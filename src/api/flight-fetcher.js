import { robustFetch } from '../utils/api.js';

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
    const data = await robustFetch('/api/flights');
    if (!data || !data.aircraft) throw new Error('No aircraft data returned');
    
    const flights = (data.aircraft || []).map(a => ({
      icao24: a.id,
      callsign: a.callsign,
      lat: a.lat,
      lon: a.lon,
      alt: a.altitude,
      speed: a.velocity,
      heading: a.heading,
      source: a.source || 'Live (Proxy)'
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
