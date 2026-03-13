const { Cesium } = window;

export { Cesium };

export function buildLabel(text, enabled = true) {
  return {
    text,
    font: "12px 'IBM Plex Sans'",
    show: enabled,
    showBackground: true,
    backgroundColor: Cesium.Color.fromCssColorString("#08131c").withAlpha(0.78),
    fillColor: Cesium.Color.WHITE,
    pixelOffset: new Cesium.Cartesian2(0, -24),
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2000000),
    scale: 0.9,
  };
}

export function createPulseAxis(base, amplitude, speed = 0.003) {
  return new Cesium.CallbackProperty(() => base + Math.sin(Date.now() * speed) * amplitude, false);
}

export function createPosition(lon, lat, alt = 0) {
  return Cesium.Cartesian3.fromDegrees(Number(lon), Number(lat), Math.max(Number(alt) || 0, 0));
}

export async function initGlobe() {
  const token = window.__ENV?.CESIUM_TOKEN || "";
  if (token) {
    Cesium.Ion.defaultAccessToken = token;
  }

  // Build terrain provider
  let terrainProvider;
  if (token) {
    try {
      // In Cesium 1.115 CDN, createWorldTerrainAsync is available
      terrainProvider = await Cesium.createWorldTerrainAsync();
    } catch (e) {
      console.warn("World terrain failed, using ellipsoid:", e.message);
      terrainProvider = new Cesium.EllipsoidTerrainProvider();
    }
  } else {
    terrainProvider = new Cesium.EllipsoidTerrainProvider();
  }

  // Initialize viewer with NO imagery provider to prevent Cesium defaults from crashing/interfering
  const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    navigationHelpButton: false,
    terrainProvider,
    baseLayer: false, // Ensures no default Bing layer tries to load and fail
    shouldAnimate: true,
  });

  // Explicitly add Reliable Esri satellite imagery (no key needed, fast)
  viewer.imageryLayers.removeAll();
  const esriProvider = new Cesium.UrlTemplateImageryProvider({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit: "Source: Esri, Maxar, Earthstar Geographics",
    maximumLevel: 19,
  });
  viewer.imageryLayers.addImageryProvider(esriProvider);
  console.log("✅ Esri World Imagery explicitly added to layers");

  // Minimal scene — no lighting/atmosphere to ensure imagery tiles are always visible
  viewer.scene.globe.enableLighting = false;
  viewer.scene.globe.atmosphereLightIntensity = 1.0;
  viewer.scene.globe.showGroundAtmosphere = false;
  viewer.scene.skyAtmosphere.show = false;
  viewer.scene.fog.enabled = false;
  viewer.scene.highDynamicRange = false;
  viewer.clock.shouldAnimate = true;

  // OSM 3D buildings (skip if Google key provided)
  try {
    const googleKey = window.__ENV?.GOOGLE_KEY;
    const isPlaceholder = !googleKey || googleKey.includes("your_google_maps_api_key_here") || googleKey.length < 20;

    if (!isPlaceholder) {
      const tileset = await Cesium.Cesium3DTileset.fromUrl(
        `https://tile.googleapis.com/v1/3dtiles/root.json?key=${googleKey}`,
        { showCreditsOnScreen: true, maximumScreenSpaceError: 16 },
      );
      viewer.scene.primitives.add(tileset);
      console.log("✅ Google Photorealistic 3D Tiles initialized");
    } else {
      const osmBuildings = await Cesium.createOsmBuildingsAsync();
      osmBuildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('#c8d5e0', 0.9)",
      });
      viewer.scene.primitives.add(osmBuildings);
      console.log("🏙️ OSM 3D Buildings initialized (using fallback)");
    }
  } catch (err) {
    console.warn("3D buildings disabled:", err.message);
  }

  // Start at a view that shows the whole Earth but not from 20,000 km away
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(20, 15, 7000000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });

  return viewer;
}
