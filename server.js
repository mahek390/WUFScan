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

    res.json({
      filename: file.originalname,
      riskScore: finalRiskScore,
      riskLevel: finalRiskLevel,
      regexScore: Math.min(riskScore, 100),
      aiScore,
      regexFindings: findings,
      aiSummary,
      aiFindings: aiIssues,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Scan error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Scan failed' });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});