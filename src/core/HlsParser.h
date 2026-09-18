#pragma once
#include <string>
#include <vector>

struct HlsSegment {
    std::string uri;
    double duration;
};

class HlsParser {
public:
    HlsParser() = default;
    ~HlsParser() = default;

    // Parses a given m3u8 manifest content and returns a list of segment URIs
    bool parse_manifest(const std::string& manifest_content, const std::string& base_url);
    
    const std::vector<HlsSegment>& get_segments() const;
    size_t get_total_segments() const;

private:
    std::vector<HlsSegment> segments;
    
    // Helper to resolve relative URIs against the base URL
    std::string resolve_url(const std::string& base_url, const std::string& relative_uri) const;
};
