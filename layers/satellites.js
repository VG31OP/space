import * as satellite from "satellite.js";
import { Cesium, buildLabel, createPosition } from "../globe.js";
import { ICONS } from "../icons.js";

const TLE_ENDPOINTS = {
  active: "/api/celestrak/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  iss: "/api/celestrak/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle",
  starlink: "/api/celestrak/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
  debris: "/api/celestrak/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle",
};

const LIMITS = { active: 1500, iss: 1, starlink: 1200, debris: 500 };

function parseTle(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const entries = [];
  for (let i = 0; i < lines.length; i += 3) {
    if (lines[i + 2]) {
      entries.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
    }
  }
  return entries;
}

function sampleItems(items, max) {
  if (items.length <= max) return items;
  const step = items.length / max;
  return Array.from({ length: max }, (_, index) => items[Math.floor(index * step)]);
}

function orbitalPeriodMinutes(meanMotion) {
  const value = Number(meanMotion);
  return Number.isFinite(value) && value > 0 ? (1440 / value).toFixed(1) : "n/a";
}

function satVelocityKmS(velocityEci) {
  if (!velocityEci) return "n/a";
  const vx = velocityEci.x || 0;
  const vy = velocityEci.y || 0;
  const vz = velocityEci.z || 0;
  return Math.sqrt(vx * vx + vy * vy + vz * vz).toFixed(2);
}

function buildEntityOptions(group, name) {
  if (group === "iss") {
    return {
      point: { pixelSize: 6, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.YELLOW, outlineWidth: 2 },
      label: buildLabel("ISS"),
    };
  }
  if (group === "starlink") {
    return {
      point: { pixelSize: 3, color: Cesium.Color.CYAN.withAlpha(0.8), outlineColor: Cesium.Color.WHITE.withAlpha(0.5), outlineWidth: 1 },
      label: buildLabel(name.replace(/^STARLINK-?/i, "").trim() || name, false),
    };
  }
  if (group === "debris") {
    return { point: { pixelSize: 2, color: Cesium.Color.DARKGRAY.withAlpha(0.6) } };
  }
  // Active satellites
  return {
    point: { pixelSize: 4, color: Cesium.Color.LIGHTGREEN.withAlpha(0.9), outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
    label: buildLabel(name, false),
  };
}

function createOrbitPolyline(viewer, satRecord, show) {
  const orbitPoints = [];
  const now = new Date();
  for (let minutes = 0; minutes < 100; minutes += 4) {
    const at = new Date(now.getTime() + minutes * 60000);
    const pv = satellite.propagate(satRecord.satrec, at);
    if (!pv.position) continue;
    const gmst = satellite.gstime(at);
    const geo = satellite.eciToGeodetic(pv.position, gmst);
    orbitPoints.push(Cesium.Cartesian3.fromDegrees(satellite.degreesLong(geo.longitude), satellite.degreesLat(geo.latitude), geo.height * 1000));
  }
  return viewer.entities.add({
    polyline: { positions: orbitPoints, width: 2, material: Cesium.Color.CYAN.withAlpha(0.45), show },
  });
}

export function createSatelliteLayers(viewer, app) {
  const satGroups = new Map();
  const auxIntervals = new Map();
  const layers = [
    { id: "activeSatellites", label: "Active Satellites", icon: "S", color: "#72f6ff", group: "active", enabled: true, entities: new Map(), count: 0 },
    { id: "iss", label: "ISS", icon: "I", color: "#ffffff", group: "iss", enabled: true, entities: new Map(), count: 0 },
    { id: "starlink", label: "Starlink", icon: "L", color: "#7cf9ff", group: "starlink", enabled: false, entities: new Map(), count: 0 },
    { id: "debris", label: "Debris", icon: "·", color: "#b6c1c8", group: "debris", enabled: false, entities: new Map(), count: 0 },
  ];

  layers.forEach((layer) => satGroups.set(layer.group, []));

  async function fetchGroup(group) {
    const response = await fetch(TLE_ENDPOINTS[group]);
    if (!response.ok) throw new Error(`Failed TLE fetch for ${group}`);
    const text = await response.text();
    return sampleItems(parseTle(text), LIMITS[group]).map((entry) => ({ ...entry, satrec: satellite.twoline2satrec(entry.line1, entry.line2) }));
  }

  async function refreshGroup(group) {
    const records = await fetchGroup(group);
    satGroups.set(group, records);
    updateEntities(group);
    app.reportAPIStatus("Celestrak (Space)", "NOMINAL");
  }

  function updateEntities(group) {
    const records = satGroups.get(group) || [];
    const layer = layers.find((item) => item.group === group);
    if (!layer) return;
    const now = new Date();
    const nextIds = new Set();

    records.forEach((record, index) => {
      const id = `${group}:${record.name}:${index}`;
      const posVel = satellite.propagate(record.satrec, now);
      if (!posVel.position) return;
      const gmst = satellite.gstime(now);
      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const lat = satellite.degreesLat(geo.latitude);
      const lon = satellite.degreesLong(geo.longitude);
      const alt = geo.height * 1000;
      nextIds.add(id);

      let entity = layer.entities.get(id);
      if (!entity) {
        entity = viewer.entities.add({ id, position: createPosition(lon, lat, alt), ...buildEntityOptions(group, record.name) });
        entity.worldview = { layerId: layer.id, kind: "satellite", orbitShown: group === "iss", satRecord: record };
        if (group === "iss") entity.worldview.orbitEntity = createOrbitPolyline(viewer, record, layer.enabled);
        layer.entities.set(id, entity);
      }

      entity.position = createPosition(lon, lat, alt);
      entity.show = layer.enabled;
      entity.name = record.name;
      entity.worldview.meta = {
        name: record.name,
        norad: record.line1.slice(2, 7).trim(),
        inclination: Number(record.line2.split(/\s+/)[2] || 0).toFixed(2),
        period: orbitalPeriodMinutes(record.satrec.no * (1440 / (2 * Math.PI))),
        altitudeKm: (alt / 1000).toFixed(0),
        lat: lat.toFixed(2),
        lon: lon.toFixed(2),
        velocity: satVelocityKmS(posVel.velocity),
      };
      if (entity.label) entity.label.show = layer.enabled && viewer.camera.positionCartographic.height < 2000000;
      if (entity.worldview.orbitEntity) entity.worldview.orbitEntity.show = layer.enabled && entity.worldview.orbitShown;
    });

    Array.from(layer.entities.keys()).forEach((id) => {
      if (nextIds.has(id)) return;
      const entity = layer.entities.get(id);
      if (entity?.worldview?.orbitEntity) viewer.entities.remove(entity.worldview.orbitEntity);
      viewer.entities.remove(entity);
      layer.entities.delete(id);
    });

    layer.count = layer.entities.size;
    app.updateLayerCount(layer.id, layer.count);
    app.updateSummary();
  }

  function startLayer(layer) {
    if (auxIntervals.has(layer.id)) return;
    refreshGroup(layer.group).catch((error) => app.notify(`Satellite feed degraded for ${layer.label}: ${error.message}`, "warning"));
    const tick = window.setInterval(() => updateEntities(layer.group), 10000);
    const refetch = window.setInterval(() => {
      refreshGroup(layer.group).catch((error) => console.warn("Satellite refetch failed", error));
    }, 15 * 60 * 1000);
    auxIntervals.set(layer.id, [tick, refetch]);
  }

  function stopLayer(layer) {
    const timers = auxIntervals.get(layer.id);
    if (!timers) return;
    timers.forEach((timer) => clearInterval(timer));
    auxIntervals.delete(layer.id);
  }

  layers.forEach((layer) => {
    layer.start = () => startLayer(layer);
    layer.stop = () => stopLayer(layer);
    layer.onVisibilityChange = () => {
      layer.entities.forEach((entity) => {
        entity.show = layer.enabled;
        if (entity.worldview?.orbitEntity) entity.worldview.orbitEntity.show = layer.enabled && entity.worldview.orbitShown;
      });
    };
    if (layer.enabled) layer.start();
  });

  return layers;
}

