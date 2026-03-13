const MODES = {
  normal: {
    filter: 'none',
    overlay: null,
  },
  thermal: {
    filter: 'sepia(1) hue-rotate(100deg) saturate(6) contrast(1.4) brightness(0.65)',
    overlay: {
      background: 'transparent',
      mixBlendMode: 'normal',
      extra: `
        repeating-linear-gradient(
          0deg,
          rgba(255,60,0,0.04) 0px,
          rgba(255,60,0,0.04) 1px,
          transparent 1px,
          transparent 3px
        )
      `,
    },
  },
  nvg: {
    filter: `
      saturate(0)
      brightness(3)
      contrast(4)
      sepia(1)
      hue-rotate(80deg)
      saturate(8)
      brightness(0.35)
    `,
    overlay: {
      background: `
        radial-gradient(ellipse at center,
          transparent 40%,
          rgba(0,10,0,0.7) 100%
        )
      `,
      extra: `
        repeating-linear-gradient(
          0deg,
          rgba(0,0,0,0.12) 0px,
          rgba(0,0,0,0.12) 1px,
          transparent 1px,
          transparent 2px
        )
      `,
    },
    grain: true,
  },
  crt: {
    filter: 'contrast(1.15) brightness(0.88) saturate(1.1)',
    overlay: {
      background: `
        repeating-linear-gradient(
          0deg,
          transparent 0px,
          transparent 2px,
          rgba(0,0,0,0.18) 2px,
          rgba(0,0,0,0.18) 4px
        )
      `,
      extra: `
        radial-gradient(ellipse at center,
          transparent 55%,
          rgba(0,0,0,0.6) 100%
        )
      `,
    },
    aberration: true,
  },
};

export function initVisualModes() {
  document.querySelectorAll('.mode-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-pill').forEach((pill) => pill.classList.remove('active'));
      btn.classList.add('active');
      applyMode(btn.dataset.mode);
    });
  });

  applyMode('normal');
}

function applyMode(modeName) {
  const mode = MODES[modeName];
  const container = document.getElementById('cesiumContainer');
  if (!mode || !container) return;

  container.style.filter = mode.filter;

  const existing = document.getElementById('modeOverlay');
  if (existing) existing.remove();
  const existingGrain = document.getElementById('nvgGrain');
  if (existingGrain) existingGrain.remove();

  if (!mode.overlay) return;

  const overlay = document.createElement('div');
  overlay.id = 'modeOverlay';
  overlay.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 2;
    background: ${mode.overlay.background || 'transparent'};
    mix-blend-mode: ${mode.overlay.mixBlendMode || 'normal'};
  `;

  if (mode.overlay.extra) {
    const inner = document.createElement('div');
    inner.style.cssText = `
      position: absolute;
      inset: 0;
      background: ${mode.overlay.extra};
    `;
    overlay.appendChild(inner);
  }
  container.parentElement.appendChild(overlay);

  if (mode.grain) {
    const grain = document.createElement('canvas');
    grain.id = 'nvgGrain';
    grain.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 3;
      opacity: 0.08;
      mix-blend-mode: screen;
    `;
    grain.width = 256;
    grain.height = 256;
    const gc = grain.getContext('2d');

    function drawGrain() {
      const img = gc.createImageData(256, 256);
      for (let i = 0; i < img.data.length; i += 4) {
        const value = Math.random() * 255;
        img.data[i] = 0;
        img.data[i + 1] = value;
        img.data[i + 2] = 0;
        img.data[i + 3] = 200;
      }
      gc.putImageData(img, 0, 0);
      if (document.getElementById('nvgGrain')) requestAnimationFrame(drawGrain);
    }

    drawGrain();
    container.parentElement.appendChild(grain);
  }

  if (mode.aberration) {
    container.style.filter = `${mode.filter} url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><filter id="ab"><feColorMatrix type="matrix" values="1 0 0 0 0.01 0 0 0 0 0 0 0 1 0 -0.01 0 0 0 1 0"/></filter></svg>#ab')`;
  }
}
