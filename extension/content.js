// content.js — Uses YouTube's Internal API (Innertube) for bulletproof format extraction
// This is the same API that YouTube's own player uses internally

let downloadBtn = null;
let dropdown = null;
let videoFormats = [];
let videoTitle = 'Unknown Video';
let hoverTimer = null;
let isMouseOverUI = false;
let lastVideoId = '';

// ==================== STEP 1: Extract Formats via YouTube Innertube API ====================
async function extractFormats() {
    let urlParams = new URLSearchParams(window.location.search);
    let videoId = urlParams.get('v');
    
    if (!videoId) return;
    if (videoId === lastVideoId && videoFormats.length > 0) return;
    lastVideoId = videoId;
    videoFormats = [];
    
    try {
        // YouTube's internal player API — same one the player uses
        let apiResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: 'WEB',
                        clientVersion: '2.20240101.00.00',
                        hl: 'en',
                        gl: 'US'
                    }
                },
                videoId: videoId
            }),
            credentials: 'include'
        });
        
        let data = await apiResponse.json();
        
        if (!data.streamingData) {
            console.error('HyperDM: No streamingData in API response');
            return;
        }
        
        let streamingData = data.streamingData;
        videoTitle = (data.videoDetails && data.videoDetails.title) || 'Unknown Video';
        
        // Process muxed formats (video+audio combined)
        if (streamingData.formats) {
            for (let f of streamingData.formats) {
                if (!f.url) continue;
                let sizeBytes = parseInt(f.contentLength) || 0;
                let sizeMB = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '';
                
                videoFormats.push({
                    label: '🎬 ' + (f.qualityLabel || f.quality || '?') + ' (Video+Audio)' + (sizeMB ? ' — ' + sizeMB : ''),
                    url: f.url,
                    contentLength: sizeBytes,
                    type: 'muxed',
                    height: f.height || 0
                });
            }
        }
        
        // Process adaptive formats (HD/4K/8K video-only, audio-only)
        if (streamingData.adaptiveFormats) {
            for (let f of streamingData.adaptiveFormats) {
                if (!f.url) continue;
                let sizeBytes = parseInt(f.contentLength) || 0;
                let sizeMB = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '';
                let isAudio = f.mimeType && f.mimeType.startsWith('audio');
                
                if (isAudio) {
                    let bitrate = f.bitrate ? Math.round(f.bitrate / 1000) + 'kbps' : '';
                    let codec = '';
                    if (f.mimeType.includes('opus')) codec = 'opus';
                    else if (f.mimeType.includes('mp4a')) codec = 'm4a';
                    
                    videoFormats.push({
                        label: '🔊 Audio ' + bitrate + (codec ? ' (' + codec + ')' : '') + (sizeMB ? ' — ' + sizeMB : ''),
                        url: f.url,
                        contentLength: sizeBytes,
                        type: 'audio',
                        height: 0
                    });
                } else {
                    let fps = f.fps ? ' ' + f.fps + 'fps' : '';
                    let codec = '';
                    if (f.mimeType) {
                        if (f.mimeType.includes('avc1')) codec = 'H.264';
                        else if (f.mimeType.includes('vp9') || f.mimeType.includes('vp09')) codec = 'VP9';
                        else if (f.mimeType.includes('av01')) codec = 'AV1';
                    }
                    
                    videoFormats.push({
                        label: '🎥 ' + (f.qualityLabel || f.height + 'p') + fps + (codec ? ' ' + codec : '') + ' (Video Only)' + (sizeMB ? ' — ' + sizeMB : ''),
                        url: f.url,
                        contentLength: sizeBytes,
                        type: 'video',
                        height: f.height || 0
                    });
                }
            }
        }
        
        // Sort: muxed first, then video by height desc, then audio by bitrate desc
        videoFormats.sort((a, b) => {
            if (a.type === 'muxed' && b.type !== 'muxed') return -1;
            if (a.type !== 'muxed' && b.type === 'muxed') return 1;
            if (a.type === 'audio' && b.type !== 'audio') return 1;
            if (a.type !== 'audio' && b.type === 'audio') return -1;
            return b.height - a.height;
        });
        
        console.log('HyperDM: Found ' + videoFormats.length + ' formats for "' + videoTitle + '"');
        
    } catch (err) {
        console.error('HyperDM: Error calling YouTube API:', err);
    }
}

// Extract on load
extractFormats();

// Re-extract on YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
    lastVideoId = '';
    setTimeout(extractFormats, 1000);
});

// Watch URL changes
let navObserver = new MutationObserver(() => {
    let urlParams = new URLSearchParams(window.location.search);
    let currentId = urlParams.get('v');
    if (currentId && currentId !== lastVideoId) {
        setTimeout(extractFormats, 500);
    }
});
navObserver.observe(document.body, { childList: true, subtree: true });

// ==================== STEP 2: IDM-Style Hover UI ====================
function createUI() {
    if (downloadBtn) return;
    
    downloadBtn = document.createElement('button');
    downloadBtn.className = 'hyperdm-download-btn';
    downloadBtn.innerHTML = '⬇ Download this video';
    downloadBtn.style.position = 'absolute';
    downloadBtn.style.display = 'none';
    document.body.appendChild(downloadBtn);
    
    dropdown = document.createElement('div');
    dropdown.className = 'hyperdm-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);
    
    downloadBtn.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    downloadBtn.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    dropdown.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    dropdown.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    
    downloadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (videoFormats.length === 0) {
            await extractFormats();
        }
        
        if (videoFormats.length === 0) {
            alert('Koi format nahi mila. Page refresh (Ctrl+F5) karke dobara try karein.');
            return;
        }
        
        dropdown.innerHTML = '';
        
        // Title header
        let header = document.createElement('div');
        header.style.cssText = 'padding:10px 14px;font-weight:bold;border-bottom:2px solid #0078D7;color:#0078D7;font-size:13px;background:#111;border-radius:8px 8px 0 0;';
        header.textContent = '📹 ' + videoTitle;
        dropdown.appendChild(header);
        
        for (let fmt of videoFormats) {
            let item = document.createElement('div');
            item.className = 'hyperdm-dropdown-item';
            item.textContent = fmt.label;
            
            item.addEventListener('click', (ev) => {
                ev.stopPropagation();
                chrome.runtime.sendMessage({
                    action: "downloadMedia",
                    media: {
                        url: fmt.url,
                        format: fmt.label,
                        title: videoTitle,
                        contentLength: fmt.contentLength,
                        headers: {}
                    }
                }, () => {
                    dropdown.style.display = 'none';
                    downloadBtn.style.display = 'none';
                });
            });
            
            dropdown.appendChild(item);
        }
        
        const rect = downloadBtn.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        dropdown.style.left = (rect.left + window.scrollX) + 'px';
        dropdown.style.display = 'block';
    });
    
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

// ==================== STEP 3: Mouse Hover ====================
document.addEventListener('mousemove', (e) => {
    let target = e.target;
    let isOverVideo = target && target.tagName && target.tagName.toLowerCase() === 'video';
    
    if (isOverVideo) {
        createUI();
        const rect = target.getBoundingClientRect();
        downloadBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
        downloadBtn.style.left = (rect.right + window.scrollX - 195) + 'px';
        downloadBtn.style.display = 'flex';
        clearTimeout(hoverTimer);
    } else if (!isMouseOverUI) {
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (!isMouseOverUI) {
                    downloadBtn.style.display = 'none';
                    dropdown.style.display = 'none';
                }
            }, 1500);
        }
    }
});
