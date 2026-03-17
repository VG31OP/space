import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());

// Log all requests
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

const cache = new Map();

function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cache.set(key, { data, time: Date.now(), ttl: ttlMs });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

// Flight Data Handler
app.get('/api/flights', async (req, res) => {
  const cacheKey = 'flights:all';
  const cached = getCache(cacheKey);
  
  if (cached) {
    console.log('[Cache] hit: flights');
    return res.json(cached);
  }
  
  try {
    const endpoints = [
      'https://api.adsb.lol/v2/mil',
      'https://api.adsb.lol/v2/pia',
      'https://api.adsb.lol/v2/ladd'
    ];
    
    console.log('[Flights] Fetching from ADSB.lol sub-endpoints (v2)...');
    const results = await Promise.all(endpoints.map(async url => {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'WorldView-Cesium (contact: worldview@example.com)' }
        });
        if (response.ok) {
          const data = await response.json();
          // Readsb format uses 'ac' instead of 'aircraft'
          const aircraft = data.ac || data.aircraft || [];
          console.log(`[Flights] ${url} -> ${aircraft.length} aircraft`);
          return aircraft;
        } else {
          console.warn(`[Flights] ${url} failed with ${response.status}`);
        }
      } catch (e) { console.warn(`[Flights] Sub-fetch error (${url}): ${e.message}`); }
      return [];
    }));
    
    const combinedAircraft = [];
    const seen = new Set();
    
    results.flat().forEach(a => {
      if (a && a.hex && !seen.has(a.hex)) {
        seen.add(a.hex);
        combinedAircraft.push({
          hex: a.hex,
          flight: a.flight?.trim() || a.hex.toUpperCase(),
          lat: a.lat,
          lon: a.lon,
          alt_baro: a.alt_baro,
          gs: a.gs,
          track: a.track || a.nav_heading || 0
        });
      }
    });
    
    if (combinedAircraft.length > 0) {
      const result = { aircraft: combinedAircraft };
      setCache(cacheKey, result, 10000); // 10s cache
      console.log(`[ADSB.lol] Combined SUCCESS: ${combinedAircraft.length} aircraft`);
      return res.json(result);
    }
  } catch (err) {
    console.warn(`[ADSB.lol] Combined fetch failed: ${err.message}`);
  }
  
  // Fallback to OpenSky
  try {
    console.log('[Flights] Trying OpenSky fallback...');
    const response = await fetch('https://api.opensky-network.org/api/states/all', {
      headers: { 'User-Agent': 'WorldView-Cesium (contact: worldview@example.com)' }
    });
    if (response.ok) {
      const data = await response.json();
      const converted = {
        aircraft: (data.states || []).map(s => ({
          hex: s[0],
          flight: s[1]?.trim() || s[0].toUpperCase(),
          lat: s[6],
          lon: s[5],
          alt_baro: s[7],
          gs: s[9],
          track: s[10]
        })).filter(a => a.lat !== null && a.lon !== null)
      };
      setCache(cacheKey, converted, 60000); // 1 minute cache
      console.log(`[OpenSky] SUCCESS: ${converted.aircraft.length} aircraft`);
      return res.json(converted);
    }
  } catch (err) {
    console.warn(`[OpenSky] Error: ${err.message}`);
  }
  
  // Return stale or empty
  const stale = cache.get(cacheKey)?.data || { aircraft: [] };
  return res.json(stale);
});

// Generic TLE Proxy
app.use('/api/celestrak', async (req, res) => {
  const targetUrl = `https://celestrak.org${req.url}`;
  const cacheKey = `proxy:${targetUrl}`;
  const cached = getCache(cacheKey);
  if (cached) return res.send(cached);
  try {
    const response = await fetch(targetUrl);
    const text = await response.text();
    setCache(cacheKey, text, 3600000);
    res.send(text);
  } catch (err) { res.status(502).send('Error'); }
});

// NASA FIRMS
app.use('/api/firms', async (req, res) => {
  const targetUrl = `https://firms.modaps.eosdis.nasa.gov${req.url}`;
  const cacheKey = `proxy:${targetUrl}`;
  const cached = getCache(cacheKey);
  if (cached) return res.send(cached);
  try {
    const response = await fetch(targetUrl);
    const text = await response.text();
    setCache(cacheKey, text, 1800000); // 30 min
    res.send(text);
  } catch (err) { res.status(502).send('Error'); }
});

// Map Tiles
app.use('/map/tiles', async (req, res) => {
  const targetUrl = `https://tile.openstreetmap.org${req.url}`;
  const cacheKey = `proxy:${targetUrl}`;
  const cached = getCache(cacheKey);
  if (cached) {
    res.set('Content-Type', 'image/png');
    return res.send(cached);
  }
  try {
    const response = await fetch(targetUrl, { headers: { 'User-Agent': 'WorldView' } });
    const buffer = await response.buffer();
    setCache(cacheKey, buffer, 86400000); // 24h
    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) { res.status(502).send('Error'); }
});

// News
app.use('/api/bbc', async (req, res) => {
  const url = `https://feeds.bbci.co.uk${req.url}`;
  try {
    const r = await fetch(url);
    const t = await r.text();
    res.set('Content-Type', 'application/xml');
    res.send(t);
  } catch (e) { res.status(502).send('Error'); }
});

app.use('/api/reuters', async (req, res) => {
  const url = `https://feeds.reuters.com${req.url}`;
  try {
    const r = await fetch(url);
    const t = await r.text();
    res.set('Content-Type', 'application/xml');
    res.send(t);
  } catch (e) { res.status(502).send('Error'); }
});

// Generic
app.use('/api/:provider', async (req, res) => {
  const providers = {
    'usgs': 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary',
    'eonet': 'https://eonet.gsfc.nasa.gov/api/v3',
  };
  const baseUrl = providers[req.params.provider];
  if (!baseUrl) return res.status(404).send('Unknown Provider');
  try {
    const r = await fetch(`${baseUrl}${req.url}`);
    const d = await r.json();
    res.json(d);
  } catch (e) { res.status(502).send('Error'); }
});

const PORT = 5000;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Backend proxy running on http://127.0.0.1:${PORT}`);
});
