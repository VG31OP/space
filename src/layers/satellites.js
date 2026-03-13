import * as Cesium from 'cesium';
import * as satellite from 'satellite.js';

const TLE_SOURCES = {
  sats: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
  iss: 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=tle',
  deb: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=1982-092&FORMAT=tle',
  star: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
};

const satCache = new Map();

export async function initSatellites(viewer) {
  const satSource = new Cesium.CustomDataSource('satellites');
  viewer.dataSources.add(satSource);

  window.layerToggles = window.layerToggles || {};
  ['sats', 'iss', 'deb', 'star'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    window.layerToggles[key] = el ? el.checked : true;
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });

  const tleGroups = await Promise.allSettled(
    Object.entries(TLE_SOURCES).map(async ([key, url]) => {
      const res = await fetch(url);
      const text = await res.text();
      return { key, records: parseTLE(text) };
    }),
  );

  let totalCount = 0;
  for (const result of tleGroups) {
    if (result.status !== 'fulfilled') continue;
    const { key, records } = result.value;

    records.forEach((record) => {
      const uniqueId = `${key}-${record.norad}`;
      if (satCache.has(uniqueId)) return;

      satCache.set(uniqueId, { satrec: record.satrec, key, name: record.name, norad: record.norad });
      const style = getStyle(key);

      const entity = satSource.entities.add({
        id: `sat-${uniqueId}`,
        name: record.name,
        position: new Cesium.CallbackProperty(() => propagatePosition(record.satrec), false),
        point: style.point,
        path: {
          resolution: 60,
          material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.08, color: style.color.withAlpha(0.55) }),
          width: 1.6,
          leadTime: 1800,
          trailTime: 1800,
          show: false,
        },
        label: {
          text: record.name,
          font: '8pt "JetBrains Mono"',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: style.color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 25000000),
          show: false,
        },
        properties: {
          type: key,
          name: record.name,
          norad: record.norad,
          satrec: record.satrec,
          inclination: record.inclination,
          period: record.period,
          altitudeKm: record.altitudeKm,
        },
      });

      entity.worldview = { kind: 'satellite', satrec: record.satrec, color: style.color, norad: record.norad, id: uniqueId };
      totalCount += 1;
    });

    updateBadge(key, records.length);
  }

  viewer.scene.postRender.addEventListener(() => {
    const camH = viewer.camera.positionCartographic.height;
    const showLabels = camH < 20000000;

    satSource.entities.values.forEach((entity) => {
      const type = entity.properties?.type?.getValue
        ? entity.properties.type.getValue()
        : null;
      entity.show = type ? (window.layerToggles[type] ?? true) : true;
      if (entity.label) entity.label.show = entity.show && showLabels;
    });
  });

  const counter = document.getElementById('hud-count-sats');
  if (counter) counter.textContent = totalCount;
  if (window.appState) window.appState.stats.sats = totalCount;
}

function parseTLE(tleText) {
  const lines = tleText.split('\n').map((line) => line.trim()).filter(Boolean);
  const records = [];

  for (let index = 0; index + 2 < lines.length; index += 3) {
    try {
      const line1 = lines[index + 1];
      const line2 = lines[index + 2];
      const satrec = satellite.twoline2satrec(line1, line2);
      const meanMotion = parseFloat(line2.slice(52, 63));
      const altitudeKm = meanMotion ? Math.max(120, Math.round(((86400 / meanMotion) / (2 * Math.PI)) * 7.2 - 6371)) : undefined;
      records.push({
        name: lines[index].replace(/\s+/g, ' ').trim(),
        norad: line1.slice(2, 7).trim(),
        satrec,
        inclination: Number.parseFloat(line2.slice(8, 16)),
        period: meanMotion ? Math.round((1440 / meanMotion) * 10) / 10 : undefined,
        altitudeKm,
      });
    } catch {
      // Skip bad TLE record.
    }
  }

  return records;
}

function propagatePosition(satrec, date = Cesium.JulianDate.toDate(Cesium.JulianDate.now())) {
  const pv = satellite.propagate(satrec, date);
  if (!pv || !pv.position || typeof pv.position === 'boolean') return undefined;
  const gmst = satellite.gstime(date);
  const geo = satellite.eciToGeodetic(pv.position, gmst);
  return Cesium.Cartesian3.fromRadians(geo.longitude, geo.latitude, geo.height * 1000);
}

function getStyle(key) {
  const styles = {
    iss: { color: Cesium.Color.WHITE, pixelSize: 12 },
    star: { color: Cesium.Color.fromCssColorString('#4488ff'), pixelSize: 4 },
    deb: { color: Cesium.Color.DARKGRAY, pixelSize: 3 },
    sats: { color: Cesium.Color.fromCssColorString('#00ccff'), pixelSize: 6 },
  };
  const style = styles[key] || styles.sats;

  return {
    color: style.color,
    point: {
      pixelSize: style.pixelSize,
      color: style.color,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 1,
      scaleByDistance: new Cesium.NearFarScalar(150, 1.5, 8000000, 0.5),
    },
  };
}

function updateBadge(key, count) {
  const badge = document.getElementById(`badge-${key}`);
  if (badge) {
    badge.textContent = count;
    badge.classList.remove('updated');
    void badge.offsetWidth;
    badge.classList.add('updated');
  }
}

export function sampleOrbitPositions(satrec, minutes = 120, stepMinutes = 4) {
  const positions = [];
  const now = new Date();

  for (let minute = -minutes / 2; minute <= minutes / 2; minute += stepMinutes) {
    const sampleDate = new Date(now.getTime() + minute * 60000);
    const position = propagatePosition(satrec, sampleDate);
    if (position) positions.push(position);
  }

  return positions;
}
