# 🎵 Python BPM Scraper Setup

## Overview

The backend now uses a **robust Python scraper** to fetch BPM data from [songbpm.com](https://songbpm.com). This replaces the previous Node.js implementation with a more maintainable, feature-rich solution.

---

## ✨ Features

- **URL Normalization**: Handles spaces, special characters, and formatting automatically
- **Smart Caching**: Avoids redundant requests for the same song
- **Realistic Headers**: Uses proper User-Agent to avoid being blocked
- **Error Handling**: Graceful handling of 404s, timeouts, and invalid data
- **Production-Ready**: Clean logging, validation, and modular structure
- **BPM Validation**: Ensures BPM values are in reasonable range (40-240)

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Requirements:**
- `requests` - HTTP library for fetching web pages
- `beautifulsoup4` - HTML parsing
- `lxml` - Fast HTML parser

### Step 2: Test the Python Scraper

```bash
# Test individual song
python utils/bpm_scraper.py "Daniel Caesar" "Superpowers"
# Expected output: BPM: 130

# Run full test suite
python test_bpm_scraper.py
```

### Step 3: Restart Backend

The Node.js backend will automatically call the Python scraper when needed.

```bash
npm run dev
```

---

## 📋 Usage

### From Node.js Backend (Automatic)

The BPM endpoint automatically uses the Python scraper:

```bash
curl "http://localhost:5000/api/bpm?song=Blinding%20Lights&artist=The%20Weeknd"
```

**Response:**
```json
{
  "song": "Blinding Lights",
  "artist": "The Weeknd",
  "bpm": 171,
  "key": "Unknown",
  "queried_at": "2024-01-15T10:30:00.000Z",
  "source": "songbpm-python-scraper"
}
```

### From Python (Direct)

```python
from utils.bpm_scraper import get_bpm_from_songbpm

bpm = get_bpm_from_songbpm("Daniel Caesar", "Superpowers")
print(bpm)  # Output: 130
```

### From Command Line

```bash
# JSON output (for Node.js integration)
python utils/bpm_scraper.py --json "The Weeknd" "Blinding Lights"

# Human-readable output
python utils/bpm_scraper.py "The Weeknd" "Blinding Lights"
```

---

## 🔧 How It Works

### 1. URL Construction

The scraper normalizes artist and song names into URL-friendly slugs:

```
Input:  "Daniel Caesar", "Superpowers"
URL:    https://songbpm.com/@daniel-caesar/superpowers
```

**Normalization rules:**
- Convert to lowercase
- Remove non-alphanumeric characters (except hyphens)
- Replace spaces with hyphens
- Remove duplicate/leading/trailing hyphens

### 2. Web Scraping

Fetches the page with realistic headers to avoid being blocked:

```python
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...',
    'Accept': 'text/html,application/xhtml+xml,...',
    # ... more headers for realism
}
```

### 3. BPM Extraction

Parses HTML to find the BPM value in the specific tag:

```html
<dd class="text-card-foreground mt-1 text-3xl font-semibold">130</dd>
```

Validates that:
- Previous `<dt>` tag mentions "tempo" or "bpm"
- Value is numeric and in range 40-240 BPM

### 4. Caching

Uses in-memory cache to avoid redundant requests:

```python
# First request: fetches from web
bpm1 = get_bpm_from_songbpm("Drake", "Hotline Bling")  # Web request

# Second request: returns from cache
bpm2 = get_bpm_from_songbpm("Drake", "Hotline Bling")  # Instant!
```

---

## 🧪 Testing

### Run Test Suite

```bash
python backend/test_bpm_scraper.py
```

Tests multiple popular songs:
- Daniel Caesar - Superpowers (130 BPM)
- The Weeknd - Blinding Lights (171 BPM)
- Dua Lipa - Levitating (103 BPM)
- Drake - Hotline Bling (135 BPM)
- Billie Eilish - bad guy (135 BPM)

### Test Individual Songs

```bash
python backend/utils/bpm_scraper.py "Artist Name" "Song Name"
```

---

## 🔍 Troubleshooting

### "No module named 'requests'" or similar

**Solution**: Install Python dependencies

```bash
cd backend
pip install -r requirements.txt
```

### "Failed to execute Python script. Is Python installed?"

**Solution**: Ensure Python 3 is installed and in PATH

```bash
# Check Python installation
python --version

# If not found, install Python 3.8+
# Windows: Download from python.org
# Mac: brew install python3
# Linux: apt-get install python3
```

### "BPM not found" for valid songs

**Possible causes:**
1. Song not in songbpm.com database
2. Artist/song name doesn't match exactly
3. Rate limiting (try again in a few seconds)

**Solutions:**
- Try different artist/song name formatting
- Check if song exists on songbpm.com manually
- Wait a bit and retry (scraper has built-in delays)

### Python script timing out

**Solution**: Check your internet connection and firewall settings

```bash
# Test connectivity
curl https://songbpm.com

# Test with longer timeout
python utils/bpm_scraper.py "Artist" "Song"
```

---

## 📁 File Structure

```
backend/
├── utils/
│   └── bpm_scraper.py       # Main Python scraper
├── routes/
│   └── bpm.js               # Node.js route (calls Python)
├── requirements.txt         # Python dependencies
├── test_bpm_scraper.py      # Test suite
└── BPM_SCRAPER_SETUP.md     # This file
```

---

## 🆚 Comparison: Old vs New

| Feature | Old (Node.js) | New (Python) |
|---------|--------------|--------------|
| Dependencies | cheerio, node-fetch | requests, beautifulsoup4 |
| Caching | ❌ No | ✅ Yes |
| Error handling | Basic | Comprehensive |
| Logging | Basic console.log | Structured logging |
| Validation | BPM range only | BPM + label validation |
| Testing | Manual | Automated test suite |
| Modularity | Embedded in route | Standalone module |

---

## 🚀 Advanced Usage

### Custom Python Script Location

If you need to use a different Python executable:

Edit `backend/routes/bpm.js`:

```javascript
// Change this line:
const pythonProcess = spawn('python', [...])

// To:
const pythonProcess = spawn('python3', [...])
// or
const pythonProcess = spawn('/path/to/python', [...])
```

### Disable Caching

```python
from utils.bpm_scraper import get_bpm_from_songbpm

# Disable cache for this request
bpm = get_bpm_from_songbpm("Artist", "Song", use_cache=False)
```

### Clear Cache Programmatically

```python
from utils.bpm_scraper import clear_cache

clear_cache()
```

---

## 📝 Development Notes

### Adding Key Detection

The Python scraper can be extended to extract musical key:

```python
# In extract_bpm_from_html():
key_match = text.match(/^([A-G][#b]?)$/i)
if key_match and label.includes('key'):
    return {'bpm': bpm, 'key': key_match[1]}
```

### Rate Limiting

To avoid overloading songbpm.com, consider adding delays:

```python
import time

def get_bpm_from_songbpm(...):
    # Add delay between requests
    time.sleep(0.5)  # 500ms delay
    ...
```

---

## 🎯 Next Steps

1. ✅ Install Python dependencies
2. ✅ Test the scraper
3. ✅ Restart backend
4. ⚡ Enjoy fast, cached BPM lookups!

---

## 📚 Resources

- [SongBPM.com](https://songbpm.com) - Source of BPM data
- [Beautiful Soup Docs](https://www.crummy.com/software/BeautifulSoup/bs4/doc/) - HTML parsing
- [Requests Docs](https://requests.readthedocs.io/) - HTTP library

---

**Need help?** Check the logs in your backend console for detailed error messages.

