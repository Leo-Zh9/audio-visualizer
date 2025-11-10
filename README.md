# Audio Visualizer

An advanced 3D audio visualizer featuring custom GLSL shaders and vertex-level wave animation. The centerpiece is an organic cloud shape with individual vertex displacement driven by Fractal Brownian Motion noise and BPM-synchronized tidal waves that propagate across the surface. Each orbital ring revolves independently around the cloud at physics-based speeds.

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

**Additional Features**
- Real-time BPM, key, and genre scraping from SongBPM.com
- 8 independent orbital rings with physics-based revolution speeds
- Cinematic postprocessing (Bloom, DepthOfField, Vignette, BrightnessContrast)
- ACES tone mapping for filmic color response
- Spotify Web API integration for track search

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
- Node.js
- Express
- Python
- BeautifulSoup4
- Requests
- Spotify Web API

## Setup

### Prerequisites

- Node.js v16 or higher
- Python 3.x
- Spotify API credentials

### Installation

1. Install dependencies:
```bash
npm install
cd backend && npm install
pip install -r requirements.txt
```

2. Configure Spotify API in `backend/.env`:
```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
```

3. Run the application:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
npm run dev
```

4. Open browser at `http://localhost:5173`

## Project Structure

```
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── CloudVisualizerContainer.jsx
│   │   └── WindLines.jsx
│   └── index.css
├── backend/
│   ├── server.js
│   ├── routes/
│   │   ├── search.js
│   │   ├── features.js
│   │   └── bpm.js
│   └── utils/
│       └── bpm_scraper.py
└── package.json
```

## License

MIT
