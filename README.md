# Audio Visualizer

An advanced 3D audio visualizer featuring custom GLSL shaders and vertex-level wave animation. The system scrapes song metadata (BPM, musical key, genre) from SongBPM.com and visualizes it through an organic 3D cloud with individual vertex displacement driven by Fractal Brownian Motion noise. The cloud is surrounded by orbital rings that revolve like electrons around a nucleus. The entire scene responds to musical characteristics through dynamic color shifting and morphing animations.

## Technical Features

**3D Shape Modeling**
- Custom vertex displacement using 6-octave Fractal Brownian Motion (FBM)
- Per-vertex tidal wave propagation with phase-based angular positioning
- Multi-layered noise (base, medium, fine, micro-detail) for organic complexity
- Vertex-level amplitude modulation (extruded areas move more than flat areas)
- IcosahedronGeometry with 120 subdivisions (43,200 vertices) for smooth detail

**Wave Animation System**
- Dual-axis orbiting tidal waves that travel across the cloud surface
- Each vertex calculates its own displacement based on angular position
- Traveling wave equations: sin(angularPos + time × frequency)
- Smooth vertex-level transitions creating solar flare-like ripples
- BPM-reactive morphing speed and wave intensity

**Shader Implementation**
- Custom GLSL vertex and fragment shaders
- HSL color space conversion for dynamic palette generation
- Multi-directional lighting (key, fill, rim, side, backlight)
- Subsurface scattering simulation for translucent glow
- Horizontal line texture using fwidth() for pixel-perfect 3px lines
- Clamp-based brightness ceiling to prevent bloom washout

**Data & Integration**
- Real-time web scraping of SongBPM.com for BPM, key, and genre metadata
- Hybrid caching system (in-memory + Vercel KV Redis) for sub-50ms cached responses
- Musical key to color mapping system (24 keys with emotional color associations)
- Spotify Web API integration for track search and metadata
- Vercel serverless backend with automatic scaling

**Visual Elements**
- 8 independent orbital rings revolving at physics-based speeds (inner fast, outer slow)
- Orbital rings rotate constantly regardless of BPM for ambient motion
- Cinematic postprocessing stack (Bloom, DepthOfField, Vignette, BrightnessContrast)
- ACES filmic tone mapping for professional color grading
- Atmospheric fog and multi-point lighting system for depth

## Tech Stack

**Frontend**
- React
- Vite
- Three.js
- react-three-fiber
- react-three-drei
- react-three-postprocessing
- GLSL shaders
- Framer Motion
- Tailwind CSS

**Backend**
- Vercel Serverless Functions (Node.js runtime)
- Vercel KV (Redis-backed persistent cache)
- Axios (HTTP client)
- Cheerio (HTML parsing)
- Spotify Web API (track search)

## Setup

### Prerequisites

- Node.js v16 or higher
- Vercel account
- Spotify Developer account

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:

Create `backend/.env` with your Spotify credentials:
```
SPOTIFY_CLIENT_ID=<get from developer.spotify.com/dashboard>
SPOTIFY_CLIENT_SECRET=<get from developer.spotify.com/dashboard>
```

For local KV testing, create `.env.local` with Vercel KV credentials:
```
KV_URL=<from Vercel KV dashboard>
KV_REST_API_URL=<from Vercel KV dashboard>
KV_REST_API_TOKEN=<from Vercel KV dashboard>
KV_REST_API_READ_ONLY_TOKEN=<from Vercel KV dashboard>
```

3. Run development server:
```bash
npm run dev
```

4. Open http://localhost:5173

For testing serverless functions locally:
```bash
npm i -g vercel
vercel dev
```

### Production Deployment

**Quick Start:**
1. Push code to GitHub
2. Import repository in Vercel dashboard
3. Create Vercel KV database named `audio-visualizer-cache`
4. Add Spotify credentials as environment variables
5. Deploy

**Detailed Steps:**

**Step 1: Push to GitHub**
```bash
git add .
git commit -m "Deploy audio visualizer"
git push origin main
```

**Step 2: Import to Vercel**
- Visit vercel.com and sign in
- Click "Add New Project"
- Import your GitHub repository
- Vercel auto-detects Vite configuration

**Step 3: Create KV Database**
- In Vercel project dashboard: Storage → Create Database → KV
- Database name: `audio-visualizer-cache`
- Vercel automatically links KV environment variables to your project

**Step 4: Add Spotify Credentials**
- In Vercel project: Settings → Environment Variables
- Add:
  - `SPOTIFY_CLIENT_ID` (get from developer.spotify.com/dashboard)
  - `SPOTIFY_CLIENT_SECRET` (get from developer.spotify.com/dashboard)

**Step 5: Deploy**
- Vercel automatically builds and deploys on push
- Frontend served via CDN
- Serverless function available at `/api/song-info`

**Architecture:**
- Frontend: Static Vite build on Vercel CDN
- Backend: Serverless function at `/api/song-info`
- Cache: Hybrid (in-memory 50 entries + KV Redis global)
- TTL: 30 minutes
- Cache hit latency: < 1ms (memory) or < 50ms (KV)
- Cache miss latency: 1-3 seconds (web scraping)

## Project Structure

```
├── src/
│   ├── App.jsx                           # Main application, UI, search logic
│   ├── components/
│   │   ├── CloudVisualizerContainer.jsx  # 3D scene with cloud and effects
│   │   └── WindLines.jsx                 # Orbital ring system
│   ├── index.css                         # Global styles and design tokens
│   └── main.jsx                          # React entry point
├── api/
│   └── song-info.js                      # Serverless function (BPM scraper + KV cache)
├── backend/                              # Legacy Node/Express server (unused in production)
│   ├── server.js
│   ├── routes/
│   └── utils/
│       └── bpm_scraper.py                # Python scraper (replaced by JS version)
├── vercel.json                           # Vercel deployment configuration
├── package.json                          # Dependencies and scripts
└── tailwind.config.js                    # Tailwind CSS configuration
```

**Production Stack:**
- Frontend: Vite + React + Three.js (deployed to Vercel CDN)
- Backend: Vercel Serverless Function at `/api/song-info`
- Database: Vercel KV (Redis) for persistent caching
- External APIs: Spotify Web API, SongBPM.com (scraped)

## License

MIT
