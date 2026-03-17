import { safeFetch } from '../utils/safeFetch.js';

const CACHE_TTL = 10000; // 10 seconds
let lastFetchTime = 0;
let cachedFlights = null;

export async function fetchRealFlights() {
  const now = Date.now();
  
  // Return cached data if within TTL
  if (cachedFlights && (now - lastFetchTime < CACHE_TTL)) {
    return {
      flights: cachedFlights,
      source: 'Cached',
      timestamp: lastFetchTime
    };
  }

  try {
    // Fetch from local backend proxy
    const data = await safeFetch('/api/flights');
    if (!data || !data.aircraft) throw new Error('No aircraft data returned');
    
    const flights = (data.aircraft || []).map(a => ({
      icao24: a.hex,
      callsign: a.flight?.trim() || a.hex?.toUpperCase() || 'UNKWN',
      lat: a.lat,
      lon: a.lon,
      alt: typeof a.alt_baro === 'number' ? a.alt_baro * 0.3048 : 0,
      speed: typeof a.gs === 'number' ? a.gs * 0.514444 : 0,
      heading: a.track || 0,
      source: 'Live (Proxy)'
    })).filter(f => f.lat !== undefined && f.lon !== undefined);

    if (flights.length > 0) {
      cachedFlights = flights;
      lastFetchTime = now;
      return { flights, source: 'Live (Proxy)', timestamp: now };
    }
    throw new Error('No aircraft data returned');
  } catch (err) {
    return {
      flights: [],
      source: 'Failed',
      timestamp: now
    };
  }
}
