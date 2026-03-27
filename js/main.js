import { Game } from './game.js';
import { UI   } from './ui.js';

// ── Animated grid background (matches databasis.info) ──────────────────────
(function initGridCanvas() {
  const c = document.getElementById('grid-canvas');
  if (!c) return;
  const ctx = c.getContext('2d');
  let W, H, nodes = [];

  const resize = () => {
    W = c.width  = window.innerWidth;
    H = c.height = window.innerHeight;
    nodes = [];
    const cols = Math.ceil(W / 80);
    const rows = Math.ceil(H / 80);
    for (let x = 0; x <= cols; x++) for (let y = 0; y <= rows; y++) {
      nodes.push({
        x: x * 80, y: y * 80,
        phase: Math.random() * Math.PI * 2,
        spd: 0.3 + Math.random() * 0.5,
      });
    }
  };
  resize();
  window.addEventListener('resize', resize);

  let t = 0;
  const BRAND = 'rgba(120,177,90,';
  const loop = () => {
    requestAnimationFrame(loop);
    t += 0.012;
    ctx.clearRect(0, 0, W, H);
    nodes.forEach(n => {
      const a = ((Math.sin(t * n.spd + n.phase) + 1) / 2) * 0.18;
      ctx.fillStyle = BRAND + a + ')';
      ctx.fillRect(n.x - 1, n.y - 1, 2, 2);
    });
    // Subtle grid lines
    ctx.strokeStyle = BRAND + '0.03)';
    ctx.lineWidth = 1;
    const cols = Math.ceil(W / 80);
    const rows = Math.ceil(H / 80);
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * 80, 0); ctx.lineTo(x * 80, H);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * 80); ctx.lineTo(W, y * 80);
      ctx.stroke();
    }
  };
  loop();
})();

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    const pauseBtn = document.getElementById('btn-pause');
    if (document.getElementById('screen-game')?.classList.contains('active')) {
      pauseBtn?.click();
    }
  }
});

// ── Init game ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const ui     = new UI();
const game   = new Game(canvas, ui);

ui.bindShopClicks(game);
ui.update(game);
