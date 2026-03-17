import * as Cesium from 'cesium';
const CesiumGlobal = window.Cesium; // Ensure Cesium is available globally if needed, though we import it.
// Prompt asked for: const Cesium = window.Cesium;
// But we already have import * as Cesium from 'cesium';
// I will add what was requested but keep the import too if possible or just use window.Cesium.
// Let's stick to the prompt.
// Actually, if I use 'const Cesium = window.Cesium', it might clash with the import.
// I'll change the import to something else or just use window.Cesium.
// Let's just add it at the top as requested.
//const Cesium = window.Cesium;

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

function getCountryCoords(headline) {
  const lower = headline.toLowerCase();
  if (lower.includes('iran') || lower.includes('tehran')) return { lat: 35.6, lng: 51.4, alt: 800000 };
  if (lower.includes('ukraine') || lower.includes('kyiv')) return { lat: 50.4, lng: 30.5, alt: 800000 };
  if (lower.includes('china') || lower.includes('beijing')) return { lat: 39.9, lng: 116.4, alt: 1000000 };
  if (lower.includes('russia') || lower.includes('moscow')) return { lat: 55.7, lng: 37.6, alt: 1500000 };
  if (lower.includes('usa') || lower.includes('america') || lower.includes('washington')) return { lat: 38.9, lng: -77.0, alt: 1000000 };
  if (lower.includes('israel') || lower.includes('gaza')) return { lat: 31.5, lng: 34.8, alt: 500000 };
  if (lower.includes('india') || lower.includes('delhi')) return { lat: 28.6, lng: 77.2, alt: 1000000 };
  if (lower.includes('uk') || lower.includes('britain') || lower.includes('london')) return { lat: 51.5, lng: -0.1, alt: 600000 };
  if (lower.includes('france') || lower.includes('paris')) return { lat: 48.8, lng: 2.3, alt: 600000 };
  if (lower.includes('germany') || lower.includes('berlin')) return { lat: 52.5, lng: 13.4, alt: 600000 };
  if (lower.includes('gulf') || lower.includes('hormuz')) return { lat: 26.5, lng: 56.3, alt: 600000 };
  if (lower.includes('syria') || lower.includes('damascus')) return { lat: 33.5, lng: 36.3, alt: 600000 };
  if (lower.includes('north korea') || lower.includes('pyongyang')) return { lat: 39.0, lng: 125.7, alt: 600000 };
  if (lower.includes('taiwan')) return { lat: 23.7, lng: 121.0, alt: 600000 };
  if (lower.includes('amsterdam') || lower.includes('netherlands')) return { lat: 52.3, lng: 4.9, alt: 500000 };
  if (lower.includes('middle east')) return { lat: 29.0, lng: 45.0, alt: 2000000 };
  if (lower.includes('africa')) return { lat: 0.0, lng: 20.0, alt: 4000000 };
  if (lower.includes('europe')) return { lat: 50.0, lng: 10.0, alt: 3000000 };
  if (lower.includes('asia')) return { lat: 35.0, lng: 100.0, alt: 5000000 };
  return { lat: 20.0, lng: 0.0, alt: 18000000 };
}

export function initNews(viewer) {
  const container = document.getElementById('newsList');
  const ticker = document.querySelector('.news-ticker');
  if (!container) return;

  async function fetchNews() {
    // Fallback 1: BBC
    try {
      const res = await fetch('/api/bbc/news/world/rss.xml');
      if (!res.ok) throw new Error('BBC failed');
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      const items = [...xml.querySelectorAll('item')].slice(0, 10).map(item => ({
        title: item.querySelector('title')?.textContent || '',
        url: item.querySelector('link')?.textContent || '',
        publishedAt: item.querySelector('pubDate')?.textContent || '',
      }));
      renderNews(items, container, ticker, viewer);
      return;
    } catch (_) { }

    // Fallback 2: Reuters
    try {
      const res = await fetch('/api/reuters/world/');
      if (!res.ok) throw new Error('Reuters failed');
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'application/xml');
      const items = [...xml.querySelectorAll('item')].slice(0, 10).map(item => ({
        title: item.querySelector('title')?.textContent || '',
        url: item.querySelector('link')?.textContent || '',
        publishedAt: item.querySelector('pubDate')?.textContent || '',
      }));
      renderNews(items, container, ticker, viewer);
    } catch (_) { }
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
          <button class="news-btn" data-headline="${article.title.replace(/"/g, '&quot;')}">LOCATE</button>
          ${article.url ? `<a class="news-btn" href="${article.url}" target="_blank" rel="noreferrer">OPEN</a>` : ''}
        </div>
      </article>`;
  }).join('');

  container.querySelectorAll('button.news-btn').forEach((button) => {
    if (button.textContent === 'LOCATE') {
      button.onclick = function (e) {
        const btn = e.currentTarget;
        const headline = btn.dataset.headline || btn.closest('[data-headline]')?.dataset.headline || '';
        const v = window.viewer;
        if (!v || !v.camera) {
          return;
        }
        const coords = getCountryCoords(headline);
        v.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(coords.lng, coords.lat, coords.alt),
          duration: 2,
        });
      };
    }
  });
}

function findGeoKey(text) {
  const lower = text.toLowerCase();
  return Object.keys(GEO_DICT).find((key) => lower.includes(key)) || null;
}
