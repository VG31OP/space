import * as Cesium from 'cesium';

// Serialize current camera state and visual mode to the URL Hash
export function initExport(viewer, appState) {
    // Try to load state from hash on init
    const hash = window.location.hash;
    if (hash.length > 1) {
        try {
            const stateParams = new URLSearchParams(hash.substring(1));
            const lat = parseFloat(stateParams.get('lat'));
            const lng = parseFloat(stateParams.get('lng'));
            const alt = parseFloat(stateParams.get('alt'));
            const mode = stateParams.get('mode');

            if (!isNaN(lat) && !isNaN(lng) && !isNaN(alt)) {
                viewer.camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(lng, lat, alt),
                    duration: 0
                });
            }

            if (mode) {
                setTimeout(() => {
                    const btn = document.querySelector(`.filter-btn[data-mode="${mode}"]`);
                    if (btn) btn.click();
                }, 500); // Wait for UI to load
            }

            console.log('Successfully loaded OSINT snapshot from URL parameters.');
        } catch (e) {
        }
    }

    // Bind export hotkey (e.g. CTRL+E)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();

            const pos = viewer.camera.positionCartographic;
            const lat = Cesium.Math.toDegrees(pos.latitude).toFixed(4);
            const lng = Cesium.Math.toDegrees(pos.longitude).toFixed(4);
            const alt = Math.round(pos.height);
            const mode = appState.activeMode;

            const params = new URLSearchParams({ lat, lng, alt, mode });
            window.history.replaceState(null, '', '#' + params.toString());

            // Notify via command palette UI
            const responseEl = document.getElementById('aiResponse');
            if (responseEl) {
                responseEl.textContent = '[SYSTEM] Export complete. URL updated with tactical state.';
                responseEl.style.color = '#00ff88';
            }

            // Copy to clipboard
            navigator.clipboard.writeText(window.location.href).catch(err => {
            });
        }
    });
}
