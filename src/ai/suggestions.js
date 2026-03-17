import * as Cesium from 'cesium';

let smartViewer = null;
let smartAppState = null;

export function initSuggestions(viewer, appState) {
  smartViewer = viewer;
  smartAppState = appState;
  refreshSmartView();
  setInterval(refreshSmartView, 60000);
}

async function refreshSmartView() {
  const container = document.getElementById('tab-smartview');
  if (!container) return;

  const context = buildGlobeContext();
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.__ENV.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Globe data: ${JSON.stringify(context)}. Suggest 3 interesting things to look at right now. Respond ONLY with valid JSON array, no markdown: [{"title":"...","desc":"...","lat":0,"lng":0,"alt":500000}]`,
        }],
        max_tokens: 400,
      }),
    });
    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();
    let suggestions = [];
    try {
      const raw = data.choices?.[0]?.message?.content || '[]';
      suggestions = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      suggestions = getFallbackSuggestions();
    }

    container.innerHTML = '';
    suggestions.forEach((suggestion) => {
      const card = document.createElement('div');
      card.style.cssText = `
        background: rgba(0,255,136,0.04);
        border: 1px solid rgba(0,255,136,0.15);
        border-radius: 8px;
        padding: 12px;
        cursor: pointer;
      `;
      card.innerHTML = `
        <div style="font-family:'Orbitron',monospace;font-size:10px;
          color:#00ff88;font-weight:700;margin-bottom:6px;
          letter-spacing:0.1em;">${suggestion.title}</div>
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;
          color:#667788;line-height:1.5;margin-bottom:10px;">${suggestion.desc}</div>
        <button style="padding:5px 12px;background:rgba(0,255,136,0.1);
          border:1px solid rgba(0,255,136,0.25);border-radius:5px;
          color:#00ff88;font-family:'JetBrains Mono',monospace;
          font-size:9px;font-weight:700;cursor:pointer;
          letter-spacing:0.1em;">FLY THERE</button>
      `;
      card.querySelector('button').onclick = () => {
        smartViewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(suggestion.lng, suggestion.lat, suggestion.alt),
          duration: 2,
        });
      };
      container.appendChild(card);
    });
  } catch {
    container.innerHTML = getFallbackSuggestions().map((suggestion) => `
      <div style="color:#445566;font-size:11px;font-family:'JetBrains Mono',monospace;padding:8px">
        ${suggestion.title}
      </div>
    `).join('');
  }
}

function buildGlobeContext() {
  const position = smartViewer?.camera?.positionCartographic;
  const stats = smartAppState?.stats || {};
  return {
    camera: position ? {
      lat: Number(Cesium.Math.toDegrees(position.latitude).toFixed(2)),
      lng: Number(Cesium.Math.toDegrees(position.longitude).toFixed(2)),
      alt: Math.round(position.height),
    } : null,
    counts: {
      flights: stats.flights || 0,
      sats: stats.sats || 0,
      ships: stats.ships || 0,
    },
  };
}

function getFallbackSuggestions() {
  return [
    { title: 'Atlantic Air Corridor', desc: 'Commercial traffic is clustering across western Europe approaches.', lat: 49.8, lng: -12.4, alt: 1500000 },
    { title: 'Equatorial Satellite Belt', desc: 'Dense active satellite coverage crosses central Africa and the Indian Ocean.', lat: 2.5, lng: 30.2, alt: 2200000 },
    { title: 'Hormuz Maritime Pressure', desc: 'Tanker and naval density remains elevated near the strait.', lat: 26.3, lng: 56.4, alt: 800000 },
  ];
}
