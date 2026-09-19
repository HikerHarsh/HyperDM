#include "MainWindow.h"
#include <QHeaderView>
#include <QHBoxLayout>
#include <QInputDialog>
#include <QMessageBox>
#include <QLocalSocket>
#include <QDialog>
#include <QVBoxLayout>
#include <QLabel>
#include <QProcess>
#include <QComboBox>
#include <QRegularExpression>
#include <nlohmann/json.hpp>
#include "../ipc/IpcDefines.h"
#include "../core/DownloadJob.h"

using json = nlohmann::json;

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setupUi();
    setupIpc();
    setWindowTitle("HyperDM - Enterprise Video Downloader");
    resize(800, 600);
}

MainWindow::~MainWindow() {
    if (ipcServer) {
        ipcServer->close();
        delete ipcServer;
    }
}

void MainWindow::setupIpc() {
    ipcServer = new QLocalServer(this);
    QLocalServer::removeServer(HyperDM::IPC_SERVER_NAME); // Clean up stale server
    if (ipcServer->listen(HyperDM::IPC_SERVER_NAME)) {
        connect(ipcServer, &QLocalServer::newConnection, this, &MainWindow::onNewIpcConnection);
    }
}

void MainWindow::onNewIpcConnection() {
    QLocalSocket* clientSocket = ipcServer->nextPendingConnection();
    connect(clientSocket, &QLocalSocket::readyRead, this, [this, clientSocket]() {
        QByteArray data = clientSocket->readAll();
        try {
            json payload = json::parse(data.toStdString());
            if (payload["action"] == "download") {
                std::string url = payload["url"];
                std::string title = payload.contains("title") ? payload["title"].get<std::string>() : "Video";
                std::string format = payload.contains("format") ? payload["format"].get<std::string>() : "";
                
                if (format == "yt-dlp") {
                    // Start yt-dlp to get formats
                    QDialog loadingDialog(this);
                    loadingDialog.setWindowTitle("HyperDM - Loading Formats");
                    QVBoxLayout* layout = new QVBoxLayout(&loadingDialog);
                    QLabel* label = new QLabel("Fetching available qualities from YouTube using yt-dlp...", &loadingDialog);
                    layout->addWidget(label);
                    loadingDialog.setFixedSize(350, 100);
                    
                    QProcess ytdlpProcess;
                    ytdlpProcess.start("python", QStringList() << "-m" << "yt_dlp" << "-j" << "--no-warnings" << QString::fromStdString(url));
                    
                    loadingDialog.show();
                    
                    // Wait for process to finish
                    if (!ytdlpProcess.waitForFinished(15000)) { // 15s timeout
                        loadingDialog.close();
                        QMessageBox::critical(this, "Error", "Failed to load formats (timeout). Is yt-dlp installed?");
                        return;
                    }
                    
                    loadingDialog.close();
                    
                    QByteArray output = ytdlpProcess.readAllStandardOutput();
                    try {
                        json info = json::parse(output.toStdString());
                        
                        QDialog selectDialog(this);
                        selectDialog.setWindowTitle("Select Video Quality");
                        QVBoxLayout* selLayout = new QVBoxLayout(&selectDialog);
                        QComboBox* combo = new QComboBox(&selectDialog);
                        
                        std::vector<std::string> formatUrls;
                        
                        for (auto& f : info["formats"]) {
                            if (!f.contains("url") || !f.contains("resolution")) continue;
                            std::string res = f["resolution"];
                            if (res == "audio only") res = "Audio";
                            std::string ext = f.contains("ext") ? f["ext"].get<std::string>() : "";
                            
                            combo->addItem(QString::fromStdString(res + " (" + ext + ")"));
                            formatUrls.push_back(f["url"]);
                        }
                        
                        selLayout->addWidget(new QLabel("Available qualities:", &selectDialog));
                        selLayout->addWidget(combo);
                        
                        QPushButton* btnOk = new QPushButton("Download", &selectDialog);
                        selLayout->addWidget(btnOk);
                        connect(btnOk, &QPushButton::clicked, &selectDialog, &QDialog::accept);
                        
                        if (selectDialog.exec() == QDialog::Accepted) {
                            int idx = combo->currentIndex();
                            if (idx >= 0 && idx < formatUrls.size()) {
                                url = formatUrls[idx];
                            } else {
                                return;
                            }
                        } else {
                            return;
                        }
                        
                    } catch (...) {
                        QMessageBox::critical(this, "Error", "Failed to parse yt-dlp output.");
                        return;
                    }
                }
                
                DownloadRequest req;
                req.url = url;
                if (payload.contains("audioUrl")) {
                    req.audio_url = payload["audioUrl"].get<std::string>();
                }
                if (payload.contains("headers")) {
                    for (auto& el : payload["headers"].items()) {
                        req.headers[el.key()] = el.value();
                    }
                }
                
                QString safeTitle = QString::fromStdString(title);
                safeTitle.replace(QRegularExpression("[\\\\/:*?\"<>|]"), "-");
                
                std::string format_id = payload.contains("format_id") ? payload["format_id"].get<std::string>() : "";
                
                // Show confirmation popup with save directory option
                QMessageBox::StandardButton reply = QMessageBox::question(this, "HyperDM - New Download",
                                      "Download this video?\n\nTitle: " + QString::fromStdString(title) + "\nQuality: " + QString::fromStdString(format),
                                      QMessageBox::Yes | QMessageBox::No);
                if (reply == QMessageBox::No) {
                    return;
                }
                
                QString savePath = QFileDialog::getSaveFileName(this, "Save Video As",
                                    QDir::homePath() + "/Downloads/" + safeTitle + ".mp4",
                                    "Videos (*.mp4 *.mkv *.ts);;All Files (*.*)");
                if (savePath.isEmpty()) {
                    return;
                }
                req.output_path = savePath.toStdString();

                // Add to table
                int row = downloadTable->rowCount();
                downloadTable->insertRow(row);
                downloadTable->setItem(row, 0, new QTableWidgetItem(QString::fromStdString(title)));
                downloadTable->setItem(row, 1, new QTableWidgetItem("Calculating..."));
                downloadTable->setItem(row, 2, new QTableWidgetItem("0%"));
                downloadTable->setItem(row, 3, new QTableWidgetItem("0 KB/s"));
                downloadTable->setItem(row, 4, new QTableWidgetItem("Starting..."));

                if (!format_id.empty()) {
                    // It's a YouTube download via yt-dlp!
                    QProcess* p = new QProcess(this);
                    
                    // -f format_id+bestaudio --merge-output-format mp4
                    QStringList args;
                    args << "-m" << "yt_dlp" 
                         << "-f" << QString::fromStdString(format_id + "+bestaudio/best")
                         << "--merge-output-format" << "mp4"
                         << "-o" << savePath
                         << "--newline"
                         << QString::fromStdString(url);
                         
                    p->start("python", args);
                    
                    connect(p, &QProcess::readyReadStandardOutput, this, [this, p, row]() {
                        QString rawOut = QString::fromUtf8(p->readAllStandardOutput());
                        QStringList lines = rawOut.split('\n', Qt::SkipEmptyParts);
                        
                        for (const QString& out : lines) {
                            if (!out.contains("[download]")) continue;
                            
                            // Parse: [download]  45.0% of 50.00MiB at 3.00MiB/s ETA 00:00
                            int percentIdx = out.indexOf("%");
                            if (percentIdx > 10) {
                                int startIdx = out.lastIndexOf(" ", percentIdx - 1);
                                if (startIdx != -1) {
                                    QString pctStr = out.mid(startIdx + 1, percentIdx - startIdx - 1);
                                    downloadTable->item(row, 2)->setText(pctStr + "%");
                                    downloadTable->item(row, 4)->setText("Downloading (yt-dlp)");
                                }
                            }
                            
                            int atIdx = out.indexOf(" at ");
                            if (atIdx != -1) {
                                int etaIdx = out.indexOf(" ETA", atIdx);
                                if (etaIdx != -1) {
                                    QString speedStr = out.mid(atIdx + 4, etaIdx - atIdx - 4).trimmed();
                                    downloadTable->item(row, 3)->setText(speedStr);
                                } else {
                                    QString speedStr = out.mid(atIdx + 4).trimmed();
                                    downloadTable->item(row, 3)->setText(speedStr);
                                }
                            }
                        }
                    });
                    
                    connect(p, &QProcess::finished, this, [this, row](int exitCode) {
                        if (exitCode == 0) {
                            downloadTable->item(row, 2)->setText("100%");
                            downloadTable->item(row, 4)->setText("Completed");
                        } else {
                            downloadTable->item(row, 4)->setText("Error (yt-dlp)");
                        }
                    });
                    
                } else {
                    // Standard DownloadJob
                    DownloadJob* job = new DownloadJob(req, this);
                    
                    connect(job, &DownloadJob::progressUpdated, this, [this, row](double percentage) {
                        downloadTable->item(row, 2)->setText(QString::number(percentage, 'f', 1) + "%");
                        downloadTable->item(row, 4)->setText("Downloading");
                    });
                    
                    connect(job, &DownloadJob::downloadCompleted, this, [this, row](const QString& path) {
                        downloadTable->item(row, 2)->setText("100%");
                        downloadTable->item(row, 4)->setText("Completed");
                    });
                    
                    connect(job, &DownloadJob::downloadError, this, [this, row](const QString& err) {
                        downloadTable->item(row, 4)->setText("Error: " + err);
                    });

                    job->start();
                }
            }
        } catch (...) {
            // parsing failed
        }
    });
    connect(clientSocket, &QLocalSocket::disconnected, clientSocket, &QLocalSocket::deleteLater);
}


void MainWindow::setupUi() {
    QWidget* centralWidget = new QWidget(this);
    QVBoxLayout* mainLayout = new QVBoxLayout(centralWidget);

    // Toolbar / Action Buttons
    QHBoxLayout* topLayout = new QHBoxLayout();
    btnAdd = new QPushButton("Add URL", this);
    btnPause = new QPushButton("Pause", this);
    btnResume = new QPushButton("Resume", this);
    btnRemove = new QPushButton("Remove", this);

    topLayout->addWidget(btnAdd);
    topLayout->addWidget(btnPause);
    topLayout->addWidget(btnResume);
    topLayout->addWidget(btnRemove);
    topLayout->addStretch();

    // Downloads Table
    downloadTable = new QTableWidget(0, 5, this);
    downloadTable->setHorizontalHeaderLabels({"File Name", "Size", "Progress", "Speed", "Status"});
    downloadTable->horizontalHeader()->setSectionResizeMode(QHeaderView::Stretch);
    downloadTable->setSelectionBehavior(QAbstractItemView::SelectRows);
    downloadTable->setEditTriggers(QAbstractItemView::NoEditTriggers);

    mainLayout->addLayout(topLayout);
    mainLayout->addWidget(downloadTable);

    setCentralWidget(centralWidget);

    // Connections
    connect(btnAdd, &QPushButton::clicked, this, &MainWindow::onAddDownloadClicked);
    connect(btnPause, &QPushButton::clicked, this, &MainWindow::onPauseDownloadClicked);
    connect(btnResume, &QPushButton::clicked, this, &MainWindow::onResumeDownloadClicked);
    connect(btnRemove, &QPushButton::clicked, this, &MainWindow::onRemoveDownloadClicked);
}

void MainWindow::onAddDownloadClicked() {
    bool ok;
    QString url = QInputDialog::getText(this, "Add Download", "Enter Video URL:", QLineEdit::Normal, "", &ok);
    if (ok && !url.isEmpty()) {
        int row = downloadTable->rowCount();
        downloadTable->insertRow(row);
        downloadTable->setItem(row, 0, new QTableWidgetItem(url));
        downloadTable->setItem(row, 1, new QTableWidgetItem("Calculating..."));
        downloadTable->setItem(row, 2, new QTableWidgetItem("0%"));
        downloadTable->setItem(row, 3, new QTableWidgetItem("0 KB/s"));
        downloadTable->setItem(row, 4, new QTableWidgetItem("Queued"));
        
        // In a real app, this would instantiate DownloadJob and connect progress signals
    }
}

void MainWindow::onPauseDownloadClicked() {
    QMessageBox::information(this, "Info", "Pause functionality to be implemented in Core.");
}

void MainWindow::onResumeDownloadClicked() {
    QMessageBox::information(this, "Info", "Resume functionality to be implemented in Core.");
}

void MainWindow::onRemoveDownloadClicked() {
    int row = downloadTable->currentRow();
    if (row >= 0) {
        downloadTable->removeRow(row);
    }
}
