import * as Cesium from 'cesium';

// Known GPS jamming zones based on open intelligence reports (GPSJam.org equivalent)
const JAMMING_ZONES = [
    { lat: 32.0, lng: 34.8, radius: 200000, level: 'high', label: 'Eastern Mediterranean' },
    { lat: 55.7, lng: 37.6, radius: 150000, level: 'high', label: 'Moscow/Russian Border' },
    { lat: 36.8, lng: 36.1, radius: 180000, level: 'high', label: 'Syria/Turkey Border' },
    { lat: 50.4, lng: 30.5, radius: 250000, level: 'med', label: 'Ukraine Conflict Zone' },
    { lat: 26.3, lng: 56.4, radius: 120000, level: 'med', label: 'Strait of Hormuz' },
    { lat: 23.6, lng: 58.6, radius: 100000, level: 'low', label: 'Gulf of Oman' },
    { lat: 14.0, lng: 43.0, radius: 180000, level: 'med', label: 'Red Sea (Yemen)' },
    { lat: 35.2, lng: 128.6, radius: 80000, level: 'low', label: 'Korean Peninsula' },
];

export function initJamming(viewer) {
    const jammingSource = new Cesium.CustomDataSource('jamming');
    viewer.dataSources.add(jammingSource);

    const el = document.getElementById('layer-jam');
    window.layerToggles = window.layerToggles || {};
    window.layerToggles.jam = el ? el.checked : true;
    if (el) el.addEventListener('change', e => {
        window.layerToggles.jam = e.target.checked;
        jammingSource.entities.values.forEach(ent => ent.show = e.target.checked);
    });

    JAMMING_ZONES.forEach((zone, i) => {
        const alpha = zone.level === 'high' ? 0.35 : zone.level === 'med' ? 0.22 : 0.12;
        const color = zone.level === 'high'
            ? new Cesium.Color(1, 0, 0, alpha)
            : zone.level === 'med'
                ? new Cesium.Color(1, 0.65, 0, alpha)
                : new Cesium.Color(1, 1, 0, alpha);

        jammingSource.entities.add({
            id: `jam-${i}`,
            name: `GPS JAMMING: ${zone.label}`,
            position: Cesium.Cartesian3.fromDegrees(zone.lng, zone.lat),
            ellipse: {
                semiMajorAxis: zone.radius,
                semiMinorAxis: zone.radius * 0.85,
                material: new Cesium.ColorMaterialProperty(color),
                outline: false,
                height: 0,
                extrudedHeight: 25000
            },
            label: {
                text: `📡 ${zone.label}\n[${zone.level.toUpperCase()} INTERFERENCE]`,
                font: '9pt "JetBrains Mono"',
                fillColor: zone.level === 'high' ? Cesium.Color.RED : Cesium.Color.fromCssColorString('#ffaa00'),
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 3e6),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10)
            },
            show: window.layerToggles.jam,
            properties: { type: 'jam', level: zone.level, label: zone.label }
        });
    });

    const b = document.getElementById('badge-jam');
    if (b) b.textContent = JAMMING_ZONES.length;
    console.log(`GPS Jamming layer: ${JAMMING_ZONES.length} zones loaded.`);
}
