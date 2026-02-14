const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Regex patterns for sensitive data detection
const patterns = {
  awsKey: /AKIA[0-9A-Z]{16}/g,
  apiKey: /[a-zA-Z0-9_-]{32,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
};

// Scan endpoint
app.post('/api/scan', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fs = require('fs');
    let text = '';
    const ext = path.extname(file.originalname || '').toLowerCase();

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
      console.log('Image detected:', file.originalname);
      const Tesseract = require('tesseract.js');
      try {
        console.log('Starting OCR...');
        const result = await Tesseract.recognize(file.path, 'eng');
        text = result.data.text || '';
        console.log('OCR completed. Text length:', text.length);
      } catch (e) {
        console.error('OCR error:', e.message);
        text = '';
      }
    } else {
      // fallback: attempt to read as utf-8 text
      try {
        text = readUtf8(file.path);
      } catch (e) {
        text = '';
      }
    }

    // Pattern matching scan
    const findings = [];
    let riskScore = 0;

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const severity = ['awsKey', 'ssn', 'creditCard'].includes(type) ? 'CRITICAL' : 
                          type === 'apiKey' ? 'HIGH' : 'MEDIUM';
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

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // Determine risk level
    let riskLevel = 'LOW';
    if (riskScore > 75) riskLevel = 'CRITICAL';
    else if (riskScore > 50) riskLevel = 'HIGH';
    else if (riskScore > 25) riskLevel = 'MEDIUM';

    res.json({
      filename: file.originalname,
      riskScore: Math.min(riskScore, 100),
      riskLevel,
      findings,
      originalText: text,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Scan error:', error);
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});
