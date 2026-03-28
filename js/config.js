// ── MAP DEFINITION ───────────────────────────────────
// Grid: 14 cols × 10 rows, 60px cells → canvas 840×600
export const COLS = 14;
export const ROWS = 10;
export const CELL = 60;

// Path waypoints [col, row] — entry from left, exit to CORE at col 14
export const PATH_WPS = [
  [0,  4],
  [3,  4],
  [3,  1],
  [8,  1],
  [8,  7],
  [11, 7],
  [11, 2],
  [13, 2],
  [14, 2],   // CORE cell — enemies reach here and deal TVL damage
];

// ── TOWER DEFINITIONS ────────────────────────────────
export const TOWERS = {
  auditor: {
    id: 'auditor', name: 'Auditor', icon: '🔍',
    desc: 'Slows & damages hackers',
    cost: 60,
    sell: 30,
    range: 2.2,
    damage: 18,
    fireRate: 1.1,   // shots/sec
    projSpeed: 280,
    color: '#4fc3f7',
    special: 'slow',   // slows target 35%
    slowAmt: 0.35,
    targeting: 'first',
    upgrades: [
      { cost: 80,  damage: 32,  range: 2.6, fireRate: 1.3, sell: 70,  desc: 'Deep audit' },
      { cost: 130, damage: 55,  range: 3.0, fireRate: 1.6, sell: 135, desc: 'Zero-trust audit' },
    ],
  },
  firewall: {
    id: 'firewall', name: 'Firewall', icon: '🔥',
    desc: 'Fast rate. Destroys MEV bots',
    cost: 80,
    sell: 40,
    range: 1.8,
    damage: 12,
    fireRate: 3.2,
    projSpeed: 480,
    color: '#ff7043',
    special: null,
    targeting: 'fastest',
    upgrades: [
      { cost: 100, damage: 22,  range: 2.0, fireRate: 4.0, sell: 90,  desc: 'Deep-packet filter' },
      { cost: 160, damage: 38,  range: 2.2, fireRate: 5.5, sell: 175, desc: 'Zero-day firewall' },
    ],
  },
  multisig: {
    id: 'multisig', name: 'Multisig', icon: '🔐',
    desc: 'AOE burst. Hits all nearby enemies',
    cost: 110,
    sell: 55,
    range: 2.4,
    damage: 10,
    fireRate: 0.55,
    projSpeed: 0,    // instant AOE
    color: '#ab47bc',
    special: 'aoe',
    aoeR: 1.6,
    targeting: 'most',
    upgrades: [
      { cost: 130, damage: 20, range: 2.8, aoeR: 2.0, fireRate: 0.7, sell: 120, desc: '3-of-5 multisig' },
      { cost: 200, damage: 35, range: 3.0, aoeR: 2.5, fireRate: 0.9, sell: 225, desc: 'DAO governance' },
    ],
  },
  validator: {
    id: 'validator', name: 'Validator', icon: '⚡',
    desc: 'Long-range sniper. High single damage',
    cost: 150,
    sell: 75,
    range: 4.0,
    damage: 60,
    fireRate: 0.48,
    projSpeed: 650,
    color: '#66bb6a',
    special: null,
    targeting: 'strongest',
    upgrades: [
      { cost: 180, damage: 100, range: 5.0, fireRate: 0.55, sell: 165, desc: 'Supervalidator' },
      { cost: 260, damage: 165, range: 6.0, fireRate: 0.65, sell: 310, desc: 'Network consensus' },
    ],
  },
  lp_pool: {
    id: 'lp_pool', name: 'LP Pool', icon: '💧',
    desc: 'No attack. Earns +9 $BASIS/sec',
    cost: 90,
    sell: 45,
    range: 0,
    damage: 0,
    fireRate: 0,
    projSpeed: 0,
    color: '#ffd54f',
    special: 'income',
    income: 9,
    targeting: null,
    upgrades: [
      { cost: 110, income: 18, sell: 100, desc: 'Deep liquidity' },
      { cost: 160, income: 30, sell: 200, desc: 'Protocol-owned LP' },
    ],
  },
  insurance: {
    id: 'insurance', name: 'Insurance', icon: '🛡️',
    desc: 'Regenerates Protocol TVL slowly',
    cost: 120,
    sell: 60,
    range: 0,
    damage: 0,
    fireRate: 0,
    projSpeed: 0,
    color: '#26c6da',
    special: 'heal',
    healRate: 0.6,   // TVL %/sec
    targeting: null,
    upgrades: [
      { cost: 140, healRate: 1.2, sell: 130, desc: 'Full coverage' },
      { cost: 210, healRate: 2.2, sell: 250, desc: 'Nexus Mutual tier' },
    ],
  },
};

export const TOWER_ORDER = ['auditor','firewall','multisig','validator','lp_pool','insurance'];

// ── ENEMY DEFINITIONS ────────────────────────────────
export const ENEMIES = {
  script_kiddie: {
    id: 'script_kiddie', name: 'Script Kiddie', icon: '👾',
    hp: 70, speed: 75, reward: 10,
    tvlDmg: 4, color: '#aed581', size: 13,
    isBoss: false,
  },
  rug_puller: {
    id: 'rug_puller', name: 'Rug Puller', icon: '🪤',
    hp: 160, speed: 100, reward: 22,
    tvlDmg: 14, color: '#ef5350', size: 16,
    isBoss: false,
  },
  mev_bot: {
    id: 'mev_bot', name: 'MEV Bot', icon: '🤖',
    hp: 45, speed: 230, reward: 18,
    tvlDmg: 7, color: '#ffa726', size: 12,
    isBoss: false,
  },
  flash_loan: {
    id: 'flash_loan', name: 'Flash Loan', icon: '💥',
    hp: 350, speed: 65, reward: 42,
    tvlDmg: 20, color: '#7e57c2', size: 20,
    isBoss: false,
  },
  whale: {
    id: 'whale', name: 'Whale Dumper', icon: '🐋',
    hp: 900, speed: 42, reward: 85,
    tvlDmg: 35, color: '#26c6da', size: 28,
    isBoss: true,
  },
  fifty_one: {
    id: 'fifty_one', name: '51% Attacker', icon: '💀',
    hp: 2200, speed: 32, reward: 220,
    tvlDmg: 100, color: '#f44336', size: 36,
    isBoss: true,
    special: 'disable', // disables towers it passes through
  },
};

// ── WAVE DEFINITIONS ─────────────────────────────────
// Each wave: array of spawn groups { type, count, interval, delay? }
export const WAVES = [
  // 1 — Tutorial
  [{ type:'script_kiddie', count:6,  interval:1.5 }],
  // 2
  [{ type:'script_kiddie', count:10, interval:1.1 }],
  // 3 — Rug pullers arrive
  [{ type:'script_kiddie', count:6,  interval:1.2 },
   { type:'rug_puller',    count:3,  interval:3.0, delay:6 }],
  // 4
  [{ type:'rug_puller',    count:6,  interval:2.0 }],
  // 5 — MEV bots
  [{ type:'script_kiddie', count:12, interval:0.7 },
   { type:'mev_bot',       count:4,  interval:0.8, delay:8 }],
  // 6
  [{ type:'mev_bot',       count:10, interval:0.6 },
   { type:'rug_puller',    count:4,  interval:2.0, delay:5 }],
  // 7 — First whale
  [{ type:'script_kiddie', count:8,  interval:1.0 },
   { type:'whale',         count:1,  interval:1,   delay:10 }],
  // 8 — Flash loans
  [{ type:'flash_loan',    count:4,  interval:3.5 },
   { type:'mev_bot',       count:8,  interval:0.5, delay:4 }],
  // 9
  [{ type:'rug_puller',    count:8,  interval:1.2 },
   { type:'flash_loan',    count:4,  interval:4.0, delay:6 }],
  // 10 — Whale pack
  [{ type:'mev_bot',       count:12, interval:0.45},
   { type:'whale',         count:2,  interval:8.0, delay:8 }],
  // 11
  [{ type:'flash_loan',    count:6,  interval:2.5 },
   { type:'rug_puller',    count:6,  interval:1.5, delay:5 }],
  // 12 — Swarm
  [{ type:'script_kiddie', count:18, interval:0.35},
   { type:'mev_bot',       count:10, interval:0.5, delay:4 },
   { type:'rug_puller',    count:5,  interval:1.5, delay:8 }],
  // 13 — Whale bosses
  [{ type:'whale',         count:3,  interval:7.0 },
   { type:'flash_loan',    count:6,  interval:2.5, delay:6 }],
  // 14 — Pre-final
  [{ type:'mev_bot',       count:14, interval:0.4 },
   { type:'rug_puller',    count:7,  interval:1.0, delay:5 },
   { type:'fifty_one',     count:1,  interval:1,   delay:18 }],
  // 15 — FINAL BOSS
  [{ type:'script_kiddie', count:12, interval:0.4 },
   { type:'mev_bot',       count:12, interval:0.4, delay:3 },
   { type:'rug_puller',    count:8,  interval:0.6, delay:6 },
   { type:'flash_loan',    count:5,  interval:3.0, delay:9 },
   { type:'fifty_one',     count:1,  interval:1,   delay:22 }],
];

// Starting economy
export const START_BASIS  = 200;
export const START_TVL    = 100;  // %
