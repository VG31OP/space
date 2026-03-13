import * as Cesium from 'cesium';

const UPDATE_INTERVAL = 30000;
const MAX_ENTITIES = 2000;
const OPENSKY_URL = '/api/opensky/api/states/all?lamin=30.0&lomin=-130.0&lamax=70.0&lomax=60.0';
const flightCache = new Map();
let fallbackSeeded = false;
let warned429 = false;

export function initFlights(viewer) {
  const flightSource = new Cesium.CustomDataSource('flights');
  viewer.dataSources.add(flightSource);

  window.layerToggles = window.layerToggles || {};
  ['comm', 'mil', 'heli', 'priv'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    window.layerToggles[key] = el ? el.checked : true;
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });

  async function fetchFlightData() {
    try {
      const res = await fetch(OPENSKY_URL);
      if (res.status === 429) {
        if (!warned429) {
          console.warn('[Flights] OpenSky rate limit hit. Holding last state and using fallback if needed.');
          warned429 = true;
        }
        if (!flightSource.entities.values.length) seedFallbackFlights(flightSource);
        return;
      }
      if (!res.ok) throw new Error(`OpenSky HTTP ${res.status}`);

      warned429 = false;
      const data = await res.json();
      processFlightStates(data.states || [], flightSource);
    } catch (err) {
      if (!fallbackSeeded && !flightSource.entities.values.length) {
        seedFallbackFlights(flightSource);
      }
      console.warn('[Flights] Feed unavailable, keeping current flight layer state.');
    }
  }

  fetchFlightData();
  setInterval(fetchFlightData, UPDATE_INTERVAL);

  viewer.scene.postRender.addEventListener(() => {
    const showLabels = viewer.camera.positionCartographic.height < 2000000;
    flightSource.entities.values.forEach((entity) => {
      const type = entity.properties?.type?.getValue
        ? entity.properties.type.getValue()
        : 'comm';
      entity.show = !!window.layerToggles[type];
      if (entity.label) entity.label.show = entity.show && showLabels;
    });
  });
}

function processFlightStates(states, dataSource) {
  const activeIds = new Set();
  const counts = { comm: 0, mil: 0, heli: 0, priv: 0 };
  let processed = 0;

  for (const state of states) {
    if (processed >= MAX_ENTITIES) break;
    if (state[5] === null || state[6] === null) continue;

    const icao = state[0];
    const callsign = (state[1] || 'UNKWN').trim();
    const lng = state[5];
    const lat = state[6];
    const alt = state[7] || state[13] || 10000;
    const velocity = state[9] || 0;
    const heading = state[10] || 0;
    const category = state[17] || 0;

    activeIds.add(icao);
    processed += 1;

    let type = 'comm';
    let color = Cesium.Color.WHITE;
    if (category === 7) {
      type = 'heli';
      color = Cesium.Color.CYAN;
    } else if (category === 9 || category === 13) {
      type = 'mil';
      color = Cesium.Color.fromCssColorString('#ff6b3d');
    } else if (category === 11 || category === 1) {
      type = 'priv';
      color = Cesium.Color.YELLOW;
    }

    counts[type] += 1;

    const position = Cesium.Cartesian3.fromDegrees(lng, lat, alt);
    const time = Cesium.JulianDate.now();
    const existing = flightCache.get(icao);

    if (!existing) {
      const posProp = new Cesium.SampledPositionProperty();
      posProp.addSample(time, position);

      const entity = dataSource.entities.add({
        id: icao,
        name: callsign,
        position: posProp,
        billboard: {
          image: makePlaneBillboard(color.toCssColorString()),
          scale: 0.95,
          rotation: Cesium.Math.toRadians(heading),
          alignedAxis: Cesium.Cartesian3.UNIT_Z,
        },
        path: {
          resolution: 1,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.1, color: color.withAlpha(0.65) }),
          width: 2,
          leadTime: 0,
          trailTime: 90,
          show: false,
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
          origin: state[2],
          destination: state[12],
          altitude: alt,
          velocity,
          heading,
          data: {
            lat,
            lon: lng,
            track: heading,
            velocity,
            baro_altitude: alt,
          },
        },
      });

      entity.worldview = {
        kind: 'flight',
        color,
        id: icao,
        data: {
          lat,
          lon: lng,
          track: heading,
          velocity,
          baro_altitude: alt,
        },
      };
      flightCache.set(icao, { entity, posProp });
    } else {
      existing.posProp.addSample(time, position);
      existing.entity.billboard.rotation = Cesium.Math.toRadians(heading);
      existing.entity.label.text = `${callsign}\n${Math.round(alt)}m`;
      existing.entity.properties.altitude = alt;
      existing.entity.properties.velocity = velocity;
      existing.entity.properties.heading = heading;
      existing.entity.properties.destination = state[12];
      existing.entity.properties.data = {
        lat,
        lon: lng,
        track: heading,
        velocity,
        baro_altitude: alt,
      };
      existing.entity.worldview.data = {
        lat,
        lon: lng,
        track: heading,
        velocity,
        baro_altitude: alt,
      };
    }
  }

  for (const [id, cached] of flightCache) {
    if (!activeIds.has(id) && !id.startsWith('demo-')) {
      dataSource.entities.remove(cached.entity);
      flightCache.delete(id);
    }
  }

  updateFlightCounts(counts, processed);
}

function seedFallbackFlights(dataSource) {
  if (fallbackSeeded) return;
  fallbackSeeded = true;

  const fallback = [
    { id: 'demo-1', callsign: 'AFR402', lat: 48.9, lng: 2.4, alt: 10800, velocity: 236, heading: 84, type: 'comm' },
    { id: 'demo-2', callsign: 'DLH118', lat: 51.4, lng: -0.3, alt: 11200, velocity: 240, heading: 101, type: 'comm' },
    { id: 'demo-3', callsign: 'RCH204', lat: 37.1, lng: 36.8, alt: 9400, velocity: 210, heading: 132, type: 'mil' },
    { id: 'demo-4', callsign: 'N900JV', lat: 40.7, lng: -73.8, alt: 12400, velocity: 228, heading: 59, type: 'priv' },
  ];

  const counts = { comm: 0, mil: 0, heli: 0, priv: 0 };
  fallback.forEach((item) => {
    const color = item.type === 'mil' ? Cesium.Color.fromCssColorString('#ff6b3d') : item.type === 'priv' ? Cesium.Color.YELLOW : Cesium.Color.WHITE;
    counts[item.type] += 1;
    const entity = dataSource.entities.add({
      id: item.id,
      name: item.callsign,
      position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, item.alt),
      billboard: { image: makePlaneBillboard(color.toCssColorString()), scale: 0.95, rotation: Cesium.Math.toRadians(item.heading), alignedAxis: Cesium.Cartesian3.UNIT_Z },
      path: { show: false },
      label: { text: `${item.callsign}\n${item.alt}m`, font: '9pt "JetBrains Mono"', fillColor: color, show: false },
      properties: { type: item.type, icao: item.id, callsign: item.callsign, altitude: item.alt, velocity: item.velocity, heading: item.heading },
    });
    entity.properties.data = {
      lat: item.lat,
      lon: item.lng,
      track: item.heading,
      velocity: item.velocity,
      baro_altitude: item.alt,
    };
    entity.worldview = {
      kind: 'flight',
      color,
      id: item.id,
      data: {
        lat: item.lat,
        lon: item.lng,
        track: item.heading,
        velocity: item.velocity,
        baro_altitude: item.alt,
      },
    };
    flightCache.set(item.id, { entity, posProp: null });
  });

  updateFlightCounts(counts, fallback.length);
}

function updateFlightCounts(counts, total) {
  ['comm', 'mil', 'heli', 'priv'].forEach((key) => {
    const badge = document.getElementById(`badge-${key}`);
    if (badge) {
      badge.textContent = counts[key];
      badge.classList.remove('updated');
      void badge.offsetWidth;
      badge.classList.add('updated');
    }
  });

  const counter = document.getElementById('hud-count-flights');
  if (counter) counter.textContent = total;
  if (window.appState) window.appState.stats.flights = total;
}

function makePlaneBillboard(color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
