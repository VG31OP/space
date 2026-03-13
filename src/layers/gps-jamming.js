import * as Cesium from 'cesium';

// We simulate GPSJam.org data by creating interference hotzones
// (since their raw data requires scraping/API keys that aren't public CORS)
const JAMMING_ZONES = [
    // Red zones (high jamming)
    { type: 'high', rect: [30.0, 32.0, 36.0, 36.0] }, // Middle East coast
    { type: 'high', rect: [36.0, 48.0, 40.0, 52.0] }, // Eastern Europe Border
    // Amber zones (medium jamming)
    { type: 'med', rect: [28.0, 36.0, 32.0, 39.0] },
    { type: 'med', rect: [25.0, 50.0, 30.0, 55.0] },
];

export function initGpsJamming(viewer) {
    const jammingDataSource = new Cesium.CustomDataSource('gps-jamming');
    viewer.dataSources.add(jammingDataSource);

    // Tactical grid material
    const highMaterial = new Cesium.GridMaterialProperty({
        color: new Cesium.Color(1.0, 0.0, 0.0, 0.4),
        cellAlpha: 0.1,
        lineCount: new Cesium.Cartesian2(8, 8),
        lineThickness: new Cesium.Cartesian2(2.0, 2.0)
    });

    const medMaterial = new Cesium.GridMaterialProperty({
        color: new Cesium.Color(1.0, 0.6, 0.0, 0.3),
        cellAlpha: 0.05,
        lineCount: new Cesium.Cartesian2(8, 8),
        lineThickness: new Cesium.Cartesian2(1.0, 1.0)
    });

    JAMMING_ZONES.forEach((zone, index) => {
        jammingDataSource.entities.add({
            id: `jamming-zone-${index}`,
            name: 'GPS Interference Detected',
            rectangle: {
                coordinates: Cesium.Rectangle.fromDegrees(zone.rect[0], zone.rect[1], zone.rect[2], zone.rect[3]),
                material: zone.type === 'high' ? highMaterial : medMaterial,
                height: 50, // Slightly above ground
                extrudedHeight: 20000, // Volume block for tactical look
                outline: true,
                outlineColor: zone.type === 'high' ? Cesium.Color.RED : Cesium.Color.ORANGE
            },
            description: `Tactical Assessment: ${zone.type === 'high' ? 'High' : 'Medium'} probability of GNSS spoofing or jamming.`
        });
    });

    console.log('GPS Jamming mock overlay active.');
}
