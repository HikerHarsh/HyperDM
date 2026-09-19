// background.js — Service Worker
// Handles native messaging bridge between extension and C++ HyperDM app

function getNetscapeCookies(callback) {
    chrome.cookies.getAll({domain: ".youtube.com"}, (cookies) => {
        let cookieStr = "# Netscape HTTP Cookie File\n";
        for (let c of cookies) {
            cookieStr += `${c.domain}\t${c.domain.startsWith('.') ? 'TRUE' : 'FALSE'}\t${c.path}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 0}\t${c.name}\t${c.value}\n`;
        }
        callback(cookieStr);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "downloadMedia") {
        let port = chrome.runtime.connectNative('com.hyperdm.core');
        getNetscapeCookies((cookies) => {
            port.postMessage({
                action: "download",
                url: request.media.url,
                format_id: request.media.format_id || "",
                title: request.media.title || "video",
                format: request.media.format || "unknown",
                cookies: cookies
            });
            sendResponse({status: "sent"});
        });
        return true;
    }
    else if (request.action === "getFormats") {
        let port = chrome.runtime.connectNative('com.hyperdm.core');
        getNetscapeCookies((cookies) => {
            port.postMessage({
                action: "getFormats",
                url: request.url,
                cookies: cookies
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
        });
        return true;
    }
    return false;
});
