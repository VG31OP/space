import * as Cesium from 'cesium';

// NASA FIRMS CSV feed for last 24h wildfire hotspots (no API key needed for public endpoint)
const FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv';

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
        if (!res.ok) throw new Error('FIRMS fetch failed');
        const csv = await res.text();
        const hotspots = parseFIRMSCsv(csv);

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
        console.log(`Wildfire layer: ${hotspots.length} hotspots loaded.`);
    } catch (err) {
        console.warn('NASA FIRMS fetch failed, seeding demo hotspots:', err.message);
        seedFallbackFires(fireSource);
    }

    viewer.scene.postRender.addEventListener(() => {
        fireSource.entities.values.forEach(ent => { ent.show = window.layerToggles.fire; });
    });
}

function parseFIRMSCsv(csv) {
    const lines = csv.trim().split('\n');
    const header = lines[0].split(',');
    const latIdx = header.indexOf('latitude');
    const lngIdx = header.indexOf('longitude');
    const briIdx = header.indexOf('brightness');
    const conIdx = header.indexOf('confidence');
    return lines.slice(1).map(l => {
        const p = l.split(',');
        return { lat: parseFloat(p[latIdx]), lng: parseFloat(p[lngIdx]), brightness: parseFloat(p[briIdx]) || 300, confidence: p[conIdx] || 'nominal' };
    }).filter(h => !isNaN(h.lat) && !isNaN(h.lng));
}

function seedFallbackFires(fireSource) {
    const DEMO = [
        { lat: 36.7, lng: -119.4 }, { lat: 34.1, lng: -118.2 }, { lat: -33.8, lng: 151.2 },
        { lat: -3.7, lng: -62.2 }, { lat: 60.5, lng: 30.2 }, { lat: 40.4, lng: -3.7 }
    ];
    DEMO.forEach((f, i) => {
        fireSource.entities.add({
            id: `fire-demo-${i}`,
            name: '🔥 Wildfire Hotspot',
            position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 0),
            point: { pixelSize: 8, color: Cesium.Color.fromCssColorString('#ff4400').withAlpha(0.85), outlineColor: Cesium.Color.ORANGE, outlineWidth: 1 },
            show: false,
            properties: { type: 'fire', brightness: 340, confidence: 'nominal' }
        });
    });
    const b = document.getElementById('badge-fire');
    if (b) b.textContent = DEMO.length;
}
