import {
  COLS, ROWS, CELL, PATH_WPS,
  TOWERS, TOWER_ORDER, ENEMIES, WAVES,
  START_BASIS, START_TVL
} from './config.js';

// ── UTILITIES ─────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rnd  = (lo, hi) => lo + Math.random() * (hi - lo);
const rndI = (lo, hi) => Math.floor(rnd(lo, hi + 1));

function hexA(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── PATH BUILDING ─────────────────────────────────────
// Convert waypoints → pixel path segments
function buildPath() {
  const pts = PATH_WPS.map(([c, r]) => ({
    x: (c + 0.5) * CELL,
    y: (r + 0.5) * CELL,
  }));
  // Mark all grid cells on path
  const pathSet = new Set();
  for (let i = 0; i < PATH_WPS.length - 1; i++) {
    const [c0, r0] = PATH_WPS[i];
    const [c1, r1] = PATH_WPS[i + 1];
    const dc = Math.sign(c1 - c0);
    const dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    while (c !== c1 || r !== r1) {
      pathSet.add(`${c},${r}`);
      c += dc; r += dr;
    }
    pathSet.add(`${c1},${r1}`);
  }
  return { pts, pathSet };
}

const { pts: PATH_PTS, pathSet: PATH_SET } = buildPath();

// ── PARTICLE SYSTEM ──────────────────────────────────
class Particle {
  constructor(x, y, color, vx, vy, life, size) {
    this.x = x; this.y = y;
    this.color = color;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 60 * dt; // gravity
    this.life -= dt;
    return this.life > 0;
  }
  draw(ctx) {
    const a = this.life / this.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

// ── PROJECTILE ───────────────────────────────────────
class Projectile {
  constructor(x, y, target, damage, speed, color, aoe, aoeR, slow, slowAmt) {
    this.x = x; this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed  = speed;
    this.color  = color;
    this.aoe    = aoe;
    this.aoeR   = aoeR * CELL;
    this.slow   = slow;
    this.slowAmt = slowAmt;
    this.dead   = false;
    this.size   = 5;
  }
  update(dt, enemies, particles, onHit) {
    if (this.dead) return;
    if (!this.target || this.target.dead) { this.dead = true; return; }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      this.dead = true;
      onHit(this, enemies, particles);
      return;
    }
    const spd = this.speed * dt;
    this.x += (dx / d) * spd;
    this.y += (dy / d) * spd;
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    // trail
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size + 2, 0, Math.PI * 2);
    ctx.strokeStyle = hexA(this.color, .3);
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ── ENEMY ────────────────────────────────────────────
let _eid = 0;
class Enemy {
  constructor(type) {
    const def = ENEMIES[type];
    this.id       = _eid++;
    this.type     = type;
    this.name     = def.name;
    this.hp       = def.hp;
    this.maxHp    = def.hp;
    this.speed    = def.speed;
    this.baseSpeed= def.speed;
    this.reward   = def.reward;
    this.tvlDmg   = def.tvlDmg;
    this.color    = def.color;
    this.size     = def.size;
    this.isBoss   = def.isBoss || false;
    this.special  = def.special || null;
    this.dead     = false;
    this.reached  = false;

    // Position — start just before entry
    this.x = -CELL;
    this.y = PATH_PTS[0].y;
    this.wpIdx = 0; // next waypoint index

    // Slow effect
    this.slowTimer = 0;
    this.slowFactor = 1;

    // Disable effect (from 51% attacker ally — future, for now enemy uses it)
    this.disableTimer = 0;

    // Flash hit effect
    this.flashTimer = 0;
  }

  update(dt) {
    if (this.dead) return;

    // Slow decay
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) this.slowFactor = 1;
    }
    if (this.flashTimer > 0) this.flashTimer -= dt;

    const spd = this.speed * this.slowFactor * dt;
    const target = PATH_PTS[this.wpIdx];
    if (!target) { this.reached = true; this.dead = true; return; }

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const d  = Math.hypot(dx, dy);
    if (d < spd + 1) {
      this.x = target.x;
      this.y = target.y;
      this.wpIdx++;
      if (this.wpIdx >= PATH_PTS.length) {
        this.reached = true;
        this.dead = true;
      }
    } else {
      this.x += (dx / d) * spd;
      this.y += (dy / d) * spd;
    }
  }

  takeDamage(dmg, slow, slowAmt, particles) {
    if (this.dead) return false;
    this.hp -= dmg;
    this.flashTimer = 0.12;

    // particles
    for (let i = 0; i < Math.min(4, Math.ceil(dmg / 20)); i++) {
      particles.push(new Particle(
        this.x + rnd(-6,6), this.y + rnd(-6,6),
        this.color,
        rnd(-60, 60), rnd(-80, -20),
        rnd(0.2, 0.5), rnd(2, 4)
      ));
    }

    if (slow) {
      this.slowFactor = 1 - slowAmt;
      this.slowTimer  = 1.5;
    }
    if (this.hp <= 0) {
      this.dead = true;
      // death burst — bosses get a bigger coloured ring + white flash ring
      const n = this.isBoss ? 32 : 12;
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * Math.PI * 2;
        particles.push(new Particle(
          this.x, this.y, this.color,
          Math.cos(angle) * rnd(this.isBoss ? 80 : 40, this.isBoss ? 220 : 120),
          Math.sin(angle) * rnd(this.isBoss ? 80 : 40, this.isBoss ? 220 : 120),
          rnd(this.isBoss ? 0.7 : 0.4, this.isBoss ? 1.4 : 0.9),
          rnd(this.isBoss ? 5 : 3, this.isBoss ? 11 : 6)
        ));
      }
      if (this.isBoss) {
        // white flash ring
        for (let i = 0; i < 20; i++) {
          const angle = (i / 20) * Math.PI * 2;
          particles.push(new Particle(
            this.x, this.y, '#ffffff',
            Math.cos(angle) * rnd(120, 300),
            Math.sin(angle) * rnd(120, 300),
            rnd(0.2, 0.5), rnd(3, 7)
          ));
        }
      }
      return true; // killed
    }
    return false;
  }

  // Progress along path (0=start, 1=end) — for targeting
  get progress() { return this.wpIdx + this._subProgress(); }
  _subProgress() {
    const wp = PATH_PTS[this.wpIdx];
    if (!wp) return 1;
    const prev = PATH_PTS[this.wpIdx - 1] || { x: -CELL, y: this.y };
    const total = dist(prev.x, prev.y, wp.x, wp.y);
    const done  = dist(prev.x, prev.y, this.x, this.y);
    return total > 0 ? done / total : 0;
  }

  draw(ctx) {
    if (this.dead) return;
    const { x, y, size, color, flashTimer } = this;

    // Shadow
    ctx.beginPath();
    ctx.ellipse(x, y + size + 2, size * .7, size * .3, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    const flash = flashTimer > 0;
    ctx.fillStyle = flash ? '#ffffff' : color;
    ctx.fill();
    ctx.strokeStyle = flash ? '#ffffff' : hexA(color, .6);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Boss ring
    if (this.isBoss) {
      ctx.beginPath();
      ctx.arc(x, y, size + 5, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(color, .35);
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // HP bar
    const bw = size * 2.4;
    const bh = 4;
    const bx = x - bw / 2;
    const by = y - size - 10;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(bx, by, bw, bh);
    const pct = this.hp / this.maxHp;
    const barColor = pct > .6 ? '#6dd97d' : pct > .3 ? '#e0a040' : '#e07070';
    ctx.fillStyle = barColor;
    ctx.fillRect(bx, by, bw * pct, bh);

    // Slow indicator
    if (this.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(x, y, size + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(79,195,247,.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// ── TOWER ─────────────────────────────────────────────
class Tower {
  constructor(type, col, row) {
    const def = TOWERS[type];
    this.type      = type;
    this.col       = col;
    this.row       = row;
    this.x         = (col + 0.5) * CELL;
    this.y         = (row + 0.5) * CELL;
    this.level     = 0;    // 0=base, 1=upg1, 2=upg2
    this.def       = def;
    this.selected  = false;
    this.disabled  = false;
    this.disTimer  = 0;

    // Income / heal — tick timer
    this.tickTimer = 0;

    // Fire cooldown
    this.fireCd    = 0;
    this.angle     = 0;   // current aim angle

    // Computed stats (recalculated on upgrade)
    this._calc();
  }

  _calc() {
    const def = this.def;
    const lvl = this.level;
    if (lvl === 0) {
      this.range     = def.range;
      this.damage    = def.damage;
      this.fireRate  = def.fireRate;
      this.projSpeed = def.projSpeed;
      this.aoeR      = def.aoeR || 0;
      this.income    = def.income || 0;
      this.healRate  = def.healRate || 0;
      this.sellVal   = def.sell;
    } else {
      const up = def.upgrades[lvl - 1];
      this.range     = up.range     ?? def.range;
      this.damage    = up.damage    ?? def.damage;
      this.fireRate  = up.fireRate  ?? def.fireRate;
      this.projSpeed = up.projSpeed ?? def.projSpeed;
      this.aoeR      = up.aoeR     ?? def.aoeR ?? 0;
      this.income    = up.income   ?? def.income ?? 0;
      this.healRate  = up.healRate ?? def.healRate ?? 0;
      this.sellVal   = up.sell;
    }
    this.rangePx = this.range * CELL;
    this.firePeriod = this.fireRate > 0 ? 1 / this.fireRate : Infinity;
  }

  upgrade() {
    if (this.level < 2) { this.level++; this._calc(); return true; }
    return false;
  }

  upgradeCost() {
    if (this.level >= 2) return null;
    return this.def.upgrades[this.level].cost;
  }

  update(dt, enemies, projectiles, tvlRef, onEarn) {
    if (this.disTimer > 0) {
      this.disTimer -= dt;
      this.disabled = this.disTimer > 0;
    }
    if (this.disabled) return;

    const special = this.def.special;

    // Income towers
    if (special === 'income') {
      this.tickTimer += dt;
      if (this.tickTimer >= 1) {
        this.tickTimer -= 1;
        onEarn(this.income);
      }
      return;
    }
    // Heal towers
    if (special === 'heal') {
      tvlRef.val = Math.min(100, tvlRef.val + this.healRate * dt);
      return;
    }

    // Attacking towers
    this.fireCd -= dt;

    if (this.fireCd <= 0) {
      const target = this._pickTarget(enemies);
      if (target) {
        this.angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.fireCd = this.firePeriod;

        if (special === 'aoe') {
          // AOE — damage all in aoeR around target
          const atkR = this.aoeR * CELL;
          enemies.forEach(e => {
            if (!e.dead && dist(e.x, e.y, target.x, target.y) <= atkR) {
              e.takeDamage(this.damage, false, 0, []);
            }
          });
          // AOE flash projectile (visual only, instant)
          projectiles.push(new Projectile(
            this.x, this.y, target,
            0, 999, this.def.color, true, this.aoeR, false, 0
          ));
        } else {
          const isSlower = special === 'slow';
          projectiles.push(new Projectile(
            this.x, this.y, target,
            this.damage, this.projSpeed,
            this.def.color,
            false, 0,
            isSlower, this.def.slowAmt || 0
          ));
        }
      }
    }
  }

  _pickTarget(enemies) {
    const inRange = enemies.filter(e =>
      !e.dead && dist(this.x, this.y, e.x, e.y) <= this.rangePx
    );
    if (!inRange.length) return null;

    const targeting = this.def.targeting;
    if (targeting === 'first') {
      return inRange.reduce((a, b) => b.progress > a.progress ? b : a);
    }
    if (targeting === 'fastest') {
      return inRange.reduce((a, b) => b.speed > a.speed ? b : a);
    }
    if (targeting === 'strongest') {
      return inRange.reduce((a, b) => b.hp > a.hp ? b : a);
    }
    if (targeting === 'most') {
      // pick enemy that has most others near it
      return inRange.reduce((best, e) => {
        const cnt = inRange.filter(o => dist(o.x, o.y, e.x, e.y) <= this.aoeR * CELL).length;
        const bCnt= inRange.filter(o => dist(o.x, o.y, best.x, best.y) <= this.aoeR * CELL).length;
        return cnt > bCnt ? e : best;
      });
    }
    return inRange[0];
  }

  draw(ctx, showRange) {
    const { x, y, def, level, disabled } = this;
    const half = CELL * 0.45;

    // Range ring (shown when selected or hovered)
    if (showRange) {
      ctx.beginPath();
      ctx.arc(x, y, this.rangePx, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(def.color, .25);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hexA(def.color, .05);
      ctx.fill();
    }

    // Base platform — brand dark
    ctx.fillStyle = '#0e1a0c';
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    ctx.strokeStyle = disabled ? 'rgba(120,177,90,.15)' : hexA(def.color, .55);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - half, y - half, half * 2, half * 2);

    // Corner accents
    const ac = 8;
    ctx.strokeStyle = disabled ? '#444' : def.color;
    ctx.lineWidth = 2;
    [[x-half,y-half],[x+half,y-half],[x-half,y+half],[x+half,y+half]].forEach(([cx,cy],i) => {
      const sx = i%2===0?1:-1, sy = i<2?1:-1;
      ctx.beginPath();
      ctx.moveTo(cx, cy); ctx.lineTo(cx+sx*ac, cy);
      ctx.moveTo(cx, cy); ctx.lineTo(cx, cy+sy*ac);
      ctx.stroke();
    });

    // Level pip dots
    for (let l = 0; l < level; l++) {
      ctx.beginPath();
      ctx.arc(x - 6 + l * 6, y + half - 8, 3, 0, Math.PI * 2);
      ctx.fillStyle = def.color;
      ctx.fill();
    }

    // Aim barrel (if attacking tower)
    if (def.range > 0 && def.targeting) {
      const blen = 18, bw = 4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.angle);
      ctx.fillStyle = disabled ? '#555' : def.color;
      ctx.fillRect(0, -bw/2, blen, bw);
      ctx.restore();
    }

    // Icon / center
    ctx.font = `${Math.floor(CELL * 0.38)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = disabled ? 0.4 : 1;
    ctx.fillText(def.icon, x, y);
    ctx.globalAlpha = 1;

    // Disabled X overlay
    if (disabled) {
      ctx.strokeStyle = '#e07070';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x-12, y-12); ctx.lineTo(x+12, y+12);
      ctx.moveTo(x+12, y-12); ctx.lineTo(x-12, y+12);
      ctx.stroke();
    }

    // Selected highlight — brand green
    if (this.selected) {
      ctx.strokeStyle = 'rgba(120,177,90,.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4,3]);
      ctx.strokeRect(x-half-2, y-half-2, half*2+4, half*2+4);
      ctx.setLineDash([]);
    }
  }
}

// ── WAVE SPAWNER ──────────────────────────────────────
class WaveSpawner {
  constructor(waveDef) {
    this.groups = waveDef.map(g => ({
      ...g,
      delay:     g.delay || 0,
      spawned:   0,
      timer:     0,
      delayLeft: g.delay || 0,
    }));
    this.done = false;
  }

  update(dt) {
    if (this.done) return [];
    const out = [];
    let allDone = true;
    for (const g of this.groups) {
      if (g.spawned >= g.count) continue;
      allDone = false;
      if (g.delayLeft > 0) { g.delayLeft -= dt; continue; }
      g.timer -= dt;
      if (g.timer <= 0) {
        out.push(new Enemy(g.type));
        g.spawned++;
        g.timer = g.interval;
      }
    }
    if (allDone) this.done = true;
    return out;
  }
}

// ── MAIN GAME CLASS ───────────────────────────────────
export class Game {
  constructor(canvas, ui) {
    this.canvas  = canvas;
    this.ctx     = canvas.getContext('2d');
    this.ui      = ui;

    // Game state
    this.state   = 'idle'; // idle | wave | wavebreak | gameover | victory
    this.waveIdx = 0;      // next wave to run (0-based)
    this.basis   = START_BASIS;
    this.tvl     = { val: START_TVL };
    this.score   = 0;
    this.kills   = 0;
    this.income  = 0;      // passive income/sec (shown in UI)

    // Objects
    this.towers      = [];
    this.enemies     = [];
    this.projectiles = [];
    this.particles   = [];

    // Wave spawner
    this.spawner     = null;
    this.waveCleanup = 0; // countdown after all spawned before next break

    // Input
    this.selectedTower = null;   // tower type string being placed
    this.selectedCell  = null;   // placed tower being inspected
    this.hoverCol      = -1;
    this.hoverRow      = -1;

    // Timing
    this.lastTime = 0;
    this.speed    = 1;   // 1x or 2x
    this.paused   = false;
    this.rafId    = null;

    // Stats for end screen
    this.totalEarned = START_BASIS;
    this.wavesSurvived = 0;

    // Bind loop
    this._loop = this._loop.bind(this);

    // Init canvas size
    this._resize();
    this._bindInput();
  }

  _resize() {
    this.canvas.width  = COLS * CELL;
    this.canvas.height = ROWS * CELL;
  }

  // ── INPUT ──────────────────────────────────────────
  _bindInput() {
    const c = this.canvas;
    c.addEventListener('mousemove', e => this._onMove(e));
    c.addEventListener('click',     e => this._onClick(e));
    // Right-click anywhere on the game screen (canvas OR sidebar) deselects
    document.getElementById('screen-game')?.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._deselect();
    });
  }

  _getCell(e) {
    const r = this.canvas.getBoundingClientRect();
    // Canvas may be CSS-scaled; map client coords back to canvas pixel space
    const scaleX = this.canvas.width  / r.width;
    const scaleY = this.canvas.height / r.height;
    const col = Math.floor((e.clientX - r.left) * scaleX / CELL);
    const row = Math.floor((e.clientY - r.top)  * scaleY / CELL);
    return { col, row };
  }

  _onMove(e) {
    const { col, row } = this._getCell(e);
    this.hoverCol = col; this.hoverRow = row;
  }

  _onClick(e) {
    const { col, row } = this._getCell(e);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    // Check if clicking on existing tower
    const existing = this.towers.find(t => t.col === col && t.row === row);
    if (existing) {
      this._inspectTower(existing);
      return;
    }

    // Place tower if one is selected
    if (this.selectedTower) {
      this._placeTower(this.selectedTower, col, row);
      return;
    }
  }

  _inspectTower(tower) {
    this.towers.forEach(t => t.selected = false);
    tower.selected = true;
    this.selectedCell  = tower;
    this.selectedTower = null;
    this.ui.showTowerDetail(tower, this);
  }

  _deselect() {
    this.selectedTower = null;
    this.selectedCell  = null;
    this.towers.forEach(t => t.selected = false);
    this.ui.hideTowerDetail();
  }

  _placeTower(type, col, row) {
    // Can't place on path
    if (PATH_SET.has(`${col},${row}`)) {
      this.ui.toast('Cannot build on path', 'bad'); return;
    }
    // Can't place on existing tower
    if (this.towers.some(t => t.col === col && t.row === row)) {
      this.ui.toast('Cell occupied', 'bad'); return;
    }
    const def = TOWERS[type];
    if (this.basis < def.cost) {
      this.ui.toast('Insufficient $BASIS', 'bad'); return;
    }
    this.basis -= def.cost;
    const tower = new Tower(type, col, row);
    this.towers.push(tower);
    this.ui.toast(`${def.name} deployed`, 'good');
    this._deselect();
    this.ui.update(this);
  }

  sellTower(tower) {
    this.basis += tower.sellVal;
    this.towers = this.towers.filter(t => t !== tower);
    this.ui.toast(`Sold for ${tower.sellVal} $BASIS`, 'gold');
    this._deselect();
    this.ui.update(this);
  }

  upgradeTower(tower) {
    const cost = tower.upgradeCost();
    if (cost === null) { this.ui.toast('Max level reached', 'info'); return; }
    if (this.basis < cost) { this.ui.toast('Insufficient $BASIS', 'bad'); return; }
    this.basis -= cost;
    tower.upgrade();
    this.ui.toast(`Upgraded to Lv${tower.level + 1}`, 'good');
    this.ui.showTowerDetail(tower, this);
    this.ui.update(this);
  }

  // ── WAVE CONTROL ───────────────────────────────────
  startWave() {
    if (this.state !== 'idle') return;
    if (this.waveIdx >= WAVES.length) return;

    this.state   = 'wave';
    this.spawner = new WaveSpawner(WAVES[this.waveIdx]);
    this.waveCleanup = -1; // not counting yet
    this._deselect();

    this.ui.announceWave(this.waveIdx + 1, WAVES[this.waveIdx]);
    this.ui.update(this);
  }

  // ── MAIN LOOP ───────────────────────────────────────
  start() {
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  _loop(now) {
    this.rafId = requestAnimationFrame(this._loop);
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    dt = Math.min(dt, 0.05); // cap at 50ms

    if (!this.paused) {
      const sdt = dt * this.speed;
      this._update(sdt);
    }
    this._render();
    this.ui.update(this);
  }

  _update(dt) {
    // Spawn enemies
    if (this.state === 'wave' && this.spawner) {
      const newEnemies = this.spawner.update(dt);
      this.enemies.push(...newEnemies);

      // After spawner done, wait for all enemies to be gone
      if (this.spawner.done) {
        if (this.waveCleanup < 0) this.waveCleanup = 0;
        if (this.enemies.every(e => e.dead)) {
          this._endWave();
        }
      }
    }

    // Update enemies
    this.enemies.forEach(e => e.update(dt));

    // Check if enemy reached end
    this.enemies.forEach(e => {
      if (e.reached) {
        this.tvl.val = Math.max(0, this.tvl.val - e.tvlDmg);
        e.dead = true;
        this.ui.shake();
        if (this.tvl.val <= 0) this._gameOver();
      }
    });

    // Update towers
    const tvlRef = this.tvl;
    let incomeSum = 0;
    this.towers.forEach(t => {
      t.update(dt, this.enemies, this.projectiles, tvlRef, (amt) => {
        this.basis += amt;
        this.totalEarned += amt;
        incomeSum += amt;
      });
      if (t.def.special === 'income') incomeSum = t.income;
    });
    // Compute total income/sec for UI
    this.income = this.towers
      .filter(t => t.def.special === 'income')
      .reduce((s, t) => s + t.income, 0);

    // Update projectiles
    this.projectiles.forEach(p => {
      p.update(dt, this.enemies, this.particles, (proj, enemies, particles) => {
        if (!proj.aoe) {
          // Single target
          if (!proj.target.dead) {
            const killed = proj.target.takeDamage(proj.damage, proj.slow, proj.slowAmt, particles);
            if (killed) {
              this.basis += proj.target.reward;
              this.totalEarned += proj.target.reward;
              this.score += proj.target.reward * 10;
              this.kills++;
            }
          }
        }
        // AOE visual — damage already applied in tower.update
      });
    });

    // 51% attacker disables nearby towers
    this.enemies.filter(e => e.type === 'fifty_one' && !e.dead).forEach(e => {
      this.towers.forEach(t => {
        if (dist(t.x, t.y, e.x, e.y) < CELL * 2) {
          t.disabled = true;
          t.disTimer = 1.5;
        }
      });
    });

    // Cleanup
    this.enemies     = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(p => !p.dead);
    this.particles   = this.particles.filter(p => p.update(dt));
  }

  _endWave() {
    this.waveIdx++;
    this.wavesSurvived = this.waveIdx;
    this.state = 'idle';
    this.spawner = null;

    // Bonus $BASIS between waves
    const bonus = 30 + this.waveIdx * 10;
    this.basis += bonus;
    this.totalEarned += bonus;
    this.ui.toast(`Wave ${this.waveIdx} survived! +${bonus} $BASIS`, 'gold');

    if (this.waveIdx >= WAVES.length) {
      this._victory();
    }
    this.ui.update(this);
  }

  _gameOver() {
    if (this.state === 'gameover') return;
    this.state = 'gameover';
    this.ui.showGameOver(this);
  }

  _victory() {
    if (this.state === 'victory') return;
    this.state = 'victory';
    this.ui.showVictory(this);
  }

  // ── RENDER ─────────────────────────────────────────
  _render() {
    const { ctx } = this;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Background grid
    this._drawGrid(ctx, W, H);

    // Path
    this._drawPath(ctx);

    // Tower range of hovered/selected tower
    const hoverTower = this.towers.find(t =>
      t.col === this.hoverCol && t.row === this.hoverRow
    );

    // Towers
    this.towers.forEach(t => {
      const showRange = t.selected || (hoverTower === t);
      t.draw(ctx, showRange);
    });

    // Preview placement
    if (this.selectedTower && this.hoverCol >= 0) {
      this._drawPreview(ctx);
    }

    // Particles (below enemies)
    this.particles.forEach(p => p.draw(ctx));

    // AOE rings (visual)
    this.projectiles.filter(p => p.aoe).forEach(p => {
      ctx.beginPath();
      ctx.arc(p.target.x, p.target.y, p.aoeR, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(p.color, .6);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = hexA(p.color, .1);
      ctx.fill();
    });

    // Projectiles
    this.projectiles.filter(p => !p.aoe).forEach(p => p.draw(ctx));

    // Enemies
    this.enemies.forEach(e => e.draw(ctx));

    // Entry / exit arrows
    this._drawEntryExit(ctx);

    // Scanlines
    ctx.fillStyle = 'rgba(0,0,0,.03)';
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);
  }

  _drawGrid(ctx, W, H) {
    // Base bg — brand dark green-black
    ctx.fillStyle = '#080c06';
    ctx.fillRect(0, 0, W, H);

    // Grid lines — brand green tinted
    ctx.strokeStyle = 'rgba(120,177,90,.07)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL);
      ctx.stroke();
    }

    // Buildable cells
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (!PATH_SET.has(`${c},${r}`)) {
          const hasTower = this.towers.some(t => t.col === c && t.row === r);
          if (!hasTower) {
            ctx.fillStyle = 'rgba(120,177,90,.025)';
            ctx.fillRect(c*CELL+1, r*CELL+1, CELL-2, CELL-2);
          }
        }
      }
    }
  }

  _drawPath(ctx) {
    // Path outer gutter — very dark green
    ctx.strokeStyle = '#0a1208';
    ctx.lineWidth = CELL - 2;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    PATH_PTS.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Path fill — slightly lighter green-dark
    ctx.strokeStyle = '#0f1a0c';
    ctx.lineWidth = CELL - 6;
    ctx.beginPath();
    PATH_PTS.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Path border glow — brand green dashed
    ctx.strokeStyle = 'rgba(120,177,90,.12)';
    ctx.lineWidth = CELL - 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    PATH_PTS.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dashed line — brand green subtle
    ctx.strokeStyle = 'rgba(120,177,90,.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    PATH_PTS.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint nodes — brand green dots
    PATH_PTS.forEach((pt, i) => {
      if (i === 0 || i === PATH_PTS.length - 1) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,177,90,.3)';
      ctx.fill();
    });
  }

  _drawEntryExit(ctx) {
    // Entry arrow — brand green
    const ent = PATH_PTS[0];
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(120,177,90,.5)';
    ctx.fillText('▶▶', ent.x - CELL * .75, ent.y);

    // CORE indicator
    const ex = PATH_PTS[PATH_PTS.length - 1];
    const cx = ex.x + CELL * .62;
    const cy = ex.y;

    // Pulsing core circle
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(224,112,112,.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(224,112,112,.12)';
    ctx.fill();

    ctx.font = '600 8px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#e07070';
    ctx.fillText('CORE', cx, cy + 22);
  }

  _drawPreview(ctx) {
    const { hoverCol: col, hoverRow: row, selectedTower } = this;
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
    const onPath = PATH_SET.has(`${col},${row}`);
    const occupied = this.towers.some(t => t.col === col && t.row === row);
    const can = !onPath && !occupied && this.basis >= TOWERS[selectedTower].cost;

    const px = col * CELL; const py = row * CELL;

    // Brand green or red preview
    ctx.fillStyle = can ? 'rgba(120,177,90,.12)' : 'rgba(224,112,112,.10)';
    ctx.fillRect(px, py, CELL, CELL);
    ctx.strokeStyle = can ? 'rgba(120,177,90,.55)' : 'rgba(224,112,112,.45)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(px+1, py+1, CELL-2, CELL-2);

    // Range preview
    if (can) {
      const def = TOWERS[selectedTower];
      const rng = def.range * CELL;
      ctx.beginPath();
      ctx.arc(px + CELL/2, py + CELL/2, rng, 0, Math.PI * 2);
      ctx.strokeStyle = hexA(def.color, .3);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hexA(def.color, .05);
      ctx.fill();
    }
  }

  // ── PUBLIC ─────────────────────────────────────────
  setSelectedTower(type) {
    if (this.selectedTower === type) {
      this.selectedTower = null;
    } else {
      this.selectedTower = type;
      this._deselect();
      this.selectedTower = type; // _deselect clears it, restore
    }
    this.ui.highlightShopItem(this.selectedTower);
  }

  setSpeed(s) {
    this.speed = s;
  }

  setPaused(p) {
    this.paused = p;
  }

  reset() {
    this.stop();
    this.state       = 'idle';
    this.waveIdx     = 0;
    this.basis       = START_BASIS;
    this.tvl         = { val: START_TVL };
    this.score       = 0;
    this.kills       = 0;
    this.income      = 0;
    this.towers      = [];
    this.enemies     = [];
    this.projectiles = [];
    this.particles   = [];
    this.spawner     = null;
    this.selectedTower = null;
    this.selectedCell  = null;
    this.totalEarned = START_BASIS;
    this.wavesSurvived = 0;
    this.paused = false;
    this.speed  = 1;
    this.start();
    this.ui.reset(this);
  }
}
