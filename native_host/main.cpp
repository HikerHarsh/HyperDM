#include <iostream>
#include <string>
#include <cstdint>
#include <vector>
#include <nlohmann/json.hpp>
#include <QCoreApplication>
#include <QLocalSocket>
#include <QProcess>
#include <QThread>
#include "../src/ipc/IpcDefines.h"

#ifdef _WIN32
#include <io.h>
#include <fcntl.h>
#endif

using json = nlohmann::json;

std::string read_message() {
    uint32_t length = 0;
    std::cin.read(reinterpret_cast<char*>(&length), 4);
    
    if (std::cin.fail()) return ""; 

    std::vector<char> buffer(length);
    std::cin.read(buffer.data(), length);
    
    return std::string(buffer.begin(), buffer.end());
}

void write_message(const std::string& msg) {
    uint32_t length = static_cast<uint32_t>(msg.length());
    std::cout.write(reinterpret_cast<const char*>(&length), 4);
    std::cout << msg;
    std::cout.flush();
}

int main(int argc, char* argv[]) {
    QCoreApplication app(argc, argv); // Needed for QLocalSocket event loop handling if async

#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
#endif

    while (true) {
        std::string msg = read_message();
        if (msg.empty()) break; 

        try {
            json payload = json::parse(msg);
            
            if (payload["action"] == "download") {
                // Forward the request to the main GUI instance via IPC
                QLocalSocket socket;
                socket.connectToServer(HyperDM::IPC_SERVER_NAME);
                
                if (!socket.waitForConnected(1000)) {
                    // GUI might not be running. Start it.
                    // Assuming HyperDM_GUI is in the same directory.
                    QProcess::startDetached("HyperDM_GUI.exe", QStringList());
                    
                    // Give it a moment to start the IPC server
                    QThread::msleep(1000);
                    socket.connectToServer(HyperDM::IPC_SERVER_NAME);
                    socket.waitForConnected(2000);
                }

                if (socket.state() == QLocalSocket::ConnectedState) {
                    QByteArray block;
                    block.append(QString::fromStdString(msg).toUtf8());
                    socket.write(block);
                    socket.waitForBytesWritten();
                    socket.disconnectFromServer();
                    
                    json response = {
                        {"status", "success"},
                        {"message", "Sent to HyperDM GUI"}
                    };
                    write_message(response.dump());
                } else {
                    json error_resp = {
                        {"status", "error"},
                        {"message", "Failed to connect to HyperDM GUI"}
                    };
                    write_message(error_resp.dump());
                }
            }
            else if (payload["action"] == "getFormats") {
                std::string url = payload["url"];
                
                QProcess ytdlpProcess;
                ytdlpProcess.start("python", QStringList() << "-m" << "yt_dlp" << "-j" << "--no-warnings" << QString::fromStdString(url));
                
                if (!ytdlpProcess.waitForFinished(15000)) { // 15s timeout
                    json error_resp = {
                        {"status", "error"},
                        {"message", "Failed to load formats (timeout)."}
                    };
                    write_message(error_resp.dump());
                    continue;
                }
                
                QByteArray output = ytdlpProcess.readAllStandardOutput();
                try {
                    json info = json::parse(output.toStdString());
                    json formatList = json::array();
                    
                    std::string videoTitle = info.contains("title") ? info["title"].get<std::string>() : "Video";
                    
                    for (auto& f : info["formats"]) {
                        if (!f.contains("url") || !f.contains("resolution")) continue;
                        
                        std::string res = f["resolution"];
                        if (res == "audio only") res = "Audio";
                        
                        std::string ext = f.contains("ext") ? f["ext"].get<std::string>() : "";
                        std::string formatLabel = res + " (" + ext + ")";
                        
                        double sizeMB = 0;
                        if (f.contains("filesize") && !f["filesize"].is_null()) {
                            sizeMB = f["filesize"].get<double>() / (1024 * 1024);
                        } else if (f.contains("filesize_approx") && !f["filesize_approx"].is_null()) {
                            sizeMB = f["filesize_approx"].get<double>() / (1024 * 1024);
                        }
                        
                        if (sizeMB > 0) {
                            char sizeStr[32];
                            snprintf(sizeStr, sizeof(sizeStr), "%.1f MB", sizeMB);
                            formatLabel += std::string(" | ") + sizeStr;
                        }
                        
                        json item;
                        item["label"] = formatLabel;
                        item["url"] = f["url"];
                        item["format_id"] = f.contains("format_id") ? f["format_id"].get<std::string>() : "";
                        item["title"] = videoTitle;
                        formatList.push_back(item);
                    }
                    
                    json response = {
                        {"status", "success"},
                        {"formats", formatList}
                    };
                    write_message(response.dump());
                } catch (const std::exception& e) {
                    json error_resp = {
                        {"status", "error"},
                        {"message", "Failed to parse yt-dlp output."}
                    };
                    write_message(error_resp.dump());
                }
            }
        } catch (const std::exception& e) {
            json error_resp = {
                {"status", "error"},
                {"message", e.what()}
            };
            write_message(error_resp.dump());
        }
    }

    return 0;
}
