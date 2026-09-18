#include "ChunkManager.h"
#include <iostream>
#include <algorithm>

ChunkManager::ChunkManager(size_t total_size, int num_threads) 
    : total_size(total_size), num_threads(num_threads) {
    
    if (num_threads <= 0) num_threads = 1;
    
    size_t chunk_size = total_size / num_threads;
    size_t remainder = total_size % num_threads;

    for (int i = 0; i < num_threads; ++i) {
        ChunkRange range;
        range.start_byte = i * chunk_size;
        range.end_byte = (i == num_threads - 1) ? (range.start_byte + chunk_size + remainder - 1) : (range.start_byte + chunk_size - 1);
        range.downloaded = 0;
        range.completed = false;
        chunks.push_back(range);
    }
}

bool ChunkManager::get_next_chunk(int thread_id, ChunkRange& out_range) {
    std::lock_guard<std::mutex> lock(mtx);
    if (thread_id >= 0 && thread_id < chunks.size()) {
        if (!chunks[thread_id].completed) {
            out_range = chunks[thread_id];
            return true;
        }
    }
    return false;
}

void ChunkManager::update_chunk_progress(int thread_id, size_t bytes_downloaded) {
    std::lock_guard<std::mutex> lock(mtx);
    if (thread_id >= 0 && thread_id < chunks.size()) {
        chunks[thread_id].downloaded += bytes_downloaded;
    }
}

void ChunkManager::mark_chunk_completed(int thread_id) {
    std::lock_guard<std::mutex> lock(mtx);
    if (thread_id >= 0 && thread_id < chunks.size()) {
        chunks[thread_id].completed = true;
        chunks[thread_id].downloaded = chunks[thread_id].end_byte - chunks[thread_id].start_byte + 1;
    }
}

double ChunkManager::get_total_progress() const {
    std::lock_guard<std::mutex> lock(mtx);
    size_t total_downloaded = 0;
    for (const auto& chunk : chunks) {
        total_downloaded += chunk.downloaded;
    }
    if (total_size == 0) return 0.0;
    return (double)total_downloaded / total_size;
}
