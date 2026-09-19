// content.js — Simplified IDM Architecture
// Communicates with C++ NativeHost to fetch true formats via yt-dlp

let downloadBtn = null;
let dropdown = null;
let hoverTimer = null;
let isMouseOverUI = false;

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
    
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (dropdown.style.display === 'block') {
            dropdown.style.display = 'none';
            return;
        }
        
        let videoUrl = window.location.href;
        downloadBtn.innerHTML = '⏳ Loading Formats...';
        
        chrome.runtime.sendMessage({
            action: "getFormats",
            url: videoUrl
        }, (response) => {
            downloadBtn.innerHTML = '⬇ Download this video';
            
            if (!response || response.status === "error" || !response.formats || response.formats.length === 0) {
                alert("Formats load nahi hue! " + (response ? response.message : ""));
                return;
            }
            
            dropdown.innerHTML = '';
            
            let header = document.createElement('div');
            header.style.cssText = 'padding:10px 14px;font-weight:bold;border-bottom:2px solid #0078D7;color:#0078D7;font-size:13px;background:#111;border-radius:8px 8px 0 0;';
            header.textContent = '📹 ' + (response.formats[0].title || "YouTube Video");
            dropdown.appendChild(header);
            
            // Deduplicate formats based on label
            let seenLabels = new Set();
            let uniqueFormats = [];
            for (let fmt of response.formats) {
                if (!seenLabels.has(fmt.label)) {
                    seenLabels.add(fmt.label);
                    uniqueFormats.push(fmt);
                }
            }
            
            // Sort by file size descending
            uniqueFormats.sort((a, b) => {
                let sizeA = 0, sizeB = 0;
                let matchA = a.label.match(/([0-9.]+) MB/);
                let matchB = b.label.match(/([0-9.]+) MB/);
                if (matchA) sizeA = parseFloat(matchA[1]);
                if (matchB) sizeB = parseFloat(matchB[1]);
                return sizeB - sizeA;
            });
            
            for (let fmt of uniqueFormats) {
                let item = document.createElement('div');
                item.className = 'hyperdm-dropdown-item';
                item.textContent = fmt.label;
                
                item.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    
                    chrome.runtime.sendMessage({
                        action: "downloadMedia",
                        media: {
                            url: videoUrl, // Use original URL
                            format_id: fmt.format_id,
                            title: fmt.title,
                            format: fmt.label,
                            contentLength: 0,
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
    });
    
    document.addEventListener('click', () => {
        if (dropdown) dropdown.style.display = 'none';
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
