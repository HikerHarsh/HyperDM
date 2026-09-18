#pragma once
#include <string>
#include <vector>
#include <map>

struct DownloadRequest {
    std::string url;
    std::map<std::string, std::string> headers;
    std::string user_agent;
    std::string referer;
    std::string cookie;
    std::string output_path;
};

class DownloadJob {
public:
    DownloadJob(const DownloadRequest& req);
    ~DownloadJob();

    void start();
    void pause();
    void resume();
    
    double get_progress() const;
    
private:
    void worker_thread(int chunk_index, size_t start_byte, size_t end_byte);
    
    DownloadRequest request;
    size_t total_size = 0;
    std::vector<size_t> chunk_progress;
};
