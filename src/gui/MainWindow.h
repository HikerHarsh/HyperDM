#pragma once

#include <QMainWindow>
#include <QTableWidget>
#include <QPushButton>
#include <QVBoxLayout>

class MainWindow : public QMainWindow {
    Q_OBJECT

public:
    explicit MainWindow(QWidget *parent = nullptr);
    ~MainWindow() override = default;

private slots:
    void onAddDownloadClicked();
    void onPauseDownloadClicked();
    void onResumeDownloadClicked();
    void onRemoveDownloadClicked();

private:
    void setupUi();

    QTableWidget* downloadTable;
    QPushButton* btnAdd;
    QPushButton* btnPause;
    QPushButton* btnResume;
    QPushButton* btnRemove;
};
