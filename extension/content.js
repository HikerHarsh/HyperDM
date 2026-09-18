let downloadBtn = null;
let dropdown = null;
let cachedMedia = [];
let hoverTimer = null;
let currentVideo = null;
let isMouseOverUI = false;

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
    
    // Keep UI visible when mouse is over it
    downloadBtn.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    downloadBtn.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    dropdown.addEventListener('mouseenter', () => { isMouseOverUI = true; });
    dropdown.addEventListener('mouseleave', () => { isMouseOverUI = false; });
    
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
    
    // Check if we are hovering over a video
    let isOverVideo = target && target.tagName && target.tagName.toLowerCase() === 'video';
    
    if (isOverVideo) {
        createUI();
        currentVideo = target;
        const rect = currentVideo.getBoundingClientRect();
        
        // Position at the top-right of the video element
        downloadBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
        downloadBtn.style.left = (rect.right + window.scrollX - 180) + 'px'; // roughly button width
        downloadBtn.style.display = 'flex';
        
        clearTimeout(hoverTimer);
    } else if (!isMouseOverUI) {
        // If mouse leaves the video and is NOT over our UI, start the hide timer
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (!isMouseOverUI) { // double check before hiding
                    downloadBtn.style.display = 'none';
                    dropdown.style.display = 'none';
                }
            }, 1000);
        }
    }
});

