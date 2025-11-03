# 🎵 Spotify API Setup Guide

## Why Spotify API?

Spotify API provides:
- ✅ **Better search quality** than iTunes
- ✅ **Handles typos** better
- ✅ **More songs** (70+ million tracks)
- ✅ **Popularity scores** to prioritize hits
- ✅ **Direct Spotify links** (real track URLs, not search)
- ✅ **Better matching** for queries like "2 soon keshi"

---

## Quick Setup (5 Minutes)

### Step 1: Get Spotify API Credentials

1. Go to https://developer.spotify.com/dashboard
2. **Log in** with your Spotify account (free account works)
3. Click **"Create app"**
4. Fill in:
   - **App name**: Music Analysis App
   - **App description**: BPM analysis tool
   - **Redirect URI**: `http://localhost:5000/callback` (not used, but required)
   - **APIs used**: Web API
5. Click **"Save"**
6. Click **"Settings"**
7. Copy your:
   - **Client ID** (e.g., `abc123def456...`)
   - **Client Secret** (click "View client secret")

### Step 2: Add Credentials to .env

Open `backend/.env` and add:

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
```

**Example**:
```env
SPOTIFY_CLIENT_ID=abc123def456ghi789jkl012mno345pq
SPOTIFY_CLIENT_SECRET=rst678uvw901xyz234abc567def890ghi
```

### Step 3: Restart Backend

```bash
cd backend
npm start
```

That's it! ✅

---

## Test It Works

```bash
# Test search endpoint
curl "http://localhost:5000/api/search?query=2%20soon%20keshi"

# Should return:
{
  "title": "2 soon",
  "artist": "keshi",
  "spotifyUrl": "https://open.spotify.com/track/5SlU0Yhi51jobhEiGE4xDv"
}
```

---

## What Now Works

### ✅ Different Input Formats
```
"2 soon keshi" ✅
"keshi 2 soon" ✅
"2soonkeshi" ✅
All → "2 Soon" by keshi
```

### ✅ Spelling Mistakes (Better)
```
"leviteting" → "Levitating" by Dua Lipa ✅
"babby" → "Baby" by Justin Bieber ✅
"shpe of you" → "Shape of You" by Ed Sheeran ✅
```

### ✅ Title Priority
```
"baby" → "Baby" by Justin Bieber (not Baby by Brandy) ✅
Prioritizes most popular song with matching title
```

### ✅ Real Spotify Links
```
Before: https://open.spotify.com/search/... (search page)
After: https://open.spotify.com/track/5SlU0... (direct track link) ✅
```

---

## How It Works

### Smart Scoring System:

```javascript
Score Calculation:
- Title word match: +20 points
- Artist word match: +5 points
- Title starts with word: +10 points
- Exact title match: +100 points
- Popularity (0-100): +(popularity/5) = up to +20 points
- Very popular (>80): +30 bonus points
- Unmatched words in title: -8 points each
```

### Popularity Threshold:

```javascript
if (bestMatch.popularity < 30 && score < 40) {
  // This is probably wrong - use most popular song instead
  return mostPopularTrack
}
```

This ensures typos like "levitain" → "Levitating" (popular) instead of "Levitainted" (obscure).

---

## Comparison: iTunes vs Spotify

| Feature | iTunes API | Spotify API |
|---------|-----------|-------------|
| Song coverage | ~30M | ~70M |
| Typo handling | Basic | Better |
| Popularity scores | ❌ No | ✅ Yes |
| Direct links | ❌ No | ✅ Yes |
| Search quality | Good | Excellent |
| Credentials needed | ❌ None | ✅ Free API key |

---

## Troubleshooting

### "Spotify credentials not configured" error

**Solution**: Add credentials to `backend/.env` (see Step 2 above)

### "Failed to fetch Spotify token" error

**Possible causes**:
1. Invalid Client ID or Secret (check for typos)
2. Credentials not copied fully (check for trailing spaces)
3. App not created in Spotify Dashboard

**Fix**: Double-check credentials, regenerate if needed

### Search still returns wrong songs

For severe typos (3+ character errors), even Spotify struggles. Suggestions:
1. User should type more accurately
2. Add autocomplete/suggestions in frontend
3. Show multiple results for user to choose

---

## Without Spotify Credentials

If you don't set up Spotify API:
- System falls back to returning error
- User gets message: "Could not find song"
- They need to refine their search

**Recommendation**: Set up Spotify API for best user experience!

---

## Next Steps After Setup

1. ✅ Add credentials to `.env`
2. ✅ Restart backend
3. ✅ Test: `curl "http://localhost:5000/api/search?query=2%20soon%20keshi"`
4. ✅ Verify Spotify URLs work
5. 🚀 Deploy to production (Render/Vercel)

---

**Need help?** Check Spotify docs: https://developer.spotify.com/documentation/web-api

