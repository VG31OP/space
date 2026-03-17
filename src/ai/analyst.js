import * as Cesium from 'cesium';

let analystViewer = null;
let analystAppState = null;

export function initAnalyst(viewer, appState) {
  analystViewer = viewer;
  analystAppState = appState;

  const sendBtn = document.getElementById('analystSend');
  const input = document.getElementById('analystInput');
  if (!sendBtn || !input) return;

  sendBtn.addEventListener('click', sendAnalystQuery);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') sendAnalystQuery();
  });
}

async function sendAnalystQuery() {
  const input = document.getElementById('analystInput');
  const query = input?.value.trim();
  if (!query) return;

  input.value = '';
  appendMessage('user', query);
  appendMessage('assistant', '...', 'thinking');

  try {
    const context = buildGlobeContext();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.__ENV.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a geospatial OSINT analyst. Current data: ${JSON.stringify(context)}. Be concise. Use military/intelligence terminology.`,
          },
          { role: 'user', content: query },
        ],
        max_tokens: 300,
      }),
    });

    if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'No response';
    removeThinking();
    appendMessage('assistant', reply);
  } catch (error) {
    removeThinking();
    appendMessage('error', 'Connection lost. Retry.');
  }
}

function buildGlobeContext() {
  const position = analystViewer?.camera?.positionCartographic;
  const stats = analystAppState?.stats || {};

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
    layers: Object.entries(window.layerToggles || {})
      .filter(([, enabled]) => enabled)
      .map(([name]) => name),
    utc: new Date().toISOString(),
  };
}

function appendMessage(role, text, id) {
  const msgs = document.getElementById('analystMessages');
  if (!msgs) return null;

  const div = document.createElement('div');
  if (id) div.id = id;
  div.style.cssText = `
    padding: 8px 10px;
    border-radius: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    line-height: 1.5;
    max-width: 90%;
    ${role === 'user'
      ? 'align-self: flex-end; background: rgba(0,255,136,0.08); border: 1px solid rgba(0,255,136,0.2); color: #aabbcc;'
      : role === 'error'
      ? 'background: rgba(255,50,50,0.08); border: 1px solid rgba(255,50,50,0.2); color: #ff6666;'
      : 'align-self: flex-start; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #8899aa;'}
  `;
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function removeThinking() {
  const thinking = document.getElementById('thinking');
  if (thinking) thinking.remove();
}
