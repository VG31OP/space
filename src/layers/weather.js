import * as Cesium from 'cesium';

// Open-Meteo free API — no key required
const WEATHER_GRID = [
    { lat: 48.8, lng: 2.35, city: 'Paris' },
    { lat: 51.5, lng: -0.12, city: 'London' },
    { lat: 40.7, lng: -74.0, city: 'New York' },
    { lat: 35.7, lng: 139.7, city: 'Tokyo' },
    { lat: -33.9, lng: 151.2, city: 'Sydney' },
    { lat: 19.4, lng: -99.1, city: 'Mexico City' },
    { lat: 55.7, lng: 37.6, city: 'Moscow' },
    { lat: 1.3, lng: 103.8, city: 'Singapore' },
    { lat: 28.6, lng: 77.2, city: 'New Delhi' },
    { lat: -23.5, lng: -46.6, city: 'São Paulo' }
];

const OPENMETEO_URL = (lat, lng) =>
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&wind_speed_unit=ms`;

export async function initWeather(viewer) {
    const weatherSource = new Cesium.CustomDataSource('weather');
    viewer.dataSources.add(weatherSource);

    const el = document.getElementById('layer-wea');
    window.layerToggles = window.layerToggles || {};
    window.layerToggles.wea = el ? el.checked : false;
    if (el) el.addEventListener('change', e => {
        window.layerToggles.wea = e.target.checked;
        weatherSource.entities.values.forEach(ent => ent.show = e.target.checked);
    });

    const results = await Promise.allSettled(
        WEATHER_GRID.map(async (loc) => {
            const res = await fetch(OPENMETEO_URL(loc.lat, loc.lng));
            const json = await res.json();
            return { ...loc, weather: json.current_weather };
        })
    );

    results.forEach(r => {
        if (r.status !== 'fulfilled') return;
        const { lat, lng, city, weather } = r.value;
        if (!weather) return;

        const windDir = weather.windspeed > 5 ? `💨 ${Math.round(weather.windspeed)}m/s` : '';
        const temp = `🌡 ${weather.temperature}°C`;
        const wmo = weather.weathercode;
        const icon = wmo === 0 ? '☀' : wmo < 50 ? '⛅' : wmo < 70 ? '🌧' : wmo < 80 ? '❄' : '⛈';

        weatherSource.entities.add({
            id: `weather-${city}`,
            name: `${city} Weather`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 5000),
            label: {
                text: `${icon} ${city}\n${temp} ${windDir}`,
                font: '10pt "JetBrains Mono"',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                showBackground: true,
                backgroundColor: new Cesium.Color(0.05, 0.1, 0.05, 0.8),
                backgroundPadding: new Cesium.Cartesian2(8, 6),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8e6),
                show: true
            },
            show: window.layerToggles.wea,
            properties: { type: 'weather', city }
        });
    });

    const b = document.getElementById('badge-wea');
    if (b) b.textContent = results.filter(r => r.status === 'fulfilled').length;

    viewer.scene.postRender.addEventListener(() => {
        weatherSource.entities.values.forEach(ent => { ent.show = window.layerToggles.wea; });
    });

    console.log('Weather layer loaded.');
}
