// injected.js — Runs in YouTube's MAIN WORLD (can access page JS variables)
// This script extracts ytInitialPlayerResponse which contains ALL video formats

(function() {
    'use strict';
    
    function extractAndSend() {
        let playerResponse = null;
        
        // Method 1: Direct global variable
        if (window.ytInitialPlayerResponse && window.ytInitialPlayerResponse.streamingData) {
            playerResponse = window.ytInitialPlayerResponse;
        }
        
        // Method 2: From ytplayer config
        if (!playerResponse && window.ytplayer && window.ytplayer.config && window.ytplayer.config.args) {
            try {
                let raw = window.ytplayer.config.args.raw_player_response;
                if (raw && raw.streamingData) {
                    playerResponse = raw;
                }
            } catch(e) {}
        }
        
        if (!playerResponse || !playerResponse.streamingData) {
            return false;
        }
        
        let streamingData = playerResponse.streamingData;
        let videoDetails = playerResponse.videoDetails || {};
        
        let formats = [];
        
        // Combined formats (video+audio, low quality like 360p/720p)
        if (streamingData.formats) {
            for (let f of streamingData.formats) {
                formats.push({
                    itag: f.itag,
                    url: f.url || null,
                    mimeType: f.mimeType || '',
                    qualityLabel: f.qualityLabel || '',
                    quality: f.quality || '',
                    contentLength: f.contentLength || '0',
                    width: f.width || 0,
                    height: f.height || 0,
                    type: 'muxed' // has both video + audio
                });
            }
        }
        
        // Adaptive formats (separate video-only and audio-only, includes 1080p+ and 4K/8K)
        if (streamingData.adaptiveFormats) {
            for (let f of streamingData.adaptiveFormats) {
                formats.push({
                    itag: f.itag,
                    url: f.url || null,
                    mimeType: f.mimeType || '',
                    qualityLabel: f.qualityLabel || '',
                    quality: f.quality || '',
                    bitrate: f.bitrate || 0,
                    contentLength: f.contentLength || '0',
                    width: f.width || 0,
                    height: f.height || 0,
                    fps: f.fps || 0,
                    type: (f.mimeType && f.mimeType.startsWith('audio')) ? 'audio' : 'video'
                });
            }
        }
        
        // Send to content script via postMessage
        window.postMessage({
            source: 'HYPERDM_INJECTED',
            videoTitle: videoDetails.title || 'Unknown Video',
            videoDuration: videoDetails.lengthSeconds || '0',
            channelName: videoDetails.author || 'Unknown',
            formats: formats
        }, '*');
        
        return true;
    }
    
    // Try immediately
    if (!extractAndSend()) {
        // Retry a few times (YouTube loads data asynchronously)
        let retries = 0;
        let timer = setInterval(() => {
            retries++;
            if (extractAndSend() || retries > 20) {
                clearInterval(timer);
            }
        }, 500);
    }
    
    // Also listen for YouTube SPA navigation (yt-navigate-finish)
    document.addEventListener('yt-navigate-finish', () => {
        setTimeout(extractAndSend, 1500);
    });
})();
