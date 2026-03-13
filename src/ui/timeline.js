import { saveSnapshot, getSnapshots, initDatabase } from '../data/snapshot.js';
import * as Cesium from 'cesium';

// Store a sliding window of recent states (e.g. up to 10 minutes)
const SNAPSHOT_INTERVAL = 30000; // 30 seconds
const MAX_SNAPSHOTS = 20;

let snapshotsCache = []; // memory cache for fast scrubber access
let isReplaying = false;

export async function initTimeline(viewer, appState) {
    await initDatabase();

    const slider = document.getElementById('timelineSlider');
    const labelLive = document.getElementById('timelineCurrent');

    // Periodically take snapshots of current state
    setInterval(async () => {
        if (isReplaying) return; // Don't record during replay, causes recursion paradox

        // Simplistic snapshot: count of flights/sats, camera pos
        const pos = viewer.camera.positionCartographic;
        const snap = {
            stats: { ...appState.stats },
            camera: {
                lng: Cesium.Math.toDegrees(pos.longitude),
                lat: Cesium.Math.toDegrees(pos.latitude),
                alt: pos.height,
                heading: viewer.camera.heading,
                pitch: viewer.camera.pitch,
                roll: viewer.camera.roll
            }
        };

        const time = Date.now();
        await saveSnapshot(time, snap);

        // Update local cache for rendering scrubber
        snapshotsCache.push({ time, state: snap });
        if (snapshotsCache.length > MAX_SNAPSHOTS) {
            snapshotsCache.shift();
        }
    }, SNAPSHOT_INTERVAL);


    // Handle scrubber
    slider.addEventListener('input', (e) => {
        if (snapshotsCache.length === 0) return;

        const val = parseInt(e.target.value);
        if (val === 100) {
            isReplaying = false;
            labelLive.textContent = 'LIVE';
            labelLive.style.color = '#ff3333';
            // in a full app we would resume live socket streams here
        } else {
            isReplaying = true;
            const index = Math.floor((val / 100) * (snapshotsCache.length - 1));
            const snap = snapshotsCache[index];

            if (snap) {
                applySnapshot(viewer, appState, snap.state);
                const d = new Date(snap.time);
                labelLive.textContent = `REPLAY: -${Math.round((Date.now() - snap.time) / 1000)}s`;
                labelLive.style.color = '#ffaa00';
            }
        }
    });
}

function applySnapshot(viewer, appState, state) {
    // Update stats UI
    appState.stats = { ...state.stats };
    document.getElementById('stat-flights').textContent = appState.stats.flights;
    document.getElementById('stat-sats').textContent = appState.stats.sats;

    // Move camera
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(state.camera.lng, state.camera.lat, state.camera.alt),
        orientation: {
            heading: state.camera.heading,
            pitch: state.camera.pitch,
            roll: state.camera.roll
        },
        duration: 0.5
    });

    // Tactical overlay note
    console.log('REPLAY MODE ENGAGED. Viewing historical snapshot.');
}
