let downloadBtn = null;
let dropdown = null;
let cachedMedia = [];

function createUI() {
    if (downloadBtn) return;
    
    downloadBtn = document.createElement('button');
    downloadBtn.className = 'hyperdm-download-btn';
    downloadBtn.innerHTML = '⬇ HyperDM Download';
    document.body.appendChild(downloadBtn);
    
    dropdown = document.createElement('div');
    dropdown.className = 'hyperdm-dropdown';
    document.body.appendChild(dropdown);
    
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        chrome.runtime.sendMessage({action: "getMediaList"}, (response) => {
            cachedMedia = response ? (response.media || []) : [];
            
            if (cachedMedia.length === 0) {
                alert("Koi media stream nahi mili! Video play karke thoda wait karein ya page refresh karein.");
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
                        dropdown.style.display = 'none';
                    });
                });
                
                dropdown.appendChild(item);
            });
            
            const rect = downloadBtn.getBoundingClientRect();
            dropdown.style.top = (rect.bottom + 5) + 'px';
            dropdown.style.left = rect.left + 'px';
            dropdown.style.position = 'fixed'; // Important for fixed dropdown
            dropdown.style.display = 'block';
        });
    });
    
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
    });
}

function checkVideos() {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
        createUI();
    }
}

// Initial check and periodic check
setTimeout(checkVideos, 2000);
setInterval(checkVideos, 3000);

