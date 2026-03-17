import * as satellite from "satellite.js";
import * as Cesium from 'cesium';
import { robustFetch } from '../utils/api.js';

const TLE_ENDPOINTS = {
  active: "/api/celestrak/NORAD/elements/gp.php?GROUP=active&FORMAT=tle",
  iss: "/api/celestrak/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle",
  starlink: "/api/celestrak/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle",
};

const LIMITS = { active: 300, iss: 1, starlink: 150 };
const satCache = new Map();

export async function initSatellites(viewer) {
  const satSource = new Cesium.CustomDataSource('satellites');
  viewer.dataSources.add(satSource);

  window.layerToggles = window.layerToggles || {};
  ['sats', 'iss', 'star', 'deb'].forEach(key => {
    const el = document.getElementById(`layer-${key}`);
    window.layerToggles[key] = el ? el.checked : (key === 'iss' || key === 'sats');
    if (el) el.addEventListener('change', e => {
      window.layerToggles[key] = e.target.checked;
    });
  });

  const groups = ['iss', 'star', 'active'];
  for (const group of groups) {
    refreshGroup(viewer, satSource, group);
  }

  setInterval(() => {
    updateSatPositions(satSource);
  }, 3000); // Update positions every 3 seconds

  // Refetch TLEs every hour
  setInterval(() => {
    groups.forEach(g => refreshGroup(viewer, satSource, g));
  }, 3600000);
}

async function refreshGroup(viewer, source, group) {
  try {
    const text = await robustFetch(TLE_ENDPOINTS[group] || TLE_ENDPOINTS.active, {}, 3600000, 'text');
    if (!text) return;
    
    const records = parseTle(text).slice(0, LIMITS[group] || 100);

    records.forEach(rec => {
      const satrec = satellite.twoline2satrec(rec.line1, rec.line2);
      if (!satrec) return;
      
      const id = `sat-${satrec.satnum}`;
      if (satCache.has(id)) return;

      const entity = source.entities.add({
        id,
        name: rec.name,
        point: {
          pixelSize: group === 'iss' ? 8 : 3,
          color: group === 'iss' ? Cesium.Color.WHITE : Cesium.Color.CYAN,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1
        },
        label: {
          text: rec.name,
          font: '8pt "JetBrains Mono"',
          show: group === 'iss',
          pixelOffset: new Cesium.Cartesian2(0, -12),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5000000)
        }
      });

      satCache.set(id, { entity, satrec, group });
    });

    updateSatCounts();
  } catch (e) {
    console.warn(`Failed to load ${group} satellites`, e);
  }
}

function updateSatPositions(source) {
  const now = new Date();
  const gmst = satellite.gstime(now);

  for (const [id, sat] of satCache) {
    try {
      const posVel = satellite.propagate(sat.satrec, now);
      if (!posVel || !posVel.position || typeof posVel.position === 'boolean') continue;
      
      const geo = satellite.eciToGeodetic(posVel.position, gmst);
      const pos = Cesium.Cartesian3.fromDegrees(
        satellite.degreesLong(geo.longitude),
        satellite.degreesLat(geo.latitude),
        geo.height * 1000
      );
      
      sat.entity.position = pos;
      
      // Filter by toggle
      const toggleMap = { iss: 'iss', starlink: 'star', active: 'sats' };
      sat.entity.show = window.layerToggles[toggleMap[sat.group]] ?? true;
    } catch (e) {}
  }
}

function parseTle(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const entries = [];
  for (let i = 0; i < lines.length; i += 3) {
    if (lines[i + 2]) {
      entries.push({ name: lines[i], line1: lines[i+1], line2: lines[i+2] });
    }
  }
  return entries;
}

function updateSatCounts() {
    const counts = { sats: 0, iss: 0, star: 0, deb: 0 };
    for(const sat of satCache.values()) {
        if(sat.group === 'active') counts.sats++;
        if(sat.group === 'iss') counts.iss++;
        if(sat.group === 'starlink') counts.star++;
    }
    ['sats', 'iss', 'star', 'deb'].forEach(k => {
        const el = document.getElementById(`badge-${k}`);
        if(el) el.textContent = counts[k];
    });
    const total = Object.values(counts).reduce((a,b) => a+b, 0);
    const hud = document.getElementById('hud-count-sats');
    if(hud) hud.textContent = total;
}
