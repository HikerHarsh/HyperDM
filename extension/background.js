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
            
            // Format extraction for YouTube/General
            let format = "Video/Media";
            if (url.includes("itag=137")) format = "1080p Video";
            else if (url.includes("itag=299")) format = "1080p60 Video";
            else if (url.includes("itag=313") || url.includes("itag=336")) format = "4K / 1440p Video";
            else if (url.includes("itag=571") || url.includes("itag=272")) format = "8K Video";
            else if (url.includes("itag=136")) format = "720p Video";
            else if (url.includes("itag=140")) format = "Audio Only (m4a)";
            else if (url.includes("itag=251")) format = "Audio Only (webm)";
            else if (url.includes(".m3u8")) format = "HLS Stream";
            
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
