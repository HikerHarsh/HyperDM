// content.js — Runs in ISOLATED WORLD
// Injects injected.js into MAIN WORLD, receives format data, shows IDM-style hover UI

let downloadBtn = null;
let dropdown = null;
let videoFormats = [];
let videoTitle = 'Unknown Video';
let hoverTimer = null;
let isMouseOverUI = false;

// ==================== STEP 1: Inject Main World Script ====================
function injectMainWorldScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = () => script.remove(); // Clean up
    (document.head || document.documentElement).appendChild(script);
}

injectMainWorldScript();

// Re-inject on YouTube SPA navigation
const observer = new MutationObserver(() => {
    let url = location.href;
    if (observer._lastUrl !== url) {
        observer._lastUrl = url;
        videoFormats = []; // Reset
        setTimeout(injectMainWorldScript, 1000);
    }
});
observer._lastUrl = location.href;
observer.observe(document.body, { childList: true, subtree: true });

// ==================== STEP 2: Listen for Format Data from Injected Script ====================
window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== 'HYPERDM_INJECTED') return;
    
    videoTitle = event.data.videoTitle || 'Unknown Video';
    let rawFormats = event.data.formats || [];
    
    // Process and clean up formats for display
    videoFormats = [];
    for (let f of rawFormats) {
        if (!f.url) continue; // Skip formats without direct URL (cipher/signature required)
        
        let label = '';
        let sizeBytes = parseInt(f.contentLength) || 0;
        let sizeMB = sizeBytes > 0 ? (sizeBytes / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown size';
        
        if (f.type === 'muxed') {
            label = '🎬 ' + (f.qualityLabel || f.quality) + ' (Video+Audio) — ' + sizeMB;
        } else if (f.type === 'audio') {
            let bitrate = f.bitrate ? Math.round(f.bitrate / 1000) + 'kbps' : '';
            label = '🔊 Audio ' + bitrate + ' — ' + sizeMB;
        } else {
            label = '🎥 ' + (f.qualityLabel || f.quality || f.height + 'p') + ' (Video Only) — ' + sizeMB;
        }
        
        videoFormats.push({
            label: label,
            url: f.url,
            qualityLabel: f.qualityLabel || '',
            contentLength: sizeBytes,
            mimeType: f.mimeType || '',
            type: f.type
        });
    }
    
    // Sort: muxed first, then video by height desc, then audio
    videoFormats.sort((a, b) => {
        if (a.type === 'muxed' && b.type !== 'muxed') return -1;
        if (a.type !== 'muxed' && b.type === 'muxed') return 1;
        if (a.type === 'audio' && b.type !== 'audio') return 1;
        if (a.type !== 'audio' && b.type === 'audio') return -1;
        return b.contentLength - a.contentLength;
    });
});

// ==================== STEP 3: IDM-Style Hover UI ====================
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
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (videoFormats.length === 0) {
            // Retry injection
            injectMainWorldScript();
            setTimeout(() => {
                if (videoFormats.length === 0) {
                    alert('Formats load nahi hue! Page refresh karke dobara try karein.');
                }
            }, 2000);
            return;
        }
        
        dropdown.innerHTML = '';
        
        // Title header
        let header = document.createElement('div');
        header.style.cssText = 'padding:8px 12px;font-weight:bold;border-bottom:2px solid #0078D7;color:#0078D7;font-size:13px;';
        header.textContent = '📹 ' + videoTitle;
        dropdown.appendChild(header);
        
        for (let fmt of videoFormats) {
            let item = document.createElement('div');
            item.className = 'hyperdm-dropdown-item';
            item.textContent = fmt.label;
            
            item.addEventListener('click', (ev) => {
                ev.stopPropagation();
                
                // Send to C++ app via Native Messaging
                chrome.runtime.sendMessage({
                    action: "downloadMedia",
                    media: {
                        url: fmt.url,
                        format: fmt.label,
                        title: videoTitle,
                        mimeType: fmt.mimeType,
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

// ==================== STEP 4: Mouse Hover Detection ====================
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
