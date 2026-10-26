// The "they got it!" moment: a gold tint over the page and a burst of confetti for about 3 seconds.
const COLORS = ['#d0a64e', '#e9dfc4', '#9fd3a9', '#ff9c92', '#f0e7d8', '#c9a24a'];

export function celebrate() {
  const tint = document.createElement('div');
  tint.className = 'celebrate-tint';
  document.body.append(tint);
  setTimeout(() => tint.remove(), 3000);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'celebrate-confetti';
  document.body.append(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = (canvas.width = innerWidth * dpr), h = (canvas.height = innerHeight * dpr);
  const pieces = Array.from({ length: 160 }, (_, i) => ({
    x: w * (i % 2 ? 0.15 : 0.85), y: h * 0.9,
    vx: (i % 2 ? 1 : -1) * (2 + Math.random() * 9) * dpr, vy: -(12 + Math.random() * 14) * dpr,
    size: (5 + Math.random() * 7) * dpr, spin: Math.random() * 6, color: COLORS[i % COLORS.length],
  }));
  const start = performance.now();
  (function frame(now) {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, 3 - t));
    for (const p of pieces) {
      p.vy += 0.45 * dpr; p.vx *= 0.99; p.x += p.vx; p.y += p.vy;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin * t);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 3) requestAnimationFrame(frame); else canvas.remove();
  })(start);
}
