import * as Cesium from 'cesium';
import { robustFetch } from '../utils/api.js';

const QUAKE_URL = '/api/usgs/all_day.geojson';

export async function initEarthquakes(viewer) {
    const quakeSource = new Cesium.CustomDataSource('earthquakes');
    viewer.dataSources.add(quakeSource);

    const el = document.getElementById('layer-quakes');
    window.layerToggles = window.layerToggles || {};
    window.layerToggles.quakes = el ? el.checked : true;
    if (el) el.addEventListener('change', e => {
        window.layerToggles.quakes = e.target.checked;
        quakeSource.entities.values.forEach(ent => ent.show = e.target.checked);
    });

    try {
        const data = await robustFetch(QUAKE_URL);
        if (!data) return;
        
        const features = (data.features || []).filter(f => f.properties.mag >= 2.5);

        features.forEach(f => {
            const [lng, lat, depth] = f.geometry.coordinates;
            const mag = f.properties.mag;
            const place = f.properties.place;

            quakeSource.entities.add({
                name: `M${mag} - ${place}`,
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
                point: {
                    pixelSize: Math.max(5, mag * 2.5),
                    color: mag > 6 ? Cesium.Color.RED : mag > 4.5 ? Cesium.Color.ORANGE : Cesium.Color.YELLOW,
                    outlineColor: Cesium.Color.BLACK,
                    outlineWidth: 1,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 8e6, 0.4)
                },
                ellipse: {
                    semiMajorAxis: mag * 15000,
                    semiMinorAxis: mag * 15000,
                    material: (mag > 6 ? Cesium.Color.RED : Cesium.Color.YELLOW).withAlpha(0.1),
                    outline: true,
                    outlineColor: (mag > 6 ? Cesium.Color.RED : Cesium.Color.YELLOW).withAlpha(0.3),
                    height: 0
                },
                show: window.layerToggles.quakes,
                properties: { type: 'quake', mag, place, depth }
            });
        });

        const b = document.getElementById('badge-quakes');
        if (b) b.textContent = features.length;
    } catch (e) {
        console.warn('Failed to load earthquakes', e);
    }

    viewer.scene.postRender.addEventListener(() => {
        quakeSource.entities.values.forEach(ent => { ent.show = window.layerToggles.quakes; });
    });
}
