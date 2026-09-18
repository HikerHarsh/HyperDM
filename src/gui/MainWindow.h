#pragma once

#include <QMainWindow>
#include <QTableWidget>
#include <QPushButton>
#include <QVBoxLayout>
#include <QLocalServer>
#include <QFileDialog>
#include <QMessageBox>
#include <QInputDialog>
#include "../core/DownloadJob.h"

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override;

private slots:
    void onAddDownloadClicked();
    void onPauseDownloadClicked();
    void onResumeDownloadClicked();
    void onRemoveDownloadClicked();
    
    // IPC slot
    void onNewIpcConnection();

private:
    void setupUi();
    void setupIpc();

    QTableWidget* downloadTable;
    QPushButton* btnAdd;
    QPushButton* btnPause;
    QPushButton* btnResume;
    QPushButton* btnRemove;
    
    QLocalServer* ipcServer;
};
