// ----------------------
// server.js
// ----------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// ----------------------
// Regex patterns
// ----------------------
const patterns = {
  awsKey: /AKIA[0-9A-Z]{16}/g,
  apiKey: /[a-zA-Z0-9_-]{32,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ipAddress: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g
};

// ----------------------
// Gemini AI scan function
// ----------------------
async function runGeminiScan(text) {
  try {
    const truncatedText = text.slice(0, 15000); // limit token usage

    const prompt = `
You are a cybersecurity analyst.

Analyze the following content for sensitive information leakage.

Look for:
- Hardcoded secrets
- API tokens
- Passwords
- Credentials
- Personally identifiable information
- Hidden contextual risks

Return ONLY valid JSON:

{
  "riskScore": number (0-100),
  "summary": "short explanation",
  "issues": [
    {
      "type": "string",
      "severity": "LOW | MEDIUM | HIGH | CRITICAL",
      "description": "string"
    }
  ]
}

Content:
${truncatedText}
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let textResponse = response.text();

    // Remove markdown formatting if Gemini wraps JSON
    textResponse = textResponse.replace(/```json|```/g, '').trim();

    return JSON.parse(textResponse);

  } catch (err) {
    console.error("Gemini scan error:", err);
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

    // Extract text from file
    if (file.mimetype === 'text/plain') {
      text = fs.readFileSync(file.path, 'utf-8');
    } else if (file.mimetype === 'application/pdf') {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      text = pdfData.text;
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
          const severity = ['awsKey', 'ssn', 'creditCard'].includes(type) ? 'CRITICAL' : 
                          type === 'apiKey' ? 'HIGH' : 'MEDIUM';
          const points = severity === 'CRITICAL' ? 25 : severity === 'HIGH' ? 15 : 10;
          
          findings.push({
            type,
            severity,
            content: match.substring(0, 4) + '...' + match.substring(match.length - 4),
            confidence: 95
          });
          
          riskScore += points;
        });
      }
    });

    // ----------------------
    // Gemini AI scan
    // ----------------------
    const aiResult = await runGeminiScan(text);

    let finalRiskScore = Math.min(riskScore, 100);
    let aiSummary = null;
    let aiIssues = [];

    if (aiResult) {
      finalRiskScore = Math.min(
        100,
        Math.round((riskScore * 0.6) + (aiResult.riskScore * 0.4))
      );
      aiSummary = aiResult.summary;
      aiIssues = aiResult.issues || [];
    }

    // ----------------------
    // Determine risk level
    // ----------------------
    let finalRiskLevel = 'LOW';
    if (finalRiskScore > 75) finalRiskLevel = 'CRITICAL';
    else if (finalRiskScore > 50) finalRiskLevel = 'HIGH';
    else if (finalRiskScore > 25) finalRiskLevel = 'MEDIUM';

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    // ----------------------
    // Return combined results
    // ----------------------
    res.json({
      filename: file.originalname,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      regexFindings: findings,
      aiSummary,
      aiFindings: aiIssues,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({ error: 'Scan failed' });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});
