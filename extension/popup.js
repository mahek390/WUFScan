// WUFScan Popup Script

let updateInterval;

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('toggle');
  const openDashboard = document.getElementById('openDashboard');
  const settings = document.getElementById('settings');
  const serverStatus = document.getElementById('server');
  
  // Function to update stats
  async function updateStats() {
    const data = await chrome.storage.sync.get(['enabled', 'scanned', 'blocked', 'serverUrl']);
    
    if (data.enabled) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
    
    document.getElementById('scanned').textContent = data.scanned || 0;
    document.getElementById('blocked').textContent = data.blocked || 0;
    
    // Check server status
    try {
      const response = await fetch(`${data.serverUrl || 'http://localhost:5001'}/api/health`);
      if (response.ok) {
        serverStatus.textContent = '● Online';
        serverStatus.style.color = '#2d5016';
      } else {
        throw new Error('Server offline');
      }
    } catch (err) {
      serverStatus.textContent = '● Offline';
      serverStatus.style.color = '#c41e3a';
    }
  }
  
  // Initial update
  await updateStats();
  
  // Update every 2 seconds
  updateInterval = setInterval(updateStats, 2000);
  
  // Toggle protection
  toggle.addEventListener('click', async () => {
    const isEnabled = toggle.classList.contains('active');
    toggle.classList.toggle('active');
    await chrome.storage.sync.set({ enabled: !isEnabled });
  });
  
  // Open dashboard
  openDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  });
  
  // Settings
  settings.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
  });
});

// Clean up interval when popup closes
window.addEventListener('unload', () => {
  if (updateInterval) clearInterval(updateInterval);
});
