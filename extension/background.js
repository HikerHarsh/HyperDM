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
    return true;
});
