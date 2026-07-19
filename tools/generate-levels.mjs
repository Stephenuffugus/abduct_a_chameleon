// ABDUCTEE — themed level generator
// Produces large open SCANNER-format maps for camouflage hide-and-seek.
// Run:  node tools/generate-levels.mjs      (writes maps/*.json + maps/levels.json)
//
// Each theme picks a base terrain, stamps organic terrain patches to camouflage
// against, scatters theme-appropriate cover, and distributes seeker/hider spawns.
// Newer "crafted" themes additionally run a design() pass with hand-authored
// primitives (rivers, bridges, courtyards, seam strips, cover clusters, mosaics)
// on a SEPARATE rng stream, so the original six themes stay byte-identical.
//
// Terrain keys must match the TERRAIN table in the game (index.html):
//   void grass dirt water rock concrete foliage metal sand snow ice mud moss lava ash crystal
// Cover types must match addCover() in the game:
//   tree boulder crate barrel wall cactus dead_tree ice_spike alien_pod

import { writeFileSync, mkdirSync } from 'fs';

function rngFactory(seed){ let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function makeMap(cfg){
  const { name, biome, cols, rows, base, patches = [], cover = [], buildings = 0, hazards = [], seed = 1 } = cfg;
  const rnd = rngFactory(seed);
  // design-only rng stream: crafted features + spread spawns draw from here so they
  // can never shift the byte-stable output of the legacy themes.
  const drng = rngFactory((Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) || 1);
  const t = Array.from({ length: rows }, () => Array.from({ length: cols }, () => base));
  const inb = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const blob = (cx, cy, r, key) => {
    for (let y = cy - r - 1; y <= cy + r + 1; y++)
      for (let x = cx - r - 1; x <= cx + r + 1; x++) {
        const d = Math.hypot(x - cx, y - cy) + (rnd() * 1.6 - 0.8);
        if (d <= r && inb(x, y)) t[y][x] = key;
      }
  };

  // organic terrain patches
  for (const p of patches) {
    for (let i = 0; i < (p.count || 1); i++) {
      const cx = 3 + Math.floor(rnd() * (cols - 6));
      const cy = 3 + Math.floor(rnd() * (rows - 6));
      const r = (p.minR || 3) + Math.floor(rnd() * ((p.maxR || 5) - (p.minR || 3) + 1));
      blob(cx, cy, r, p.key);
    }
  }

  const objs = [], seen = new Set();
  // clearCells: lanes/plazas/bridges reserved by design() — cover may not land there,
  // guaranteeing open patrol space (openness>=2 pools) and clean chokepoints.
  const clearCells = new Set();
  const put = (x, y, type) => {
    const k = x + ',' + y;
    if (clearCells.has(k)) return false;
    if (inb(x, y) && !seen.has(k)) { seen.add(k); objs.push({ x, y, type }); return true; }
    return false;
  };

  // buildings: rectangular wall rings with one doorway (city theme)
  for (let b = 0; b < buildings; b++) {
    const bw = 4 + Math.floor(rnd() * 5), bh = 4 + Math.floor(rnd() * 5);
    const x0 = 2 + Math.floor(rnd() * Math.max(1, cols - bw - 4));
    const y0 = 2 + Math.floor(rnd() * Math.max(1, rows - bh - 4));
    const door = Math.floor(rnd() * 4), mx = x0 + (bw >> 1), my = y0 + (bh >> 1);
    for (let x = x0; x <= x0 + bw; x++) { if (!(door === 0 && x === mx)) put(x, y0, 'wall'); if (!(door === 1 && x === mx)) put(x, y0 + bh, 'wall'); }
    for (let y = y0; y <= y0 + bh; y++) { if (!(door === 2 && y === my)) put(x0, y, 'wall'); if (!(door === 3 && y === my)) put(x0 + bw, y, 'wall'); }
  }

  /* ---------- crafted-feel design primitives (design() themes only) ---------- */
  const paint = (x, y, key) => { if (inb(x, y)) t[y][x] = key; };
  const fillRect = (x0, y0, w, h, key) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) paint(x, y, key); };
  const clearDisc = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if (Math.hypot(x - cx, y - cy) <= r) clearCells.add(x + ',' + y);
  };
  // carvePath: rivers / roads / trails along a jittered polyline.
  //   opts.bank {key,extra}: paints a wider band first — river banks, road shoulders
  //   (a 1-tile bank against the core terrain is a deliberate 2-tone seam strip).
  //   opts.clear: reserves the lane for patrols (no cover will spawn on it).
  const carvePath = (points, width, key, opts = {}) => {
    const { bank = null, jitter = 0, clear = false } = opts;
    const samples = [];
    for (let i = 0; i < points.length - 1; i++) {
      const [ax, ay] = points[i], [bx, by] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2));
      for (let s = 0; s <= steps; s++) {
        let px = ax + (bx - ax) * s / steps, py = ay + (by - ay) * s / steps;
        if (jitter) { px += (drng() * 2 - 1) * jitter; py += (drng() * 2 - 1) * jitter; }
        samples.push([px, py]);
      }
    }
    const stamp = (r, k) => {
      for (const [px, py] of samples)
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
          for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++)
            if (Math.hypot(x - px, y - py) <= r) paint(x, y, k);
    };
    if (bank) stamp(width / 2 + (bank.extra || 1), bank.key);
    stamp(width / 2, key);
    if (clear) for (const [px, py] of samples) clearDisc(px, py, width / 2 + 1);
  };
  // seamStrip: a deliberate 1-2 tile strip of terrain b edged by a — the Split Camo playground.
  const seamStrip = (x0, y0, x1, y1, a, b, w = 1) => {
    carvePath([[x0, y0], [x1, y1]], w + 2, a);
    carvePath([[x0, y0], [x1, y1]], w, b);
  };
  // checkerboard / stripes: 2-tone mosaic plots (every cell border is a seam).
  const checkerboard = (x0, y0, w, h, keys, cell = 2) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      paint(x0 + x, y0 + y, keys[(Math.floor(x / cell) + Math.floor(y / cell)) % keys.length]);
  };
  const stripes = (x0, y0, w, h, dir, keys, band = 2) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
      paint(x0 + x, y0 + y, keys[Math.floor((dir === 'h' ? y : x) / band) % keys.length]);
  };
  // clearing: clean-ish terrain disc; opts.clear reserves it as a patrol plaza.
  const clearing = (cx, cy, r, key, opts = {}) => {
    const { noise = 0.8, clear = false } = opts;
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.hypot(x - cx, y - cy) + (noise ? (drng() * 2 - 1) * noise : 0);
        if (d <= r) paint(x, y, key);
      }
    if (clear) clearDisc(cx, cy, r + 1);
  };
  // courtyard: wall ring + doorway(s) + interior floor + interior cover.
  // Interior cover starts 2 cells in, so a ring corridor always stays walkable.
  const courtyard = (x0, y0, w, h, opts = {}) => {
    const { floor = 'concrete', doors = ['s'], doorW = 2, inner = null, innerDensity = 0, mossy = null } = opts;
    fillRect(x0, y0, w + 1, h + 1, floor);
    const mx = x0 + (w >> 1), my = y0 + (h >> 1);
    const gaps = new Set();
    const addGap = (x, y) => { gaps.add(x + ',' + y); clearCells.add(x + ',' + y); };
    for (const d of doors) for (let o = 0; o < doorW; o++) {
      if (d === 'n') addGap(mx - (doorW >> 1) + o, y0);
      if (d === 's') addGap(mx - (doorW >> 1) + o, y0 + h);
      if (d === 'w') addGap(x0, my - (doorW >> 1) + o);
      if (d === 'e') addGap(x0 + w, my - (doorW >> 1) + o);
    }
    for (let x = x0; x <= x0 + w; x++) { if (!gaps.has(x + ',' + y0)) put(x, y0, 'wall'); if (!gaps.has(x + ',' + (y0 + h))) put(x, y0 + h, 'wall'); }
    for (let y = y0; y <= y0 + h; y++) { if (!gaps.has(x0 + ',' + y)) put(x0, y, 'wall'); if (!gaps.has((x0 + w) + ',' + y)) put(x0 + w, y, 'wall'); }
    if (inner && innerDensity > 0)
      for (let y = y0 + 2; y <= y0 + h - 2; y++)
        for (let x = x0 + 2; x <= x0 + w - 2; x++)
          if (drng() < innerDensity) put(x, y, inner);
    if (mossy) { // overgrowth creeping across the floor — interior 2-tone seams
      if (drng() < 0.5) { const yy = y0 + 2 + Math.floor(drng() * Math.max(1, h - 3)); seamStrip(x0 + 2, yy, x0 + w - 2, yy, floor, mossy, 1); }
      else { const xx = x0 + 2 + Math.floor(drng() * Math.max(1, w - 3)); seamStrip(xx, y0 + 2, xx, y0 + h - 2, floor, mossy, 1); }
    }
  };
  // coverCluster: a loose pocket of cover — overlapping LoS shadows with slip gaps.
  const coverCluster = (cx, cy, type, n, spread = 3) => {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 6) {
      tries++;
      const a = drng() * Math.PI * 2, r = 0.6 + drng() * spread;
      if (put(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), type)) placed++;
    }
  };
  // coverRow: a line of cover with a gap every `gapEvery` — crate rows, hedgerows.
  const coverRow = (x0, y0, dx, dy, count, type, gapEvery = 0) => {
    for (let i = 0; i < count; i++) {
      if (gapEvery && (i % gapEvery) === gapEvery - 1) continue;
      put(Math.round(x0 + dx * i), Math.round(y0 + dy * i), type);
    }
  };
  // bridge: a hard strip crossing water/lava. opts.clear (default true) keeps it cover-free.
  const bridge = (x, y, dir, len, width = 2, key = 'concrete', opts = {}) => {
    const { clear = true } = opts;
    const w = dir === 'h' ? len : width, h = dir === 'h' ? width : len;
    fillRect(x, y, w, h, key);
    if (clear) for (let yy = y - 1; yy < y + h + 1; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) clearCells.add(xx + ',' + yy);
  };

  if (cfg.design) cfg.design({
    paint, fillRect, carvePath, seamStrip, checkerboard, stripes, clearing,
    courtyard, coverCluster, coverRow, bridge, clearDisc, put, drng, cols, rows,
  });

  // scatter cover by rule ({ type, on:[terrainKeys], density })
  for (const rule of cover) {
    const on = rule.on ? new Set(rule.on) : null;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (on && !on.has(t[y][x])) continue;
        if (rnd() < rule.density) put(x, y, rule.type);
      }
  }

  // spawns — never on hazards; hiders scattered, seekers pushed to the corners
  const hz = new Set(['water', 'lava', 'void', ...hazards]);
  const open = [];
  for (let y = 1; y < rows - 1; y++)
    for (let x = 1; x < cols - 1; x++)
      if (!hz.has(t[y][x]) && !seen.has(x + ',' + y)) open.push([x, y]);

  const spawns = [];
  if (cfg.spawnMode === 'spread') {
    // seekers hug edges/corners; hiders are farthest-point sampled for even spread
    // (Hunt bots + Time Attack reuse hider spawns, so spacing matters).
    const anchors = cfg.seekerAnchors || [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.5, 0.05]];
    const taken = new Set();
    for (const [fx, fy] of anchors) {
      const sx = fx * cols, sy = fy * rows; let best = null, bd = Infinity;
      for (const [x, y] of open) { if (taken.has(x + ',' + y)) continue; const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      if (best) { taken.add(best[0] + ',' + best[1]); spawns.push({ x: best[0], y: best[1], role: 'seeker' }); }
    }
    const seekers = spawns.filter(s => s.role === 'seeker');
    const H = cfg.hiderCount || 20;
    const farEnough = (x, y, r2) => seekers.every(s => (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) >= r2);
    let pool = open.filter(([x, y]) => !clearCells.has(x + ',' + y) && farEnough(x, y, 36));
    if (pool.length < H * 3) pool = open.filter(([x, y]) => farEnough(x, y, 16));
    const chosen = [], chosenSet = new Set();
    const first = pool[Math.floor(drng() * pool.length)];
    if (first) { chosen.push(first); chosenSet.add(first[0] + ',' + first[1]); }
    while (chosen.length && chosen.length < H) {
      let best = null, bd = -1;
      for (const c of pool) {
        const k = c[0] + ',' + c[1]; if (chosenSet.has(k)) continue;
        let dm = Infinity;
        for (const q of chosen) { const d = (c[0] - q[0]) ** 2 + (c[1] - q[1]) ** 2; if (d < dm) dm = d; if (dm <= bd) break; }
        if (dm > bd) { bd = dm; best = c; }
      }
      if (!best) break;
      chosen.push(best); chosenSet.add(best[0] + ',' + best[1]);
    }
    for (const [x, y] of chosen) spawns.push({ x, y, role: 'hider' });
  } else {
    // original scatter — kept verbatim so the six legacy maps stay byte-identical
    const seekPts = [[cols * 0.15, rows * 0.15], [cols * 0.85, rows * 0.15], [cols * 0.85, rows * 0.85], [cols * 0.15, rows * 0.85], [cols * 0.5, rows * 0.5]];
    for (const [sx, sy] of seekPts) {
      let best = null, bd = Infinity;
      for (const [x, y] of open) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
      if (best) spawns.push({ x: best[0], y: best[1], role: 'seeker' });
    }
    for (let i = 0; i < 16; i++) { const c = open[Math.floor(rnd() * open.length)]; if (c) spawns.push({ x: c[0], y: c[1], role: 'hider' }); }
  }

  return { format: 'scanner-map', version: 1, name, biome, grid: { cols, rows }, terrain: t, objects: objs, spawns };
}

const THEMES = [
  { name: 'greenwood', display: 'Greenwood — dense forest', biome: 'greenwood', cols: 72, rows: 54, base: 'grass', seed: 11,
    patches: [ { key: 'foliage', count: 7, minR: 4, maxR: 7 }, { key: 'water', count: 2, minR: 3, maxR: 5 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 }, { key: 'rock', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.20 }, { type: 'tree', on: ['grass'], density: 0.05 }, { type: 'boulder', on: ['rock'], density: 0.30 }, { type: 'dead_tree', on: ['foliage'], density: 0.03 }, { type: 'crate', on: ['dirt'], density: 0.02 } ] },

  { name: 'dunes', display: 'Dunes — desert flats', biome: 'dunes', cols: 74, rows: 54, base: 'sand', seed: 22,
    patches: [ { key: 'rock', count: 4, minR: 3, maxR: 6 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 }, { key: 'water', count: 1, minR: 2, maxR: 3 } ],
    cover: [ { type: 'cactus', on: ['sand'], density: 0.035 }, { type: 'boulder', on: ['rock'], density: 0.25 }, { type: 'boulder', on: ['sand'], density: 0.01 }, { type: 'dead_tree', on: ['sand'], density: 0.012 }, { type: 'crate', on: ['dirt'], density: 0.02 } ] },

  { name: 'tundra', display: 'Tundra — frozen north', biome: 'tundra', cols: 72, rows: 54, base: 'snow', seed: 33,
    patches: [ { key: 'ice', count: 5, minR: 3, maxR: 6 }, { key: 'rock', count: 3, minR: 2, maxR: 4 }, { key: 'water', count: 1, minR: 2, maxR: 3 } ],
    cover: [ { type: 'ice_spike', on: ['ice'], density: 0.06 }, { type: 'ice_spike', on: ['snow'], density: 0.02 }, { type: 'dead_tree', on: ['snow'], density: 0.02 }, { type: 'boulder', on: ['rock'], density: 0.28 } ] },

  { name: 'downtown', display: 'Downtown — city blocks', biome: 'downtown', cols: 68, rows: 52, base: 'concrete', seed: 44, buildings: 14,
    patches: [ { key: 'metal', count: 4, minR: 2, maxR: 4 }, { key: 'grass', count: 4, minR: 3, maxR: 5 }, { key: 'dirt', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'tree', on: ['grass'], density: 0.10 }, { type: 'crate', on: ['concrete'], density: 0.015 }, { type: 'barrel', on: ['metal'], density: 0.03 }, { type: 'barrel', on: ['concrete'], density: 0.008 } ] },

  { name: 'xeno', display: 'Xeno — alien world', biome: 'xeno', cols: 72, rows: 54, base: 'moss', seed: 55,
    patches: [ { key: 'crystal', count: 5, minR: 3, maxR: 5 }, { key: 'water', count: 2, minR: 2, maxR: 4 }, { key: 'lava', count: 2, minR: 2, maxR: 4 }, { key: 'ash', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'alien_pod', on: ['moss'], density: 0.04 }, { type: 'alien_pod', on: ['crystal'], density: 0.04 }, { type: 'boulder', on: ['crystal'], density: 0.10 }, { type: 'dead_tree', on: ['ash'], density: 0.05 } ] },

  { name: 'bog', display: 'Bog — sunken swamp', biome: 'bog', cols: 70, rows: 52, base: 'mud', seed: 66,
    patches: [ { key: 'water', count: 7, minR: 3, maxR: 6 }, { key: 'foliage', count: 4, minR: 3, maxR: 5 }, { key: 'grass', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'dead_tree', on: ['mud'], density: 0.05 }, { type: 'dead_tree', on: ['foliage'], density: 0.06 }, { type: 'boulder', on: ['mud'], density: 0.015 }, { type: 'tree', on: ['grass'], density: 0.08 } ] },

  /* ================= crafted themes (design() + spread spawns) ================= */

  // IDENTITY: a winding river with 1-tile dirt banks splits the valley — three
  // bridges are the only dry crossings, and every bank is a grass/dirt/water seam.
  { name: 'riverline', display: 'Riverline — valley of three bridges', biome: 'greenwood',
    cols: 92, rows: 64, base: 'grass', seed: 111, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'foliage', count: 6, minR: 4, maxR: 7 }, { key: 'dirt', count: 4, minR: 2, maxR: 4 }, { key: 'rock', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.20 }, { type: 'tree', on: ['grass'], density: 0.035 }, { type: 'boulder', on: ['rock'], density: 0.28 }, { type: 'crate', on: ['dirt'], density: 0.03 }, { type: 'dead_tree', on: ['foliage'], density: 0.03 } ],
    design({ carvePath, bridge, seamStrip, coverCluster }) {
      carvePath([[46, -2], [38, 10], [50, 22], [40, 34], [52, 46], [44, 58], [48, 66]], 4, 'water', { bank: { key: 'dirt', extra: 1 }, jitter: 1.1 });
      carvePath([[-2, 21], [14, 24], [30, 26], [42, 27]], 3, 'water', { bank: { key: 'dirt', extra: 1 }, jitter: 0.8 });
      bridge(33, 12, 'h', 15, 2);
      bridge(35, 32, 'h', 15, 2);
      bridge(41, 50, 'h', 16, 2);
      seamStrip(8, 44, 26, 52, 'grass', 'dirt', 1);
      seamStrip(64, 12, 84, 20, 'grass', 'rock', 1);
      seamStrip(70, 52, 86, 46, 'grass', 'dirt', 1);
      coverCluster(18, 10, 'tree', 6, 3);
      coverCluster(72, 38, 'tree', 6, 3);
      coverCluster(78, 8, 'boulder', 5, 2.5);
      coverCluster(12, 58, 'boulder', 4, 2.5);
    } },

  // IDENTITY: walled courtyards with narrow doorways — moss creeps over the
  // concrete floors, so the best hiding is a 2-tone crouch inside the walls.
  { name: 'ruins', display: 'Sunken Ruins — flooded courtyards', biome: 'bog',
    cols: 84, rows: 62, base: 'grass', seed: 222, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'moss', count: 8, minR: 3, maxR: 6 }, { key: 'foliage', count: 5, minR: 3, maxR: 5 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.18 }, { type: 'dead_tree', on: ['moss'], density: 0.03 }, { type: 'boulder', on: ['grass'], density: 0.012 }, { type: 'boulder', on: ['moss'], density: 0.02 }, { type: 'crate', on: ['concrete'], density: 0.035 }, { type: 'barrel', on: ['concrete'], density: 0.015 } ],
    design({ carvePath, courtyard, clearing, seamStrip, coverCluster, coverRow }) {
      // old processional roads — kept clear so patrols sweep the ruin lanes
      carvePath([[-2, 31], [42, 31], [86, 31]], 2, 'dirt', { jitter: 0.6, clear: true });
      carvePath([[42, -2], [42, 31], [42, 64]], 2, 'dirt', { jitter: 0.6, clear: true });
      // courtyards (roads breach the central plaza on purpose — it is a ruin)
      courtyard(7, 5, 12, 9, { floor: 'concrete', doors: ['s', 'e'], inner: 'crate', innerDensity: 0.05, mossy: 'moss' });
      courtyard(26, 7, 11, 9, { floor: 'concrete', doors: ['s', 'w'], inner: 'barrel', innerDensity: 0.04 });
      courtyard(60, 6, 13, 9, { floor: 'concrete', doors: ['s', 'w'], inner: 'crate', innerDensity: 0.05, mossy: 'moss' });
      courtyard(8, 40, 11, 9, { floor: 'concrete', doors: ['n', 'e'], inner: 'crate', innerDensity: 0.05 });
      courtyard(48, 38, 13, 10, { floor: 'concrete', doors: ['n', 'w'], inner: 'barrel', innerDensity: 0.04, mossy: 'moss' });
      courtyard(66, 44, 12, 9, { floor: 'concrete', doors: ['n', 'w'], inner: 'crate', innerDensity: 0.05 });
      courtyard(36, 24, 14, 12, { floor: 'concrete', doors: ['e', 'w'], inner: 'crate', innerDensity: 0.04, mossy: 'moss' }); // the broken forum
      // flood pools
      clearing(22, 20, 3, 'water'); clearing(58, 22, 2.5, 'water');
      clearing(30, 50, 3, 'water'); clearing(72, 26, 2.5, 'water');
      // rubble lines + snags outside the walls
      coverRow(20, 17, 1, 0, 6, 'boulder', 3);
      coverRow(56, 54, 1, 0, 6, 'boulder', 3);
      coverCluster(52, 18, 'boulder', 5, 2.5);
      coverCluster(24, 36, 'dead_tree', 4, 2.5);
      // deliberate moss seams in the open ground between courtyards
      seamStrip(10, 26, 22, 26, 'grass', 'moss', 1);
      seamStrip(62, 36, 78, 38, 'grass', 'moss', 1);
    } },

  // IDENTITY: lava ribbons cross the field, broken by narrow causeways — every
  // ribbon has a 1-tile rock rim, so the brave hide on the seam beside the fire.
  { name: 'cinderfield', display: 'Cinderfield — seams through the fire', biome: 'xeno',
    cols: 88, rows: 62, base: 'ash', seed: 333, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'rock', count: 6, minR: 3, maxR: 5 }, { key: 'crystal', count: 2, minR: 2, maxR: 3 }, { key: 'dirt', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'boulder', on: ['rock'], density: 0.22 }, { type: 'boulder', on: ['ash'], density: 0.02 }, { type: 'dead_tree', on: ['ash'], density: 0.03 }, { type: 'alien_pod', on: ['crystal'], density: 0.08 } ],
    design({ carvePath, seamStrip, clearing, coverCluster }) {
      const lava = (pts) => carvePath(pts, 3, 'lava', { bank: { key: 'rock', extra: 1 }, jitter: 0.9 });
      // upper ribbon, two causeway gaps
      lava([[-2, 15], [14, 18], [28, 14]]);
      lava([[34, 13], [52, 18], [64, 14]]);
      lava([[70, 15], [90, 13]]);
      // lower ribbon, offset causeways
      lava([[-2, 42], [16, 45], [30, 41], [44, 44]]);
      lava([[50, 43], [68, 46], [90, 41]]);
      // vertical connector with one causeway
      lava([[58, 18], [54, 26]]);
      lava([[54, 32], [58, 40]]);
      // rock seams threading the safe mid-field
      seamStrip(8, 28, 30, 30, 'ash', 'rock', 1);
      seamStrip(36, 26, 50, 24, 'ash', 'rock', 1);
      seamStrip(66, 26, 82, 30, 'ash', 'rock', 1);
      seamStrip(20, 52, 40, 56, 'ash', 'dirt', 1);
      clearing(44, 31, 3, 'crystal'); // the vent
      coverCluster(10, 8, 'boulder', 5, 2.5);
      coverCluster(80, 54, 'boulder', 5, 2.5);
      coverCluster(24, 22, 'dead_tree', 4, 2);
      coverCluster(70, 34, 'boulder', 4, 2);
    } },

  // IDENTITY: concrete piers over frozen water, crate rows with slip gaps on the
  // docks and yards — plus ice floes to slide between hiding spots.
  { name: 'frostharbor', display: 'Frostharbor — docks and crate rows', biome: 'tundra',
    cols: 96, rows: 66, base: 'snow', seed: 444, spawnMode: 'spread', hiderCount: 22,
    seekerAnchors: [[0.05, 0.06], [0.5, 0.05], [0.95, 0.06], [0.06, 0.7], [0.94, 0.7]],
    patches: [ { key: 'ice', count: 5, minR: 3, maxR: 5 }, { key: 'rock', count: 3, minR: 2, maxR: 4 }, { key: 'dirt', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'ice_spike', on: ['ice'], density: 0.05 }, { type: 'ice_spike', on: ['snow'], density: 0.015 }, { type: 'dead_tree', on: ['snow'], density: 0.015 }, { type: 'boulder', on: ['rock'], density: 0.25 }, { type: 'crate', on: ['concrete'], density: 0.02 }, { type: 'barrel', on: ['metal'], density: 0.05 } ],
    design({ fillRect, carvePath, bridge, coverRow, courtyard, clearing, checkerboard, coverCluster }) {
      // the harbor: south water with a wavy shoreline
      fillRect(0, 50, 96, 16, 'water');
      carvePath([[-2, 50], [12, 51], [30, 49], [52, 51], [70, 49], [90, 51], [98, 50]], 3, 'water', { jitter: 1.2 });
      // wharf boardwalk — the main patrol lane, kept clear
      carvePath([[-2, 45], [98, 45]], 3, 'concrete', { clear: true });
      // piers (not cleared: crate rows live on them)
      bridge(11, 46, 'v', 15, 3, 'concrete', { clear: false });
      bridge(34, 46, 'v', 17, 3, 'concrete', { clear: false });
      bridge(57, 46, 'v', 14, 3, 'concrete', { clear: false });
      bridge(80, 46, 'v', 16, 3, 'concrete', { clear: false });
      coverRow(11, 49, 0, 1, 11, 'crate', 3);
      coverRow(36, 49, 0, 1, 13, 'crate', 4);
      coverRow(57, 49, 0, 1, 10, 'crate', 3);
      coverRow(82, 49, 0, 1, 12, 'crate', 4);
      // ice floes drifting between the piers
      clearing(22, 56, 2.5, 'ice'); clearing(46, 58, 3, 'ice');
      clearing(70, 57, 2.5, 'ice'); clearing(90, 60, 2, 'ice');
      // shore yards: crate rows with slip gaps north of the wharf
      coverRow(6, 41, 1, 0, 10, 'crate', 4);
      coverRow(20, 39, 1, 0, 12, 'crate', 3);
      coverRow(46, 40, 1, 0, 10, 'crate', 4);
      coverRow(66, 41, 1, 0, 12, 'crate', 3);
      // warehouses
      courtyard(6, 6, 13, 8, { floor: 'metal', doors: ['s'], inner: 'crate', innerDensity: 0.07 });
      courtyard(70, 8, 14, 9, { floor: 'metal', doors: ['s', 'w'], inner: 'barrel', innerDensity: 0.05 });
      // the loading yard: concrete/snow mosaic — 2-tone play in the open
      checkerboard(38, 20, 14, 10, ['concrete', 'snow'], 2);
      coverCluster(30, 12, 'ice_spike', 5, 2.5);
      coverCluster(56, 30, 'crate', 5, 2.5);
    } },

  // IDENTITY: a crate-maze junkyard cut by wide, cover-free patrol lanes — dart
  // between LoS shadow pockets, or blend on the dirt/metal scrap seams.
  { name: 'scrapline', display: 'Scrapline — junkyard alleys', biome: 'downtown',
    cols: 84, rows: 60, base: 'dirt', seed: 555, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'metal', count: 5, minR: 2, maxR: 4 }, { key: 'mud', count: 2, minR: 2, maxR: 3 }, { key: 'rock', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'crate', on: ['metal'], density: 0.06 }, { type: 'crate', on: ['dirt'], density: 0.015 }, { type: 'barrel', on: ['metal'], density: 0.04 }, { type: 'barrel', on: ['dirt'], density: 0.008 }, { type: 'boulder', on: ['rock'], density: 0.2 } ],
    design({ carvePath, clearing, seamStrip, coverRow, coverCluster, courtyard }) {
      // the lanes: a concrete grid kept clear so hunters sweep believably
      carvePath([[-2, 19], [86, 19]], 3, 'concrete', { clear: true });
      carvePath([[-2, 41], [86, 41]], 3, 'concrete', { clear: true });
      carvePath([[27, -2], [27, 62]], 3, 'concrete', { clear: true });
      carvePath([[56, -2], [56, 62]], 3, 'concrete', { clear: true });
      clearing(27, 19, 4, 'concrete', { clear: true }); // patrol hub plazas
      clearing(56, 41, 4, 'concrete', { clear: true });
      // block A/B/C (top): crate alleys with slip gaps
      coverRow(4, 4, 1, 0, 18, 'crate', 4); coverRow(4, 7, 1, 0, 18, 'crate', 5);
      coverRow(4, 10, 1, 0, 18, 'crate', 4); coverRow(4, 13, 1, 0, 18, 'crate', 3);
      coverRow(32, 5, 1, 0, 20, 'crate', 5); coverRow(32, 8, 1, 0, 20, 'crate', 4);
      coverRow(32, 11, 1, 0, 20, 'crate', 3); coverRow(32, 14, 1, 0, 20, 'crate', 5);
      coverRow(62, 4, 0, 1, 12, 'crate', 4); coverRow(65, 5, 0, 1, 12, 'crate', 5);
      coverRow(68, 4, 0, 1, 12, 'crate', 4); coverRow(71, 5, 0, 1, 12, 'crate', 3);
      coverRow(74, 4, 0, 1, 12, 'crate', 4);
      // block D (mid-left): alleys; block E: the crusher shed; block F: barrel field
      coverRow(4, 25, 1, 0, 18, 'crate', 3); coverRow(4, 28, 1, 0, 18, 'crate', 4);
      coverRow(4, 31, 1, 0, 18, 'crate', 5); coverRow(4, 34, 1, 0, 18, 'crate', 3);
      courtyard(34, 24, 12, 9, { floor: 'metal', doors: ['e', 's'], inner: 'barrel', innerDensity: 0.06 });
      seamStrip(62, 26, 80, 26, 'dirt', 'metal', 1);
      seamStrip(62, 32, 80, 34, 'dirt', 'metal', 1);
      coverCluster(66, 29, 'barrel', 6, 3);
      coverCluster(76, 36, 'crate', 5, 2.5);
      // bottom blocks: alleys, tire piles, mud seam
      coverRow(4, 46, 1, 0, 18, 'crate', 3); coverRow(4, 49, 1, 0, 18, 'crate', 4);
      coverRow(4, 52, 1, 0, 18, 'crate', 5); coverRow(4, 55, 1, 0, 18, 'crate', 3);
      coverCluster(36, 48, 'boulder', 5, 2.5); coverCluster(46, 53, 'boulder', 5, 2.5);
      seamStrip(32, 50, 52, 50, 'dirt', 'mud', 1);
      coverRow(62, 46, 0, 1, 11, 'crate', 4); coverRow(65, 47, 0, 1, 11, 'crate', 3);
      coverRow(68, 46, 0, 1, 11, 'crate', 4); coverRow(71, 47, 0, 1, 11, 'crate', 5);
      coverRow(74, 46, 0, 1, 11, 'crate', 4); coverRow(77, 47, 0, 1, 11, 'crate', 3);
    } },

  // IDENTITY: a deliberate 2-tone mosaic — checkerboard and striped plots behind
  // hedgerows, every plot border a Split Camo seam. The paint-to-match playground.
  { name: 'gardens', display: 'Twin Gardens — two-tone topiary maze', biome: 'greenwood',
    cols: 80, rows: 60, base: 'grass', seed: 666, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'foliage', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.15 }, { type: 'tree', on: ['grass'], density: 0.012 }, { type: 'boulder', on: ['moss'], density: 0.02 } ],
    design({ carvePath, checkerboard, stripes, clearing, coverRow, coverCluster }) {
      // sand walks — the patrol grid, kept clear
      carvePath([[-2, 15], [82, 15]], 2, 'sand', { clear: true });
      carvePath([[-2, 44], [82, 44]], 2, 'sand', { clear: true });
      carvePath([[20, -2], [20, 62]], 2, 'sand', { clear: true });
      carvePath([[59, -2], [59, 62]], 2, 'sand', { clear: true });
      // the mosaic plots — a different 2-tone pairing in every bed
      checkerboard(4, 3, 13, 9, ['grass', 'dirt'], 2);
      checkerboard(25, 3, 13, 9, ['moss', 'grass'], 3);
      checkerboard(64, 3, 13, 9, ['dirt', 'sand'], 2);
      stripes(4, 20, 13, 10, 'h', ['dirt', 'grass'], 2);
      checkerboard(25, 20, 13, 10, ['dirt', 'moss'], 3);
      checkerboard(64, 20, 13, 10, ['grass', 'moss'], 2);
      checkerboard(4, 48, 13, 9, ['sand', 'grass'], 3);
      stripes(25, 48, 13, 9, 'v', ['moss', 'dirt'], 2);
      checkerboard(45, 48, 11, 9, ['dirt', 'grass'], 2);
      stripes(64, 48, 13, 9, 'h', ['grass', 'sand'], 2);
      // central pond with a sand beach ring
      clearing(40, 30, 6, 'sand'); clearing(40, 30, 4, 'water');
      // hedgerows with slip gaps between the beds
      coverRow(4, 12, 1, 0, 14, 'tree', 4); coverRow(25, 12, 1, 0, 14, 'tree', 5);
      coverRow(64, 12, 1, 0, 14, 'tree', 4); coverRow(4, 41, 1, 0, 14, 'tree', 5);
      coverRow(64, 41, 1, 0, 14, 'tree', 4);
      coverRow(23, 20, 0, 1, 10, 'tree', 4); coverRow(62, 20, 0, 1, 10, 'tree', 5);
      // topiary + garden stones
      coverCluster(10, 31, 'boulder', 4, 2); coverCluster(70, 33, 'boulder', 4, 2);
      coverCluster(48, 8, 'tree', 5, 2.5); coverCluster(32, 55, 'tree', 4, 2);
    } },
];

mkdirSync('maps', { recursive: true });
const manifest = [];
for (const th of THEMES) {
  const map = makeMap(th);
  writeFileSync(`maps/${th.name}.json`, JSON.stringify(map));
  manifest.push({ file: `maps/${th.name}.json`, name: th.name, display: th.display });
  console.log(`wrote maps/${th.name}.json  ${map.grid.cols}x${map.grid.rows}  ${map.objects.length} props  ${map.spawns.length} spawns`);
}
writeFileSync('maps/levels.json', JSON.stringify(manifest, null, 2));
console.log(`wrote maps/levels.json  (${manifest.length} levels)`);
