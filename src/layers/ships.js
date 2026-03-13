import * as Cesium from 'cesium';

const AISSTREAM_WS = 'wss://stream.aisstream.io/v0/stream';
let ws = null;
const shipCache = new Map();
let warnedAisUnavailable = false;

const SHIP_TYPES = {
  70: 'cargo', 71: 'cargo', 72: 'cargo', 73: 'cargo', 74: 'cargo',
  80: 'tank', 81: 'tank', 82: 'tank', 83: 'tank', 84: 'tank',
  30: 'fish', 32: 'fish',
  35: 'naval', 36: 'naval',
};

function getShipStyle(type) {
  const styles = {
    cargo: { color: Cesium.Color.WHITE, size: 8 },
    tank: { color: Cesium.Color.fromCssColorString('#ffaa00'), size: 9 },
    naval: { color: Cesium.Color.RED, size: 10 },
    fish: { color: Cesium.Color.CYAN, size: 6 },
    other: { color: Cesium.Color.GRAY, size: 6 },
  };
  return styles[type] || styles.other;
}

export function initShips(viewer) {
  const shipSource = new Cesium.CustomDataSource('ships');
  viewer.dataSources.add(shipSource);

  window.layerToggles = window.layerToggles || {};
  ['cargo', 'tank', 'naval', 'fish'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    window.layerToggles[key] = el ? el.checked : false;
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });

  seedFallbackShips(shipSource);

  connectAIS(shipSource);

  viewer.scene.postRender.addEventListener(() => {
    const showLabels = viewer.camera.positionCartographic.height < 3000000;
    shipSource.entities.values.forEach((entity) => {
      const type = entity.properties?.shipType?.getValue
        ? entity.properties.shipType.getValue()
        : null;
      entity.show = window.layerToggles[type] ?? false;
      if (entity.label) entity.label.show = entity.show && showLabels;
    });
  });
}

function connectAIS(shipSource) {
  const key = window.__ENV?.AIS_KEY;
  if (!key) {
    console.warn('AIS key not set, using fallback ship data');
    return;
  }

  let retryCount = 0;
  const MAX_RETRIES = 3;

  function connect() {
    try {
      ws = new WebSocket(AISSTREAM_WS);

      ws.addEventListener('open', () => {
        retryCount = 0;
        ws.send(JSON.stringify({
          APIKey: key,
          BoundingBoxes: [[[-90, -180], [90, 180]]],
          FilterMessageTypes: ['PositionReport'],
        }));
      });

      ws.addEventListener('message', (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.MessageType !== 'PositionReport') return;
          updateShipEntity(msg, shipSource);
        } catch {
          // Skip malformed payloads.
        }
      });

      ws.addEventListener('error', (error) => {
        console.warn('AIS WebSocket error:', error);
      });

      ws.addEventListener('close', () => {
        if (retryCount < MAX_RETRIES) {
          retryCount += 1;
          console.log(`AIS reconnecting (${retryCount}/${MAX_RETRIES})...`);
          setTimeout(connect, 5000 * retryCount);
        } else if (!warnedAisUnavailable) {
          warnedAisUnavailable = true;
          console.warn('AIS max retries reached, using fallback');
        }
      });
    } catch (error) {
      console.warn('AIS connect failed:', error);
    }
  }

  connect();
}

function seedFallbackShips(shipSource) {
  const fallback = [
    { name: 'EVER GIVEN', lat: 30.5, lng: 32.3, type: 'cargo', dest: 'ROTTERDAM' },
    { name: 'PIONEER', lat: 51.5, lng: 1.2, type: 'tank', dest: 'LONDON' },
    { name: 'USS LINCOLN', lat: 26.3, lng: 56.4, type: 'naval', dest: 'BAHRAIN' },
    { name: 'ENDEAVOUR', lat: 1.3, lng: 103.8, type: 'cargo', dest: 'SINGAPORE' },
    { name: 'MING HE', lat: 22.3, lng: 113.9, type: 'cargo', dest: 'HONG KONG' },
    { name: 'HORIZON', lat: 35.6, lng: 139.7, type: 'tank', dest: 'TOKYO' },
    { name: 'BLUE FIN', lat: -33.9, lng: 151.2, type: 'fish', dest: 'SYDNEY' },
    { name: 'ARCTIC STAR', lat: 64.1, lng: -21.9, type: 'cargo', dest: 'REYKJAVIK' },
    { name: 'USS FORD', lat: 37.4, lng: -76.0, type: 'naval', dest: 'NORFOLK VA' },
    { name: 'GULF TITAN', lat: 24.5, lng: 54.4, type: 'tank', dest: 'ABU DHABI' },
  ];

  fallback.forEach((item, index) => {
    const style = getShipStyle(item.type);
    const entity = shipSource.entities.add({
      id: `ship-static-${index}`,
      name: item.name,
      position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, 10),
      point: { pixelSize: style.size, color: style.color, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
      label: {
        text: item.name,
        font: '8pt "JetBrains Mono"',
        fillColor: style.color,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        show: false,
      },
      properties: { shipType: item.type, destination: item.dest, velocity: Math.random() * 12 + 2 },
    });
    entity.worldview = { kind: 'ship', color: style.color, id: entity.id };
  });

  ['cargo', 'tank', 'naval', 'fish'].forEach((type) => updateBadge(type, fallback.filter((item) => item.type === type).length));
  const counter = document.getElementById('hud-count-ships');
  if (counter) counter.textContent = fallback.length;
  if (window.appState) window.appState.stats.ships = fallback.length;
}

function updateShipCounts(shipSource) {
  const counts = { cargo: 0, tank: 0, naval: 0, fish: 0 };
  shipSource.entities.values.forEach((entity) => {
    const type = entity.properties?.shipType?.getValue
      ? entity.properties.shipType.getValue()
      : null;
    if (type && counts[type] !== undefined) counts[type] += 1;
  });

  Object.entries(counts).forEach(([type, count]) => updateBadge(type, count));

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const counter = document.getElementById('hud-count-ships');
  if (counter) counter.textContent = total;
  if (window.appState) window.appState.stats.ships = total;
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

function updateShipEntity(msg, shipSource) {
  const rep = msg.Message.PositionReport;
  const meta = msg.MetaData;
  const mmsi = String(meta.MMSI);
  const lng = rep.Longitude;
  const lat = rep.Latitude;
  const speed = rep.Sog || 0;
  const hdg = rep.Cog || 0;
  const shipType = SHIP_TYPES[Math.floor((meta.ShipType || 0) / 10) * 10] || 'other';

  if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return;

  const pos = Cesium.Cartesian3.fromDegrees(lng, lat, 10);
  const style = getShipStyle(shipType);

  if (!shipCache.has(mmsi)) {
    const entity = shipSource.entities.add({
      id: `ship-${mmsi}`,
      name: meta.ShipName || `SHIP-${mmsi}`,
      position: new Cesium.ConstantPositionProperty(pos),
      point: { pixelSize: style.size, color: style.color, outlineColor: Cesium.Color.BLACK, outlineWidth: 1 },
      label: {
        text: meta.ShipName || mmsi,
        font: '8pt "JetBrains Mono"',
        fillColor: style.color,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        pixelOffset: new Cesium.Cartesian2(0, -16),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 1000000),
        show: false,
      },
      properties: { shipType, mmsi, velocity: speed, heading: hdg, destination: meta.Destination },
    });
    entity.worldview = { kind: 'ship', color: style.color, id: mmsi };
    shipCache.set(mmsi, entity);
  } else {
    const entity = shipCache.get(mmsi);
    entity.position = new Cesium.ConstantPositionProperty(pos);
    entity.properties.velocity = speed;
    entity.properties.heading = hdg;
    entity.properties.destination = meta.Destination;
  }

  updateShipCounts(shipSource);
}
