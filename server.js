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
  phone: /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
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

    // Extract text based on file type
    if (file.mimetype === 'text/plain') {
      text = fs.readFileSync(file.path, 'utf-8');
    } else if (file.mimetype === 'application/pdf') {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
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

    // Clean up uploaded file
    fs.unlinkSync(file.path);

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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});
