// background.js — Service Worker
// Handles native messaging bridge between extension and C++ HyperDM app

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadMedia") {
        let port = chrome.runtime.connectNative('com.hyperdm.core');
        port.postMessage({
            action: "download",
            url: request.media.url,
            title: request.media.title || "video",
            format: request.media.format || "unknown",
            mimeType: request.media.mimeType || "",
            contentLength: request.media.contentLength || 0,
            headers: request.media.headers || {}
        });
        
        sendResponse({status: "sent"});
        return true;
    }
    else if (request.action === "getFormats") {
        let port = chrome.runtime.connectNative('com.hyperdm.core');
        port.postMessage({
            action: "getFormats",
            url: request.url
        });
        
        port.onMessage.addListener((msg) => {
            sendResponse(msg);
            port.disconnect();
        });
        
        port.onDisconnect.addListener(() => {
            if (chrome.runtime.lastError) {
                sendResponse({status: "error", message: chrome.runtime.lastError.message});
            }
        });
        return true; // async response
    }
    return false;
});
