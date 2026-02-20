# 🚀 WUFScan Deployment Guide

## Quick Deploy Options

### Option 1: GitHub Pages (Frontend Only - Demo)
```bash
# Build frontend
cd client
npm run build

# Deploy to GitHub Pages
npm install -g gh-pages
gh-pages -d build
```

### Option 2: Vercel (Recommended for Full Stack)

**Frontend:**
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. Set root directory to `client`
5. Deploy!

**Backend:**
1. Create new Vercel project
2. Set root directory to `/`
3. Add environment variables in Vercel dashboard
4. Deploy!

### Option 3: Heroku (Full Stack)

```bash
# Install Heroku CLI
brew install heroku

# Login
heroku login

# Create app
heroku create wufscan-app

# Add buildpacks
heroku buildpacks:add heroku/nodejs
heroku buildpacks:add heroku/python

# Set environment variables
heroku config:set GEMINI_API_KEY=your_key_here
heroku config:set OPENAI_API_KEY=your_key_here

# Deploy
git push heroku main
```

### Option 4: Railway (Easiest)

1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Select your WUFScan repo
4. Add environment variables
5. Deploy automatically!

### Option 5: AWS EC2 (Production)

```bash
# SSH into EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install dependencies
sudo apt update
sudo apt install nodejs npm python3 python3-pip redis-server

# Clone repo
git clone https://github.com/yourusername/WUFScan.git
cd WUFScan

# Install packages
npm install
cd client && npm install && cd ..
pip3 install -r requirements.txt

# Setup environment
cp .env.example .env
nano .env  # Add your API keys

# Start with PM2
npm install -g pm2
pm2 start server.js
cd client && pm2 start npm -- start

# Setup nginx reverse proxy
sudo apt install nginx
# Configure nginx to proxy port 80 to 3000 and 5001
```

## Environment Variables Needed

```bash
GEMINI_API_KEY=required
OPENAI_API_KEY=optional
ANTHROPIC_API_KEY=optional
PORT=5001
VALKEY_ENABLED=true
EMAIL_ENABLED=true
EMAIL_USER=your_email
EMAIL_PASS=your_password
```

## Pre-Deployment Checklist

- [ ] Remove all API keys from code
- [ ] Add `.env` to `.gitignore`
- [ ] Test build: `cd client && npm run build`
- [ ] Update API URLs in frontend (change localhost to production URL)
- [ ] Set up Redis/Valkey on production server
- [ ] Configure CORS for production domain
- [ ] Set up SSL certificate (Let's Encrypt)
- [ ] Configure firewall rules
- [ ] Set up monitoring (Sentry, LogRocket)

## Quick GitHub Deploy

```bash
# Initialize git (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - WUFScan v1.0"

# Add remote
git remote add origin https://github.com/yourusername/WUFScan.git

# Push
git push -u origin main
```

## Update Frontend API URL for Production

In `client/src/App.js`, change:
```javascript
// Development
const API_URL = 'http://localhost:5001';

// Production
const API_URL = process.env.REACT_APP_API_URL || 'https://your-backend-url.com';
```

## Docker Deployment (Advanced)

```bash
# Build and run with Docker Compose
docker-compose up -d
```

See `docker-compose.yml` for configuration.

---

**Recommended for Hackathon Demo:** Railway or Vercel (easiest, free tier available)
