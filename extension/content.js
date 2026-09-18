let activeVideo = null;
let downloadBtn = null;
let dropdown = null;
let cachedMedia = [];

function createUI() {
    if (downloadBtn) return;
    
    downloadBtn = document.createElement('button');
    downloadBtn.className = 'hyperdm-download-btn';
    downloadBtn.innerHTML = '⬇ Download Video';
    document.body.appendChild(downloadBtn);
    
    dropdown = document.createElement('div');
    dropdown.className = 'hyperdm-dropdown';
    document.body.appendChild(dropdown);
    
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        chrome.runtime.sendMessage({action: "getMediaList"}, (response) => {
            cachedMedia = response.media || [];
            
            if (cachedMedia.length === 0) {
                alert("No media streams caught yet. Try playing the video.");
                return;
            }
            
            dropdown.innerHTML = '';
            cachedMedia.forEach((media, index) => {
                let item = document.createElement('div');
                item.className = 'hyperdm-dropdown-item';
                item.innerHTML = `<span>${media.format}</span>`;
                
                item.addEventListener('click', () => {
                    chrome.runtime.sendMessage({
                        action: "downloadMedia",
                        media: media
                    }, () => {
                        alert("Sent to HyperDM!");
                        dropdown.style.display = 'none';
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
    
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

function updateButtonPosition(video) {
    if (!downloadBtn) return;
    const rect = video.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 100) {
        downloadBtn.style.top = (rect.top + window.scrollY + 10) + 'px';
        downloadBtn.style.left = (rect.right + window.scrollX - downloadBtn.offsetWidth - 10) + 'px';
        downloadBtn.style.display = 'flex';
    } else {
        downloadBtn.style.display = 'none';
    }
}

function checkVideos() {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
        createUI();
        let playingVideo = Array.from(videos).find(v => !v.paused) || videos[0];
        
        if (playingVideo) {
            updateButtonPosition(playingVideo);
        }
    }
}

// Check every second to keep button attached to video player
setInterval(checkVideos, 1000);
