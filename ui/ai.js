function initTabs() {
  document.querySelectorAll('.ai-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ai-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.ai-tab-content').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + btn.dataset.tab);
      if (panel) panel.style.display = 'flex';
    });
  });
}
initTabs();

document.addEventListener('DOMContentLoaded', () => {
const analystPanel = document.getElementById('tab-analyst');
if(analystPanel) analystPanel.innerHTML = `<div style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;" id="analystMsgs"></div>
<div style="padding:10px 12px;border-top:1px solid rgba(0,255,136,0.1);display:flex;gap:8px;">
  <input id="analystInput" type="text" placeholder="Ask the analyst..." style="flex:1;background:rgba(0,255,136,0.05);border:1px solid rgba(0,255,136,0.2);border-radius:6px;padding:8px 10px;color:#aabbcc;font-family:monospace;font-size:11px;outline:none;" />
  <button id="analystSend" style="padding:8px 12px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.3);border-radius:6px;color:#00ff88;font-family:monospace;font-size:10px;font-weight:700;cursor:pointer;">SEND</button>
</div>`;
});

function addMsg(role,text){const d=document.createElement('div');d.style.cssText='padding:8px 10px;border-radius:6px;font-family:monospace;font-size:11px;line-height:1.5;max-width:90%;'+(role==='user'?'align-self:flex-end;background:rgba(0,255,136,0.08);border:1px solid rgba(0,255,136,0.2);color:#aabbcc;':role==='err'?'background:rgba(255,50,50,0.08);border:1px solid rgba(255,50,50,0.2);color:#ff6666;':'align-self:flex-start;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#8899aa;');d.textContent=text;const msgs=document.getElementById('analystMsgs');msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}

async function sendAnalyst(){const inp=document.getElementById('analystInput');const q=inp.value.trim();if(!q)return;inp.value='';addMsg('user',q);const t=addMsg('ai','Analyzing...');try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.__ENV.OPENAI_KEY},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:250,messages:[{role:'system',content:'You are a geospatial OSINT analyst. Be concise and use intelligence terminology.'},{role:'user',content:q}]})});const data=await r.json();t.textContent=data.choices?.[0]?.message?.content||'No response.';}catch(e){t.style.color='#ff6666';t.textContent='Connection failed.';}}

document.addEventListener('DOMContentLoaded',()=>{const btn=document.getElementById('analystSend');const inp=document.getElementById('analystInput');if(btn)btn.onclick=sendAnalyst;if(inp)inp.onkeydown=e=>{if(e.key==='Enter')sendAnalyst();};});

const FALLBACK_NEWS = [
  { title: "Naval task groups reposition near the Eastern Mediterranean", source: "Regional Watch", publishedAt: new Date(Date.now() - 15 * 60000).toISOString(), url: "#" },
  { title: "Launch cadence increases as new Starlink tranche enters orbit", source: "Orbital Monitor", publishedAt: new Date(Date.now() - 43 * 60000).toISOString(), url: "#" },
  { title: "Cargo insurers watch Red Sea diversion and Suez transit delays", source: "Maritime Desk", publishedAt: new Date(Date.now() - 83 * 60000).toISOString(), url: "#" },
];

const COUNTRY_COORDS = {
  ukraine: [48.38, 31.17, 1800000],
  russia: [61.52, 105.31, 3500000],
  israel: [31.05, 34.85, 900000],
  iran: [32.42, 53.68, 2100000],
  china: [35.86, 104.2, 3200000],
  taiwan: [23.7, 121, 900000],
  japan: [36.2, 138.25, 1800000],
  india: [20.59, 78.96, 2500000],
  syria: [34.8, 38.99, 1000000],
  yemen: [15.55, 48.52, 1100000],
  egypt: [26.82, 30.8, 1700000],
};

const RSS_FEEDS = [
  { url: "/api/bbc/news/world/rss.xml", source: "BBC World" },
  { url: "/api/reuters/Reuters/worldNews", source: "Reuters" },
  { url: "/api/aljazeera/xml/rss/all.xml", source: "Al Jazeera" },
];

function timeAgo(timestamp) {
  const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function locateHeadline(title) {
  const lower = title.toLowerCase();
  const match = Object.entries(COUNTRY_COORDS).find(([name]) => lower.includes(name));
  return match ? match[1] : null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseRssFeed(text, fallbackSource) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  return [...xml.querySelectorAll("item")].slice(0, 8).map((item) => ({
    title: item.querySelector("title")?.textContent?.trim() || "Untitled",
    url: item.querySelector("link")?.textContent?.trim() || "#",
    publishedAt: item.querySelector("pubDate")?.textContent || new Date().toISOString(),
    source: item.querySelector("source")?.textContent || fallbackSource,
    description: item.querySelector("description")?.textContent || "",
  }));
}

function buildAnalystPrompt(app) {
  const context = app.getContext();
  return `You are a geospatial intelligence analyst for a real-time global situational awareness platform. You have access to:\n- ${context.flightCount} live aircraft (${context.militaryCount} military)\n- ${context.satelliteCount} tracked satellites\n- ${context.shipCount} maritime vessels\n- Current camera: lat ${context.camera.lat}, lng ${context.camera.lng}, alt ${context.camera.alt}m\nProvide concise, analytical responses. When referencing locations, give specific coordinates when possible. Flag any anomalies or patterns of interest.`;
}

async function streamOpenAI(messages, onChunk) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.__ENV.OPENAI_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", stream: true, messages }),
  });
  if (!response.ok || !response.body) throw new Error(`OpenAI ${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    lines.forEach((line) => {
      if (!line.startsWith("data:")) return;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload);
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) onChunk(chunk);
      } catch (error) {
        console.warn("Stream parse error", error);
      }
    });
  }
}

async function completeOpenAI(messages) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${window.__ENV.OPENAI_KEY}` },
    body: JSON.stringify({ model: "gpt-4o-mini", messages, temperature: 0.4 }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}`);
  const payload = await response.json();
  return payload.choices?.[0]?.message?.content || "";
}

function fallbackAnalyst(app, text) {
  const context = app.getContext();
  const focus = context.militaryCount > 0 ? `Military aviation is the main anomaly with ${context.militaryCount} active tracks.` : "No concentrated military surge is visible in the current feed.";
  return `${focus} Camera is centered near ${context.camera.lat}, ${context.camera.lng} at ${context.camera.alt}m. Request: ${text}`;
}

function fallbackSmartViews(app) {
  const context = app.getContext();
  return [
    { title: "Eastern Mediterranean Air-Maritime Overlap", description: `Cross-check ${context.militaryCount} military tracks against shipping lanes and signal jamming zones.`, lat: 34.7, lng: 33.3, alt: 1400000, zoom_reason: "Concurrent air, sea, and EW indicators" },
    { title: "North Atlantic Civil Aviation Corridor", description: "Review dense commercial transit against storm activity and diversion routes.", lat: 50.1, lng: -28.4, alt: 2600000, zoom_reason: "High route density with weather pressure" },
    { title: "Malacca Strait Shipping Watch", description: "Track concentrated cargo and tanker traffic at a strategic chokepoint.", lat: 2.5, lng: 101.1, alt: 1200000, zoom_reason: "Sustained maritime throughput in constrained waters" },
  ];
}

export function createAiPanel(app) {
  const tabButtons = Array.from(document.querySelectorAll(".ai-tab-btn"));
  const tabPanels = Array.from(document.querySelectorAll(".ai-tab-content"));
  const newsList = document.getElementById("newsList");
  const newsStatus = document.getElementById("newsStatus");
  const breakingChip = document.getElementById("breakingChip");
  const chatHistory = document.getElementById("analystMessages");
  const analystInput = document.getElementById("analystInput");
  const analystSend = document.getElementById("analystSend");
  const smartList = document.getElementById("tab-smartview");
  const suggestionsCache = [];
  const conversation = [];

  // Tab switching — use display style, not class toggling
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.style.display = "none");
      button.classList.add("active");
      const target = button.dataset.tab;
      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.style.display = "flex";
    });
  });

  // Show news tab by default
  document.getElementById('tab-news').style.display = 'flex';
  document.getElementById('tab-analyst').style.display = 'none';
  document.getElementById('tab-smartview').style.display = 'none';

  function renderNews(items) {
    newsList.innerHTML = "";
    const breaking = items.some((item) => /war|attack|missile|explosion|conflict/i.test(item.title));
    breakingChip.classList.toggle("pulse", breaking);
    breakingChip.textContent = breaking ? "BREAKING" : "LIVE FEED";

    items.forEach((article) => {
      const domain = article.url && article.url !== "#" ? new URL(article.url).hostname : "example.com";
      const card = document.createElement("article");
      card.className = "news-card";
      card.innerHTML = `
        <div class="news-meta">
          <div class="news-source">
            <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64" alt="" />
            <span>${escapeHtml(article.source?.name || article.source || "Open feed")}</span>
          </div>
          <span>${timeAgo(article.publishedAt)}</span>
        </div>
        <div class="news-title">${escapeHtml(article.title)}</div>
        <div class="news-actions">
          <button class="news-action">LOCATE</button>
          <a class="news-action" href="${article.url || "#"}" target="_blank" rel="noreferrer">OPEN</a>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => {
        const location = locateHeadline(article.title);
        if (!location) {
          app.notify("No geographic cue found in that headline.", "warning");
          return;
        }
        app.flyTo(location[0], location[1], location[2]);
      });
      newsList.appendChild(card);
    });
  }

  async function refreshNews() {
    try {
      const articles = [];

      if (window.__ENV.NEWS_KEY) {
        const url = `/api/news/v2/everything?q=military+geopolitics+aviation+maritime&sortBy=publishedAt&pageSize=8&language=en&apiKey=${window.__ENV.NEWS_KEY}`;
        const response = await fetch(url);
        if (response.ok) {
          const payload = await response.json();
          articles.push(...(payload.articles || []));
        }
      }

      if (articles.length === 0) {
        for (const feed of RSS_FEEDS) {
          const response = await fetch(feed.url);
          if (!response.ok) {
            continue;
          }
          const text = await response.text();
          articles.push(...parseRssFeed(text, feed.source));
          if (articles.length >= 8) {
            break;
          }
        }
      }

      if (articles.length === 0) {
        throw new Error("No RSS or NewsAPI articles available");
      }

      renderNews(articles.slice(0, 8));
      newsStatus.textContent = window.__ENV.NEWS_KEY ? "Updated from proxied feeds" : "Updated from live RSS feeds";
      app.reportAPIStatus("News (Geopolitical)", "NOMINAL");
    } catch (error) {
      newsStatus.textContent = "Fallback intelligence digest";
      renderNews(FALLBACK_NEWS);
      if (error.message.includes("401")) app.reportAPIStatus("News (Geopolitical)", "401 UNAUTHORIZED");
      else app.reportAPIStatus("News (Geopolitical)", "ERROR");
      app.notify("News feed degraded. Fallback headlines active.", "warning");
    }
  }

  function addMessage(role, content, extraClass = "") {
    const message = document.createElement("div");
    message.className = `chat-message ${role}${extraClass ? ` ${extraClass}` : ""}`;
    message.textContent = content;
    chatHistory.appendChild(message);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return message;
  }

  async function handleAnalystSend() {
    const text = analystInput.value.trim();
    if (!text) return;
    analystInput.value = "";
    addMessage("user", text);
    const typing = addMessage("assistant", "Analyzing", "typing");
    conversation.push({ role: "user", content: text });
    const messages = [{ role: "system", content: buildAnalystPrompt(app) }, ...conversation.slice(-8)];

    try {
      if (!window.__ENV.OPENAI_KEY) {
        typing.classList.remove("typing");
        typing.textContent = fallbackAnalyst(app, text);
      } else {
        typing.classList.remove("typing");
        typing.textContent = "";
        await streamOpenAI(messages, (chunk) => {
          typing.textContent += chunk;
          chatHistory.scrollTop = chatHistory.scrollHeight;
        });
      }
      conversation.push({ role: "assistant", content: typing.textContent });
      app.reportAPIStatus("OpenAI (Analyst)", "NOMINAL");
    } catch (error) {
      typing.classList.remove("typing");
      typing.textContent = fallbackAnalyst(app, text);
      if (error.message.includes("429")) app.reportAPIStatus("OpenAI (Analyst)", "RATE LIMITED");
      else app.reportAPIStatus("OpenAI (Analyst)", "ERROR");
      app.notify("Analyst stream degraded. Local context answer returned.", "warning");
    }
  }

  analystSend.addEventListener("click", handleAnalystSend);
  analystInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleAnalystSend();
  });

  function renderSmartCards(items) {
    smartList.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "smart-card";
      card.innerHTML = `
        <div class="smart-title">${escapeHtml(item.title)}</div>
        <div>${escapeHtml(item.description)}</div>
        <div class="smart-meta">
          <span>${item.zoom_reason}</span>
          <button class="news-action">FLY THERE</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", () => app.flyTo(item.lat, item.lng, item.alt));
      smartList.appendChild(card);
    });
  }

  async function refreshSmartView() {
    let suggestions = [];
    if (!window.__ENV.OPENAI_KEY) {
      suggestions = fallbackSmartViews(app);
    } else {
      try {
        const context = app.getContext();
        const prompt = `Based on current data: ${context.flightCount} flights, ${context.militaryCount} military aircraft, ${context.shipCount} ships. Suggest 3 specific interesting views with coordinates. Format as JSON array: [{title, description, lat, lng, alt, zoom_reason}]`;
        const response = await completeOpenAI([
          { role: "system", content: "You are a geospatial analyst. Return valid JSON only." },
          { role: "user", content: prompt },
        ]);
        suggestions = JSON.parse(response);
      } catch (error) {
        suggestions = fallbackSmartViews(app);
      }
    }
    suggestionsCache.unshift(suggestions);
    suggestionsCache.splice(5);
    renderSmartCards(suggestionsCache[0]);
  }

  window.setInterval(refreshNews, 5 * 60 * 1000);
  window.setInterval(refreshSmartView, 60000);
  refreshNews();
  refreshSmartView();
  addMessage("assistant", "Analyst ready. Ask for anomalies, routes, or coordinate-specific assessment.");

  return {};
}

async function refreshSmartView(){const el=document.getElementById('tab-smartview');if(!el)return;el.innerHTML='<div style="padding:16px;font-family:monospace;font-size:11px;color:#445566;">FETCHING INTEL...</div>';let sugs=[];try{const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+window.__ENV.OPENAI_KEY},body:JSON.stringify({model:'gpt-4o-mini',max_tokens:350,messages:[{role:'user',content:'Suggest 3 interesting geospatial viewpoints right now. Reply ONLY with a JSON array, no markdown, no explanation: [{"title":"...","desc":"...","lat":0,"lng":0,"alt":500000}]'}]})});const d=await r.json();sugs=JSON.parse((d.choices?.[0]?.message?.content||'[]').replace(/```json|```/g,'').trim());}catch(_){sugs=[{title:'Strait of Hormuz',desc:'Key maritime chokepoint with high naval activity',lat:26.5,lng:56.3,alt:400000},{title:'ISS Groundtrack',desc:'Current ISS orbital pass over hemisphere',lat:28.6,lng:77.2,alt:800000},{title:'North Atlantic Corridor',desc:'Busiest transatlantic flight path',lat:52,lng:-30,alt:2000000}];}el.innerHTML='';sugs.forEach(s=>{const c=document.createElement('div');c.style.cssText='background:rgba(0,255,136,0.04);border:1px solid rgba(0,255,136,0.15);border-radius:8px;padding:12px;margin:8px;';c.innerHTML='<div style="font-family:monospace;font-size:10px;color:#00ff88;font-weight:700;letter-spacing:0.1em;margin-bottom:5px;">'+s.title+'</div><div style="font-family:monospace;font-size:11px;color:#556677;line-height:1.5;margin-bottom:10px;">'+s.desc+'</div><button style="padding:4px 10px;background:rgba(0,255,136,0.1);border:1px solid rgba(0,255,136,0.25);border-radius:4px;color:#00ff88;font-size:9px;font-family:monospace;font-weight:700;cursor:pointer;">FLY THERE</button>';c.querySelector('button').onclick=()=>{if(window.viewer)window.viewer.camera.flyTo({destination:Cesium.Cartesian3.fromDegrees(s.lng,s.lat,s.alt),duration:2});};el.appendChild(c);});}
refreshSmartView();
setInterval(refreshSmartView,60000);

