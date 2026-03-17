function initTabs() {
  const buttons = document.querySelectorAll('.ai-tab-btn');
  const panels = document.querySelectorAll('.ai-tab-content');
  if (buttons.length === 0) {
    setTimeout(initTabs, 100);
    return;
  }
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.borderColor = 'rgba(0,255,136,0.1)';
        b.style.color = '#445566';
      });
      panels.forEach(p => { p.style.display = 'none'; p.style.flexDirection = 'column'; });
      btn.classList.add('active');
      btn.style.background = 'rgba(0,255,136,0.1)';
      btn.style.borderColor = 'rgba(0,255,136,0.3)';
      btn.style.color = '#00ff88';
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) { panel.style.display = 'flex'; panel.style.flexDirection = 'column'; }
    });
  });
  const firstPanel = document.getElementById('tab-news');
  const otherPanels = document.querySelectorAll('.ai-tab-content:not(#tab-news)');
  if (firstPanel) firstPanel.style.display = 'flex';
  otherPanels.forEach(p => p.style.display = 'none');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTabs);
} else {
  initTabs();
}

function initMinimap() {
  const minimapEl = document.getElementById('minimap');
  if (!minimapEl) return;
  minimapEl.innerHTML = '<canvas id="minimapCanvas" width="240" height="140" style="width:100%;height:100%;border-radius:6px;display:block;"></canvas>';
  const canvas = document.getElementById('minimapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0a0c10';
    ctx.fillRect(0, 0, 240, 140);
    ctx.strokeStyle = 'rgba(0,255,136,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= 240; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,140); ctx.stroke(); }
    for (let y = 0; y <= 140; y += 14) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(240,y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,255,136,0.2)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(120,0); ctx.lineTo(120,140); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0,70); ctx.lineTo(240,70); ctx.stroke();
    if (window.viewer && window.Cesium && window.viewer.camera) {
      try {
        const cam = window.viewer.camera.positionCartographic;
        const toDeg = window.Cesium?.Math?.toDegrees || ((r) => r * 180 / Math.PI);
        const lat = toDeg(cam.latitude);
        const lng = toDeg(cam.longitude);
        const px = ((lng + 180) / 360) * 240;
        const py = ((90 - lat) / 180) * 140;
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,68,68,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444'; ctx.fill();
        ctx.fillStyle = 'rgba(0,255,136,0.5)';
        ctx.font = '7px monospace';
        ctx.fillText(lat.toFixed(1) + ' ' + lng.toFixed(1), 4, 136);
      } catch(_) {}
    }
    requestAnimationFrame(draw);
  }
  draw();
}
function tryInitMinimap() {
  const el = document.getElementById('minimap');
  if (!el) {
    setTimeout(tryInitMinimap, 500);
    return;
  }
  initMinimap();
}
tryInitMinimap();

function ensureAnalystLayout() {
  const analystTab = document.getElementById('tab-analyst');
  if (!analystTab) return;

  analystTab.innerHTML = `
    <div id="analystMsgs" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="padding:12px;border-top:1px solid rgba(0,255,136,0.12);display:flex;gap:8px;">
      <input id="analystInput" type="text" placeholder="Ask the analyst" style="flex:1;background:rgba(4,12,10,0.94);border:1px solid rgba(0,255,136,0.28);border-radius:6px;padding:9px 12px;color:#d7e4ec;font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;" />
      <button id="analystSend" type="button" style="padding:9px 14px;background:transparent;border:1px solid rgba(0,255,136,0.35);border-radius:6px;color:#00ff88;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:700;letter-spacing:0.1em;">SEND</button>
    </div>
  `;
}

function addMsg(role, text) {
  const wrap = document.getElementById('analystMsgs');
  if (!wrap) return null;

  const div = document.createElement('div');
  div.style.cssText = [
    'padding:8px 10px',
    'border-radius:6px',
    'font-family:"JetBrains Mono", monospace',
    'font-size:11px',
    'line-height:1.5',
    'max-width:90%',
    role === 'user'
      ? 'align-self:flex-end;background:rgba(0,255,136,0.12);border:1px solid rgba(0,255,136,0.24);color:#d7fff0;'
      : role === 'err'
      ? 'align-self:flex-start;background:rgba(255,64,64,0.12);border:1px solid rgba(255,64,64,0.28);color:#ff7b7b;'
      : 'align-self:flex-start;background:rgba(10,18,18,0.72);border:1px solid rgba(255,255,255,0.08);color:#c8d3d9;',
  ].join(';');
  div.textContent = text;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

async function sendAnalyst() {
  const now = Date.now();
  if (window._lastAnalystCall && now - window._lastAnalystCall < 3000) return;
  window._lastAnalystCall = now;

  const input = document.getElementById('analystInput');
  const query = input?.value.trim();
  if (!query) return;

  input.value = '';
  addMsg('user', query);
  const thinking = addMsg('ai', 'Analyzing');

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.__ENV.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 250,
        messages: [
          { role: 'system', content: 'you are a geospatial OSINT analyst, be concise.' },
          { role: 'user', content: query },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();
    if (thinking) {
      thinking.textContent = data.choices?.[0]?.message?.content || 'No response';
    }
  } catch {
    if (thinking) {
      thinking.style.color = '#ff6666';
      thinking.textContent = 'Connection failed';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAnalystLayout();
  const sendButton = document.getElementById('analystSend');
  const input = document.getElementById('analystInput');

  if (sendButton) {
    sendButton.onclick = sendAnalyst;
  }

  if (input) {
    input.onkeydown = (event) => {
      if (event.key === 'Enter') {
        sendAnalyst();
      }
    };
  }
});

function renderFallbackSuggestions() {
  const el = document.getElementById('tab-smartview');
  if (!el) return;
  const items = [
    { title: 'STRAIT OF HORMUZ', desc: 'High naval activity — key oil transit chokepoint', lat: 26.5, lng: 56.3, alt: 400000 },
    { title: 'ISS ORBIT', desc: 'International Space Station current pass', lat: 28.6, lng: 77.2, alt: 800000 },
    { title: 'NORTH ATLANTIC CORRIDOR', desc: 'Busiest transatlantic flight path', lat: 52, lng: -30, alt: 2000000 },
    { title: 'SOUTH CHINA SEA', desc: 'Active maritime and military zone', lat: 15, lng: 114, alt: 1500000 },
  ];
  el.innerHTML = '';
  items.forEach(s => {
    const c = document.createElement('div');
    c.style.cssText = 'background:rgba(0,255,136,0.04);border:1px solid rgba(0,255,136,0.15);border-radius:8px;padding:12px;margin:8px;';
    c.innerHTML = '<div style="font-family:monospace;font-size:10px;color:#00ff88;font-weight:700;letter-spacing:0.1em;margin-bottom:5px;">' + s.title + '</div><div style="font-family:monospace;font-size:11px;color:#556677;line-height:1.5;margin-bottom:10px;">' + s.desc + '</div><button style="padding:4px 10px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.25);border-radius:4px;color:#00ff88;font-size:9px;font-family:monospace;font-weight:700;cursor:pointer;">FLY THERE</button>';
    c.querySelector('button').onclick = () => {
      if (window.viewer) window.viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(s.lng, s.lat, s.alt), duration: 2 });
    };
    el.appendChild(c);
  });
}

async function refreshSmartView() {
  if (!window.__ENV?.OPENAI_KEY) {
    renderFallbackSuggestions();
    return;
  }
  const now = Date.now();
  if (window._lastSmartCall && now - window._lastSmartCall < 60000) return;
  window._lastSmartCall = now;

  const container = document.getElementById('tab-smartview');
  if (!container) return;

  container.innerHTML = '<div style="padding:12px;color:#00ff88;font-family:\'JetBrains Mono\',monospace;font-size:11px;">FETCHING INTEL</div>';

  const fallback = [
    { title: 'Strait of Hormuz', desc: 'Chokepoint surveillance over tanker and naval activity.', lat: 26.5, lng: 56.3, alt: 400000 },
    { title: 'ISS Groundtrack', desc: 'Current overhead pass context for broad regional scanning.', lat: 28.6, lng: 77.2, alt: 800000 },
    { title: 'North Atlantic Corridor', desc: 'Long-haul aviation density and transatlantic routing pressure.', lat: 52, lng: -30, alt: 2000000 },
  ];

  let suggestions = fallback;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${window.__ENV.OPENAI_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 350,
        messages: [
          {
            role: 'user',
            content: 'Give me 3 interesting geospatial viewpoints right now and reply only with a raw JSON array with no markdown containing objects each with a title string, a desc string, a lat number, a lng number, and an alt number.',
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
    const data = await response.json();
    const raw = (data.choices?.[0]?.message?.content || '[]').replace(/```json|```/gi, '').trim();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) {
      suggestions = parsed;
    }
  } catch {
    suggestions = fallback;
  }

  container.innerHTML = '';
  suggestions.forEach((suggestion) => {
    const card = document.createElement('div');
    card.style.cssText = 'margin:12px;border:1px solid rgba(0,255,136,0.24);background:rgba(0,40,20,0.24);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px;';
    card.innerHTML = `
      <div style="color:#00ff88;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;letter-spacing:0.08em;">${suggestion.title}</div>
      <div style="color:#7b8f9f;font-size:11px;line-height:1.5;">${suggestion.desc}</div>
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'FLY THERE';
    button.style.cssText = 'align-self:flex-start;padding:7px 11px;background:transparent;border:1px solid rgba(0,255,136,0.35);border-radius:6px;color:#00ff88;font-family:"JetBrains Mono",monospace;font-size:10px;font-weight:700;letter-spacing:0.08em;';
    button.onclick = () => {
      window.viewer?.camera.flyTo({
        destination: window.Cesium.Cartesian3.fromDegrees(suggestion.lng, suggestion.lat, suggestion.alt),
      });
    };

    card.appendChild(button);
    container.appendChild(card);
  });
}

refreshSmartView();
setInterval(refreshSmartView, 300000);
