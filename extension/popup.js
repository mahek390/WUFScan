const patterns = {
  awsKey: { regex: /AKIA[0-9A-Z]{16}/g, severity: 'CRITICAL', name: 'AWS API Key' },
  apiKey: { regex: /[a-zA-Z0-9_-]{32,}/g, severity: 'HIGH', name: 'API Key' },
  ssn: { regex: /\b\d{3}-\d{2}-\d{4}\b/g, severity: 'CRITICAL', name: 'Social Security Number' },
  creditCard: { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, severity: 'CRITICAL', name: 'Credit Card' },
  email: { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: 'MEDIUM', name: 'Email Address' },
  phone: { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, severity: 'MEDIUM', name: 'Phone Number' },
  ipAddress: { regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, severity: 'MEDIUM', name: 'IP Address' }
};

document.getElementById('scanBtn').addEventListener('click', scanText);

function scanText() {
  const text = document.getElementById('textInput').value;
  if (!text.trim()) return;

  const findings = [];
  let riskScore = 0;

  Object.entries(patterns).forEach(([type, config]) => {
    const matches = text.match(config.regex);
    if (matches) {
      matches.forEach(match => {
        const points = config.severity === 'CRITICAL' ? 25 : config.severity === 'HIGH' ? 15 : 10;
        findings.push({
          type: config.name,
          severity: config.severity,
          content: match.substring(0, 4) + '...' + match.substring(match.length - 4)
        });
        riskScore += points;
      });
    }
  });

  displayResults(Math.min(riskScore, 100), findings);
}

function displayResults(score, findings) {
  const resultsDiv = document.getElementById('results');
  const riskScoreEl = document.getElementById('riskScore');
  const riskLevelEl = document.getElementById('riskLevel');
  const findingsEl = document.getElementById('findings');

  let level = 'LOW';
  let color = '#2d5016';
  if (score > 75) { level = 'CRITICAL'; color = '#c41e3a'; }
  else if (score > 50) { level = 'HIGH'; color = '#cc5500'; }
  else if (score > 25) { level = 'MEDIUM'; color = '#d4a017'; }

  riskScoreEl.textContent = score + '/100';
  riskScoreEl.style.color = color;
  riskLevelEl.textContent = 'Threat Level: ' + level;
  riskLevelEl.style.color = color;

  findingsEl.innerHTML = '';
  if (findings.length === 0) {
    findingsEl.innerHTML = '<div style="text-align: center; color: #2d5016;">✓ No sensitive data detected</div>';
  } else {
    findings.forEach(finding => {
      const div = document.createElement('div');
      div.className = `finding-item ${finding.severity.toLowerCase()}`;
      div.innerHTML = `
        <div class="finding-type">${finding.type}</div>
        <div class="finding-content">${finding.content}</div>
      `;
      findingsEl.appendChild(div);
    });
  }

  resultsDiv.classList.remove('hidden');
}

document.getElementById('historyLink').addEventListener('click', (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: 'http://localhost:3000' });
});
