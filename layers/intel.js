import { Cesium, buildLabel, createPosition } from "../globe.js";
import { ICONS } from "../icons.js";

// Intel layers now pull exclusively from real-time sources where possible.
// Simulated demo data has been completely removed.

function upsertIntelEntity(viewer, layer, item, appearance, meta) {
  let entity = layer.entities.get(item.id);
  if (!entity) {
    entity = viewer.entities.add({ 
      id: `${layer.id}:${item.id}`, 
      position: createPosition(item.lon, item.lat, appearance.alt || 0), 
      ...appearance.graphics, 
      label: buildLabel(item.label || meta.system || meta.region, false) 
    });
    layer.entities.set(item.id, entity);
  }
  entity.position = createPosition(item.lon, item.lat, appearance.alt || 0);
  entity.show = layer.enabled;
  entity.worldview = { layerId: layer.id, kind: meta.kind, meta };
}

export function createIntelLayers(viewer, app) {
  const wildfire = { id: "wildfire", label: "Wildfires", icon: "F", color: "#ff6a3d", enabled: false, entities: new Map(), count: 0 };
  const weather = { id: "weather", label: "Weather", icon: "W", color: "#72f6ff", enabled: false, entities: new Map(), count: 0 };
  const volcanoes = { id: "volcanoes", label: "Volcanoes", icon: "V", color: "#ff4400", enabled: false, entities: new Map(), count: 0 };
  const earthquakes = { id: "earthquakes", label: "Earthquakes", icon: "Q", color: "#ff5b55", enabled: false, entities: new Map(), count: 0 };
  const jamming = { id: "jamming", label: "Jamming Zones", icon: "J", color: "#ffce54", enabled: false, entities: new Map(), count: 0 };

  async function refreshNASAEvents() {
    try {
      const response = await fetch("/api/eonet/events?status=open&days=30");
      if (!response.ok) throw new Error(`NASA EONET ${response.status}`);
      const payload = await response.json();
      const events = payload.events || [];

      // Clean up old entities
      const currentIds = new Set(events.map(e => e.id));
      [wildfire, weather, volcanoes].forEach(layer => {
        layer.entities.forEach((entity, id) => {
          if (!currentIds.has(id)) {
            viewer.entities.remove(entity);
            layer.entities.delete(id);
          }
        });
      });

      events.forEach(event => {
        const category = event.categories?.[0]?.id;
        const geometry = event.geometry?.[0];
        if (!geometry || !geometry.coordinates) return;

        const lon = geometry.coordinates[0];
        const lat = geometry.coordinates[1];
        const id = event.id;

        if (category === "wildfires") {
          upsertIntelEntity(viewer, wildfire, { id, lat, lon }, { 
            graphics: { billboard: { image: ICONS.fire, scale: 0.82, verticalOrigin: Cesium.VerticalOrigin.CENTER } } 
          }, { kind: "wildfire", region: event.title, lat: lat.toFixed(2), lon: lon.toFixed(2), source: event.sources?.[0]?.url || "NASA FIRMS" });
        } else if (category === "volcanoes") {
          upsertIntelEntity(viewer, volcanoes, { id, lat, lon }, {
            graphics: { billboard: { image: ICONS.volcano, scale: 0.85, verticalOrigin: Cesium.VerticalOrigin.CENTER } }
          }, { kind: "volcano", name: event.title, lat: lat.toFixed(2), lon: lon.toFixed(2), source: event.sources?.[0]?.url });
        } else if (category === "severeStorms" || category === "seaLakeIce" || category === "waterColor") {
           upsertIntelEntity(viewer, weather, { id, lat, lon }, {
            graphics: {
              billboard: { image: ICONS.weather, scale: 0.78, verticalOrigin: Cesium.VerticalOrigin.CENTER },
              ellipse: { semiMajorAxis: 150000, semiMinorAxis: 150000, material: Cesium.Color.CYAN.withAlpha(0.08), outline: true, outlineColor: Cesium.Color.CYAN.withAlpha(0.35) },
            },
          }, { kind: "weather", system: event.title, severity: "Active Event", lat: lat.toFixed(2), lon: lon.toFixed(2), source: event.sources?.[0]?.url });
        }
      });

      wildfire.count = wildfire.entities.size;
      weather.count = weather.entities.size;
      volcanoes.count = volcanoes.entities.size;
      [wildfire, weather, volcanoes].forEach(l => app.updateLayerCount(l.id, l.count));
      app.reportAPIStatus("NASA EONET (Intel)", "NOMINAL");
      app.updateSummary();
    } catch (error) {
      app.reportAPIStatus("NASA EONET (Intel)", "ERROR");
    }
  }

  async function refreshUSGSEvents() {
    try {
      const response = await fetch("/api/usgs/all_day.geojson");
      if (!response.ok) throw new Error(`USGS ${response.status}`);
      const payload = await response.json();
      const features = payload.features || [];

      const currentIds = new Set(features.map(f => f.id));
      earthquakes.entities.forEach((entity, id) => {
        if (!currentIds.has(id)) {
          viewer.entities.remove(entity);
          earthquakes.entities.delete(id);
        }
      });

      features.forEach(feat => {
        const [lon, lat, depth] = feat.geometry.coordinates;
        const mag = feat.properties.mag;
        if (mag < 2.5) return; // Only show relevant ones

        upsertIntelEntity(viewer, earthquakes, { id: feat.id, lat, lon }, {
          graphics: {
            billboard: { image: ICONS.quake, scale: 0.6 + (mag / 10), verticalOrigin: Cesium.VerticalOrigin.CENTER },
            ellipse: { semiMajorAxis: mag * 20000, semiMinorAxis: mag * 20000, material: Cesium.Color.RED.withAlpha(0.12), outline: true, outlineColor: Cesium.Color.RED.withAlpha(0.4) }
          }
        }, { kind: "earthquake", location: feat.properties.place, magnitude: mag, depth: `${depth}km`, time: new Date(feat.properties.time).toISOString() });
      });

      earthquakes.count = earthquakes.entities.size;
      app.updateLayerCount(earthquakes.id, earthquakes.count);
      app.reportAPIStatus("USGS (Seismic)", "NOMINAL");
      app.updateSummary();
    } catch (error) {
      app.reportAPIStatus("USGS (Seismic)", "ERROR");
    }
  }

  async function refreshJamming() {
    jamming.count = 0;
    app.updateLayerCount(jamming.id, jamming.count);
    app.updateSummary();
  }

  [wildfire, weather, volcanoes, earthquakes, jamming].forEach((layer) => {
    layer.fetchFn = layer.id === "earthquakes" ? refreshUSGSEvents : (layer.id === "jamming" ? refreshJamming : refreshNASAEvents);
    layer.start = () => {
      if (layer.interval) return;
      layer.fetchFn();
      layer.interval = window.setInterval(layer.fetchFn, 300000); // 5 mins
    };
    layer.stop = () => {
      if (!layer.interval) return;
      clearInterval(layer.interval);
      layer.interval = null;
    };
    layer.onVisibilityChange = () => { 
      layer.entities.forEach((entity) => { entity.show = layer.enabled; }); 
      if (layer.enabled && !layer.interval) layer.start();
    };
    if (layer.enabled) layer.start();
  });

  return [wildfire, weather, volcanoes, earthquakes, jamming];
}



