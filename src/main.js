import { HealthMonitor, requestManager } from './utils/api.js';
import { getFreshnessState } from './utils/error-handler.js';

// Legacy fetch override removed in favor of robustFetch in layers.


import './styles/main.css';
import './styles/hud.css';
import './styles/panels.css';
import './styles/filters.css';
import './styles/cards.css';

import { initGlobe } from './globe.js';
import { initFlights } from './layers/flights.js';
import { initSatellites } from './layers/satellites.js';
import { initShips } from './layers/ships.js';
import { initJamming } from './layers/jamming.js';
import { initWildfire } from './layers/wildfire.js';
import { initWeather } from './layers/weather.js';
import { initHUD } from './ui/hud.js';
import { initEntityInteractions } from './ui/entity-popup.js';
import { initNews } from './ai/news.js';
import './ui/ai.js';
import './ui/modes.js';

window.__ENV = {
  CESIUM_TOKEN: import.meta.env.VITE_CESIUM_TOKEN || '',
  GOOGLE_KEY: import.meta.env.VITE_GOOGLE_KEY || '',
  OPENAI_KEY: import.meta.env.VITE_OPENAI_KEY || '',
  NEWS_KEY: import.meta.env.VITE_NEWS_KEY || '',
  AIS_KEY: import.meta.env.VITE_AIS_KEY || '',
};

function startClock() {
  function tick() {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    const el = document.getElementById('utcClock');
    if (el) el.textContent = `${h}:${m}:${s} UTC`;
  }

  tick();
  setInterval(tick, 1000);
}

startClock();

const appState = {
  viewer: null,
  stats: { flights: 0, sats: 0, ships: 0 },
  activeMode: 'normal',
};

window.appState = appState;
window.layerToggles = {};
window.addEventListener('worldview:data-status', refreshDataFreshnessIndicator);

function refreshDataFreshnessIndicator() {
  const wrapper = document.getElementById('dataFreshness');
  const dot = document.getElementById('dataFreshnessDot');
  const text = document.getElementById('dataFreshnessText');
  if (!wrapper || !dot || !text) return;

  const sources = window.appState?.dataSources || {};
  const entries = Object.values(sources);
  if (entries.length === 0) {
    text.textContent = 'Loading...';
    dot.className = 'freshness-dot red';
    wrapper.title = 'Waiting for first data payload';
    return;
  }

  const hasError = entries.some((entry) => !!entry.error && !entry.isCached);
  const newestTimestamp = entries
    .map((entry) => entry.timestamp)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const usingCached = entries.some((entry) => entry.isCached);
  const state = getFreshnessState(newestTimestamp, usingCached, hasError);

  text.textContent = state.label;
  dot.className = `freshness-dot ${state.color}`;
  const metrics = requestManager.getMetrics();
  wrapper.title = `Queue ${metrics.queueLength} | Success ${metrics.success} | Failed ${metrics.failed}`;
}

function setLoadingProgress(percent, status) {
  const bar = document.getElementById('loadingBar');
  const txt = document.getElementById('loadingStatus');
  if (bar) bar.style.width = percent + '%';
  if (txt) txt.textContent = status;
}

function hideLoading() {
  const screen = document.getElementById('loadingScreen');
  if (!screen) return;
  screen.style.transition = 'opacity 0.8s';
  screen.style.opacity = '0';
  setTimeout(() => { screen.style.display = 'none'; }, 800);
}

setInterval(refreshDataFreshnessIndicator, 1000);

(async () => {
  try {
    setLoadingProgress(10, 'LOADING GLOBE...');
    try {
      appState.viewer = await initGlobe();
      window.viewer = appState.viewer;
    } catch(e) {
      setLoadingProgress(30, 'GLOBE DEGRADED - CONTINUING...');
    }

    setLoadingProgress(30, 'INITIALIZING HUD...');
    if (window.viewer) {
      initHUD(window.viewer);
      initEntityInteractions(window.viewer);
      setLoadingProgress(40, 'LOADING FLIGHT DATA...');
      initFlights(window.viewer);
      setLoadingProgress(50, 'LOADING MARITIME DATA...');
      initShips(window.viewer);
      initJamming(window.viewer);
      setLoadingProgress(65, 'LOADING SATELLITE DATA...');
      await initSatellites(window.viewer);
      setLoadingProgress(80, 'LOADING INTEL LAYERS...');
      await initWildfire(window.viewer);
      await initWeather(window.viewer);
    }

    setLoadingProgress(95, 'LOADING INTELLIGENCE FEED...');
    initNews();

    setLoadingProgress(100, 'SYSTEMS ONLINE');
    setTimeout(hideLoading, 1000);

    // Sync API Health Monitor to UI
    HealthMonitor.subscribe((status) => {
      const pill = document.getElementById('statusPill');
      const dot = document.getElementById('statusDot');
      const txt = document.getElementById('statusText');
      
      if (status === 'critical') {
        if (pill) pill.classList.add('alert');
        if (dot) {
          dot.classList.remove('nominal');
          dot.classList.remove('warn');
          dot.classList.add('critical');
        }
        if (txt) txt.textContent = 'CRITICAL';
      } else if (status === 'degraded') {
        if (pill) pill.classList.add('alert');
        if (dot) {
          dot.classList.remove('nominal');
          dot.classList.remove('critical');
          dot.classList.add('warn');
        }
        if (txt) txt.textContent = 'DEGRADED';
      } else {
        if (pill) pill.classList.remove('alert');
        if (dot) {
          dot.classList.remove('critical');
          dot.classList.remove('warn');
          dot.classList.add('nominal');
        }
        if (txt) txt.textContent = 'NOMINAL';
      }
    });

    requestManager.on((event) => {
    });

  } catch (err) {
    const pill = document.getElementById('statusPill');
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (pill) pill.classList.add('alert');
    if (dot) {
      dot.classList.remove('nominal');
      dot.classList.add('critical');
    }
    if (txt) txt.textContent = 'SYSTEM ERROR';
  }

  setTimeout(() => {
    if (window.viewer) {
      window.viewer.scene.requestRender();
      window.viewer.entities.values.forEach(e => { e.show = false; e.show = true; });
      for (let i = 0; i < window.viewer.dataSources.length; i++) {
        const ds = window.viewer.dataSources.get(i);
        ds.entities.values.forEach(e => { e.show = false; e.show = true; });
      }
      window.viewer.scene.requestRender();
    }
  }, 5000);
})();

(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let stars = [];
  let shootingStar = null;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function init() {
    stars = Array.from({ length: 350 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.1 + 0.2,
      opacity: Math.random() * 0.6 + 0.2,
      direction: Math.random() > 0.5 ? 1 : -1,
      speed: Math.random() * 0.015 + 0.004,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star) => {
      star.opacity += star.speed * star.direction;
      if (star.opacity >= 1) {
        star.opacity = 1;
        star.direction = -1;
      } else if (star.opacity <= 0.1) {
        star.opacity = 0.1;
        star.direction = 1;
      }

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 255, ${star.opacity})`;
      ctx.fill();
    });

    if (shootingStar) {
      const dx = Math.cos(shootingStar.angle) * shootingStar.length;
      const dy = Math.sin(shootingStar.angle) * shootingStar.length;
      const gradient = ctx.createLinearGradient(
        shootingStar.x,
        shootingStar.y,
        shootingStar.x + dx,
        shootingStar.y + dy,
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(1, `rgba(255, 255, 255, ${shootingStar.opacity})`);

      ctx.beginPath();
      ctx.moveTo(shootingStar.x, shootingStar.y);
      ctx.lineTo(shootingStar.x + dx, shootingStar.y + dy);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
      shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
      shootingStar.opacity -= 0.018;
      if (shootingStar.opacity <= 0) {
        shootingStar = null;
      }
    }

    requestAnimationFrame(draw);
  }

  function launchShootingStar() {
    shootingStar = {
      x: Math.random() * canvas.width * 0.6,
      y: Math.random() * canvas.height * 0.35,
      length: Math.random() * 120 + 90,
      speed: Math.random() * 9 + 12,
      angle: Math.PI / 4,
      opacity: 1,
    };
  }

  resize();
  init();
  draw();
  setInterval(launchShootingStar, 15000);
  window.addEventListener('resize', () => {
    resize();
    init();
  });
}());
