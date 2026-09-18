let tabMediaData = {};

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        const url = details.url;
        const tabId = details.tabId;
        
        if (tabId < 0) return; // Ignore background requests
        
        if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".ts") || url.includes("videoplayback")) {
            
            let headers = {};
            for (let header of details.requestHeaders) {
                headers[header.name] = header.value;
            }
            
            // Format extraction for YouTube/General using regex
            let format = "Video/Media";
            
            // Try to extract itag
            let itagMatch = url.match(/(?:[?&]|%26)itag(?:=|%3D)([0-9]+)/);
            let mimeMatch = url.match(/(?:[?&]|%26)mime(?:=|%3D)([^&]+)/);
            
            if (itagMatch) {
                let itag = itagMatch[1];
                if (itag === "137") format = "1080p Video (MP4)";
                else if (itag === "299") format = "1080p60 Video (MP4)";
                else if (itag === "313" || itag === "336") format = "4K Video (WebM)";
                else if (itag === "571" || itag === "272") format = "8K Video (WebM)";
                else if (itag === "136") format = "720p Video (MP4)";
                else if (itag === "140") format = "Audio Only (m4a)";
                else if (itag === "251") format = "Audio Only (webm)";
                else if (itag === "18") format = "360p Video (MP4)";
                else if (itag === "22") format = "720p Video (MP4)";
                else if (mimeMatch) format = decodeURIComponent(mimeMatch[1]) + " (itag=" + itag + ")";
                else format = "Stream (itag=" + itag + ")";
            } else if (mimeMatch) {
                format = decodeURIComponent(mimeMatch[1]);
            } else if (url.includes(".m3u8")) {
                format = "HLS Playlist";
            } else if (url.includes(".mp4")) {
                format = "MP4 Video";
            }
            
            const mediaItem = {
                url: url,
                headers: headers,
                format: format,
                timestamp: Date.now()
            };
            
            if (!tabMediaData[tabId]) tabMediaData[tabId] = [];
            
            // Avoid duplicate exact URLs
            if (!tabMediaData[tabId].some(item => item.url === url)) {
                tabMediaData[tabId].push(mediaItem);
            }
        }
    },
    {urls: ["<all_urls>"]},
    ["requestHeaders", "extraHeaders"]
);

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener(function(tabId) {
    delete tabMediaData[tabId];
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getMediaList") {
        const tabId = sender.tab ? sender.tab.id : request.tabId;
        sendResponse({ media: tabMediaData[tabId] || [] });
    } 
    else if (request.action === "downloadMedia") {
        let port = chrome.runtime.connectNative('com.hyperdm.core');
        port.postMessage({
            action: "download",
            url: request.media.url,
            headers: request.media.headers
        });
        
        port.onMessage.addListener((msg) => {
            console.log("HyperDM Native Host response:", msg);
        });
        
        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                console.error("Native Host Disconnected:", chrome.runtime.lastError.message);
            }
        });
        sendResponse({status: "sent"});
    }
    return true; // async response
});
