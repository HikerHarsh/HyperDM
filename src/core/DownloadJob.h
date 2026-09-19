#pragma once
#include <QObject>
#include <QString>
#include <string>
#include <vector>
#include <map>
#include <atomic>
#include <mutex>
#include "ChunkManager.h"

struct DownloadRequest {
    std::string url;
    std::string audio_url; // Optional: For YouTube separate audio stream
    std::string output_path;
    std::map<std::string, std::string> headers;
    int num_threads = 8;
};

class DownloadJob : public QObject {
    Q_OBJECT
public:
    explicit DownloadJob(const DownloadRequest& req, QObject* parent = nullptr);
    ~DownloadJob() override;

    void start();

signals:
    void progressUpdated(double percentage);
    void downloadCompleted(const QString& finalFilePath);
    void downloadError(const QString& errorMessage);

private:
    void worker_thread(int thread_id);
    void merge_chunks();
    void fetch_file_size();

    DownloadRequest request;
    size_t total_size = 0;
    std::atomic<bool> is_running;
    ChunkManager* chunk_manager = nullptr;
    
    std::atomic<int> active_threads;
    std::mutex mtx;
    std::string temp_dir;
};
