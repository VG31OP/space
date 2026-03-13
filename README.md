## WorldView

WorldView is a browser-based 3D geospatial OSINT dashboard built on Cesium and Vite. It visualizes live and simulated data for aircraft, satellites, ships, weather, wildfires, GPS jamming, and AI-assisted analysis on a single globe.

### Features

- **Global 3D globe**: Cesium-based earth with OSM imagery, optional Bing aerial overlay, and OSM 3D buildings.
- **Live flights**: OpenSky Network integration with entity trails, per-type layer toggles, and HUD counters.
- **Maritime picture**: AISStream WebSocket integration plus static fallback ships at key chokepoints.
- **Satellites & orbits**: Real-time orbital visualization with inclination and track details.
- **Environmental layers**: Weather, wildfire, GPS-jamming and other threat overlays.
- **Interactive HUD & timeline**: Camera coordinates, UTC clock, AI panel tabs, and time-scrub UI.
- **Entity inspector**: Click entities to get rich detail cards and follow-cam tracking.
- **AI analyst & suggestions**: GPT-based analyst chat and view suggestions driven by live stats.
- **News panel**: Geopolitically relevant headlines with “LOCATE” buttons that fly the globe.

### Requirements

- **Node.js**: v18 or newer (recommended).
- **npm**: v9+ recommended.
- A modern browser with WebGL2 support (Chrome, Edge, or Firefox).

### Installation

```bash
cd worldview
npm install
```

If `node_modules` is already present, you can skip `npm install`, but it is safe to run again.

### Development

Run the Vite dev server:

```bash
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`) in your browser.

### Production build

Create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

### Environment variables

Create a `.env` file in the `worldview` directory (same level as `package.json`) to configure API keys:

```bash
VITE_CESIUM_TOKEN=your_cesium_ion_token        # Optional but recommended for terrain & Bing imagery
VITE_OPENAI_KEY=your_openai_api_key           # Optional, enables AI Analyst & Smart Suggestions
VITE_NEWS_KEY=your_newsapi_org_key            # Optional, enables live news feed
VITE_GOOGLE_KEY=your_google_api_key_optional  # Currently only logged; reserved for future use
```

- **Without `VITE_CESIUM_TOKEN`**: The globe will use OSM imagery and ellipsoid terrain only; a public demo token is used as a fallback for basic access.
- **Without `VITE_OPENAI_KEY`**: The AI Analyst and Suggestions panels fall back to static, non-AI content and UI hints instead of live model calls.
- **Without `VITE_NEWS_KEY`**: The News panel shows a configuration message instead of live headlines.

### Data sources & services

- **OpenSky Network**: Live flight states API.
- **AISStream.io**: Live AIS WebSocket stream (with static fallbacks if unavailable).
- **NewsAPI.org**: News headlines for the geopolitics / aviation / maritime / military feed.
- **OpenAI Chat Completions**: GPT-4o-mini for analyst chat and smart suggestions.
- **Cesium OSM & buildings**: Base imagery and global 3D building layer.

### Known behaviors and runtime safety

- **Missing DOM elements**: All UI modules defensively check for required elements before attaching listeners, avoiding null-reference runtime errors.
- **Missing API keys**: AI and News modules detect absent keys and display clear configuration messages instead of throwing.
- **Network failures**: External fetches and WebSocket connections (OpenSky, AISStream, NewsAPI, OpenAI) are wrapped in `try/catch` blocks with console warnings and safe fallbacks.

If you see any remaining runtime errors in the browser console, please capture the exact message and stack trace so they can be addressed more precisely.

