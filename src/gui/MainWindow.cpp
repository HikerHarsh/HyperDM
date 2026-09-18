#include "MainWindow.h"
#include <QHeaderView>
#include <QHBoxLayout>
#include <QInputDialog>
#include <QMessageBox>
#include <QLocalSocket>
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
                int row = downloadTable->rowCount();
                downloadTable->insertRow(row);
                downloadTable->setItem(row, 0, new QTableWidgetItem(QString::fromStdString(url)));
                downloadTable->setItem(row, 1, new QTableWidgetItem("Calculating..."));
                downloadTable->setItem(row, 2, new QTableWidgetItem("0%"));
                downloadTable->setItem(row, 3, new QTableWidgetItem("0 KB/s"));
                downloadTable->setItem(row, 4, new QTableWidgetItem("Queued"));
                
                // TODO: Instantiate DownloadJob and bind signals
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
