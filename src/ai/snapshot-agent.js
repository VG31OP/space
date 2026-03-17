import { saveSnapshot } from '../data/snapshot.js';
import * as Cesium from 'cesium';

// The OSINT Snapshot Agent monitors the application state and auto-records "major events"
// e.g. An anomaly in flight volume, or a sudden camera move to a conflict zone

let lastFlightCount = 0;

export function initSnapshotAgent(viewer, appState) {
    // Check every 15 seconds for anomalies
    setInterval(async () => {
        const currentFlights = appState.stats.flights;

        // Anomaly: 50% drop or spike in flights tracked
        if (lastFlightCount > 0) {
            const changeRatio = Math.abs(currentFlights - lastFlightCount) / lastFlightCount;
            if (changeRatio > 0.5) {
                const pos = viewer.camera.positionCartographic;
                const snap = {
                    event: 'AVIATION_ANOMALY',
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

                await saveSnapshot(Date.now(), snap);

                // Flash UI warning (mock)
                const sysStatus = document.querySelector('.system-status');
                if (sysStatus) {
                    sysStatus.innerHTML = '<span class="pulse" style="background-color:red;box-shadow:0 0 10px red;"></span> STATUS: ANOMALY RECORDED';
                    setTimeout(() => {
                        sysStatus.innerHTML = '<span class="pulse"></span> STATUS: NOMINAL';
                    }, 5000);
                }
            }
        }

        lastFlightCount = currentFlights;
    }, 15000);

    console.log('OSINT Auto-Snapshot Agent active.');
}
