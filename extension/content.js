// content.js — Simplified IDM Architecture
// Only detects video and sends the page URL to the C++ app

let downloadBtn = null;
let hoverTimer = null;
let isMouseOverBtn = false;

function createUI() {
    if (downloadBtn) return;
    
    downloadBtn = document.createElement('button');
    downloadBtn.className = 'hyperdm-download-btn';
    downloadBtn.innerHTML = '⬇ Download this video';
    downloadBtn.style.position = 'absolute';
    downloadBtn.style.display = 'none';
    document.body.appendChild(downloadBtn);
    
    downloadBtn.addEventListener('mouseenter', () => { isMouseOverBtn = true; });
    downloadBtn.addEventListener('mouseleave', () => { isMouseOverBtn = false; });
    
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        let videoUrl = window.location.href;
        
        // Send directly to C++ App
        chrome.runtime.sendMessage({
            action: "downloadMedia",
            media: {
                url: videoUrl,
                title: document.title.replace(' - YouTube', ''),
                format: "yt-dlp",
                contentLength: 0,
                headers: {}
            }
        }, () => {
            downloadBtn.style.display = 'none';
            alert("Sent to HyperDM! Please check the app.");
        });
    });
}

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
    } else if (!isMouseOverBtn) {
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (!isMouseOverBtn) {
                    downloadBtn.style.display = 'none';
                }
            }, 1000);
        }
    }
});
