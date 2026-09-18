#include <iostream>
#include <string>
#include <cstdint>
#include <vector>
#include <nlohmann/json.hpp>
#include <curl/curl.h>
#include "../src/core/DownloadJob.h"

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

int main() {
#ifdef _WIN32
    _setmode(_fileno(stdin), _O_BINARY);
    _setmode(_fileno(stdout), _O_BINARY);
#endif

    curl_global_init(CURL_GLOBAL_ALL);

    while (true) {
        std::string msg = read_message();
        if (msg.empty()) break; 

        try {
            json payload = json::parse(msg);
            
            if (payload["action"] == "download") {
                DownloadRequest req;
                req.url = payload["url"];
                
                if (payload.contains("headers")) {
                    for (auto& el : payload["headers"].items()) {
                        req.headers[el.key()] = el.value();
                    }
                }
                
                // For Phase 2, we just instantiate and start (blocking for now)
                DownloadJob job(req);
                job.start();
                
                json response = {
                    {"status", "success"},
                    {"message", "Download job started successfully"}
                };
                write_message(response.dump());
            }
        } catch (const std::exception& e) {
            json error_resp = {
                {"status", "error"},
                {"message", e.what()}
            };
            write_message(error_resp.dump());
        }
    }

    curl_global_cleanup();
    return 0;
}
