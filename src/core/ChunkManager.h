#pragma once
#include <vector>
#include <cstdint>
#include <mutex>
#include <string>

struct ChunkRange {
    size_t start_byte;
    size_t end_byte;
    size_t downloaded;
    bool completed;
};

class ChunkManager {
public:
    ChunkManager(size_t total_size, int num_threads);
    ~ChunkManager() = default;

    // Get the next chunk range for a worker thread. Returns false if no chunks left.
    bool get_next_chunk(int thread_id, ChunkRange& out_range);
    
    // Update progress of a chunk
    void update_chunk_progress(int thread_id, size_t bytes_downloaded);
    
    // Mark a chunk as complete
    void mark_chunk_completed(int thread_id);
    
    double get_total_progress() const;

private:
    size_t total_size;
    int num_threads;
    std::vector<ChunkRange> chunks;
    std::mutex mtx;
};
