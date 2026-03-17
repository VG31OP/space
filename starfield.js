(function() {
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
    for (let i = 0; i < NUM_STARS; i++) {
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
    // Draw stars
    stars.forEach(s => {
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha > 1)   { s.alpha = 1;   s.twinkleDir = -1; }
      if (s.alpha < 0.1) { s.alpha = 0.1; s.twinkleDir =  1; }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,210,255,${s.alpha})`;
      ctx.fill();
    });
    // Draw shooting star
    if (shootingStar) {
      const ss = shootingStar;
      const dx = Math.cos(ss.angle) * ss.len * ss.life;
      const dy = Math.sin(ss.angle) * ss.len * ss.life;
      const grad = ctx.createLinearGradient(
        ss.x, ss.y, ss.x + dx, ss.y + dy
      );
      grad.addColorStop(0, `rgba(255,255,255,0)`);
      grad.addColorStop(1, `rgba(255,255,255,${ss.alpha})`);
      ctx.beginPath();
      ctx.moveTo(ss.x, ss.y);
      ctx.lineTo(ss.x + dx, ss.y + dy);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;
      ss.alpha -= 0.015;
      if (ss.alpha <= 0) shootingStar = null;
    }
    requestAnimationFrame(drawFrame);
  }

  resize();
  initStars();
  drawFrame();
  setInterval(launchShootingStar, SHOOTING_INTERVAL);
  window.addEventListener('resize', () => { resize(); initStars(); });
})();
