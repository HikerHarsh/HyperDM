let downloadBtn = null;
let dropdown = null;
let cachedMedia = [];
let hoverTimer = null;
let currentVideo = null;

function createUI() {
    if (downloadBtn) return;
    
    // The main hover button
    downloadBtn = document.createElement('button');
    downloadBtn.className = 'hyperdm-download-btn';
    downloadBtn.innerHTML = '⬇ Download this video';
    downloadBtn.style.position = 'absolute';
    downloadBtn.style.display = 'none';
    document.body.appendChild(downloadBtn);
    
    // The dropdown menu
    dropdown = document.createElement('div');
    dropdown.className = 'hyperdm-dropdown';
    dropdown.style.position = 'absolute';
    dropdown.style.display = 'none';
    document.body.appendChild(dropdown);
    
    // Click on the download button
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        chrome.runtime.sendMessage({action: "getMediaList"}, (response) => {
            cachedMedia = response ? (response.media || []) : [];
            
            if (cachedMedia.length === 0) {
                alert("Koi stream catch nahi hui! Video quality change karke dekhein.");
                return;
            }
            
            dropdown.innerHTML = '';
            cachedMedia.forEach((media, index) => {
                let item = document.createElement('div');
                item.className = 'hyperdm-dropdown-item';
                item.innerHTML = `<span>${media.format}</span>`;
                
                item.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    chrome.runtime.sendMessage({
                        action: "downloadMedia",
                        media: media
                    }, () => {
                        dropdown.style.display = 'none';
                        downloadBtn.style.display = 'none';
                    });
                });
                
                dropdown.appendChild(item);
            });
            
            const rect = downloadBtn.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + window.scrollY + 5) + 'px';
            dropdown.style.left = (rect.left + window.scrollX) + 'px';
            dropdown.style.display = 'block';
        });
    });
    
    // Hide dropdown on outside click
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

// Watch for mouse movements to show the button over videos
document.addEventListener('mousemove', (e) => {
    let target = e.target;
    
    // Check if we are hovering over a video or our own UI
    let isOverVideo = target && target.tagName && target.tagName.toLowerCase() === 'video';
    let isOverUI = target === downloadBtn || target === dropdown || (dropdown && dropdown.contains(target));
    
    if (isOverVideo) {
        createUI();
        currentVideo = target;
        const rect = currentVideo.getBoundingClientRect();
        
        // Position at the top-right of the video element
        downloadBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
        downloadBtn.style.left = (rect.right + window.scrollX - 180) + 'px'; // roughly button width
        downloadBtn.style.display = 'flex';
        
        clearTimeout(hoverTimer);
    } else if (!isOverUI) {
        // If mouse leaves the video and UI, hide after 2 seconds
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                downloadBtn.style.display = 'none';
                dropdown.style.display = 'none';
            }, 2000);
        }
    }
});

