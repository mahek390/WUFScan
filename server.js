// ----------------------
// server.js
// ----------------------

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const Redis = require('ioredis');

// Optional dependencies (for extended file support)
let mammoth, XLSX, Tesseract, nodemailer;
try { mammoth = require('mammoth'); } catch (e) {}
try { XLSX = require('xlsx'); } catch (e) {}
try { Tesseract = require('tesseract.js'); } catch (e) {}
try { nodemailer = require('nodemailer'); } catch (e) {}

// ----------------------
// Initialize Gemini AI & Valkey
// ----------------------
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const redis = new Redis({
  host: process.env.VALKEY_HOST || 'localhost',
  port: process.env.VALKEY_PORT || 6379,
  retryStrategy: () => null
});

redis.on('error', () => console.log('⚠️ Valkey unavailable'));
redis.on('connect', () => console.log('✅ Valkey connected'));

// ----------------------
// Email Setup
// ----------------------
let emailTransporter = null;
console.log('🔍 Email config check:');
console.log('  EMAIL_ENABLED:', process.env.EMAIL_ENABLED);
console.log('  EMAIL_USER:', process.env.EMAIL_USER);
console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '***set***' : 'NOT SET');
console.log('  nodemailer:', nodemailer ? 'loaded' : 'NOT LOADED');

if (process.env.EMAIL_ENABLED === 'true' && nodemailer) {
  try {
    emailTransporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    console.log('✅ Email notifications enabled');
  } catch (e) {
    console.error('❌ Email setup failed:', e.message);
  }
} else {
  console.log('⚠️ Email notifications disabled');
}

// ----------------------
// Express app & multer
// ----------------------
const app = express();
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

app.use(cors());
app.use(express.json());

// ----------------------
// Persistent History Setup
// ----------------------
const HISTORY_FILE = path.join(__dirname, 'scan-history.json');
let scanHistory = [];
let scanIdCounter = 1;

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

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify({ scans: scanHistory, counter: scanIdCounter }, null, 2));
  } catch (err) {
    console.error('Failed to save history:', err);
  }
}

// ----------------------
// Valkey Cache Functions
// ----------------------
function calculateHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function getCachedScan(hash) {
  try {
    const cached = await redis.get(`scan:${hash}`);
    if (cached) {
      console.log('💾 Cache HIT');
      return JSON.parse(cached);
    }
  } catch (err) {}
  return null;
}

async function cacheScan(hash, result) {
  try {
    await redis.setex(`scan:${hash}`, 86400, JSON.stringify(result));
    console.log('💾 Cached result');
  } catch (err) {}
}

// ----------------------
// Regex patterns
// ----------------------
const patterns = {
  awsKey: /AKIA[0-9A-Z]{16}/g,
  apiKey: /[a-zA-Z0-9_-]{32,}/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)?\d{3}[\s.-]?\d{4}\b/g,
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

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

    const prompt = `
Extract ALL sensitive data from this document and return a JSON as specified:
{
  "riskScore": <total points, max 100>,
  "summary": "Found X emails, Y phones, Z SSNs, etc.",
  "issues": [
    {"type": "Email", "severity": "MEDIUM", "description": "Found email: example@domain.com"},
    {"type": "Phone", "severity": "MEDIUM", "description": "Found phone: 123-456-7890"},
    {"type": "SSN", "severity": "CRITICAL", "description": "Found SSN: XXX-XX-1234"},
    {"type": "Face/Photo", "severity": "HIGH", "description": "Document contains photo of person or face"}
  ]
}

Look for:
- Emails, phones, SSN, credit cards, addresses
- API keys, passwords, credentials
- Passport, I-94, driver license numbers
- References to photos, images, faces, or people
- Mentions like "photo attached", "see image", "person in video", "face visible"

Document:
${truncatedText}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    console.log("Raw Gemini response:", textResponse.substring(0, 500));

    const clean = textResponse.replace(/```json/g, "").replace(/```/g, "").trim();

    try {
      const parsed = JSON.parse(clean);
      console.log("Parsed AI result successfully");
      return parsed;
    } catch (parseErr) {
      console.error("Error parsing AI response:", parseErr.message);
      console.error("Attempting to extract JSON from response...");
      
      // Try to extract JSON from response
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const extracted = JSON.parse(jsonMatch[0]);
          console.log("Successfully extracted JSON");
          return extracted;
        } catch (e) {
          console.error("Failed to extract JSON");
        }
      }
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

    const userEmail = req.headers['x-notification-email'];

    let text = '';
    const ext = path.extname(file.originalname || '').toLowerCase();
    const readUtf8 = p => fs.readFileSync(p, 'utf-8');

    // --- File Parsing Logic ---
    try {
      if (file.mimetype === 'text/plain' || file.mimetype === 'text/csv' || ext === '.txt' || ext === '.csv') {
        text = readUtf8(file.path);
      } 
      else if (file.mimetype === 'application/json' || ext === '.json') {
        const raw = readUtf8(file.path);
        try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch (e) { text = raw; }
      } 
      else if (file.mimetype === 'application/pdf' || ext === '.pdf') {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        text = pdfData.text;
      } 
      else if ((file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') && mammoth) {
        const result = await mammoth.extractRawText({ path: file.path });
        text = result.value || '';
      } 
      else if ((file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') || ext === '.xlsx' || ext === '.xls') && XLSX) {
        const workbook = XLSX.readFile(file.path);
        text = workbook.SheetNames.map(name => XLSX.utils.sheet_to_csv(workbook.Sheets[name])).join('\n');
      } 
      else if ((['.png', '.jpg', '.jpeg'].includes(ext) || file.mimetype?.startsWith('image/')) && Tesseract) {
        console.log("Processing image with Tesseract...");
        const { data: { text: ocrText } } = await Tesseract.recognize(file.path, 'eng');
        text = ocrText;
      }
      else if ((['.png', '.jpg', '.jpeg'].includes(ext) || file.mimetype?.startsWith('image/')) && !Tesseract) {
        console.log("Processing image with Python OCR...");
        try {
          const { stdout } = await execPromise(`python3 python_scanner.py "${file.path}" "${ext.slice(1)}"`);
          const result = JSON.parse(stdout);
          if (result.success) text = result.text;
        } catch (e) {
          console.error('Python OCR failed:', e.message);
        }
      }
      else if (['.yaml', '.yml', '.env', '.js', '.py', '.java', '.cpp', '.c', '.h', '.xml', '.html', '.css', '.md', '.sh', '.bat', '.ps1', '.rb', '.go', '.rs', '.php', '.ts', '.tsx', '.jsx', '.tex', '.latex'].includes(ext)) {
        text = readUtf8(file.path);
      } 
      else {
        // Try reading as text for unknown types
        console.log(`Unknown file type ${ext}, attempting text read...`);
        text = readUtf8(file.path);
      }
    } catch (parseError) {
      console.error("Error parsing file:", parseError);
      console.error("File path:", file.path);
      console.error("File extension:", ext);
      console.error("File mimetype:", file.mimetype);
      text = "";
    }

    if (!text || text.trim().length === 0) {
       if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
       return res.status(400).json({ error: 'Could not extract text from file. Format may not be supported.' });
    }

    // ----------------------
    // Valkey Cache Check
    // ----------------------
    const fileHash = calculateHash(text);
    console.log('📄 File hash:', fileHash.substring(0, 16) + '...');

    const cachedResult = await getCachedScan(fileHash);
    if (cachedResult) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      
      // Send email for cached results too
      console.log('🔍 Email check (cached):');
      console.log('  emailTransporter:', emailTransporter ? 'EXISTS' : 'NULL');
      console.log('  userEmail:', userEmail || 'NOT PROVIDED');
      
      if (emailTransporter && userEmail) {
        console.log(`📧 Attempting to send email to: ${userEmail}`);
        emailTransporter.sendMail({
          from: process.env.EMAIL_USER,
          to: userEmail,
          subject: `🚨 DataGuardian Alert: ${cachedResult.riskLevel} Risk - ${file.originalname}`,
          html: `<h2>🕵️ Sensitive Data Detected (Cached Result)</h2>
                 <p><b>File:</b> ${file.originalname}</p>
                 <p><b>Risk Score:</b> ${cachedResult.riskScore}/100</p>
                 <p><b>Risk Level:</b> ${cachedResult.riskLevel}</p>
                 <p><b>Findings:</b> ${cachedResult.regexFindings.length} issues</p>
                 <p><b>Time:</b> ${new Date().toLocaleString()}</p>`
        }).then(() => {
          console.log(`✅ Email sent successfully to ${userEmail}`);
        }).catch(e => {
          console.error('❌ Email send failed:', e.message);
          console.error('Full error:', e);
        });
      } else {
        if (!emailTransporter) console.log('⚠️ Email not sent: transporter not configured');
        if (!userEmail) console.log('⚠️ Email not sent: no email address provided');
      }
      
      return res.json({ ...cachedResult, cached: true });
    }

    console.log('🔍 Cache MISS - scanning...');

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
    // Face Detection
    // ----------------------
    if (['.jpg', '.jpeg', '.png', '.pdf'].includes(ext)) {
      try {
        const { stdout } = await execPromise(`python3 face_detector.py "${file.path}" "${ext.slice(1)}"`);
        const faceResult = JSON.parse(stdout);
        if (faceResult.success && faceResult.faces_detected > 0) {
          findings.push({
            type: 'faceDetection',
            severity: 'HIGH',
            content: faceResult.message,
            fullMatch: '',
            confidence: 90
          });
          riskScore += 20;
        }
      } catch (e) {
        console.log('Face detection failed:', e.message);
      }
    }

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

    // Construct Result Object
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
      extractedText: text.substring(0, 50000),
      timestamp: new Date().toISOString()
    };

    // Save to history
    scanHistory.unshift(scanResult);
    if (scanHistory.length > 100) scanHistory.pop();
    saveHistory();

    // Generate audio alert if high risk
    if (finalRiskLevel === 'CRITICAL' || finalRiskLevel === 'HIGH') {
      try {
        const totalFindings = findings.length + aiIssues.length;
        const { stdout } = await execPromise(`python3 audio_alert.py "${finalRiskLevel}" ${totalFindings}`);
        const audioResult = JSON.parse(stdout);
        if (audioResult.success) {
          scanResult.audioAlert = audioResult.audio_path;
        }
      } catch (e) {
        console.log('Audio alert generation failed:', e.message);
      }
    }

    res.json(scanResult);

    // Cache the result
    await cacheScan(fileHash, scanResult);

    // Clean up uploaded file
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    // Send email after response (non-blocking)
    console.log('🔍 Email check:');
    console.log('  emailTransporter:', emailTransporter ? 'EXISTS' : 'NULL');
    console.log('  userEmail:', userEmail || 'NOT PROVIDED');
    
    if (emailTransporter && userEmail) {
      console.log(`📧 Attempting to send email to: ${userEmail}`);
      emailTransporter.sendMail({
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `🚨 DataGuardian Alert: ${scanResult.riskLevel} Risk - ${scanResult.filename}`,
        html: `<h2>🕵️ Sensitive Data Detected</h2>
               <p><b>File:</b> ${scanResult.filename}</p>
               <p><b>Risk Score:</b> ${scanResult.riskScore}/100</p>
               <p><b>Risk Level:</b> ${scanResult.riskLevel}</p>
               <p><b>Findings:</b> ${scanResult.regexFindings.length} issues</p>
               <p><b>Time:</b> ${new Date(scanResult.timestamp).toLocaleString()}</p>`
      }).then(() => {
        console.log(`✅ Email sent successfully to ${userEmail}`);
      }).catch(e => {
        console.error('❌ Email send failed:', e.message);
        console.error('Full error:', e);
      });
    } else {
      if (!emailTransporter) console.log('⚠️ Email not sent: transporter not configured');
      if (!userEmail) console.log('⚠️ Email not sent: no email address provided');
    }
  } catch (error) {
    console.error('Scan error:', error);
    console.error('Error stack:', error.stack);
    
    try {
      if (req.file && req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    
    res.status(500).json({ 
      error: 'Scan failed', 
      details: error.message 
    });
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

// ----------------------
// History endpoint
// ----------------------
app.get('/api/history', (req, res) => {
  res.json(scanHistory);
});

// ----------------------
// Extension scan endpoint
// ----------------------
app.post('/api/extension-scan', (req, res) => {
  try {
    const scanData = req.body;
    scanData.id = scanIdCounter++;
    scanData.timestamp = new Date().toISOString();
    
    scanHistory.unshift(scanData);
    if (scanHistory.length > 100) scanHistory.pop();
    saveHistory();
    
    res.json({ success: true, id: scanData.id });
  } catch(e) {
    console.error("Extension scan error", e);
    res.status(500).json({ error: "Failed to save extension scan" });
  }
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🕵️ DataGuardian server running on port ${PORT}`);
});
