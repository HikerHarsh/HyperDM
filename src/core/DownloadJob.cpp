#include "DownloadJob.h"
#include <iostream>
#include <thread>
#include <curl/curl.h>
#include <QDir>
#include <QFile>
#include <QStandardPaths>

struct ThreadContext {
    FILE* fp;
    DownloadJob* job;
    int thread_id;
};

static size_t write_data_callback(void* ptr, size_t size, size_t nmemb, void* userdata) {
    ThreadContext* ctx = static_cast<ThreadContext*>(userdata);
    size_t realsize = size * nmemb;
    if (ctx && ctx->fp) {
        fwrite(ptr, size, nmemb, ctx->fp);
        
        // Report progress
        if (ctx->job) {
            // (We will update chunk progress via chunk_manager directly in a cleaner way, 
            // but for simplicity we do it via a thread-safe call if needed. 
            // Actually, libcurl's xferinfo callback is better for progress.)
        }
    }
    return realsize;
}

static int progress_callback(void *clientp, curl_off_t dltotal, curl_off_t dlnow, curl_off_t ultotal, curl_off_t ulnow) {
    ThreadContext* ctx = static_cast<ThreadContext*>(clientp);
    if (ctx && ctx->job) {
        // We could report per-chunk progress here if needed.
    }
    return 0;
}

DownloadJob::DownloadJob(const DownloadRequest& req, QObject* parent) 
    : QObject(parent), request(req), is_running(false), active_threads(0) {
    
    // Set default output path if empty
    if (request.output_path.empty()) {
        QString downloadsDir = QStandardPaths::writableLocation(QStandardPaths::DownloadLocation);
        request.output_path = downloadsDir.toStdString() + "/video_download.mp4"; // Hardcoded for MVP
    }
    temp_dir = request.output_path + "_tmp";
    QDir().mkpath(QString::fromStdString(temp_dir));
}

DownloadJob::~DownloadJob() {
    is_running = false;
    if (chunk_manager) delete chunk_manager;
}

void DownloadJob::fetch_file_size() {
    CURL* curl = curl_easy_init();
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, request.url.c_str());
        curl_easy_setopt(curl, CURLOPT_NOBODY, 1L); // HEAD request
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
        
        struct curl_slist* headers = NULL;
        for (const auto& [key, value] : request.headers) {
            std::string header = key + ": " + value;
            headers = curl_slist_append(headers, header.c_str());
        }
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        
        CURLcode res = curl_easy_perform(curl);
        if (res == CURLE_OK) {
            curl_off_t cl;
            res = curl_easy_getinfo(curl, CURLINFO_CONTENT_LENGTH_DOWNLOAD_T, &cl);
            if (res == CURLE_OK && cl > 0) {
                total_size = static_cast<size_t>(cl);
            }
        }
        
        // IDM Hack: If HEAD fails or gives 0 size (like YouTube), try GET with Range 0-0
        if (total_size == 0) {
            curl_easy_setopt(curl, CURLOPT_NOBODY, 0L); // Change to GET
            curl_easy_setopt(curl, CURLOPT_RANGE, "0-0"); // Ask for 1 byte
            
            // We just need headers to parse Content-Range
            curl_easy_setopt(curl, CURLOPT_HEADERFUNCTION, +[](char* buffer, size_t size, size_t nitems, void* userdata) -> size_t {
                std::string header(buffer, size * nitems);
                if (header.find("Content-Range:") != std::string::npos) {
                    size_t slash_pos = header.find("/");
                    if (slash_pos != std::string::npos) {
                        std::string size_str = header.substr(slash_pos + 1);
                        size_t* ts = static_cast<size_t*>(userdata);
                        try { *ts = std::stoull(size_str); } catch(...) {}
                    }
                }
                return size * nitems;
            });
            curl_easy_setopt(curl, CURLOPT_HEADERDATA, &total_size);
            
            // Discard the 1 byte body
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, +[](void*, size_t s, size_t n, void*) -> size_t { return s * n; });
            
            curl_easy_perform(curl);
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
}

void DownloadJob::start() {
    if (is_running) return;
    is_running = true;

    // Run the main orchestration in a detached thread so we don't block GUI
    std::thread([this]() {
        fetch_file_size();
        if (total_size == 0) {
            emit downloadError("Failed to get file size or file is 0 bytes.");
            is_running = false;
            return;
        }

        int num_threads = 8; // Default to 8 threads
        chunk_manager = new ChunkManager(total_size, num_threads);
        
        active_threads = num_threads;
        
        for (int i = 0; i < num_threads; ++i) {
            std::thread(&DownloadJob::worker_thread, this, i).detach();
        }
    }).detach();
}

void DownloadJob::worker_thread(int thread_id) {
    ChunkRange range;
    if (!chunk_manager->get_next_chunk(thread_id, range)) {
        active_threads--;
        return;
    }

    std::string chunk_file = temp_dir + "/part_" + std::to_string(thread_id);
    FILE* fp = fopen(chunk_file.c_str(), "wb");
    if (!fp) {
        active_threads--;
        return;
    }

    ThreadContext ctx = {fp, this, thread_id};

    CURL* curl = curl_easy_init();
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, request.url.c_str());
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L); // Bypass SSL cert checks for MVP robustness
        
        std::string range_str = std::to_string(range.start_byte) + "-" + std::to_string(range.end_byte);
        curl_easy_setopt(curl, CURLOPT_RANGE, range_str.c_str());
        
        struct curl_slist* headers = NULL;
        for (const auto& [key, value] : request.headers) {
            std::string header = key + ": " + value;
            headers = curl_slist_append(headers, header.c_str());
        }
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_data_callback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &ctx);
        
        // Setup progress callback
        curl_easy_setopt(curl, CURLOPT_NOPROGRESS, 0L);
        curl_easy_setopt(curl, CURLOPT_XFERINFOFUNCTION, progress_callback);
        curl_easy_setopt(curl, CURLOPT_XFERINFODATA, &ctx);

        CURLcode res = curl_easy_perform(curl);
        
        if (res == CURLE_OK) {
            chunk_manager->mark_chunk_completed(thread_id);
            // Rough global progress emission
            emit progressUpdated(chunk_manager->get_total_progress() * 100.0);
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
    }
    fclose(fp);

    int remaining = --active_threads;
    if (remaining == 0) {
        merge_chunks();
    }
}

void DownloadJob::merge_chunks() {
    std::string final_file = request.output_path;
    FILE* out_fp = fopen(final_file.c_str(), "wb");
    if (!out_fp) {
        emit downloadError("Failed to open output file for merging.");
        return;
    }

    for (int i = 0; i < 8; ++i) { // 8 threads
        std::string part_file = temp_dir + "/part_" + std::to_string(i);
        FILE* in_fp = fopen(part_file.c_str(), "rb");
        if (in_fp) {
            char buffer[8192];
            size_t bytes;
            while ((bytes = fread(buffer, 1, sizeof(buffer), in_fp)) > 0) {
                fwrite(buffer, 1, bytes, out_fp);
            }
            fclose(in_fp);
            QFile::remove(QString::fromStdString(part_file)); // Cleanup
        }
    }
    fclose(out_fp);
    
    // Remove temp dir
    QDir().rmdir(QString::fromStdString(temp_dir));

    emit progressUpdated(100.0);
    emit downloadCompleted(QString::fromStdString(final_file));
    is_running = false;
}
