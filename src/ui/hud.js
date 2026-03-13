import * as Cesium from 'cesium';

export function initHUD(viewer) {
  bindTabs();

  viewer.scene.preRender.addEventListener(() => {
    updateCoords(viewer);
  });
}

function bindTabs() {
  document.querySelectorAll('.ai-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab-btn').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.ai-tab-content').forEach((panel) => {
        panel.style.display = 'none';
        panel.classList.remove('active');
      });

      btn.classList.add('active');
      const target = btn.dataset.tab;
      const panel = document.getElementById(`tab-${target}`);
      if (panel) {
        panel.style.display = 'flex';
        panel.classList.add('active');
      }
    });
  });

  const news = document.getElementById('tab-news');
  const analyst = document.getElementById('tab-analyst');
  const smart = document.getElementById('tab-smartview');
  if (news) {
    news.style.display = 'flex';
    news.classList.add('active');
  }
  if (analyst) {
    analyst.style.display = 'none';
    analyst.classList.remove('active');
  }
  if (smart) {
    smart.style.display = 'none';
    smart.classList.remove('active');
  }
}

function updateCoords(viewer) {
  const pos = viewer.camera.positionCartographic;
  const lat = Cesium.Math.toDegrees(pos.latitude).toFixed(4);
  const lng = Cesium.Math.toDegrees(pos.longitude).toFixed(4);
  const alt = Math.round(pos.height).toLocaleString();

  const elLat = document.getElementById('coordLat');
  const elLng = document.getElementById('coordLng');
  const elAlt = document.getElementById('coordAlt');

  if (elLat) elLat.innerHTML = `${lat}&deg;`;
  if (elLng) elLng.innerHTML = `${lng}&deg;`;
  if (elAlt) elAlt.textContent = `${alt}m`;
}
