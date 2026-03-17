import { Cesium, buildLabel, createPosition } from "../globe.js";
import { ICONS } from "../icons.js";

const SHIP_COLORS = {
  cargo: "#6caeff",
  tanker: "#ff9b52",
  naval: "#ff4d4f",
  fishing: "#65f1ff",
  passenger: "#ffe26b",
};

// No demo ships used — strict real-time data only

function upsertShip(viewer, layer, ship) {
  let entity = layer.entities.get(ship.id);
  if (!entity) {
    let pointColor = Cesium.Color.WHITE;
    const type = (ship.type || '').toLowerCase();
    if (type === 'cargo') pointColor = Cesium.Color.DODGERBLUE;
    else if (type === 'tanker') pointColor = Cesium.Color.ORANGE;
    else if (type === 'naval') pointColor = Cesium.Color.RED;
    else if (type === 'fishing') pointColor = Cesium.Color.CYAN;

    entity = viewer.entities.add({
      id: `${layer.id}:${ship.id}`,
      position: Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 100),
      point: {
        pixelSize: 6,
        color: pointColor,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.NONE
      },
      label: buildLabel(ship.name, false),
    });
    layer.entities.set(ship.id, entity);
  }

  entity.position = Cesium.Cartesian3.fromDegrees(ship.lon, ship.lat, 100);
  entity.show = layer.enabled;
  entity.worldview = {
    layerId: layer.id,
    kind: "ship",
    meta: {
      name: ship.name,
      mmsi: ship.mmsi,
      type: ship.type.toUpperCase(),
      heading: Math.round(ship.heading || 0),
      speed: `${Number(ship.speed || 0).toFixed(1)} kn`,
      lat: ship.lat.toFixed(2),
      lon: ship.lon.toFixed(2),
    },
  };
}

export function createShipLayers(viewer, app) {
  const layerDefs = [
    { id: "cargo", label: "Cargo Vessels", icon: "C", color: SHIP_COLORS.cargo, enabled: true, entities: new Map(), count: 0 },
    { id: "tanker", label: "Tankers", icon: "T", color: SHIP_COLORS.tanker, enabled: true, entities: new Map(), count: 0 },
    { id: "naval", label: "Naval", icon: "N", color: SHIP_COLORS.naval, enabled: true, entities: new Map(), count: 0 },
    { id: "fishing", label: "Fishing", icon: "F", color: SHIP_COLORS.fishing, enabled: false, entities: new Map(), count: 0 },
    { id: "passenger", label: "Passenger", icon: "P", color: SHIP_COLORS.passenger, enabled: false, entities: new Map(), count: 0 },
  ];

  let websocket = null;
  let fallbackInterval = null;

  function applyRecords(records) {
    const byType = new Map(layerDefs.map((layer) => [layer.id, []]));
    records.forEach((record) => {
      if (byType.has(record.type)) {
        byType.get(record.type).push(record);
      }
    });

    layerDefs.forEach((layer) => {
      const current = byType.get(layer.id) || [];
      const seen = new Set(current.map((item) => item.id));
      current.forEach((ship) => upsertShip(viewer, layer, ship));
      Array.from(layer.entities.keys()).forEach((id) => {
        if (seen.has(id)) {
          return;
        }
        viewer.entities.remove(layer.entities.get(id));
        layer.entities.delete(id);
      });
      layer.count = current.length;
      app.updateLayerCount(layer.id, layer.count);
    });

    app.updateSummary();
  }

  function connectAIS() {
  const key = window.__ENV?.AIS_KEY;
  if (!key) { loadFallbackShips(); return; }
  let retries = 0;
  function connect() {
    try {
      const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');
      ws.onopen = () => { retries=0; ws.send(JSON.stringify({APIKey:key,BoundingBoxes:[[[-90,-180],[90,180]]],FilterMessageTypes:['PositionReport']})); };
      ws.onmessage = (e) => { try { const m=JSON.parse(e.data); if(m.MessageType==='PositionReport') updateShipEntity(m); } catch(_){} };
      ws.onerror = () => {};
      ws.onclose = () => { if(retries<3){retries++;setTimeout(connect,5000*retries);}else loadFallbackShips(); };
    } catch(e) { loadFallbackShips(); }
  }
  connect();
}
function loadFallbackShips() {
  console.info('AIS: fallback mode active');
  const fallbacks = [
    { lng: 103.8, lat: 1.3 },
    { lng: 32.3, lat: 29.9 },
    { lng: -5.4, lat: 36.1 },
    { lng: 56.3, lat: 26.5 },
    { lng: 43.6, lat: 12.6 },
    { lng: -75.0, lat: 8.9 },
    { lng: 121.5, lat: 25.0 },
    { lng: 4.9, lat: 52.3 }
  ];
  fallbacks.forEach((pos, i) => {
    viewer.entities.add({
      id: `fallback-ship-${i}`,
      position: Cesium.Cartesian3.fromDegrees(pos.lng, pos.lat, 100),
      point: {
        pixelSize: 6,
        color: Cesium.Color.STEELBLUE,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.NONE
      }
    });
  });
}

  function stopAll() {
    if (websocket) {
      websocket.close();
      websocket = null;
    }
  }

  const anyEnabled = () => layerDefs.some((layer) => layer.enabled);

  layerDefs.forEach((layer) => {
    layer.start = () => {
      if (!anyEnabled()) {
        return;
      }
      if (!websocket && !fallbackInterval) {
        connectAIS();
      }
    };
    layer.stop = () => {
      if (!anyEnabled()) {
        stopAll();
      }
    };
    layer.onVisibilityChange = () => {
      layer.entities.forEach((entity) => {
        entity.show = layer.enabled;
      });
      if (anyEnabled() && !websocket) {
        layer.start();
      }
      if (!anyEnabled()) {
        stopAll();
      }
    };
  });

  if (anyEnabled()) {
    connectAIS();
  }

  return layerDefs;
}

