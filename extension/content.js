// WUFScan Content Script - Intercepts file uploads and text submissions

const API_URL = 'http://localhost:5001/api/scan';

// Patterns for quick client-side detection
const patterns = {
  awsKey: /AKIA[0-9A-Z]{16}/g,
  apiKey: /[a-zA-Z0-9_-]{32,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
};

// Quick scan text content
function quickScan(text) {
  const findings = [];
  for (const [type, pattern] of Object.entries(patterns)) {
    const matches = text.match(pattern);
    if (matches) {
      findings.push({ type, count: matches.length, samples: matches.slice(0, 3) });
    }
  }
  return findings;
}

let isProcessing = false;

// Monitor file inputs with MutationObserver for dynamic content
const observer = new MutationObserver((mutations) => {
  document.querySelectorAll('input[type="file"]').forEach(input => {
    if (!input.dataset.wufscanMonitored) {
      input.dataset.wufscanMonitored = 'true';
      input.addEventListener('change', handleFileChange);
    }
  });
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial scan for existing file inputs
document.querySelectorAll('input[type="file"]').forEach(input => {
  input.dataset.wufscanMonitored = 'true';
  input.addEventListener('change', handleFileChange);
});

async function handleFileChange(e) {
  if (isProcessing) return;
  
  const input = e.target;
  if (!input.files || input.files.length === 0) return;
  
  const file = input.files[0];
  
  // Get settings
  const settings = await chrome.storage.sync.get(['enabled', 'autoBlock', 'threshold', 'scanned', 'blocked']);
  if (settings.enabled === false) return;
  
  // Increment scanned count
  const scanned = (settings.scanned || 0) + 1;
  await chrome.storage.sync.set({ scanned });
  
  // Only scan text-based files
  if (file.type.match(/text.*/) || file.name.match(/\.(txt|json|xml|js|py|env|yml|yaml|md|csv)$/)) {
    isProcessing = true;
    
    try {
      const text = await file.text();
      const findings = quickScan(text);
      
      if (findings.length > 0) {
        const totalScore = findings.reduce((sum, f) => sum + (f.count * 10), 0);
        const shouldBlock = settings.autoBlock && totalScore > (settings.threshold || 75);
        
        const message = `🚨 WUFScan Alert!\n\n` +
          `Detected ${findings.length} types of sensitive data:\n` +
          findings.map(f => `• ${f.type}: ${f.count} matches`).join('\n') +
          `\n\nRisk Score: ${Math.min(totalScore, 100)}/100` +
          (shouldBlock ? '\n\n⛔ AUTO-BLOCKED by WUFScan' : '\n\nDo you want to proceed?');
        
        if (shouldBlock) {
          alert(message);
          input.value = '';
          // Increment blocked count
          const blocked = (settings.blocked || 0) + 1;
          await chrome.storage.sync.set({ blocked });
          isProcessing = false;
          return;
        }
        
        const proceed = confirm(message);
        if (!proceed) {
          input.value = '';
          // Increment blocked count
          const blocked = (settings.blocked || 0) + 1;
          await chrome.storage.sync.set({ blocked });
        }
      }
    } catch (err) {
      console.error('WUFScan scan error:', err);
    }
    
    isProcessing = false;
  }
}

// Intercept form submissions
document.addEventListener('submit', async (e) => {
  const form = e.target;
  
  // Get settings
  const settings = await chrome.storage.sync.get(['enabled', 'autoBlock', 'threshold']);
  if (settings.enabled === false) return;
  
  const formData = new FormData(form);
  let allText = '';
  
  // Collect all text inputs and textareas
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      allText += value + ' ';
    }
  }
  
  // Also scan contenteditable elements (Gmail compose)
  document.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]').forEach(el => {
    const text = el.innerText || el.textContent || el.value || '';
    if (text.trim()) allText += text + ' ';
  });
  
  if (allText.trim().length === 0) return;
  
  const findings = quickScan(allText);
  
  if (findings.length > 0) {
    const totalScore = findings.reduce((sum, f) => sum + (f.count * 10), 0);
    const shouldBlock = settings.autoBlock && totalScore > (settings.threshold || 75);
    
    const message = `🚨 WUFScan Alert!\n\n` +
      `Detected sensitive data in email/form:\n` +
      findings.map(f => `• ${f.type}: ${f.count} matches`).join('\n') +
      `\n\nRisk Score: ${Math.min(totalScore, 100)}/100` +
      (shouldBlock ? '\n\n⛔ AUTO-BLOCKED by WUFScan' : '\n\nDo you want to send?');
    
    if (shouldBlock) {
      alert(message);
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    
    const proceed = confirm(message);
    if (!proceed) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
}, true);

// Gmail-specific: Monitor Send button clicks
setInterval(async () => {
  document.querySelectorAll('[role="button"]').forEach(btn => {
    const text = btn.textContent || btn.innerText || '';
    if (text.toLowerCase().includes('send') && !btn.dataset.wufscanMonitored) {
      btn.dataset.wufscanMonitored = 'true';
      btn.addEventListener('click', async (e) => {
        const settings = await chrome.storage.sync.get(['enabled', 'autoBlock', 'threshold', 'scanned', 'blocked']);
        if (settings.enabled === false) return;
        
        // Increment scanned count
        const scanned = (settings.scanned || 0) + 1;
        await chrome.storage.sync.set({ scanned });
        
        let emailText = '';
        document.querySelectorAll('[contenteditable="true"]').forEach(el => {
          emailText += (el.innerText || el.textContent || '') + ' ';
        });
        
        if (emailText.trim().length === 0) return;
        
        const findings = quickScan(emailText);
        if (findings.length > 0) {
          const totalScore = findings.reduce((sum, f) => sum + (f.count * 10), 0);
          const shouldBlock = settings.autoBlock && totalScore > (settings.threshold || 75);
          
          const message = `🚨 WUFScan Alert!\n\n` +
            `Detected sensitive data in email:\n` +
            findings.map(f => `• ${f.type}: ${f.count} matches`).join('\n') +
            `\n\nRisk Score: ${Math.min(totalScore, 100)}/100` +
            (shouldBlock ? '\n\n⛔ AUTO-BLOCKED by WUFScan' : '\n\nDo you want to send?');
          
          if (shouldBlock || !confirm(message)) {
            // Increment blocked count
            const blocked = (settings.blocked || 0) + 1;
            await chrome.storage.sync.set({ blocked });
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
          }
        }
      }, true);
    }
  });
}, 1000);

console.log('🕵️ WUFScan extension active - monitoring for sensitive data');
