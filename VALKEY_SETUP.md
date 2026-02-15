# Valkey Setup for DataGuardian

## What is Valkey?
Valkey is a high-performance key-value store (Redis fork) that caches scan results to:
- **Avoid duplicate scans** of the same file
- **Save Gemini API quota** (no redundant AI calls)
- **Instant results** for previously scanned files (0ms latency)

## Quick Setup

### Option 1: Docker (Recommended)
```bash
docker run -d -p 6379:6379 --name valkey valkey/valkey:latest
```

### Option 2: Local Install (Windows)

**Step 1: Download Redis (Valkey-compatible)**
```bash
# Download Redis for Windows from:
https://github.com/microsoftarchive/redis/releases
# Get: Redis-x64-3.0.504.msi
```

**Step 2: Install**
- Run the .msi installer
- Keep default settings (Port 6379)
- Check "Add to PATH"

**Step 3: Start Redis**
```bash
# Open Command Prompt and run:
redis-server
```

**Step 4: Verify**
```bash
# In another terminal:
redis-cli ping
# Should return: PONG
```

**Alternative: Use Memurai (Redis for Windows)**
```bash
# Download from: https://www.memurai.com/get-memurai
# Free for development
# Runs as Windows service automatically
```

### Option 3: Skip Valkey
The app works without Valkey - it just won't cache results.

## How It Works
1. File uploaded → Calculate SHA-256 hash
2. Check Valkey cache with hash
3. **Cache HIT**: Return cached result instantly
4. **Cache MISS**: Scan file → Save to Valkey (24hr TTL)

## Benefits
- **Cost Savings**: Avoid redundant Gemini API calls
- **Speed**: Cached results return in <10ms
- **Scalability**: Production-ready caching layer

## Logs
- `✅ Valkey connected` - Cache is working
- `⚠️ Valkey unavailable` - App works without cache
- `💾 Cache HIT` - Returning cached result
- `🔍 Cache MISS` - Performing new scan
