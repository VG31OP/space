import * as Cesium from 'cesium';
import { safeFetch } from '../utils/safeFetch.js';

// NASA FIRMS CSV feed for last 24h wildfire hotspots (no API key needed for public endpoint)
const FIRMS_URL = '/api/firms/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';

export async function initWildfire(viewer) {
    const fireSource = new Cesium.CustomDataSource('wildfire');
    viewer.dataSources.add(fireSource);

    const el = document.getElementById('layer-fire');
    window.layerToggles = window.layerToggles || {};
    window.layerToggles.fire = el ? el.checked : false;
    if (el) el.addEventListener('change', e => {
        window.layerToggles.fire = e.target.checked;
        fireSource.entities.values.forEach(ent => ent.show = e.target.checked);
    });

    try {
        const res = await fetch(FIRMS_URL);
        if (!res.ok) return;
        
        const csv = await res.text();
        const hotspots = parseFIRMSCsv(csv);

        if (!hotspots || hotspots.length === 0) return;

        hotspots.slice(0, 1000).forEach((hs, i) => {
            fireSource.entities.add({
                id: `fire-${i}`,
                name: `🔥 Wildfire Hotspot`,
                position: Cesium.Cartesian3.fromDegrees(hs.lng, hs.lat, 0),
                point: {
                    pixelSize: Math.min(4 + hs.brightness / 100, 14),
                    color: Cesium.Color.fromCssColorString('#ff4400').withAlpha(0.85),
                    outlineColor: Cesium.Color.fromCssColorString('#ff8800'),
                    outlineWidth: 1,
                    scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 5e6, 0.4)
                },
                show: window.layerToggles.fire,
                properties: { type: 'fire', brightness: hs.brightness, confidence: hs.confidence }
            });
        });

        const b = document.getElementById('badge-fire');
        if (b) b.textContent = Math.min(hotspots.length, 1000);
    } catch {
       return;
    }

    viewer.scene.postRender.addEventListener(() => {
        fireSource.entities.values.forEach(ent => { ent.show = window.layerToggles.fire; });
    });
}

function parseFIRMSCsv(csv) {
    if (!csv) return [];
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    const header = lines[0].split(',');
    const latIdx = header.indexOf('latitude');
    const lngIdx = header.indexOf('longitude');
    const briIdx = header.indexOf('brightness');
    const conIdx = header.indexOf('confidence');
    
    if (latIdx === -1 || lngIdx === -1) return [];

    return lines.slice(1).map(l => {
        const p = l.split(',');
        return { lat: parseFloat(p[latIdx]), lng: parseFloat(p[lngIdx]), brightness: parseFloat(p[briIdx]) || 300, confidence: p[conIdx] || 'nominal' };
    }).filter(h => !isNaN(h.lat) && !isNaN(h.lng));
}
