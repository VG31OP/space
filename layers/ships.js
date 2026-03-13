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
    entity = viewer.entities.add({
      id: `${layer.id}:${ship.id}`,
      position: createPosition(ship.lon, ship.lat, 0),
      billboard: {
        image: ICONS[ship.type] || ICONS.ship,
        scale: 0.8,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        rotation: Cesium.Math.toRadians((ship.heading || 0) - 90),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: buildLabel(ship.name, false),
    });
    layer.entities.set(ship.id, entity);
  }

  entity.position = createPosition(ship.lon, ship.lat, 0);
  entity.billboard.rotation = Cesium.Math.toRadians((ship.heading || 0) - 90);
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

  function startWebsocket() {
    if (!window.__ENV?.AIS_KEY) {
      app.reportAPIStatus("AIS Stream (Ships)", "KEY REQUIRED");
      app.notify("AIS key not provided. Live vessel tracking is disabled.", "warning");
      return;
    }
    app.reportAPIStatus("AIS Stream (Ships)", "NOMINAL");

    try {
      websocket = new WebSocket("wss://stream.aisstream.io/v0/stream");
      const snapshot = new Map();

      websocket.addEventListener("open", () => {
        websocket.send(
          JSON.stringify({
            APIKey: window.__ENV.AIS_KEY,
            BoundingBoxes: [[[-90, -180], [90, 180]]],
          }),
        );
      });

      websocket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.MessageType !== "PositionReport") {
            return;
          }
          const report = payload.Message?.PositionReport;
          if (!report?.Latitude || !report?.Longitude) {
            return;
          }

          const shipTypeValue = Number(report.ShipType || 70);
          let type = "cargo";
          if (shipTypeValue >= 80 && shipTypeValue <= 89) type = "tanker";
          else if (shipTypeValue === 35) type = "naval";
          else if (shipTypeValue === 30) type = "fishing";
          else if (shipTypeValue >= 60 && shipTypeValue <= 69) type = "passenger";

          snapshot.set(report.UserID, {
            id: String(report.UserID),
            name: report.ShipName || `MMSI ${report.UserID}`,
            type,
            lat: report.Latitude,
            lon: report.Longitude,
            heading: report.TrueHeading || 0,
            speed: report.Sog || 0,
            mmsi: String(report.UserID),
          });

          applyRecords(Array.from(snapshot.values()).slice(-120));
        } catch (error) {
          console.warn("AIS stream parse failure", error);
        }
      });

      websocket.addEventListener("error", () => {
        app.reportAPIStatus("AIS Stream (Ships)", "ERROR");
        app.notify("AIS stream connection error. Live vessel tracking disabled.", "error");
      });

      websocket.addEventListener("close", () => {
        console.warn("AIS stream closed");
      });
    } catch (error) {
      app.reportAPIStatus("AIS Stream (Ships)", "ERROR");
      app.notify("AIS websocket unavailable. Live vessel tracking disabled.", "error");
    }
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
        startWebsocket();
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
    startWebsocket();
  }

  return layerDefs;
}

