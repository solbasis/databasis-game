import { TOWERS, TOWER_ORDER, ENEMIES, WAVES } from './config.js';

export class UI {
  constructor() {
    // HUD elements
    this.elBasis    = document.getElementById('hud-basis');
    this.elTvl      = document.getElementById('hud-tvl');
    this.elTvlFill  = document.getElementById('tvl-fill');
    this.elWave     = document.getElementById('hud-wave');
    this.elIncome   = document.getElementById('income-val');
    this.elScore    = document.getElementById('hud-score');

    // Shop
    this.elShopItems = document.getElementById('shop-items');
    this.elTowerDetail = document.getElementById('tower-detail');
    this.btnWave    = document.getElementById('btn-wave');

    // Announce
    this.elAnnounce = document.getElementById('wave-announce');
    this.elWNum     = document.getElementById('wa-wave-num');
    this.elWSub     = document.getElementById('wa-enemies');
    this._announceTimer = null;

    // End screens
    this.elGameover = document.getElementById('screen-gameover');
    this.elVictory  = document.getElementById('screen-victory');

    // Pause
    this.elPause    = document.getElementById('pause-overlay');
    this.paused     = false;

    // Toast container
    this.elToasts   = document.getElementById('toast-container');

    // Build shop
    this._buildShop();
    this._buildBgCanvas();
  }

  // ── BG CANVAS (menu) ────────────────────────────────
  _buildBgCanvas() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h;
    const dots = [];

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create grid dots
    for (let x = 0; x < 40; x++) for (let y = 0; y < 25; y++) {
      dots.push({ x: x/40, y: y/25, phase: Math.random()*Math.PI*2, spd: .3+Math.random()*.7 });
    }

    let t = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#3af0a0';
      dots.forEach(d => {
        const a = (Math.sin(t * d.spd + d.phase) + 1) / 2 * .8;
        ctx.globalAlpha = a;
        ctx.fillRect(d.x * w, d.y * h, 2, 2);
      });
      ctx.globalAlpha = 1;
    };
    loop();
  }

  // ── SHOP BUILD ──────────────────────────────────────
  _buildShop() {
    const container = this.elShopItems;
    if (!container) return;
    container.innerHTML = '';
    TOWER_ORDER.forEach(id => {
      const def = TOWERS[id];
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.dataset.id = id;
      el.innerHTML = `
        <div class="si-icon">${def.icon}</div>
        <div class="si-info">
          <div class="si-name">${def.name}</div>
          <div class="si-desc">${def.desc}</div>
        </div>
        <div class="si-cost">${def.cost}</div>
      `;
      container.appendChild(el);
    });
  }

  bindShopClicks(game) {
    this.elShopItems.querySelectorAll('.shop-item').forEach(el => {
      el.addEventListener('click', () => {
        game.setSelectedTower(el.dataset.id);
      });
    });

    // Wave button
    this.btnWave?.addEventListener('click', () => {
      if (game.state === 'idle' && game.waveIdx < 15) {
        game.startWave();
      }
    });

    // Pause btn
    document.getElementById('btn-pause')?.addEventListener('click', () => {
      this.togglePause(game);
    });

    // Speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        game.setSpeed(parseFloat(btn.dataset.speed));
      });
    });

    // Pause overlay buttons
    document.getElementById('btn-resume')?.addEventListener('click', () => this.togglePause(game));
    document.getElementById('btn-restart-pause')?.addEventListener('click', () => {
      this.hidePause(); game.reset();
    });
    document.getElementById('btn-quit-pause')?.addEventListener('click', () => {
      this.hidePause();
      document.getElementById('screen-game').classList.remove('active');
      document.getElementById('screen-menu').classList.add('active');
      game.stop();
    });

    // Game over buttons
    document.getElementById('btn-retry-over')?.addEventListener('click', () => {
      this.elGameover.classList.remove('show'); game.reset();
    });

    // Victory buttons
    document.getElementById('btn-retry-win')?.addEventListener('click', () => {
      this.elVictory.classList.remove('show'); game.reset();
    });

    // How to play
    document.getElementById('btn-how')?.addEventListener('click', () => {
      document.getElementById('screen-menu').classList.remove('active');
      document.getElementById('screen-howto').classList.add('active');
    });
    document.querySelector('.back-btn')?.addEventListener('click', () => {
      document.getElementById('screen-howto').classList.remove('active');
      document.getElementById('screen-menu').classList.add('active');
    });

    // Start game
    document.getElementById('btn-start')?.addEventListener('click', () => {
      document.getElementById('screen-menu').classList.remove('active');
      document.getElementById('screen-game').classList.add('active');
      game.reset();
    });
  }

  // ── HUD UPDATE ──────────────────────────────────────
  update(game) {
    if (this.elBasis)   this.elBasis.textContent = Math.floor(game.basis).toLocaleString();
    if (this.elScore)   this.elScore.textContent  = game.score.toLocaleString();
    if (this.elIncome)  this.elIncome.textContent = game.income.toFixed(0);
    const incomeDisplay = document.getElementById('income-display');
    if (incomeDisplay) incomeDisplay.textContent = game.income.toFixed(0) + ' $B/s';

    const tvl = game.tvl.val;
    if (this.elTvl) {
      this.elTvl.textContent = Math.ceil(tvl) + '%';
      this.elTvl.className = tvl > 50 ? '' : tvl > 25 ? 'warn' : 'crit';
    }
    if (this.elTvlFill) {
      this.elTvlFill.style.width = tvl + '%';
      this.elTvlFill.className = 'tvl-fill' + (tvl > 50 ? '' : tvl > 25 ? ' warn' : ' crit');
    }

    const wNum = game.waveIdx + (game.state === 'wave' ? 0 : 0);
    const wDisp = game.state === 'wave' ? game.waveIdx + 1 : game.waveIdx;
    if (this.elWave) this.elWave.textContent = `${Math.min(wDisp, 15)} / 15`;

    // Wave button
    if (this.btnWave) {
      const canStart = game.state === 'idle' && game.waveIdx < 15;
      this.btnWave.disabled = !canStart;
      this.btnWave.textContent = game.state === 'wave'
        ? `WAVE ${game.waveIdx + 1} ACTIVE`
        : game.waveIdx >= 15
          ? 'PROTOCOL SECURED'
          : `[ START WAVE ${game.waveIdx + 1} ]`;
    }

    // Shop item affordability
    this.elShopItems?.querySelectorAll('.shop-item').forEach(el => {
      const def = TOWERS[el.dataset.id];
      const cant = game.basis < def.cost;
      el.classList.toggle('cant-afford', cant);
    });
  }

  highlightShopItem(typeId) {
    this.elShopItems?.querySelectorAll('.shop-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.id === typeId);
    });
  }

  // ── TOWER DETAIL PANEL ───────────────────────────────
  showTowerDetail(tower, game) {
    const el = this.elTowerDetail;
    if (!el) return;
    el.classList.add('visible');

    const def   = tower.def;
    const lvl   = tower.level;
    const upCost = tower.upgradeCost();
    const canUp  = upCost !== null && game.basis >= upCost;
    const maxed  = upCost === null;

    const statRows = [];
    if (def.range > 0)    statRows.push(`<div class="td-stat"><span class="k">RANGE </span><span class="v">${tower.range.toFixed(1)}</span></div>`);
    if (def.damage > 0)   statRows.push(`<div class="td-stat"><span class="k">DAMAGE </span><span class="v">${tower.damage}</span></div>`);
    if (def.fireRate > 0) statRows.push(`<div class="td-stat"><span class="k">RATE </span><span class="v">${tower.fireRate.toFixed(1)}/s</span></div>`);
    if (tower.income > 0) statRows.push(`<div class="td-stat"><span class="k">INCOME </span><span class="v">${tower.income}/s</span></div>`);
    if (tower.healRate>0) statRows.push(`<div class="td-stat"><span class="k">HEAL </span><span class="v">${tower.healRate}/s</span></div>`);
    statRows.push(`<div class="td-stat"><span class="k">LEVEL </span><span class="v">${lvl + 1}/3</span></div>`);
    statRows.push(`<div class="td-stat"><span class="k">SELL </span><span class="v">${tower.sellVal} $B</span></div>`);

    const upLabel = maxed ? 'MAX LEVEL' : upCost ? `UPGRADE (${upCost} $B)` : '—';

    el.innerHTML = `
      <div class="td-name">${def.icon} ${def.name}</div>
      <div class="td-stats">${statRows.join('')}</div>
      ${!maxed && upCost ? `<div class="td-up-cost">Next: ${def.upgrades[lvl]?.desc || ''}</div>` : ''}
      <div class="td-btns">
        <button class="td-btn" id="td-upgrade" ${maxed || !canUp ? 'disabled' : ''}>${upLabel}</button>
        <button class="td-btn sell-btn" id="td-sell">SELL ${tower.sellVal}</button>
      </div>
    `;

    document.getElementById('td-upgrade')?.addEventListener('click', () => game.upgradeTower(tower));
    document.getElementById('td-sell')?.addEventListener('click',    () => game.sellTower(tower));
  }

  hideTowerDetail() {
    this.elTowerDetail?.classList.remove('visible');
  }

  // ── WAVE ANNOUNCEMENT ────────────────────────────────
  announceWave(waveNum, waveDef) {
    const el = this.elAnnounce;
    if (!el) return;

    // Build enemy list
    const types = [...new Set(waveDef.map(g => g.type))];
    const enemyList = types.map(t => {
      const e = ENEMIES[t];
      return `<span>${e.icon} ${e.name}</span>`;
    }).join('');

    if (this.elWNum) this.elWNum.textContent = waveNum;
    if (this.elWSub) this.elWSub.innerHTML = enemyList;

    el.classList.add('show');
    clearTimeout(this._announceTimer);
    this._announceTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  // ── END SCREENS ──────────────────────────────────────
  showGameOver(game) {
    const el = this.elGameover;
    if (!el) return;
    document.getElementById('go-waves').textContent  = game.wavesSurvived;
    document.getElementById('go-kills').textContent  = game.kills;
    document.getElementById('go-score').textContent  = game.score.toLocaleString();
    document.getElementById('go-earned').textContent = game.totalEarned.toLocaleString();
    el.classList.add('show');
  }

  showVictory(game) {
    const el = this.elVictory;
    if (!el) return;
    document.getElementById('vic-kills').textContent  = game.kills;
    document.getElementById('vic-score').textContent  = game.score.toLocaleString();
    document.getElementById('vic-earned').textContent = game.totalEarned.toLocaleString();
    document.getElementById('vic-tvl').textContent    = Math.ceil(game.tvl.val) + '%';
    el.classList.add('show');
  }

  // ── PAUSE ─────────────────────────────────────────────
  togglePause(game) {
    this.paused = !this.paused;
    game.setPaused(this.paused);
    if (this.paused) {
      this.elPause?.classList.add('show');
    } else {
      this.hidePause();
    }
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = this.paused ? '▶' : '⏸';
  }

  hidePause() {
    this.elPause?.classList.remove('show');
    this.paused = false;
    const btn = document.getElementById('btn-pause');
    if (btn) btn.textContent = '⏸';
  }

  // ── TOAST ─────────────────────────────────────────────
  toast(msg, type = 'info') {
    if (!this.elToasts) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    this.elToasts.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ── RESET ─────────────────────────────────────────────
  reset(game) {
    this.hideTowerDetail();
    this.hidePause();
    this.paused = false;
    this.elGameover?.classList.remove('show');
    this.elVictory?.classList.remove('show');
    this.elAnnounce?.classList.remove('show');
    this.highlightShopItem(null);
    // Reset speed buttons
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.speed-btn[data-speed="1"]')?.classList.add('active');
    this.update(game);
  }
}
