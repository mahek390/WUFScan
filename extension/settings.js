// WUFScan Settings Script

document.addEventListener('DOMContentLoaded', async () => {
  // Load current settings
  const data = await chrome.storage.sync.get(['serverUrl', 'threshold', 'autoBlock', 'notifications']);
  
  document.getElementById('serverUrl').value = data.serverUrl || 'http://localhost:5001';
  document.getElementById('threshold').value = data.threshold || 75;
  document.getElementById('autoBlock').checked = data.autoBlock || false;
  document.getElementById('notifications').checked = data.notifications || false;
  
  // Save settings
  document.getElementById('save').addEventListener('click', async () => {
    const settings = {
      serverUrl: document.getElementById('serverUrl').value,
      threshold: parseInt(document.getElementById('threshold').value),
      autoBlock: document.getElementById('autoBlock').checked,
      notifications: document.getElementById('notifications').checked
    };
    
    await chrome.storage.sync.set(settings);
    
    // Show success message
    const success = document.getElementById('success');
    success.style.display = 'block';
    setTimeout(() => {
      success.style.display = 'none';
    }, 2000);
  });
});
