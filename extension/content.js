// Content script for detecting sensitive data on web pages
console.log('DataGuardian extension loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanPage') {
    const pageText = document.body.innerText;
    sendResponse({ text: pageText });
  }
});
