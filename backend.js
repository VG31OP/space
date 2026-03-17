import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const server = createServer(app);

// Environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const AIS_API_KEY = process.env.AIS_API_KEY;

// Cache setup
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

// Log all requests
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// OpenAI Proxy
app.post('/api/openai/chat', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(503).json({ error: 'OpenAI key not configured' });
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    if (req.body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      response.body.pipe(res);
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// News Proxy
app.get('/api/news/top', async (req, res) => {
  if (!NEWS_API_KEY) return res.status(503).json({ error: 'News key not configured' });
  
  const cacheKey = 'news:top';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  try {
    const url = `https://newsapi.org/v2/everything?q=military+geopolitics+aviation+maritime&sortBy=publishedAt&pageSize=10&language=en&apiKey=${NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    setCache(cacheKey, data, 1800000); // 30 min cache
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Flight Data Handler (Aggregated & Normalized)
app.get('/api/flights', async (req, res) => {
  const cacheKey = 'flights:all';
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);
  
  try {
    const endpoints = [
      'https://api.adsb.lol/v2/mil',
      'https://api.adsb.lol/v2/pia',
      'https://api.adsb.lol/v2/ladd'
    ];
    
    console.log('[Flights] Fetching from ADSB.lol...');
    const results = await Promise.all(endpoints.map(async url => {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'WorldView-Cesium' } });
        if (response.ok) {
          const data = await response.json();
          return data.ac || data.aircraft || [];
        }
      } catch (e) { console.warn(`[Flights] Fetch error (${url}): ${e.message}`); }
      return [];
    }));
    
    const combined = [];
    const seen = new Set();
    
    results.flat().forEach(a => {
      if (a && a.hex && !seen.has(a.hex)) {
        seen.add(a.hex);
        // Normalize: Alt (ft -> m), GS (knots -> m/s)
        const altFt = a.alt_baro || a.alt_geom || 0;
        const gsKnots = a.gs || 0;
        
        combined.push({
          id: a.hex,
          lat: a.lat,
          lon: a.lon,
          altitude: altFt * 0.3048,
          velocity: gsKnots * 0.514444,
          heading: a.track || a.nav_heading || 0,
          callsign: a.flight?.trim() || a.hex.toUpperCase(),
          type: a.t || 'UNK',
          source: 'ADSB.lol'
        });
      }
    });
    
    if (combined.length > 0) {
      const result = { aircraft: combined };
      setCache(cacheKey, result, 10000); // 10s cache
      return res.json(result);
    }
  } catch (err) {
    console.warn(`[ADSB.lol] Failed: ${err.message}`);
  }
  
  // Fallback to OpenSky
  try {
    console.log('[Flights] OpenSky Fallback...');
    const response = await fetch('https://api.opensky-network.org/api/states/all');
    if (response.ok) {
      const data = await response.json();
      const result = {
        aircraft: (data.states || []).slice(0, 1000).map(s => ({
          id: s[0],
          lat: s[6],
          lon: s[5],
          altitude: (s[7] || 0) * 0.3048, // ft to m
          velocity: s[9] || 0, // OpenSky is already m/s
          heading: s[10] || 0,
          callsign: s[1]?.trim() || s[0].toUpperCase(),
          source: 'OpenSky'
        })).filter(a => a.lat !== null && a.lon !== null)
      };
      setCache(cacheKey, result, 60000); // 60s fallback cache
      return res.json(result);
    }
  } catch (err) {
    console.warn(`[OpenSky] Failed: ${err.message}`);
  }
  
  res.json(getCache(cacheKey) || { aircraft: [] });
});

// Generic Proxies
app.use('/api/celestrak', async (req, res) => {
  const cacheKey = `celestrak:${req.url}`;
  const cached = getCache(cacheKey);
  if (cached) return res.send(cached);

  const targetUrl = `https://celestrak.org${req.url}`;
  try {
    const response = await fetch(targetUrl);
    const text = await response.text();
    setCache(cacheKey, text, 3600000); // 1 hour cache for TLEs
    res.send(text);
  } catch (err) { res.status(502).send('Error'); }
});

app.use('/api/firms', async (req, res) => {
  const cacheKey = `firms:${req.url}`;
  const cached = getCache(cacheKey);
  if (cached) return res.send(cached);

  const targetUrl = `https://firms.modaps.eosdis.nasa.gov${req.url}`;
  try {
    const response = await fetch(targetUrl);
    const text = await response.text();
    setCache(cacheKey, text, 1800000); // 30 min cache
    res.send(text);
  } catch (err) { res.status(502).send('Error'); }
});

app.use('/api/eonet', async (req, res) => {
  const cacheKey = `eonet:${req.url}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const targetUrl = `https://eonet.gsfc.nasa.gov/api/v3${req.url.replace('/api/eonet', '')}`;
  try {
    const r = await fetch(targetUrl);
    const d = await r.json();
    setCache(cacheKey, d, 900000); // 15 min cache
    res.json(d);
  } catch (e) { res.status(502).send('Error'); }
});

app.use('/api/usgs', async (req, res) => {
  const cacheKey = `usgs:${req.url}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const targetUrl = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary${req.url.replace('/api/usgs', '')}`;
  try {
    const r = await fetch(targetUrl);
    const d = await r.json();
    setCache(cacheKey, d, 300000); // 5 min cache
    res.json(d);
  } catch (e) { res.status(502).send('Error'); }
});

app.get('/api/weather', async (req, res) => {
  const { lat, lon } = req.query;
  const cacheKey = `weather:${lat}:${lon}`;
  const cached = getCache(cacheKey);
  if (cached) return res.json(cached);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&wind_speed_unit=ms`;
  try {
    const r = await fetch(url);
    const d = await r.json();
    setCache(cacheKey, d, 1800000); // 30 min cache
    res.json(d);
  } catch (e) { res.status(502).send('Error'); }
});

// WebSocket Proxy for AIS
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/api/ais') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!AIS_API_KEY) {
        ws.send(JSON.stringify({ error: 'AIS key missing' }));
        ws.close();
        return;
      }
      
      const aisWs = new WebSocket('wss://stream.aisstream.io/v0/stream');
      aisWs.on('open', () => {
        aisWs.send(JSON.stringify({
          APIKey: AIS_API_KEY,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ['PositionReport']
        }));
      });
      aisWs.on('message', (data) => ws.send(data));
      aisWs.on('close', () => ws.close());
      aisWs.on('error', () => ws.close());
      ws.on('close', () => aisWs.close());
    });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});

