import * as Cesium from 'cesium';
import { loadOSMBuildings } from './tiles.js';
import { setupShaders } from './shaders.js';

export async function initGlobe(containerId) {
    // We utilize the default Cesium ion token for initial load, but for a true 100% free offline we'd substitute local map proxies. 
    // OSM Buildings and base imagery are free.
    const viewer = new Cesium.Viewer(containerId, {
        terrainProvider: await Cesium.createWorldTerrainAsync(),
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        selectionIndicator: false,
        shouldAnimate: true, // Need this true for dynamic entities
        contextOptions: {
            webgl: {
                alpha: false,
                antialias: true,
                preserveDrawingBuffer: true,
                failIfMajorPerformanceCaveat: false,
                powerPreference: "high-performance"
            }
        }
    });

    // Dark empty void space background
    viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0c0f');
    viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#111317');

    // Tactical custom globe material (dark with grid or slight tint)
    viewer.scene.globe.enableLighting = true;

    // High fidelity settings
    viewer.scene.highDynamicRange = true;
    viewer.scene.globe.depthTestAgainstTerrain = true;

    // Disable default double click zoom
    viewer.screenSpaceEventHandler.removeInputAction(
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
    );

    // Initialize Modules
    await loadOSMBuildings(viewer);

    // Set up Post Process Shaders (FLIR, NV, CRT)
    setupShaders(viewer);

    // Start with camera over New York for demo purposes
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(-74.006, 40.7128, 5000),
        orientation: {
            heading: Cesium.Math.toRadians(20.0),
            pitch: Cesium.Math.toRadians(-35.0),
            roll: 0.0
        },
        duration: 0 // Instant snap for init
    });

    // Live Coordinate Updates for HUD
    viewer.scene.preRender.addEventListener(() => {
        updateHUDCoords(viewer);
    });

    return viewer;
}

function updateHUDCoords(viewer) {
    const position = viewer.camera.positionCartographic;
    const lat = Cesium.Math.toDegrees(position.latitude).toFixed(4);
    const lng = Cesium.Math.toDegrees(position.longitude).toFixed(4);
    const alt = Math.round(position.height);

    const elLat = document.getElementById('coord-lat');
    const elLng = document.getElementById('coord-lng');
    const elAlt = document.getElementById('coord-alt');

    if (elLat) elLat.textContent = `LAT: ${lat}`;
    if (elLng) elLng.textContent = `LNG: ${lng}`;
    if (elAlt) elAlt.textContent = `ALT: ${alt}m`;
}
