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

// Track mouse position globally
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function checkHover() {
    let isOverUI = false;
    
    // Check if mouse is over our own button or dropdown
    if (downloadBtn && downloadBtn.style.display !== 'none') {
        let btnRect = downloadBtn.getBoundingClientRect();
        if (mouseX >= btnRect.left && mouseX <= btnRect.right && mouseY >= btnRect.top && mouseY <= btnRect.bottom) {
            isOverUI = true;
        }
    }
    if (dropdown && dropdown.style.display !== 'none') {
        let dropRect = dropdown.getBoundingClientRect();
        if (mouseX >= dropRect.left && mouseX <= dropRect.right && mouseY >= dropRect.top && mouseY <= dropRect.bottom) {
            isOverUI = true;
        }
    }
    
    // If dropdown is open, keep everything visible
    if (dropdown && dropdown.style.display === 'block') {
        return;
    }

    if (isOverUI) {
        clearTimeout(hoverTimer);
        return;
    }

    const videos = document.querySelectorAll('video');
    let foundVideo = false;

    for (let i = 0; i < videos.length; i++) {
        let video = videos[i];
        let rect = video.getBoundingClientRect();
        
        // If mouse is inside the video bounds
        if (rect.width > 100 && rect.height > 100 &&
            mouseX >= rect.left && mouseX <= rect.right &&
            mouseY >= rect.top && mouseY <= rect.bottom) {
            
            foundVideo = true;
            createUI();
            
            // Position at top-right of this video
            downloadBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
            downloadBtn.style.left = (rect.right + window.scrollX - 180) + 'px';
            downloadBtn.style.display = 'flex';
            
            clearTimeout(hoverTimer);
            break;
        }
    }
    
    if (!foundVideo) {
        if (downloadBtn && downloadBtn.style.display !== 'none') {
            clearTimeout(hoverTimer);
            hoverTimer = setTimeout(() => {
                if (dropdown && dropdown.style.display === 'block') return; // Don't hide if dropdown is open
                downloadBtn.style.display = 'none';
            }, 1000);
        }
    }
}

setInterval(checkHover, 500);

