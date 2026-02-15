
# 🕵️ DataGuardian

**"Your Last Line of Defense Before You Hit Send"**

An intelligent document leak prevention system with a noir detective theme. DataGuardian analyzes files before they are shared, detects sensitive information, evaluates risk, and prevents accidental data leaks through intelligent scanning and real-time alerts.

---

## 🚀 Quick Start

### Prerequisites

* Node.js (v14+)
* npm

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

---

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

---

## 🎨 Features

* **File Upload**: Drag & drop or select files
* **Pattern Matching**: Detects API keys, SSNs, credit cards, emails, and other sensitive data
* **Risk Scoring**: 0–100 threat level calculation
* **Real-time Results**: Instant security analysis
* **Noir Theme**: 1940s detective aesthetic interface

### 🕶️ Advanced Features

* **AI-Powered Detection** using Google Gemini for advanced analysis
* **Face Detection** to flag potential identity exposure in images
* **Email Notification Generation** for security alerts and reports
* **Scan History Dashboard** to review past analyses
* **Redaction Suggestions** for sensitive content removal
* **Browser Extension** for real-time protection before uploads or submissions

---

## 🔧 Tech Stack

* **Backend**: Node.js, Express, Multer
* **Frontend**: React, Axios, Lucide Icons
* **AI**: Google Gemini API
* **Styling**: Custom CSS with noir theme

---

## 🎯 Supported File Types

* Text files (.txt)
* PDFs (.pdf)
* Code files (.js, .py, .yaml, .json, .env, .rb, .cpp, .php)
* Documents (.doc, .docx, .xlsx, .xls)
* Images (.png, .jpg, .jpeg)

---

## 🔒 Security Patterns Detected

* AWS API Keys
* Generic API Keys
* Social Security Numbers
* Credit Card Numbers
* Email Addresses
* Phone Numbers
* IP Addresses
* Faces detected in images 

---

## 📝 Next Steps

1. Advanced automatic redaction
2. Team and organization dashboards
3. Enterprise policy configuration
4. Cloud storage integrations
5. Expanded AI-assisted detection models

---
