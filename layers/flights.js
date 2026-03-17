import { Cesium, buildLabel, createPosition, createPulseAxis } from "../globe.js";
import { ICONS } from "../icons.js";

export function removeFlightPath(viewer) {
  ['__flight_path__', '__flight_end__'].forEach(id => {
    const e = viewer.entities.getById(id);
    if (e) viewer.entities.remove(e);
  });
}

export function showFlightPath(viewer, entity) {
  removeFlightPath(viewer);
  const meta = entity.worldview?.meta;
  if (!meta) return;

  const pos = entity.position?.getValue
    ? entity.position.getValue(Cesium.JulianDate.now())
    : null;
  if (!pos) return;

  const carto = Cesium.Cartographic.fromCartesian(pos);
  const lat = Cesium.Math.toDegrees(carto.latitude);
  const lon = Cesium.Math.toDegrees(carto.longitude);
  const heading = meta.heading || 0;
  const speed = parseFloat(meta.speedKts || 0) / 1.94384; // back to m/s

  if (speed < 10) return; // skip stationary

  const R = 6371000;
  let curLat = lat * Math.PI / 180;
  let curLon = lon * Math.PI / 180;
  const hdg = heading * Math.PI / 180;
  const distPerStep = speed * 60; // meters per minute
  const d = distPerStep / R;

  const positions = [];
  for (let i = 0; i <= 60; i++) {
    const newLat = Math.asin(
      Math.sin(curLat) * Math.cos(d) +
      Math.cos(curLat) * Math.sin(d) * Math.cos(hdg)
    );
    const newLon = curLon + Math.atan2(
      Math.sin(hdg) * Math.sin(d) * Math.cos(curLat),
      Math.cos(d) - Math.sin(curLat) * Math.sin(newLat)
    );
    const alt = carto.height || 10000;
    positions.push(
      Cesium.Cartesian3.fromDegrees(
        newLon * 180 / Math.PI,
        newLat * 180 / Math.PI,
        alt
      )
    );
    curLat = newLat;
    curLon = newLon;
  }

  viewer.entities.add({
    id: '__flight_path__',
    polyline: {
      positions: positions,
      width: 1.5,
      material: new Cesium.PolylineDashMaterialProperty({
        color: Cesium.Color.fromCssColorString('#ffffff').withAlpha(0.5),
        dashLength: 12,
      }),
    },
  });

  // Show projected endpoint
  const endPos = positions[positions.length - 1];
  viewer.entities.add({
    id: '__flight_end__',
    position: endPos,
    point: {
      pixelSize: 8,
      color: Cesium.Color.fromCssColorString('#ffaa00').withAlpha(0.8),
      outlineColor: Cesium.Color.WHITE.withAlpha(0.4),
      outlineWidth: 1,
    },
  });
}

function formatAircraftMeta(item, isMilitary = false) {
  return {
    callsign: item.callsign || "UNKNOWN",
    type: isMilitary ? "Military Aircraft" : "Commercial Aircraft",
    altitudeFt: Math.round((item.alt || 0) * 3.28084).toLocaleString(),
    speedKts: Math.round((item.velocity || 0) * 1.94384).toLocaleString(),
    heading: Math.round(item.track || 0),
    squawk: item.squawk || "n/a",
    country: item.country || "Unknown",
    route: isMilitary ? "Operational Track" : "Scheduled Route",
  };
}

function createFlightEntity(viewer, layer, item, isMilitary) {
  const entity = viewer.entities.add({
    id: `${layer.id}:${item.id}`,
    position: Cesium.Cartesian3.fromDegrees(item.lon, item.lat, item.alt),
    point: {
      pixelSize: 5,
      color: isMilitary ? Cesium.Color.ORANGERED : Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      heightReference: Cesium.HeightReference.NONE,
    },
    label: buildLabel(isMilitary ? `${item.callsign} [MIL]` : item.callsign || "FLIGHT"),
    ellipse: isMilitary
      ? {
          semiMajorAxis: createPulseAxis(18000, 6000),
          semiMinorAxis: createPulseAxis(18000, 6000),
          material: Cesium.Color.ORANGERED.withAlpha(0.12),
          outline: true,
          outlineColor: Cesium.Color.ORANGERED.withAlpha(0.4),
        }
      : undefined,
  });
  entity.show = layer.enabled;
  entity.worldview = { layerId: layer.id, kind: "aircraft", meta: formatAircraftMeta(item, isMilitary) };
  return entity;
}

function syncEntities({ viewer, layer, records, isMilitary, app }) {
  const seen = new Set();
  records.forEach((item) => {
    if (item.lat == null || item.lon == null) return;
    const id = `${layer.id}:${item.id}`;
    seen.add(id);
    let entity = layer.entities.get(id);
    if (!entity) {
      entity = createFlightEntity(viewer, layer, item, isMilitary);
      layer.entities.set(id, entity);
    }
    entity.position = Cesium.Cartesian3.fromDegrees(item.lon, item.lat, item.alt);
    entity.label.text = isMilitary ? `${item.callsign} [MIL]` : item.callsign || "FLIGHT";
    entity.label.show = layer.enabled && viewer.camera.positionCartographic.height < 2000000;
    entity.show = layer.enabled;
    entity.worldview.meta = formatAircraftMeta(item, isMilitary);
  });
  Array.from(layer.entities.keys()).forEach((id) => {
    if (seen.has(id)) return;
    const entity = layer.entities.get(id);
    viewer.entities.remove(entity);
    layer.entities.delete(id);
  });
  layer.count = records.length;
  app.updateLayerCount(layer.id, layer.count);
}

function driftRecords(records) {
  return records.map((item, index) => {
    const variance = 0.8;
    return {
      ...item,
      lat: item.lat + Math.sin(Date.now() / 120000 + index) * 0.05 * variance,
      lon: item.lon + Math.cos(Date.now() / 120000 + index) * 0.08 * variance,
    };
  });
}

function extractExistingRecords(layer) {
  return Array.from(layer.entities.values()).map(e => ({
    id: e.id.split(':')[1], // remove layer prefix
    lat: Cesium.Cartographic.fromCartesian(e.position.getValue(Cesium.JulianDate.now())).latitude * 180 / Math.PI,
    lon: Cesium.Cartographic.fromCartesian(e.position.getValue(Cesium.JulianDate.now())).longitude * 180 / Math.PI,
    alt: Cesium.Cartographic.fromCartesian(e.position.getValue(Cesium.JulianDate.now())).height,
    callsign: e.worldview?.meta?.callsign,
    country: e.worldview?.meta?.country,
    velocity: parseFloat(e.worldview?.meta?.speedKts || 0) / 1.94384,
    track: e.worldview?.meta?.heading,
  }));
}

export function createFlightLayers(viewer, app) {
  const commercial = { id: "commercial", label: "Commercial Flights", icon: "A", color: "#ffffff", enabled: true, entities: new Map(), count: 0 };
  const military = { id: "military", label: "Military Aircraft", icon: "M", color: "#ff8a47", enabled: false, entities: new Map(), count: 0 };

  async function fetchCommercial() {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/opensky/api/states/all", {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`OpenSky ${response.status}`);
      const payload = await response.json();
      const records = (payload.states || []).map((state) => ({
        id: state[0],
        callsign: state[1]?.trim() || state[0],
        country: state[2],
        lon: state[5],
        lat: state[6],
        alt: state[7] !== null ? state[7] : (state[13] !== null ? state[13] : 10000),
        onGround: state[8],
        velocity: state[9],
        track: state[10],
        squawk: state[14],
      })).filter((item) => item.lat != null && item.lon != null && !item.onGround).slice(0, 500);
      syncEntities({ viewer, layer: commercial, records, isMilitary: false, app });
      app.reportAPIStatus("OpenSky (Commercial)", "NOMINAL");
    } catch (error) {
      if (error.message.includes("429")) app.reportAPIStatus("OpenSky (Commercial)", "RATE LIMITED");
      else app.reportAPIStatus("OpenSky (Commercial)", "ERROR");
      
      if (commercial.entities.size > 0) {
        // We have real data, just let it drift visually during the rate limit
        const existing = extractExistingRecords(commercial);
        syncEntities({ viewer, layer: commercial, records: driftRecords(existing), isMilitary: false, app });
      } else {
        app.notify("Commercial feed rate limited (429. No real data available.).", "warning");
      }
    } finally {
      clearTimeout(timeoutId);
      app.updateSummary();
    }
  }

  async function fetchMilitary() {
    try {
      const response = await fetch("/api/adsbx/mil");
      if (!response.ok) throw new Error(`ADSBx ${response.status}`);
      const payload = await response.json();
      const aircraft = payload.ac || payload.aircraft || [];
      const records = aircraft.map((item) => ({
        id: item.hex || item.icao || item.callsign,
        callsign: item.flight || item.callsign || item.hex,
        country: item.dbFlags ? "Military Registry" : "Unknown",
        lon: item.lon,
        lat: item.lat,
        alt: (item.alt_baro || 0) * 0.3048,
        velocity: (item.gs || 0) * 0.514444,
        track: item.track || 0,
        squawk: item.squawk,
      })).filter((item) => item.lat != null && item.lon != null).slice(0, 500);
      syncEntities({ viewer, layer: military, records, isMilitary: true, app });
      app.reportAPIStatus("ADSBx (Military)", "NOMINAL");
    } catch (error) {
      if (error.message.includes("429")) app.reportAPIStatus("ADSBx (Military)", "RATE LIMITED");
      else app.reportAPIStatus("ADSBx (Military)", "ERROR");

      if (military.entities.size > 0) {
        const existing = extractExistingRecords(military);
        syncEntities({ viewer, layer: military, records: driftRecords(existing), isMilitary: true, app });
      } else {
        app.notify("Military feed rate limited. No real data available.", "warning");
      }
    } finally {
      app.updateSummary();
    }
  }

  [commercial, military].forEach((layer) => {
    layer.fetchFn = layer.id === "commercial" ? fetchCommercial : fetchMilitary;
    layer.start = () => {
      if (layer.interval) return;
      layer.fetchFn();
      layer.interval = window.setInterval(layer.fetchFn, 15000);
    };
    layer.stop = () => {
      if (!layer.interval) return;
      clearInterval(layer.interval);
      layer.interval = null;
    };
    layer.onVisibilityChange = () => {
      layer.entities.forEach((entity) => { entity.show = layer.enabled; });
    };
    if (layer.enabled) {
      layer.start();
    }
  });

  return [commercial, military];
}

