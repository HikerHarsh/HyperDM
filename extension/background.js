const NATIVE_HOST_NAME = "com.hyperdm.core";

chrome.webRequest.onBeforeSendHeaders.addListener(
    function(details) {
        const url = details.url;
        
        // Simple filter for media files
        if (url.includes(".mp4") || url.includes(".m3u8") || url.includes(".ts")) {
            console.log("HyperDM caught media URL:", url);
            
            let headers = {};
            for (let header of details.requestHeaders) {
                headers[header.name] = header.value;
            }

            // Send payload to C++ Native Host
            chrome.runtime.sendNativeMessage(
                NATIVE_HOST_NAME,
                {
                    action: "download",
                    url: url,
                    headers: headers
                },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error("Native Messaging Error:", chrome.runtime.lastError.message);
                        return;
                    }
                    console.log("Received response from C++ Host:", response);
                }
            );
        }
        return {requestHeaders: details.requestHeaders};
    },
    {urls: ["<all_urls>"]},
    ["requestHeaders"] // Required to read the headers
);
