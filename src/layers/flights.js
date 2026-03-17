import * as Cesium from 'cesium';
import { fetchRealFlights } from '../api/flight-fetcher.js';

const UPDATE_INTERVAL = 10000; // 10 seconds
const MAX_RENDERED_FLIGHTS = 2000;
const flightCache = new Map();

export function initFlights(viewer) {
  const flightSource = new Cesium.CustomDataSource('flights');
  flightSource.show = true;
  viewer.dataSources.add(flightSource);

  window.layerToggles = window.layerToggles || {};
  window.layerToggles['comm'] = true;
  window.layerToggles['mil'] = false;
  window.layerToggles['heli'] = false;
  window.layerToggles['priv'] = false;

  ['comm', 'mil', 'heli', 'priv'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });

  async function fetchFlightData() {
    publishFlightStatus({ loading: true, error: null });

    try {
      const result = await fetchRealFlights();
      const flights = result.flights;
      
      processFlightStates(flights, flightSource);
      
      publishFlightStatus({
        loading: false,
        error: null,
        source: result.source,
        isCached: result.source === 'Cached' || result.source === 'Demo',
        status: result.source,
        timestamp: new Date(result.timestamp).toISOString(),
        count: flights.length
      });
      
      // Update HUD status label specifically
      const statusText = document.getElementById('dataFreshnessText');
      if (statusText) {
        const count = flights.length;
        statusText.textContent = `Flight Data: ${result.source} (${count} aircraft)`;
      }

    } catch (e) {
      publishFlightStatus({
        loading: false,
        error: 'Data temporarily unavailable',
        source: 'error',
        isCached: false,
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  fetchFlightData();
  setInterval(fetchFlightData, UPDATE_INTERVAL);

  let lastFlightToggle = '';
  viewer.scene.postRender.addEventListener(() => {
    const state = JSON.stringify(window.layerToggles);
    if (state === lastFlightToggle) return;
    lastFlightToggle = state;
    const showLabels = viewer.camera.positionCartographic.height < 2000000;
    flightSource.entities.values.forEach((entity) => {
      const type = entity.properties?.type?.getValue ? entity.properties.type.getValue() : 'comm';
      const visible = window.layerToggles[type] ?? true;
      entity.show = visible;
      if (entity.label) entity.label.show = visible && showLabels;
    });
  });
}

function publishFlightStatus(partial) {
  window.appState = window.appState || {};
  window.appState.dataSources = window.appState.dataSources || {};
  window.appState.dataSources.flights = {
    ...(window.appState.dataSources.flights || {}),
    ...partial,
  };
  window.dispatchEvent(new CustomEvent('worldview:data-status', {
    detail: {
      source: 'flights',
      ...(window.appState.dataSources.flights || {}),
    },
  }));
}

function processFlightStates(flights, dataSource) {
  const activeIds = new Set();
  const totalCounts = { comm: 0, mil: 0, heli: 0, priv: 0 };
  
  // Categorization logic
  const getCategory = (f) => {
    const t = f.t?.toUpperCase() || '';
    if (t.startsWith('H') || t.includes('HELI')) return 'heli';
    // Simplified military check
    if (f.callsign?.startsWith('RCH') || f.callsign?.startsWith('AF') || f.r?.includes('MIL')) return 'mil';
    return 'comm';
  };

  const renderFlights = flights.slice(0, MAX_RENDERED_FLIGHTS);

  for (const f of renderFlights) {
    const icao = f.icao24;
    const callsign = f.callsign;
    const lng = f.lon;
    const lat = f.lat;
    const alt = f.alt || 10000;
    const velocity = f.speed || 0;
    const heading = f.heading || 0;
    const type = getCategory(f);

    activeIds.add(icao);
    totalCounts[type] = (totalCounts[type] || 0) + 1;

    let color = Cesium.Color.WHITE;
    let pixelSize = 4;
    if (type === 'heli') {
      color = Cesium.Color.CYAN;
    } else if (type === 'mil') {
      color = Cesium.Color.ORANGERED;
      pixelSize = 5;
    } else if (type === 'priv') {
      color = Cesium.Color.YELLOW;
    }

    const position = Cesium.Cartesian3.fromDegrees(lng, lat, alt);
    const existing = flightCache.get(icao);

    if (!existing) {
      const entity = dataSource.entities.add({
        id: icao,
        name: callsign,
        position: new Cesium.ConstantPositionProperty(position),
        point: {
          pixelSize,
          color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
          disableDepthTestDistance: 0,
          heightReference: Cesium.HeightReference.NONE,
        },
        label: {
          text: `${callsign}\n${Math.round(alt)}m`,
          font: '9pt "JetBrains Mono"',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          show: false,
        },
        properties: {
          type,
          icao,
          callsign,
          origin: f.origin || '',
          destination: f.destination || '',
          altitude: alt,
          velocity,
          heading,
          data: { lat, lon: lng, track: heading, velocity, baro_altitude: alt },
        },
      });

      entity.show = true;
      entity.worldview = {
        kind: 'flight',
        color,
        id: icao,
        data: { lat, lon: lng, track: heading, velocity, baro_altitude: alt },
      };
      flightCache.set(icao, { entity });
    } else {
      existing.entity.position = new Cesium.ConstantPositionProperty(position);
      existing.entity.point.pixelSize = pixelSize;
      existing.entity.point.color = color;
      existing.entity.label.text = `${callsign}\n${Math.round(alt)}m`;
      existing.entity.properties.altitude = alt;
      existing.entity.properties.velocity = velocity;
      existing.entity.properties.heading = heading;
      existing.entity.properties.data = { lat, lon: lng, track: heading, velocity, baro_altitude: alt };
      existing.entity.worldview.data = { lat, lon: lng, track: heading, velocity, baro_altitude: alt };
    }
  }

  // Remove stale aircraft
  for (const [id, cached] of flightCache) {
    if (!activeIds.has(id)) {
      dataSource.entities.remove(cached.entity);
      flightCache.delete(id);
    }
  }

  updateFlightCounts(totalCounts, flights.length);
}

function updateFlightCounts(counts, total) {
  ['comm', 'mil', 'heli', 'priv'].forEach((key) => {
    const badge = document.getElementById(`badge-${key}`);
    if (badge) {
      badge.textContent = counts[key] || 0;
      badge.classList.remove('updated');
      void badge.offsetWidth;
      badge.classList.add('updated');
    }
  });

  const counter = document.getElementById('hud-count-flights');
  if (counter) counter.textContent = total;
  if (window.appState) {
      window.appState.stats = window.appState.stats || {};
      window.appState.stats.flights = total;
  }
}
