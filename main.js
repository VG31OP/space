import "./style.css";
import { Cesium, initGlobe } from "./globe.js";
import { createFlightLayers } from "./layers/flights.js";
import { createSatelliteLayers, showSatelliteTrack, removeSatelliteTrack } from "./layers/satellites.js";
import { createShipLayers } from "./layers/ships.js";
import { showFlightPath, removeFlightPath } from "./layers/flights.js";
import { createIntelLayers } from "./layers/intel.js";
import { createAiPanel } from "./ui/ai.js";
import { createModes } from "./ui/modes.js";
import { createLayerPanel } from "./ui/panel.js";
import "./ui/entity-popup.js";

window.__ENV = {
  CESIUM_TOKEN: import.meta.env.VITE_CESIUM_TOKEN || "",
  GOOGLE_KEY: import.meta.env.VITE_GOOGLE_KEY || "",
  OPENAI_KEY: import.meta.env.VITE_OPENAI_KEY || "",
  NEWS_KEY: import.meta.env.VITE_NEWS_KEY || "",
  AIS_KEY: import.meta.env.VITE_AIS_KEY || "",
};

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function createApp(viewer) {
  window.viewer = viewer; // User scripts expect this global

  const statusPill = document.getElementById("statusPill");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const alertStack = document.getElementById("alertStack");
  const popup = document.getElementById("entityPopup");
  const popupContent = document.getElementById("popupContent");
  const popupClose = document.getElementById("popupClose");
  const hudFlights = document.getElementById("hudFlights");
  const hudSatellites = document.getElementById("hudSatellites");
  const hudShips = document.getElementById("hudShips");
  const coordLat = document.getElementById("coordLat");
  const coordLng = document.getElementById("coordLng");
  const coordAlt = document.getElementById("coordAlt");
  const utcClock = document.getElementById("utcClock");
  const leftCollapse = document.getElementById("leftCollapse");
  const leftPanel = document.getElementById("leftPanel");
  const layerPanelBody = document.getElementById("layerPanelBody");
  const layers = new Map();
  const recentAlerts = new Map();
  const apiHealth = new Map([
    ["OpenSky (Commercial)", "NOMINAL"],
    ["ADSBx (Military)", "NOMINAL"],
    ["NASA EONET (Intel)", "NOMINAL"],
    ["USGS (Seismic)", "NOMINAL"],
    ["AIS Stream (Ships)", "NOMINAL"],
    ["Celestrak (Space)", "NOMINAL"],
    ["News (Geopolitical)", "NOMINAL"],
    ["OpenAI (Analyst)", "NOMINAL"],
  ]);
  const healthModal = document.getElementById("healthModal");
  const healthGrid = document.getElementById("healthGrid");
  const healthClose = document.getElementById("healthClose");
  const sections = [
    { title: "Aircraft", layers: [] },
    { title: "Space", layers: [] },
    { title: "Maritime", layers: [] },
    { title: "Intel", layers: [] },
  ];
  const summary = { flights: 0, military: 0, satellites: 0, ships: 0 };

  const miniMap = L.map("miniMap", {
    attributionControl: false,
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false,
  }).setView([20, 0], 1);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 5 }).addTo(miniMap);
  const miniMarker = L.circleMarker([20, 0], { radius: 4, color: "#ff5b55", fillColor: "#ff5b55", fillOpacity: 1 }).addTo(miniMap);

  let panel = {
    setLayerState() {},
    setLayerCount() {},
  };

  popupClose.addEventListener("click", () => hidePopup());
  healthClose.addEventListener("click", () => healthModal.classList.add("hidden"));
  statusPill.addEventListener("click", () => showHealthModal());

  leftCollapse.addEventListener("click", () => {
    leftPanel.classList.toggle("collapsed");
    leftCollapse.textContent = leftPanel.classList.contains("collapsed") ? "+" : "-";
  });

  function showHealthModal() {
    healthGrid.innerHTML = Array.from(apiHealth.entries()).map(([name, status]) => {
      let cls = "status-good";
      let label = status;
      if (status === "RATE LIMITED" || status === "DEGRADED") cls = "status-limited";
      if (status === "KEY REQUIRED" || status === "ERROR" || status === "401 UNAUTHORIZED") cls = "status-err";
      return `
        <div class="health-item">
          <div class="health-name">${name}</div>
          <div class="health-status-badge ${cls}">${label}</div>
        </div>
      `;
    }).join("");
    healthModal.classList.remove("hidden");
  }

  function setStatus(text, level = "nominal") {
    statusText.textContent = text;
    statusPill.classList.toggle("alert", level === "alert");
    statusDot.classList.toggle("alert", level === "alert");
  }

  function notify(message, level = "info") {
    const lastShown = recentAlerts.get(message);
    if (lastShown && Date.now() - lastShown < 60000) {
      return;
    }
    recentAlerts.set(message, Date.now());
    const card = document.createElement("div");
    card.className = `alert-card${level === "warning" ? " warning" : ""}`;
    card.innerHTML = `<div>${message}</div><button class="news-action">DISMISS</button>`;
    card.querySelector("button").addEventListener("click", () => card.remove());
    alertStack.appendChild(card);
    window.setTimeout(() => card.remove(), 8000);
  }

  function updateClock() {
    const now = new Date();
    utcClock.textContent = `${now.toISOString().slice(11, 19)} UTC`;
  }

  function updateCameraReadout() {
    const cartographic = viewer.camera.positionCartographic;
    const lat = Cesium.Math.toDegrees(cartographic.latitude);
    const lng = Cesium.Math.toDegrees(cartographic.longitude);
    const alt = cartographic.height;
    coordLat.textContent = `LAT: ${lat.toFixed(4)}°`;
    coordLng.textContent = `LNG: ${lng.toFixed(4)}°`;
    coordAlt.textContent = `ALT: ${Math.round(alt).toLocaleString()}m`;
    miniMarker.setLatLng([lat, lng]);
    miniMap.setView([lat, lng], alt < 1000000 ? 3 : alt < 3000000 ? 2 : 1, { animate: false });
  }

  function updateSummary() {
    summary.flights = (layers.get("commercial")?.count || 0) + (layers.get("military")?.count || 0);
    summary.military = layers.get("military")?.count || 0;
    summary.satellites = (layers.get("activeSatellites")?.count || 0) + (layers.get("iss")?.count || 0) + (layers.get("starlink")?.count || 0) + (layers.get("debris")?.count || 0);
    summary.ships = (layers.get("cargo")?.count || 0) + (layers.get("tanker")?.count || 0) + (layers.get("naval")?.count || 0) + (layers.get("fishing")?.count || 0) + (layers.get("passenger")?.count || 0);
    hudFlights.textContent = formatNumber(summary.flights);
    hudSatellites.textContent = formatNumber(summary.satellites);
    hudShips.textContent = formatNumber(summary.ships);
  }

  function flyTo(lat, lng, alt = 1500000) {
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt), duration: 1.2 });
  }

  function hidePopup() {
    popup.classList.add("hidden");
    removeSatelliteTrack(viewer);
    removeFlightPath(viewer);
    if(window.clearSatTrack) window.clearSatTrack();
    if(window.clearFlightPath) window.clearFlightPath();
  }

  function drawOrbit(entity) {
    const satRecord = entity.worldview?.satRecord;
    if (!satRecord) return;
    entity.worldview.orbitShown = !entity.worldview.orbitShown;
    if (entity.worldview.orbitEntity) entity.worldview.orbitEntity.show = entity.show && entity.worldview.orbitShown;
  }

  function popupField(label, value) {
    return `<div class="popup-field"><label>${label}</label><span>${value}</span></div>`;
  }

  function showEntityPopup(entity) {
    const meta = entity.worldview?.meta || {};
    const kind = entity.worldview?.kind;
    const title = kind === "aircraft" ? `? ${meta.callsign || entity.name || "AIRCRAFT"}` : kind === "satellite" ? `?? ${meta.name || entity.name || "SATELLITE"}` : kind === "ship" ? `?? ${meta.name || "VESSEL"}` : `? ${meta.zone || meta.region || entity.name || "INTEL"}`;
    const fields = kind === "aircraft" ? [
      popupField("Type", meta.type), popupField("Country", meta.country), popupField("Altitude", `${meta.altitudeFt} ft`), popupField("Speed", `${meta.speedKts} kts`), popupField("Heading", `${meta.heading}°`), popupField("Squawk", meta.squawk)
    ] : kind === "satellite" ? [
      popupField("NORAD", meta.norad), popupField("Incl", `${meta.inclination}°`), popupField("Period", `${meta.period} min`), popupField("Altitude", `${meta.altitudeKm} km`), popupField("Lat", `${meta.lat}°`), popupField("Lon", `${meta.lon}°`)
    ] : kind === "ship" ? [
      popupField("Type", meta.type), popupField("MMSI", meta.mmsi), popupField("Heading", `${meta.heading}°`), popupField("Speed", meta.speed), popupField("Lat", `${meta.lat}°`), popupField("Lon", `${meta.lon}°`)
    ] : Object.entries(meta).slice(0, 6).map(([key, value]) => popupField(key, value));

    popupContent.innerHTML = `
      <div class="popup-header">
        <div class="popup-title">${title}</div>
        <div class="status-note">${entity.worldview?.layerId || ""}</div>
      </div>
      <div class="popup-grid">${fields.join("")}</div>
      <div class="popup-actions">
        <button class="popup-action" data-action="track">TRACK</button>
        <button class="popup-action" data-action="fly">FLY TO</button>
        ${kind === "satellite" ? '<button class="popup-action" data-action="orbit">SHOW ORBIT</button><button class="popup-action" data-action="sattrack">SHOW TRACK</button>' : ""}
        ${kind === "aircraft" ? '<button class="popup-action" data-action="flightpath">SHOW PATH</button>' : ""}
      </div>
    `;

    popupContent.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action;
        if (action === "track") viewer.trackedEntity = entity;
        if (action === "fly") {
          const position = entity.position?.getValue(Cesium.JulianDate.now());
          if (position) {
            viewer.camera.flyTo({ destination: position, duration: 1.4, offset: new Cesium.HeadingPitchRange(0, -0.7, 250000) });
          }
        }
        if (action === "orbit") drawOrbit(entity);
        if (action === "sattrack") showSatelliteTrack(viewer, entity);
        if (action === "flightpath") showFlightPath(viewer, entity);
      });
    });

    popup.classList.remove("hidden");
  }

  viewer.screenSpaceEventHandler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (Cesium.defined(picked) && picked.id?.worldview) {
      const entity = picked.id;
      showEntityPopup(entity);
      if (window.showSatTrack && entity.worldview.kind === "satellite") window.showSatTrack(entity);
      if (window.showFlightPath && entity.worldview.kind === "aircraft") window.showFlightPath(entity);
      // Auto-show track/path on click
      if (entity.worldview.kind === "aircraft") showFlightPath(viewer, entity);
    } else {
      hidePopup();
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  viewer.camera.changed.addEventListener(() => {
    updateCameraReadout();
  });

  window.setInterval(updateClock, 1000);
  updateClock();
  updateCameraReadout();

  return {
    layers,
    sections,
    panel,
    notify,
    flyTo,
    setStatus(text) { setStatus(text, text === "ALERT" ? "alert" : "nominal"); },
    setAlertStatus(text) { setStatus(text, "alert"); },
    updateLayerCount(layerId, count) {
      panel.setLayerCount(layerId, count);
      const layer = layers.get(layerId);
      if (layer) layer.count = count;
    },
    reportAPIStatus(name, status) {
      apiHealth.set(name, status);
      const anyErr = Array.from(apiHealth.values()).some(s => s === "ERROR" || s === "KEY REQUIRED");
      const anyWarn = Array.from(apiHealth.values()).some(s => s === "RATE LIMITED" || s === "DEGRADED");
      if (anyErr) setStatus("CRITICAL", "alert");
      else if (anyWarn) setStatus("DEGRADED", "nominal");
      else setStatus("NOMINAL", "nominal");
    },
    updateSummary,
    getContext() {
      const cartographic = viewer.camera.positionCartographic;
      return {
        flightCount: summary.flights,
        militaryCount: summary.military,
        satelliteCount: summary.satellites,
        shipCount: summary.ships,
        camera: {
          lat: Cesium.Math.toDegrees(cartographic.latitude).toFixed(2),
          lng: Cesium.Math.toDegrees(cartographic.longitude).toFixed(2),
          alt: Math.round(cartographic.height),
        },
      };
    },
    registerLayers(layerList, sectionTitle) {
      const section = sections.find((item) => item.title === sectionTitle);
      layerList.forEach((layer) => {
        layers.set(layer.id, layer);
        section.layers.push(layer);
      });
    },
    attachPanel() {
      panel = createLayerPanel({
        container: layerPanelBody,
        sections,
        onToggle(layerId) {
          const layer = layers.get(layerId);
          if (!layer) return;
          layer.enabled = !layer.enabled;
          layer.entities.forEach((entity) => { entity.show = layer.enabled; });
          layer.onVisibilityChange?.();
          if (layer.enabled) layer.start?.(); else layer.stop?.();
          panel.setLayerState(layer.id, layer.enabled);
          panel.setLayerCount(layer.id, layer.count);
          updateSummary();
        },
      });
      this.panel = panel;
    },
  };
}

async function bootstrap() {
  const viewer = await initGlobe();
  const app = createApp(viewer);
  const modeController = createModes();
  modeController.bindButtons(Array.from(document.querySelectorAll(".mode-pill")));

  const flightLayers = createFlightLayers(viewer, app);
  const satelliteLayers = createSatelliteLayers(viewer, app);
  const shipLayers = createShipLayers(viewer, app);
  const intelLayers = createIntelLayers(viewer, app);

  app.registerLayers(flightLayers, "Aircraft");
  app.registerLayers(satelliteLayers, "Space");
  app.registerLayers(shipLayers, "Maritime");
  app.registerLayers(intelLayers, "Intel");
  app.attachPanel();

  app.sections.forEach((section) => {
    section.layers.forEach((layer) => {
      app.panel.setLayerState(layer.id, layer.enabled);
      app.panel.setLayerCount(layer.id, layer.count);
    });
  });

  createAiPanel(app);
  if (!window.__ENV.CESIUM_TOKEN) {
    app.notify("Cesium Ion token missing. Globe is running in degraded imagery mode.", "warning");
    app.setAlertStatus("ALERT");
  } else {
    app.setStatus("NOMINAL");
  }
  app.updateSummary();
}

bootstrap().catch((error) => {
  console.error(error);
  document.getElementById("statusText").textContent = "ALERT";
  document.getElementById("statusPill").classList.add("alert");
});

(function(){const c=document.getElementById('starfield');if(!c)return;const x=c.getContext('2d');let s=[];function resize(){c.width=innerWidth;c.height=innerHeight;}function init(){s=[];for(let i=0;i<350;i++)s.push({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*1.1+0.2,a:Math.random()*0.6+0.2,d:Math.random()>0.5?1:-1,sp:Math.random()*0.015+0.004});}let ss=null;function shoot(){ss={x:Math.random()*c.width*0.6,y:Math.random()*c.height*0.25,a:1,len:Math.random()*100+60,spd:Math.random()*5+3,ang:Math.PI/4+(Math.random()-0.5)*0.3};}function draw(){x.clearRect(0,0,c.width,c.height);s.forEach(p=>{p.a+=p.sp*p.d;if(p.a>1){p.a=1;p.d=-1;}if(p.a<0.1){p.a=0.1;p.d=1;}x.beginPath();x.arc(p.x,p.y,p.r,0,Math.PI*2);x.fillStyle='rgba(200,220,255,'+p.a+')';x.fill();});if(ss){const dx=Math.cos(ss.ang)*ss.len;const dy=Math.sin(ss.ang)*ss.len;const g=x.createLinearGradient(ss.x,ss.y,ss.x+dx,ss.y+dy);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(255,255,255,'+ss.a+')');x.beginPath();x.moveTo(ss.x,ss.y);x.lineTo(ss.x+dx,ss.y+dy);x.strokeStyle=g;x.lineWidth=1.5;x.stroke();ss.x+=Math.cos(ss.ang)*ss.spd;ss.y+=Math.sin(ss.ang)*ss.spd;ss.a-=0.018;if(ss.a<=0)ss=null;}requestAnimationFrame(draw);}resize();init();draw();setInterval(shoot,3500);window.addEventListener('resize',()=>{resize();init();});})();

