import * as Cesium from 'cesium';

// Loads OpenStreetMap 3D Buildings which are free and open-source
export async function loadOSMBuildings(viewer) {
    try {
        const buildingTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingTileset);

        // Style buildings with a tactical tech aesthetic 
        // Dark base with slight opacity, highlighting edges
        buildingTileset.style = new Cesium.Cesium3DTileStyle({
            color: "color('#22252a', 0.95)",
            show: true,
        });

        console.log('OSM 3D Buildings loaded.');
    } catch (error) {
        console.error('Failed to load 3D buildings:', error);
    }
}
