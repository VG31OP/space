import * as Cesium from 'cesium';

let websocket = null;
const shipCache = new Map();

export function initShips(viewer) {
  const shipSource = new Cesium.CustomDataSource('ships');
  viewer.dataSources.add(shipSource);

  window.layerToggles = window.layerToggles || {};
  ['cargo', 'tank', 'naval', 'fish'].forEach(key => {
    const el = document.getElementById(`layer-${key}`);
    window.layerToggles[key] = el ? el.checked : false;
    if (el) el.addEventListener('change', e => {
      window.layerToggles[key] = e.target.checked;
      updateVisibility(shipSource);
    });
  });

  connect(viewer, shipSource);
}

function connect(viewer, source) {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/ais`;
  
  websocket = new WebSocket(url);
  websocket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.MessageType === 'PositionReport') {
        processShip(msg, viewer, source);
      }
    } catch (e) {}
  };
  
  websocket.onclose = () => {
    setTimeout(() => connect(viewer, source), 10000); // Reconnect after 10s
  };
}

function processShip(msg, viewer, source) {
  const meta = msg.MetaData;
  const pos = msg.Message.PositionReport;
  const mmsi = meta.MMSI;
  
  let type = 'cargo';
  const shipType = meta.ShipType;
  if (shipType >= 70 && shipType <= 79) type = 'cargo';
  else if (shipType >= 80 && shipType <= 89) type = 'tank';
  else if (shipType === 35) type = 'naval';
  else if (shipType >= 30 && shipType <= 32) type = 'fish';

  const id = `ship-${mmsi}`;
  let entity = shipCache.get(id);

  if (!entity) {
    entity = source.entities.add({
      id,
      name: meta.ShipName?.trim() || `MMSI ${mmsi}`,
      point: {
        pixelSize: 4,
        color: getTypeColor(type),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      label: {
        text: meta.ShipName?.trim() || mmsi.toString(),
        font: '8pt "JetBrains Mono"',
        show: false,
        pixelOffset: new Cesium.Cartesian2(0, -10),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000)
      },
      properties: { type }
    });
    shipCache.set(id, entity);
  }

  entity.position = Cesium.Cartesian3.fromDegrees(pos.Longitude, pos.Latitude, 0);
  entity.show = window.layerToggles[type] ?? true;
  
  updateCounts();
}

function getTypeColor(type) {
  switch(type) {
    case 'naval': return Cesium.Color.fromCssColorString('#ff4444');
    case 'tank': return Cesium.Color.fromCssColorString('#ffaa00');
    case 'fish': return Cesium.Color.fromCssColorString('#00ffcc');
    default: return Cesium.Color.fromCssColorString('#00ccff');
  }
}

function updateVisibility(source) {
  source.entities.values.forEach(e => {
    const type = e.properties.type?.getValue ? e.properties.type.getValue() : 'cargo';
    e.show = window.layerToggles[type] ?? true;
  });
}

function updateCounts() {
  const counts = { cargo: 0, tank: 0, naval: 0, fish: 0 };
  shipCache.forEach(e => {
    const t = e.properties.type.getValue();
    if (counts[t] !== undefined) counts[t]++;
  });
  
  Object.keys(counts).forEach(k => {
    const el = document.getElementById(`badge-${k}`);
    if (el) el.textContent = counts[k];
  });
  
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const hud = document.getElementById('hud-count-ships');
  if (hud) hud.textContent = total;
}
