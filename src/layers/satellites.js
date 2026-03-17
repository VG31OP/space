import * as Cesium from 'cesium';
import { safeFetch } from '../utils/safeFetch.js';

const API_URL = 'https://api.le-systeme-solaire.net/rest/bodies/';
const satCache = new Map();

export async function initSatellites(viewer) {
  const satSource = new Cesium.CustomDataSource('satellites');
  satSource.show = true;
  viewer.dataSources.add(satSource);

  window.layerToggles = window.layerToggles || {};
  window.layerToggles['sats'] = true;
  window.layerToggles['iss'] = true;
  window.layerToggles['deb'] = true;
  window.layerToggles['star'] = true;

  ['sats', 'iss', 'deb', 'star'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });
  
  publishSatelliteStatus({ loading: true, error: null });

  const data = await safeFetch(API_URL);

  if (!data || !data.bodies || data.bodies.length === 0) {
    publishSatelliteStatus({
      loading: false,
      error: 'Data unavailable',
      status: 'error',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const bodies = data.bodies
    .filter(b => b.isPlanet || b.bodyType === "Moon")
    .map((b, index) => ({
      id: b.id || `body-${index}`,
      name: b.englishName || b.name,
      gravity: b.gravity,
      density: b.density,
      moons: b.moons ? b.moons.length : 0,
      longitude: (index * 15) % 360 - 180, // Fake layout just to spread them out logically
      latitude: ((index * 5) % 180) - 90,
      radius: (b.meanRadius || 1000) * 1000,
      alt: 5000000 + (index * 100000) // Spread out altitude
    }));

  bodies.forEach((record) => {
    if (satCache.has(record.id)) return;
    satCache.set(record.id, record);
    
    const entity = satSource.entities.add({
      id: `sat-${record.id}`,
      name: record.name,
      position: Cesium.Cartesian3.fromDegrees(record.longitude, record.latitude, record.alt),
      point: {
          pixelSize: 8,
          color: Cesium.Color.fromCssColorString('#00ccff'),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
      },
      label: {
        text: record.name,
        font: '8pt "JetBrains Mono"',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -14),
        show: true,
      },
    });

    entity.show = true;
  });

  publishSatelliteStatus({
    loading: false,
    error: null,
    source: 'le-systeme-solaire',
    isCached: false,
    status: 'success',
    timestamp: new Date().toISOString(),
  });
  
  const counter = document.getElementById('hud-count-sats');
  if (counter) counter.textContent = bodies.length;
  if (window.appState) window.appState.stats.sats = bodies.length;
}

function publishSatelliteStatus(partial) {
  window.appState = window.appState || {};
  window.appState.dataSources = window.appState.dataSources || {};
  window.appState.dataSources.satellites = {
    ...(window.appState.dataSources.satellites || {}),
    ...partial,
  };
  window.dispatchEvent(new CustomEvent('worldview:data-status', {
    detail: {
      source: 'satellites',
      ...(window.appState.dataSources.satellites || {}),
    },
  }));
}

export function clearSatTrack() {}
export function showSatTrack(entity) {}
