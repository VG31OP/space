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
import { initVisualModes } from './ui/visual-modes.js';
import { initEntityInteractions } from './ui/entity-popup.js';
import { initNews } from './ai/news.js';
import { initAnalyst } from './ai/analyst.js';
import { initSuggestions } from './ai/suggestions.js';

window.__ENV = {
  CESIUM_TOKEN: import.meta.env.VITE_CESIUM_TOKEN || '',
  GOOGLE_KEY: import.meta.env.VITE_GOOGLE_KEY || '',
  OPENAI_KEY: import.meta.env.VITE_OPENAI_KEY || '',
  NEWS_KEY: import.meta.env.VITE_NEWS_KEY || '',
  AIS_KEY: import.meta.env.VITE_AIS_KEY || '',
};

// Restore animated starfield behind Cesium.
(function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  const NUM_STARS = 400;
  const SHOOTING_INTERVAL = 3000;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < NUM_STARS; i += 1) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinkleDir: Math.random() > 0.5 ? 1 : -1,
      });
    }
  }

  let shootingStar = null;

  function launchShootingStar() {
    shootingStar = {
      x: Math.random() * canvas.width * 0.7,
      y: Math.random() * canvas.height * 0.3,
      len: Math.random() * 120 + 80,
      speed: Math.random() * 6 + 4,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      alpha: 1,
      life: 1,
    };
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    stars.forEach((star) => {
      star.alpha += star.twinkleSpeed * star.twinkleDir;
      if (star.alpha > 1) {
        star.alpha = 1;
        star.twinkleDir = -1;
      }
      if (star.alpha < 0.1) {
        star.alpha = 0.1;
        star.twinkleDir = 1;
      }
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,210,255,${star.alpha})`;
      ctx.fill();
    });

    if (shootingStar) {
      const dx = Math.cos(shootingStar.angle) * shootingStar.len * shootingStar.life;
      const dy = Math.sin(shootingStar.angle) * shootingStar.len * shootingStar.life;
      const grad = ctx.createLinearGradient(
        shootingStar.x,
        shootingStar.y,
        shootingStar.x + dx,
        shootingStar.y + dy,
      );
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(1, `rgba(255,255,255,${shootingStar.alpha})`);
      ctx.beginPath();
      ctx.moveTo(shootingStar.x, shootingStar.y);
      ctx.lineTo(shootingStar.x + dx, shootingStar.y + dy);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      shootingStar.x += Math.cos(shootingStar.angle) * shootingStar.speed;
      shootingStar.y += Math.sin(shootingStar.angle) * shootingStar.speed;
      shootingStar.alpha -= 0.015;
      if (shootingStar.alpha <= 0) shootingStar = null;
    }

    requestAnimationFrame(drawFrame);
  }

  resize();
  initStars();
  drawFrame();
  setInterval(launchShootingStar, SHOOTING_INTERVAL);
  window.addEventListener('resize', () => {
    resize();
    initStars();
  });
}());

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

(async () => {
  try {
    appState.viewer = await initGlobe();

    initHUD(appState.viewer);
    initVisualModes();
    initEntityInteractions(appState.viewer);

    initFlights(appState.viewer);
    initShips(appState.viewer);
    initJamming(appState.viewer);

    await initSatellites(appState.viewer);
    await initWildfire(appState.viewer);
    await initWeather(appState.viewer);

    initNews(appState.viewer);
    initAnalyst(appState.viewer, appState);
    initSuggestions(appState.viewer, appState);
  } catch (err) {
    console.error('Init failed:', err);
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
})();
