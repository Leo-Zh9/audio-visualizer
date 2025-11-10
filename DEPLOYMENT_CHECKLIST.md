# Vercel Deployment Checklist

## Step 1: Push to GitHub

```bash
git add .
git commit -m "Add Vercel serverless backend with KV caching"
git push origin main
```

## Step 2: Connect to Vercel

1. Go to vercel.com and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Vercel will auto-detect Vite framework

## Step 3: Get Spotify API Credentials

1. Go to https://developer.spotify.com/dashboard
2. Create a new app
3. Copy your Client ID and Client Secret
4. In Spotify app settings, add redirect URI: `http://localhost:3000/callback`

## Step 4: Add Environment Variables in Vercel

In Vercel project settings → Environment Variables, add:

```
SPOTIFY_CLIENT_ID=your_actual_client_id_here
SPOTIFY_CLIENT_SECRET=your_actual_client_secret_here
```

## Step 5: Create Vercel KV Database

1. In your Vercel project dashboard, go to Storage tab
2. Click "Create Database" → Select "KV"
3. Name it: `audio-visualizer-cache`
4. Click Create
5. Vercel automatically adds these environment variables:
   - KV_URL
   - KV_REST_API_URL
   - KV_REST_API_TOKEN
   - KV_REST_API_READ_ONLY_TOKEN

## Step 6: Deploy

Vercel will automatically build and deploy when you push to GitHub.

Build process:
1. Installs dependencies (`npm install`)
2. Builds Vite frontend (`npm run build`)
3. Deploys frontend to CDN
4. Deploys `/api/song-info.js` as serverless function
5. Connects KV database

## Step 7: Test Your Deployment

Visit your deployed URL and:
1. Search for "Blinding Lights"
2. Check browser console for:
   - Successful API calls to `/api/song-info`
   - BPM, key, genre data
   - Cache layer information

## Troubleshooting

**If API fails:**
- Check Vercel function logs (Functions tab in dashboard)
- Verify environment variables are set
- Ensure KV database is created and linked

**If Spotify search fails:**
- Verify SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET
- Check backend logs for authentication errors

**If caching doesn't work:**
- Verify KV database is created
- Check KV environment variables are present
- Review function logs for KV connection errors

## Expected Performance

- First request: 1-3 seconds (scraping)
- Cached (memory): < 1ms
- Cached (KV): < 50ms
- Cache hit rate: 85-95% after initial usage

