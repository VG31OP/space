import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

let viewer = null;

export async function initGlobe() {
  const ionToken = import.meta.env.VITE_CESIUM_TOKEN;
  Cesium.Ion.defaultAccessToken = ionToken || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc4ZTgiLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk';

  try {
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
      imageryProvider: new Cesium.OpenStreetMapImageryProvider({
        url: 'https://tile.openstreetmap.org/',
      }),
    });

    viewer.scene.globe.enableLighting = true;
    viewer.scene.globe.atmosphereLightIntensity = 10.0;
    viewer.scene.backgroundColor = Cesium.Color.BLACK;

    if (ionToken) {
      try {
        const bingProvider = await Cesium.IonImageryProvider.fromAssetId(2);
        viewer.imageryLayers.addImageryProvider(bingProvider);
      } catch {
        console.warn('[Globe] Bing imagery unavailable, using OSM');
      }

      try {
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync({
          requestWaterMask: true,
          requestVertexNormals: true,
        });
      } catch {
        console.warn('[Globe] Terrain failed, using ellipsoid');
      }
    }

    await loadOSMBuildings();

    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 20, 20000000),
      duration: 2,
    });

    setStatus('NOMINAL');
    return viewer;
  } catch (err) {
    console.error('[Globe] Init failed:', err);
    setStatus('SYSTEM ERROR', true);
    throw err;
  }
}

async function loadOSMBuildings() {
  try {
    const osmTileset = await Cesium.createOsmBuildingsAsync();
    osmTileset.style = new Cesium.Cesium3DTileStyle({
      color: {
        conditions: [
          ['${feature["building"]} === "commercial"', 'color("#8899aa", 0.9)'],
          ['${feature["building"]} === "residential"', 'color("#aabbcc", 0.85)'],
          ['true', 'color("#99aabb", 0.9)'],
        ],
      },
    });
    if (viewer) viewer.scene.primitives.add(osmTileset);
  } catch (err) {
    console.warn('[Globe] OSM buildings failed:', err.message);
  }
}

function setStatus(text, isCritical = false) {
  const pill = document.getElementById('statusPill');
  const dot = document.getElementById('statusDot');
  const label = document.getElementById('statusText');

  if (label) label.textContent = text;
  if (pill) pill.classList.toggle('alert', isCritical);
  if (dot) {
    dot.classList.toggle('critical', isCritical);
    dot.classList.toggle('nominal', !isCritical);
  }
}

export function getViewer() {
  return viewer;
}
