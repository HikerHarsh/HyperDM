#include "HlsParser.h"
#include <sstream>
#include <algorithm>

bool HlsParser::parse_manifest(const std::string& manifest_content, const std::string& base_url) {
    segments.clear();
    
    std::istringstream stream(manifest_content);
    std::string line;
    
    // Validate it's an m3u8 file
    if (std::getline(stream, line)) {
        // Strip trailing \r if present
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line != "#EXTM3U") {
            return false;
        }
    } else {
        return false;
    }

    double current_duration = 0.0;
    
    while (std::getline(stream, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (line.empty()) continue;

        if (line.rfind("#EXTINF:", 0) == 0) {
            // Parse duration
            std::string duration_str = line.substr(8);
            size_t comma_pos = duration_str.find(',');
            if (comma_pos != std::string::npos) {
                duration_str = duration_str.substr(0, comma_pos);
            }
            try {
                current_duration = std::stod(duration_str);
            } catch (...) {
                current_duration = 0.0;
            }
        } else if (line[0] != '#') {
            // It's a URI
            HlsSegment segment;
            segment.duration = current_duration;
            segment.uri = resolve_url(base_url, line);
            segments.push_back(segment);
            current_duration = 0.0; // Reset for next
        }
    }
    
    return !segments.empty();
}

const std::vector<HlsSegment>& HlsParser::get_segments() const {
    return segments;
}

size_t HlsParser::get_total_segments() const {
    return segments.size();
}

std::string HlsParser::resolve_url(const std::string& base_url, const std::string& relative_uri) const {
    // If it's already an absolute URL, return it
    if (relative_uri.rfind("http://", 0) == 0 || relative_uri.rfind("https://", 0) == 0) {
        return relative_uri;
    }
    
    // Very basic relative URL resolution. 
    // In production, use a robust URL parsing library.
    std::string resolved = base_url;
    size_t last_slash = resolved.find_last_of('/');
    if (last_slash != std::string::npos) {
        resolved = resolved.substr(0, last_slash + 1);
    }
    return resolved + relative_uri;
}
