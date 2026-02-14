// ----------------------
// server.js
// ----------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ----------------------
// Initialize Gemini AI
// ----------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ----------------------
// Express app & multer
// ----------------------
const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// ----------------------
// Regex patterns
// ----------------------
// Persistent storage for scan history
const HISTORY_FILE = path.join(__dirname, 'scan-history.json');
let scanHistory = [];
let scanIdCounter = 1;

// Load history from file on startup
if (fs.existsSync(HISTORY_FILE)) {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const loaded = JSON.parse(data);
    scanHistory = loaded.scans || [];
    scanIdCounter = loaded.counter || 1;
    console.log(`✅ Loaded ${scanHistory.length} scans from history file`);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
} else {
  console.log('📝 No history file found, starting fresh');
}

// Save history to file
function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ scans: scanHistory, counter: scanIdCounter }, null, 2));
    console.log(`💾 Saved ${scanHistory.length} scans to history`);
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

// Regex patterns for sensitive data detection
const patterns = {
  awsKey: /AKIA[0-9A-Z]{16}/g,
  apiKey: /[a-zA-Z0-9_-]{32,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  passport: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
  i94: /\b[0-9]{11}\b/g,
  zipCode: /\b\d{5}(-\d{4})?\b/g
};

// ----------------------
// Gemini AI scan function
// ----------------------
async function runGeminiScan(text) {
  try {
    const truncatedText = text.slice(0, 30000);
    console.log("Sending to Gemini, text length:", truncatedText.length);

    // CHANGED: Using "gemini-2.0-flash-lite" because it is in your available list
    // and is less likely to hit the strict quotas of the standard Flash model.
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `
Extract ALL sensitive data from this document and return a JSON as specified:
{
  "riskScore": <total points, max 100>,
  "summary": "Found X emails, Y phones, Z SSNs, etc.",
  "issues": [
    {"type": "Email", "severity": "MEDIUM", "description": "Found email: example@domain.com"},
    {"type": "Phone", "severity": "MEDIUM", "description": "Found phone: 123-456-7890"},
    {"type": "SSN", "severity": "CRITICAL", "description": "Found SSN: XXX-XX-1234"}
  ]
}
Document:
${truncatedText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    console.log("Raw Gemini response:", textResponse.substring(0, 500));

    // Clean markdown
    const clean = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      return parsed;
    } catch (parseErr) {
      console.error("Error parsing AI response:", parseErr.message);
      return null;
    }

  } catch (err) {
    console.error("Gemini scan error:", err.message);
    if (err.message.includes('429')) {
         console.log("⚠️ Quota Exceeded. Returning Regex-only results.");
    }
    return null;
  }
}

// ----------------------
// Scan endpoint
// ----------------------
app.post('/api/scan', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    let text = '';
    const ext = path.extname(file.originalname || '').toLowerCase();

    // Extract text from file
    if (file.mimetype === 'text/plain') {
      text = fs.readFileSync(file.path, 'utf-8');
    } else if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else {
      if(fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Unsupported file type' });
    const readUtf8 = p => fs.readFileSync(p, 'utf-8');

    // Extract text based on file type / extension
    if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || ext === '.txt' || ext === '.csv') {
      text = readUtf8(file.path);
    } else if (file.mimetype === 'application/json' || ext === '.json') {
      const raw = readUtf8(file.path);
      try {
        const obj = JSON.parse(raw);
        text = JSON.stringify(obj, null, 2);
      } catch (e) {
        text = raw;
      }
    } else if (file.mimetype === 'application/pdf' || ext === '.pdf') {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
    } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
      const mammoth = require('mammoth');
      try {
        const result = await mammoth.extractRawText({ path: file.path });
        text = result && result.value ? result.value : '';
      } catch (e) {
        text = '';
      }
    } else if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      ext === '.xlsx' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      ext === '.xls'
    ) {
      const XLSX = require('xlsx');
      try {
        const workbook = XLSX.readFile(file.path);
        text = workbook.SheetNames.map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
      } catch (e) {
        text = '';
      }
    } else if (['.yaml', '.yml', '.env', '.js', '.py', '.java', '.cpp', '.c', '.h', '.xml', '.html', '.css', '.md', '.sh', '.bat', '.ps1', '.rb', '.go', '.rs', '.php', '.ts', '.tsx', '.jsx'].includes(ext)) {
      text = readUtf8(file.path);
    } else if (['.png', '.jpg', '.jpeg'].includes(ext) || file.mimetype?.startsWith('image/')) {
      const Tesseract = require('tesseract.js');
      const { data: { text: ocrText } } = await Tesseract.recognize(file.path, 'eng');
      text = ocrText;
    } else {
      try {
        text = readUtf8(file.path);
      } catch (e) {
        text = '';
      }
    }

    // ----------------------
    // Regex scanning
    // ----------------------
    const findings = [];
    let riskScore = 0;

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const severity = ['awsKey', 'ssn', 'creditCard'].includes(type)
            ? 'CRITICAL'
            : type === 'apiKey'
            ? 'HIGH'
            : 'MEDIUM';
          const points = severity === 'CRITICAL' ? 25 : severity === 'HIGH' ? 15 : 10;

          findings.push({
            type,
            severity,
            content: match.substring(0, 4) + '...' + match.substring(match.length - 4),
            fullMatch: match,
            confidence: 95
          });

          riskScore += points;
        });
      }
    });

    // ----------------------
    // Gemini AI scan
    // ----------------------
    console.log('Starting AI scan...');
    const aiResult = await runGeminiScan(text);
    
    // ----------------------
    // Combine Results
    // ----------------------
    let finalRiskScore = Math.min(riskScore, 100);
    let aiSummary = null;
    let aiIssues = [];
    let aiScore = 0;

    if (aiResult) {
      console.log('AI Result Summary:', aiResult.summary);
      aiScore = aiResult.riskScore || 0;
      finalRiskScore = Math.min(
        100,
        Math.round(riskScore * 0.6 + aiScore * 0.4)
      );
      aiSummary = aiResult.summary;
      aiIssues = aiResult.issues || [];
    } else {
      console.log('AI Result: null (Using Regex only)');
    }

    let finalRiskLevel = 'LOW';
    if (finalRiskScore > 75) finalRiskLevel = 'CRITICAL';
    else if (finalRiskScore > 50) finalRiskLevel = 'HIGH';
    else if (finalRiskScore > 25) finalRiskLevel = 'MEDIUM';

    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

    const scanResult = {
      id: scanIdCounter++,
      filename: file.originalname,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      regexScore: Math.min(riskScore, 100),
      aiScore,
      regexFindings: findings,
      aiSummary,
      aiFindings: aiIssues,
      timestamp: new Date().toISOString()
    };

    // Save to history
    scanHistory.unshift(scanResult);
    if (scanHistory.length > 100) scanHistory.pop();
    saveHistory();

    res.json(scanResult);

    // Clean up uploaded file
    fs.unlinkSync(file.path);

  } catch (error) {
    console.error('Scan error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Scan failed' });
  }
});

// Redaction endpoint
app.post('/api/redact', express.json(), (req, res) => {
  try {
    const { text, findings, redactionStyle } = req.body;
    let redactedText = text;

    findings.forEach(finding => {
      const match = finding.fullMatch;
      let replacement;

      switch (redactionStyle) {
        case 'full':
          replacement = '[REDACTED]';
          break;
        case 'partial':
          replacement = match.substring(0, 4) + '***' + match.substring(match.length - 4);
          break;
        case 'asterisk':
          replacement = '*'.repeat(match.length);
          break;
        case 'block':
          replacement = '█'.repeat(match.length);
          break;
        default:
          replacement = '[REDACTED]';
      }

      redactedText = redactedText.replaceAll(match, replacement);
    });

    res.json({ redactedText });
  } catch (error) {
    console.error('Redaction error:', error);
    res.status(500).json({ error: 'Redaction failed' });
  }
});

// History endpoint
app.get('/api/history', (req, res) => {
  res.json(scanHistory);
});

// Extension scan endpoint
app.post('/api/extension-scan', (req, res) => {
  const scanData = req.body;
  scanData.id = scanIdCounter++;
  scanHistory.unshift(scanData);
  if (scanHistory.length > 100) scanHistory.pop();
  saveHistory();
  res.json({ success: true });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});