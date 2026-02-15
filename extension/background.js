// WUFScan Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log('🕵️ WUFScan extension installed');
  
  // Set default settings
  chrome.storage.sync.set({
    enabled: true,
    serverUrl: 'http://localhost:5001',
    autoBlock: false
  });
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scan') {
    // Forward scan request to WUFScan server
    fetch(`${request.serverUrl}/api/scan`, {
      method: 'POST',
      body: request.formData
    })
    .then(res => res.json())
    .then(data => sendResponse({ success: true, results: data }))
    .catch(err => sendResponse({ success: false, error: err.message }));
    
    return true; // Keep channel open for async response
  }
});

// Badge to show extension is active
chrome.action.setBadgeText({ text: '🕵️' });
chrome.action.setBadgeBackgroundColor({ color: '#c41e3a' });
