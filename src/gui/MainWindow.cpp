#include "MainWindow.h"
#include <QHeaderView>
#include <QHBoxLayout>
#include <QInputDialog>
#include <QMessageBox>

MainWindow::MainWindow(QWidget *parent) : QMainWindow(parent) {
    setupUi();
    setWindowTitle("HyperDM - Enterprise Video Downloader");
    resize(800, 600);
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
