// content.js — Runs in ISOLATED WORLD
// Fetches YouTube page HTML to extract video formats reliably

let downloadBtn = null;
let dropdown = null;
let videoFormats = [];
let videoTitle = 'Unknown Video';
let hoverTimer = null;
let isMouseOverUI = false;
let lastVideoId = '';

// ==================== STEP 1: Extract Formats by Fetching Page HTML ====================
async function extractFormats() {
    let videoId = '';
    
    // Get video ID from URL
    let urlParams = new URLSearchParams(window.location.search);
    videoId = urlParams.get('v');
    
    if (!videoId) return;
    if (videoId === lastVideoId && videoFormats.length > 0) return; // Already extracted
    lastVideoId = videoId;
    videoFormats = [];
    
    try {
        // Fetch the page HTML directly - this always contains ytInitialPlayerResponse
        let response = await fetch('https://www.youtube.com/watch?v=' + videoId, {
            credentials: 'include' // Include cookies for age-restricted/premium content
        });
        let html = await response.text();
        
        // Extract ytInitialPlayerResponse from HTML
        let playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        if (!playerMatch) {
            // Try alternative pattern
            playerMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
        }
        
        if (!playerMatch) {
            console.error('HyperDM: Could not find ytInitialPlayerResponse in page');
            return;
        }
        
        let playerResponse = JSON.parse(playerMatch[1]);
        let streamingData = playerResponse.streamingData;
        let videoDetails = playerResponse.videoDetails || {};
        
        if (!streamingData) {
            console.error('HyperDM: No streamingData found');
            return;
        }
        
        videoTitle = videoDetails.title || 'Unknown Video';
        
        // Process muxed formats (video+audio combined, usually 360p/720p)
        if (streamingData.formats) {
            for (let f of streamingData.formats) {
                if (!f.url) continue;
                let sizeBytes = parseInt(f.contentLength) || 0;
                let sizeMB = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '';
                
                videoFormats.push({
                    label: '🎬 ' + (f.qualityLabel || f.quality || 'Unknown') + ' (Video+Audio)' + (sizeMB ? ' — ' + sizeMB : ''),
                    url: f.url,
                    contentLength: sizeBytes,
                    type: 'muxed',
                    height: f.height || 0
                });
            }
        }
        
        // Process adaptive formats (separate video/audio, includes HD/4K/8K)
        if (streamingData.adaptiveFormats) {
            for (let f of streamingData.adaptiveFormats) {
                if (!f.url) continue;
                let sizeBytes = parseInt(f.contentLength) || 0;
                let sizeMB = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : '';
                let isAudio = f.mimeType && f.mimeType.startsWith('audio');
                
                if (isAudio) {
                    let bitrate = f.bitrate ? Math.round(f.bitrate / 1000) + 'kbps' : '';
                    videoFormats.push({
                        label: '🔊 Audio ' + bitrate + (sizeMB ? ' — ' + sizeMB : ''),
                        url: f.url,
                        contentLength: sizeBytes,
                        type: 'audio',
                        height: 0
                    });
                } else {
                    let fps = f.fps ? f.fps + 'fps' : '';
                    videoFormats.push({
                        label: '🎥 ' + (f.qualityLabel || f.height + 'p') + ' ' + fps + ' (Video Only)' + (sizeMB ? ' — ' + sizeMB : ''),
                        url: f.url,
                        contentLength: sizeBytes,
                        type: 'video',
                        height: f.height || 0
                    });
                }
            }
        }
        
        // Sort: muxed first, then video by height desc, then audio
        videoFormats.sort((a, b) => {
            if (a.type === 'muxed' && b.type !== 'muxed') return -1;
            if (a.type !== 'muxed' && b.type === 'muxed') return 1;
            if (a.type === 'audio' && b.type !== 'audio') return 1;
            if (a.type !== 'audio' && b.type === 'audio') return -1;
            return b.height - a.height;
        });
        
        console.log('HyperDM: Found ' + videoFormats.length + ' formats for "' + videoTitle + '"');
        
    } catch (err) {
        console.error('HyperDM: Error extracting formats:', err);
    }
}

// Extract on load
extractFormats();

// Re-extract on YouTube SPA navigation
document.addEventListener('yt-navigate-finish', () => {
    lastVideoId = ''; // Force re-extract
    setTimeout(extractFormats, 1000);
});

// Also watch URL changes via MutationObserver
let navObserver = new MutationObserver(() => {
    let urlParams = new URLSearchParams(window.location.search);
    let currentId = urlParams.get('v');
    if (currentId && currentId !== lastVideoId) {
        setTimeout(extractFormats, 1000);
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
    
    // Keep UI visible when mouse is over it
    downloadBtn.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    downloadBtn.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    dropdown.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    dropdown.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    
    // Click handler
    downloadBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // If no formats yet, try extracting now
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
    
    // Hide on outside click
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

// ==================== STEP 3: Mouse Hover Detection ====================
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
