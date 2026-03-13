// NewsAPI fetcher with 5-minute refresh
// Requires VITE_NEWS_KEY set via .env or Vercel dashboard

import * as Cesium from 'cesium';

const NEWS_URL = (key) =>
  `https://newsapi.org/v2/everything?q=geopolitics+aviation+maritime+military&sortBy=publishedAt&pageSize=10&apiKey=${key}`;

const GEO_DICT = {
  russia: [55.7, 37.6],
  ukraine: [48.4, 31.2],
  china: [35.9, 104.2],
  taiwan: [23.7, 121.0],
  israel: [31.0, 34.8],
  iran: [32.4, 53.7],
  'north korea': [40.0, 127.0],
  india: [20.6, 78.9],
  pakistan: [30.4, 69.3],
  syria: [35.0, 38.0],
  yemen: [15.5, 48.5],
  gaza: [31.4, 34.3],
};

export function initNews(viewer) {
  const container = document.getElementById('newsList');
  const ticker = document.querySelector('.news-ticker');
  if (!container) return;

  const apiKey = import.meta.env.VITE_NEWS_KEY;
  if (!apiKey) {
    container.innerHTML = '<div class="news-card"><div class="news-headline">Configure VITE_NEWS_KEY to enable the live news feed.</div></div>';
    return;
  }

  async function fetchNews() {
    try {
      const res = await fetch(NEWS_URL(apiKey));
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      renderNews(data.articles || [], container, ticker, viewer);
    } catch (err) {
      console.warn('NewsAPI error:', err.message);
    }
  }

  fetchNews();
  setInterval(fetchNews, 5 * 60 * 1000);
}

function renderNews(articles, container, ticker, viewer) {
  if (!articles.length) return;

  ticker.textContent = /war|attack|missile|conflict|strike/i.test(articles[0].title) ? 'BREAKING' : 'LIVE FEED';

  container.innerHTML = articles.map((article) => {
    const mins = Math.max(1, Math.round((Date.now() - new Date(article.publishedAt)) / 60000));
    const ago = mins < 60 ? `${mins} min ago` : `${Math.round(mins / 60)} h ago`;
    const key = findGeoKey(`${article.title} ${article.description || ''}`);
    const host = article.url && article.url !== '#' ? new URL(article.url).hostname.replace(/^www\./, '') : 'Unknown';

    return `
      <article class="news-card">
        <div class="news-card-meta">
          <span class="news-source-dot"></span>
          <span class="news-source">${host}</span>
          <span class="news-time">${ago}</span>
        </div>
        <div class="news-headline">${article.title}</div>
        <div class="news-actions">
          ${key ? `<button class="news-btn" data-lat="${GEO_DICT[key][0]}" data-lng="${GEO_DICT[key][1]}">LOCATE</button>` : ''}
          ${article.url ? `<a class="news-btn" href="${article.url}" target="_blank" rel="noreferrer">OPEN</a>` : ''}
        </div>
      </article>`;
  }).join('');

  container.querySelectorAll('button[data-lat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const lat = parseFloat(btn.dataset.lat);
      const lng = parseFloat(btn.dataset.lng);
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1200000),
        duration: 2.5,
      });
    });
  });
}

function findGeoKey(text) {
  const lower = text.toLowerCase();
  return Object.keys(GEO_DICT).find((key) => lower.includes(key)) || null;
}
