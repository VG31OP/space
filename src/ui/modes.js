const FILTERS = {
  normal: 'none',
  thermal: 'sepia(1) hue-rotate(100deg) saturate(6) contrast(1.4) brightness(0.65)',
  nvg: 'saturate(0) brightness(3) contrast(4) sepia(1) hue-rotate(80deg) saturate(8) brightness(0.35)',
  crt: 'contrast(1.15) brightness(0.88) saturate(1.1)',
};

function applyMode(mode) {
  const container = document.getElementById('cesiumContainer');
  if (!container) return;

  container.style.filter = FILTERS[mode] || 'none';
  document.querySelectorAll('.mode-overlay').forEach((overlay) => overlay.remove());

  const parent = container.parentElement;
  if (!parent) return;

  if (mode === 'nvg') {
    const vignette = document.createElement('div');
    vignette.className = 'mode-overlay';
    vignette.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:radial-gradient(circle at center, rgba(0,0,0,0) 35%, rgba(0,32,0,0.78) 100%);';

    const scanlines = document.createElement('div');
    scanlines.className = 'mode-overlay';
    scanlines.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;background:repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 1px, rgba(0,0,0,0.08) 1px, rgba(0,0,0,0.08) 2px);';

    const grain = document.createElement('canvas');
    grain.className = 'mode-overlay';
    grain.width = 200;
    grain.height = 200;
    grain.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4;opacity:0.07;mix-blend-mode:screen;';

    const context = grain.getContext('2d');
    if (context) {
      const loop = () => {
        const image = context.createImageData(200, 200);
        for (let i = 0; i < image.data.length; i += 4) {
          image.data[i] = 0;
          image.data[i + 1] = Math.floor(Math.random() * 256);
          image.data[i + 2] = 0;
          image.data[i + 3] = 220;
        }
        context.putImageData(image, 0, 0);
        if (document.body.contains(grain)) {
          requestAnimationFrame(loop);
        }
      };
      requestAnimationFrame(loop);
    }

    parent.appendChild(vignette);
    parent.appendChild(scanlines);
    parent.appendChild(grain);
  }

  if (mode === 'crt') {
    const scanlines = document.createElement('div');
    scanlines.className = 'mode-overlay';
    scanlines.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(180deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.2) 3px, rgba(0,0,0,0.2) 4px);';

    const vignette = document.createElement('div');
    vignette.className = 'mode-overlay';
    vignette.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3;background:radial-gradient(circle at center, rgba(0,0,0,0) 45%, rgba(0,0,0,0.72) 100%);';

    parent.appendChild(scanlines);
    parent.appendChild(vignette);
  }

  if (mode === 'thermal') {
    const overlay = document.createElement('div');
    overlay.className = 'mode-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:2;background:repeating-linear-gradient(180deg, rgba(255,96,32,0.04) 0px, rgba(255,96,32,0.04) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px);';
    parent.appendChild(overlay);
  }
}

document.querySelectorAll('.mode-pill').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.mode-pill').forEach((pill) => pill.classList.remove('active'));
    button.classList.add('active');
    applyMode(button.dataset.mode);
  });
});

applyMode('normal');
