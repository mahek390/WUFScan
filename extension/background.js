// Background service worker for DataGuardian extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('DataGuardian extension installed');
});

// Listen for tab updates to scan pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Future: Auto-scan pages for sensitive data
  }
});
