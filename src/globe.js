import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
let viewer = null;
export async function initGlobe() {
const ionToken = import.meta.env.VITE_CESIUM_TOKEN;
if (ionToken) {
Cesium.Ion.defaultAccessToken = ionToken;
}
viewer = new Cesium.Viewer('cesiumContainer', {
animation: false,
baseLayerPicker: false,
fullscreenButton: false,
vrButton: false,
geocoder: false,
homeButton: false,
infoBox: false,
sceneModePicker: false,
selectionIndicator: false,
timeline: false,
navigationHelpButton: false,
navigationInstructionsInitiallyVisible: false,
imageryProvider: false,
shouldAnimate: true,
contextOptions: {
webgl: {
alpha: false,
antialias: true,
preserveDrawingBuffer: true,
failIfMajorPerformanceCaveat: false,
powerPreference: 'high-performance',
},
},
});
try {
viewer.imageryLayers.removeAll();
const osm = new Cesium.OpenStreetMapImageryProvider({
url: 'https://tile.openstreetmap.org/',
});
viewer.imageryLayers.addImageryProvider(osm);
} catch(e) {
}
try {
viewer.scene.globe.enableLighting = true;
} catch(e) {}
try {
viewer.scene.globe.showGroundAtmosphere = true;
viewer.scene.globe.atmosphereLightIntensity = 10.0;
} catch(e) {}
try {
viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#1a3a5c');
} catch(e) {}
try {
viewer.scene.fog.enabled = false;
} catch(e) {}
try {
viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0c10');
} catch(e) {}
try {
viewer.scene.globe.depthTestAgainstTerrain = true;
} catch(e) {}
try {
viewer.scene.requestRenderMode = false;
} catch(e) {}
try {
viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
} catch(e) {}
if (ionToken) {
try {
const terrain = await Cesium.CesiumTerrainProvider.fromIonAssetId(1);
viewer.terrainProvider = terrain;
} catch(e) {
}
try {
  const bingProvider = await Cesium.IonImageryProvider.fromAssetId(2);
  viewer.imageryLayers.addImageryProvider(bingProvider);
} catch(e) {
}
}
try {
const osm = await Cesium.createOsmBuildingsAsync();
osm.style = new Cesium.Cesium3DTileStyle({
color: 'color("#99aabb", 0.9)',
});
viewer.scene.primitives.add(osm);
} catch(e) {
}
try {
viewer.camera.setView({
destination: Cesium.Cartesian3.fromDegrees(78.9629, 22.5937, 18000000),
orientation: {
heading: 0,
pitch: Cesium.Math.toRadians(-90),
roll: 0,
},
});
} catch(e) {}
setStatus('NOMINAL', false);
window.viewer = viewer;
return viewer;
}
function setStatus(text, isCritical) {
const dot = document.getElementById('statusDot');
const label = document.getElementById('statusText');
const pill = document.getElementById('statusPill');
if (label) label.textContent = text;
if (dot) {
dot.classList.toggle('critical', isCritical);
dot.classList.toggle('nominal', !isCritical);
}
if (pill) pill.classList.toggle('alert', isCritical);
}
export function getViewer() {
return viewer;
}
