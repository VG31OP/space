// SVG icon data URIs for distinct entity rendering
// Each entity type has a unique look: shape, color, and size

function svgUri(svgContent) {
  return `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
}

// Commercial aircraft — white airplane
const PLANE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <path d="M16 2 L20 14 L30 16 L20 18 L20 26 L16 24 L12 26 L12 18 L2 16 L12 14 Z" fill="white" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
</svg>`;

// Military aircraft — red/orange swept delta
const MILITARY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <path d="M16 1 L30 28 L16 22 L2 28 Z" fill="#ff6600" stroke="rgba(0,0,0,0.5)" stroke-width="1"/>
  <circle cx="16" cy="14" r="3" fill="#ff2200"/>
</svg>`;

// Satellite — cyan crossed body with solar panels
const SAT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="28" height="28">
  <rect x="10" y="10" width="8" height="8" rx="2" fill="#00ffff" stroke="rgba(0,150,150,0.7)" stroke-width="1"/>
  <rect x="0" y="12" width="10" height="4" fill="#0099cc" rx="1"/>
  <rect x="18" y="12" width="10" height="4" fill="#0099cc" rx="1"/>
  <rect x="12" y="0" width="4" height="10" fill="#0099cc" rx="1"/>
  <rect x="12" y="18" width="4" height="10" fill="#0099cc" rx="1"/>
</svg>`;

// ISS — large white station silhouette
const ISS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect x="14" y="17" width="12" height="6" rx="2" fill="white" stroke="rgba(200,255,255,0.6)" stroke-width="1"/>
  <rect x="0" y="18" width="14" height="4" fill="#ccddff" rx="1"/>
  <rect x="26" y="18" width="14" height="4" fill="#ccddff" rx="1"/>
  <rect x="4" y="14" width="6" height="12" fill="#aabbff" rx="1"/>
  <rect x="30" y="14" width="6" height="12" fill="#aabbff" rx="1"/>
  <rect x="18" y="6" width="4" height="12" fill="silver" rx="1"/>
  <rect x="18" y="22" width="4" height="12" fill="silver" rx="1"/>
</svg>`;

// Cargo ship — blue hull with superstructure
const CARGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="32" height="24">
  <path d="M2 14 L4 8 L28 8 L30 14 L16 20 Z" fill="#4499ff" stroke="#2266cc" stroke-width="1"/>
  <rect x="10" y="4" width="12" height="6" fill="#336699" rx="1"/>
  <rect x="13" y="1" width="4" height="5" fill="#2255aa" rx="1"/>
</svg>`;

// Tanker — orange elongated hull
const TANKER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 20" width="36" height="20">
  <ellipse cx="18" cy="12" rx="16" ry="7" fill="#ff9b52" stroke="#cc6622" stroke-width="1"/>
  <rect x="8" y="6" width="16" height="5" fill="#dd7733" rx="1"/>
  <circle cx="26" cy="8" r="2" fill="#cc5500"/>
</svg>`;

// Naval vessel — red, sharp bow
const NAVAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 22" width="34" height="22">
  <path d="M3 14 L6 7 L34 10 L28 18 Z" fill="#ff4444" stroke="#aa2222" stroke-width="1"/>
  <rect x="10" y="5" width="14" height="7" fill="#cc2222" rx="1"/>
  <rect x="20" y="2" width="6" height="8" fill="#aa1111" rx="1"/>
</svg>`;

// Fishing vessel — cyan, small
const FISHING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 20" width="28" height="20">
  <path d="M2 12 L5 7 L26 9 L22 16 Z" fill="#65f1ff" stroke="#00bbcc" stroke-width="1"/>
  <rect x="10" y="5" width="8" height="6" fill="#44ccdd" rx="1"/>
</svg>`;

// Passenger ship — yellow, widest hull
const PASSENGER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 22" width="36" height="22">
  <path d="M2 14 L5 7 L31 7 L34 14 L18 20 Z" fill="#ffe26b" stroke="#ccaa00" stroke-width="1"/>
  <rect x="8" y="3" width="20" height="6" fill="#ddbb44" rx="1"/>
  <rect x="13" y="0" width="10" height="4" fill="#cc9900" rx="1"/>
</svg>`;

// Wildfire — orange flame
const FIRE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="24" height="32">
  <path d="M12 2 C14 6 18 8 16 14 C20 10 20 18 16 22 C16 26 12 30 8 28 C4 26 2 20 4 16 C6 20 8 18 8 14 C6 12 6 6 12 2 Z" fill="#ff6a3d"/>
  <path d="M12 12 C13 15 15 16 14 20 C15 17 16 20 14 22 C13 24 10 24 9 22 C8 19 10 18 10 15 C9 14 9 11 12 12 Z" fill="#ffcc00"/>
</svg>`;

// Weather system — cyan cloud
const WEATHER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 24" width="32" height="24">
  <path d="M6 18 Q4 18 4 14 Q4 10 8 10 Q8 6 12 6 Q16 4 18 8 Q20 6 22 8 Q26 8 26 14 Q28 14 28 18 Z" fill="#72f6ff" stroke="#00bbcc" stroke-width="1" fill-opacity="0.9"/>
</svg>`;

// EW / GPS jamming — gold radio waves
const JAMMING_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <circle cx="16" cy="16" r="4" fill="#ffce54"/>
  <path d="M8 8 Q4 12 4 16 Q4 20 8 24" fill="none" stroke="#ffce54" stroke-width="2" stroke-linecap="round"/>
  <path d="M24 8 Q28 12 28 16 Q28 20 24 24" fill="none" stroke="#ffce54" stroke-width="2" stroke-linecap="round"/>
  <path d="M11 11 Q8 13 8 16 Q8 19 11 21" fill="none" stroke="#ffe080" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M21 11 Q24 13 24 16 Q24 19 21 21" fill="none" stroke="#ffe080" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="16" y1="2" x2="16" y2="8" stroke="#ffce54" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export const ICONS = {
  plane:     svgUri(PLANE_SVG),
  commercial: svgUri(PLANE_SVG),
  military:  svgUri(MILITARY_SVG),
  satellite: svgUri(SAT_SVG),
  iss:       svgUri(ISS_SVG),
  starlink:  svgUri(SAT_SVG),
  debris:    svgUri(SAT_SVG),
  cargo:     svgUri(CARGO_SVG),
  ship:      svgUri(CARGO_SVG),
  tanker:    svgUri(TANKER_SVG),
  naval:     svgUri(NAVAL_SVG),
  fishing:   svgUri(FISHING_SVG),
  passenger: svgUri(PASSENGER_SVG),
  fire:      svgUri(FIRE_SVG),
  wildfire:  svgUri(FIRE_SVG),
  weather:   svgUri(WEATHER_SVG),
  jamming:   svgUri(JAMMING_SVG),
  quake:     svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="16" r="4" fill="#ff5b55"/><circle cx="16" cy="16" r="10" fill="none" stroke="#ff5b55" stroke-width="2" stroke-opacity="0.6"/><circle cx="16" cy="16" r="15" fill="none" stroke="#ff5b55" stroke-width="1" stroke-opacity="0.3"/></svg>`),
  volcano:   svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><path d="M16 4 L30 28 L2 28 Z" fill="#ff4400" stroke="white" stroke-width="1"/><path d="M12 14 L16 10 L20 14" fill="none" stroke="white" stroke-width="1"/><path d="M16 4 L14 10 L18 10 Z" fill="white"/></svg>`),
};
