# 🕵️ WUFScan Browser Extension

**Real-time protection against data leaks before you hit send**

## Features

- 🔍 **Auto-scan file uploads** - Detects sensitive data before files are uploaded
- 📝 **Form monitoring** - Scans text inputs for API keys, SSNs, credit cards, etc.
- 🚨 **Real-time alerts** - Warns you before submitting sensitive information
- 📊 **Dashboard integration** - One-click access to full WUFScan dashboard
- ⚡ **Lightweight** - Client-side pattern matching for instant feedback

## Installation

### Chrome/Edge/Brave

1. **Build the extension** (already done - files in `/extension` folder)

2. **Open Extensions page:**
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

3. **Enable Developer Mode** (toggle in top-right corner)

4. **Click "Load unpacked"**

5. **Select the `/extension` folder** from your WUFScan directory

6. **Pin the extension** to your toolbar for easy access

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `manifest.json` from the `/extension` folder

## Usage

### Automatic Protection

Once installed, WUFScan automatically monitors:
- File input fields on any website
- Form submissions with text data
- Paste operations in sensitive fields

### Manual Scan

1. Click the WUFScan icon in your toolbar
2. View protection status and statistics
3. Click "Open Dashboard" for full analysis

### Alerts

When sensitive data is detected:
```
🚨 WUFScan Alert!

Detected 3 types of sensitive data:
• apiKey: 2 matches
• email: 5 matches
• phone: 1 matches

Do you want to proceed with upload?
```

## Configuration

Click the extension icon → Settings to configure:
- **Server URL**: WUFScan backend endpoint (default: `http://localhost:5001`)
- **Auto-block**: Automatically prevent submissions with high-risk data
- **Sensitivity**: Adjust detection threshold

## Patterns Detected

- ✅ AWS API Keys (`AKIA...`)
- ✅ Generic API Keys (32+ chars)
- ✅ Social Security Numbers (`XXX-XX-XXXX`)
- ✅ Credit Card Numbers
- ✅ Email Addresses
- ✅ Phone Numbers

## Requirements

- WUFScan backend running on `http://localhost:5001`
- Chrome 88+, Edge 88+, Firefox 78+, or Brave

## Privacy

- All scanning happens **locally** in your browser
- No data is sent to external servers
- Optional: Connect to your local WUFScan server for AI analysis

## Troubleshooting

**Extension not working?**
- Check if WUFScan server is running (`npm run server`)
- Verify server URL in extension settings
- Check browser console for errors (F12)

**False positives?**
- Adjust sensitivity in settings
- Whitelist specific domains (coming soon)

## Development

```bash
# Make changes to extension files
cd extension

# Reload extension in browser
# Chrome: Go to chrome://extensions and click reload icon
```

## License

MIT License - Part of WUFScan Project
