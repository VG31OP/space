import * as Cesium from 'cesium';

const AISSTREAM_WS = 'wss://stream.aisstream.io/v0/stream';
let ws = null;
const shipCache = new Map();

const SHIP_TYPES = {
  70: 'cargo', 71: 'cargo', 72: 'cargo', 73: 'cargo', 74: 'cargo',
  80: 'tank', 81: 'tank', 82: 'tank', 83: 'tank', 84: 'tank',
  30: 'fish', 32: 'fish',
  35: 'naval', 36: 'naval',
};

function getShipStyle(type) {
  const styles = {
    cargo: { color: Cesium.Color.DODGERBLUE, size: 5 },
    tank: { color: Cesium.Color.ORANGE, size: 5 },
    naval: { color: Cesium.Color.RED, size: 5 },
    fish: { color: Cesium.Color.CYAN, size: 5 },
    other: { color: Cesium.Color.GRAY, size: 5 },
  };
  return styles[type] || styles.other;
}

export function initShips(viewer) {
  const shipSource = new Cesium.CustomDataSource('ships');
  shipSource.show = true;
  viewer.dataSources.add(shipSource);

  window.layerToggles = window.layerToggles || {};
  window.layerToggles['cargo'] = false;
  window.layerToggles['tank'] = false;
  window.layerToggles['naval'] = false;
  window.layerToggles['fish'] = false;

  ['cargo', 'tank', 'naval', 'fish'].forEach((key) => {
    const el = document.getElementById(`layer-${key}`);
    if (el) el.addEventListener('change', (event) => { window.layerToggles[key] = event.target.checked; });
  });

  connectAIS(shipSource);

  let lastShipToggle = '';
  viewer.scene.postRender.addEventListener(() => {
    const state = JSON.stringify(window.layerToggles);
    if (state === lastShipToggle) return;
    lastShipToggle = state;
    const showLabels = viewer.camera.positionCartographic.height < 3000000;
    shipSource.entities.values.forEach((entity) => {
      const type = entity.properties?.shipType?.getValue ? entity.properties.shipType.getValue() : null;
      const visible = window.layerToggles[type] ?? true;
      entity.show = visible;
      if (entity.label) entity.label.show = visible && showLabels;
    });
  });
}

function connectAIS(shipSource) {
  const key = window.__ENV?.AIS_KEY;
  if (!key || key === '' || key === 'undefined') {
    publishShipStatus({
      loading: false,
      error: 'AIS API key not configured',
      isCached: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      source: 'ais',
    });
    return;
  }

  publishShipStatus({ loading: true, error: null, source: 'ais' });

  try {
    ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

    ws.addEventListener('open', () => {
      publishShipStatus({
        loading: false,
        error: null,
        isCached: false,
        status: 'success',
        timestamp: new Date().toISOString(),
        source: 'ais',
      });
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

    ws.addEventListener('error', () => {
      ws.close();
    });

    ws.addEventListener('close', () => {
        publishShipStatus({
          loading: false,
          error: 'AIS stream unavailable',
          isCached: false,
          status: 'error',
          timestamp: new Date().toISOString(),
          source: 'ais',
        });
    });
  } catch {
       publishShipStatus({
          loading: false,
          error: 'AIS stream unavailable',
          isCached: false,
          status: 'error',
          timestamp: new Date().toISOString(),
          source: 'ais',
        });
  }
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

  const pos = Cesium.Cartesian3.fromDegrees(lng, lat, 100);
  const style = getShipStyle(shipType);

  if (!shipCache.has(mmsi)) {
    const entity = shipSource.entities.add({
      id: `ship-${mmsi}`,
      name: meta.ShipName || `SHIP-${mmsi}`,
      position: new Cesium.ConstantPositionProperty(pos),
      point: {
        pixelSize: style.size,
        color: style.color,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: 0,
        heightReference: Cesium.HeightReference.NONE,
      },
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
    entity.show = true;
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
  publishShipStatus({
    loading: false,
    error: null,
    isCached: false,
    status: 'success',
    timestamp: new Date().toISOString(),
    source: 'ais',
  });
}

function publishShipStatus(partial) {
  window.appState = window.appState || {};
  window.appState.dataSources = window.appState.dataSources || {};
  window.appState.dataSources.ships = {
    ...(window.appState.dataSources.ships || {}),
    ...partial,
  };
  window.dispatchEvent(new CustomEvent('worldview:data-status', {
    detail: {
      source: 'ships',
      ...(window.appState.dataSources.ships || {}),
    },
  }));
}
