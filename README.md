# 🕵️ DataGuardian

**"Your Last Line of Defense Before You Hit Send"**

An intelligent document leak prevention system with noir detective theme.

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- npm

### Installation

1. **Install backend dependencies:**
```bash
npm install
```

2. **Install frontend dependencies:**
```bash
cd client
npm install
cd ..
```

3. **Setup environment variables:**
```bash
# Copy .env.example to .env
copy .env.example .env

# Edit .env and add your Gemini API key
```

4. **Run the application:**
```bash
# Terminal 1 - Backend
npm run server

# Terminal 2 - Frontend
cd client
npm start
```

The app will open at `http://localhost:3000`

## 📁 Project Structure

```
WufScan/
├── server.js           # Express backend
├── package.json        # Backend dependencies
├── .env               # Environment variables
├── uploads/           # Temporary file storage
└── client/            # React frontend
    ├── src/
    │   ├── App.js     # Main component
    │   ├── App.css    # Noir theme styles
    │   └── index.js
    └── package.json   # Frontend dependencies
```

## 🎨 Features

- **File Upload**: Drag & drop or select files
- **Pattern Matching**: Detects API keys, SSN, credit cards, emails, etc.
- **Risk Scoring**: 0-100 threat level calculation
- **Noir Theme**: 1940s detective aesthetic
- **Real-time Results**: Instant security analysis

## 🔧 Tech Stack

- **Backend**: Node.js, Express, Multer
- **Frontend**: React, Axios, Lucide Icons
- **AI**: Google Gemini API (ready to integrate)
- **Styling**: Custom CSS with noir theme

## 📝 Next Steps

1. Add Gemini API integration for advanced detection
2. Implement redaction features
3. Add scan history dashboard
4. Create browser extension
5. Add more file format support

## 🎯 Supported File Types

- Text files (.txt)
- PDFs (.pdf)
- Code files (.js, .py, .yaml, .json, .env)
- Documents (.doc, .docx) - coming soon

## 🔒 Security Patterns Detected

- AWS API Keys
- Generic API Keys
- Social Security Numbers
- Credit Card Numbers
- Email Addresses
- Phone Numbers
- IP Addresses

---

Built for hackathon with ❤️
