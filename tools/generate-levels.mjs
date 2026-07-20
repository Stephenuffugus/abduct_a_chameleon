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
    const { floor = 'concrete', doors = ['s'], doorW = 2, inner = null, innerDensity = 0, mossy = null, flood = 0 } = opts;
    fillRect(x0, y0, w + 1, h + 1, floor);
    // flood: sink the interior under water, inset by `flood` tiles — a dry floor ring
    // stays inside the walls, and the pool is a slow, conceal-rich risk/reward room.
    if (flood) fillRect(x0 + flood, y0 + flood, w + 1 - flood * 2, h + 1 - flood * 2, 'water');
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
  // coverPair: two pieces offset with a slip gap — the minimal composed LoS-shadow unit
  // (critique pass: pairs 1 tile apart make real shadows; singleton scatter reads as noise).
  const coverPair = (x, y, type, dx = 2, dy = 1) => { put(x, y, type); put(x + dx, y + dy, type); };
  // bridge: a hard strip crossing water/lava. opts.clear (default true) keeps it cover-free.
  const bridge = (x, y, dir, len, width = 2, key = 'concrete', opts = {}) => {
    const { clear = true } = opts;
    const w = dir === 'h' ? len : width, h = dir === 'h' ? width : len;
    fillRect(x, y, w, h, key);
    if (clear) for (let yy = y - 1; yy < y + h + 1; yy++) for (let xx = x - 1; xx < x + w + 1; xx++) clearCells.add(xx + ',' + yy);
  };

  if (cfg.design) cfg.design({
    paint, fillRect, carvePath, seamStrip, checkerboard, stripes, clearing,
    courtyard, coverCluster, coverRow, coverPair, bridge, clearDisc, put, drng, cols, rows,
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
    // 6th seeker on the south edge: 92x64 is ~50% bigger than the shipped six, so
    // five sweepers left the south bank under-pressured (validator allows 4-6).
    seekerAnchors: [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.5, 0.05], [0.33, 0.97]],
    patches: [ { key: 'foliage', count: 6, minR: 4, maxR: 7 }, { key: 'dirt', count: 4, minR: 2, maxR: 4 }, { key: 'rock', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.20 }, { type: 'tree', on: ['grass'], density: 0.035 }, { type: 'boulder', on: ['rock'], density: 0.28 }, { type: 'crate', on: ['dirt'], density: 0.03 }, { type: 'dead_tree', on: ['foliage'], density: 0.03 } ],
    design({ carvePath, bridge, seamStrip, clearing, coverCluster, coverPair }) {
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
      // NW start shelf: the west-edge spawn pocket was naked uniform grass — give it
      // a dirt fringe to paint against and two shadow pairs to break LoS.
      clearing(5, 9, 2.5, 'dirt');
      coverPair(3, 7, 'boulder'); coverPair(6, 12, 'tree');
      // river-corridor banks: paired boulders so the mid-river spawn shelves have
      // day-one cover, not just seams-after-painting.
      coverPair(46, 38, 'boulder'); coverPair(54, 21, 'boulder'); coverPair(37, 24, 'tree', 2, -1);
      // south river-mouth pocket (the pinched SE-of-mouth spawn)
      coverCluster(53, 59, 'tree', 4, 2);
      // dead-air fixes: NE grass shelf, east notch, SE grass half — seams + pairs so
      // patrol sweeps through them have stakes.
      seamStrip(63, 2, 73, 4, 'grass', 'dirt', 1);
      coverPair(65, 4, 'boulder'); coverPair(70, 2, 'tree');
      coverPair(67, 46, 'boulder', 2, 2);
      seamStrip(57, 60, 67, 61, 'grass', 'dirt', 1);
      coverPair(60, 58, 'tree');
      // midfield east of the river: composed pairs where lone trees read as noise
      coverPair(62, 26, 'tree'); coverPair(67, 31, 'tree', 2, -1); coverPair(59, 36, 'tree');
      coverPair(72, 24, 'boulder'); coverPair(64, 41, 'tree'); coverPair(75, 44, 'tree', 2, -1);
      // bridges stay bare on purpose: crossing under patrol is the designed danger beat
    } },

  // IDENTITY: walled courtyards with narrow doorways — moss creeps over the
  // concrete floors, so the best hiding is a 2-tone crouch inside the walls.
  { name: 'ruins', display: 'Sunken Ruins — flooded courtyards', biome: 'bog',
    cols: 84, rows: 62, base: 'grass', seed: 222, spawnMode: 'spread', hiderCount: 20,
    // south-center seeker replaces the old top-center one: all five sat on the
    // top/bottom corner edges, leaving the mid-south spawns 30+ tiles from pressure.
    seekerAnchors: [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.5, 0.93]],
    patches: [ { key: 'moss', count: 8, minR: 3, maxR: 6 }, { key: 'foliage', count: 5, minR: 3, maxR: 5 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.18 }, { type: 'dead_tree', on: ['moss'], density: 0.03 }, { type: 'boulder', on: ['grass'], density: 0.012 }, { type: 'boulder', on: ['moss'], density: 0.02 }, { type: 'crate', on: ['concrete'], density: 0.035 }, { type: 'barrel', on: ['concrete'], density: 0.015 } ],
    design({ carvePath, courtyard, clearing, seamStrip, coverCluster, coverRow, coverPair }) {
      // old processional roads — kept clear so patrols sweep the ruin lanes
      carvePath([[-2, 31], [42, 31], [86, 31]], 2, 'dirt', { jitter: 0.6, clear: true });
      carvePath([[42, -2], [42, 31], [42, 64]], 2, 'dirt', { jitter: 0.6, clear: true });
      // courtyards (roads breach the central plaza on purpose — it is a ruin).
      // Three are SUNKEN: interiors flooded with a dry ring inside the walls —
      // slow, conceal-rich rooms that earn the "flooded courtyards" name.
      courtyard(7, 5, 12, 9, { floor: 'concrete', doors: ['s', 'e'], inner: 'crate', innerDensity: 0.05, mossy: 'moss' });
      courtyard(26, 7, 11, 9, { floor: 'concrete', doors: ['s', 'w'], inner: 'barrel', innerDensity: 0.04, flood: 2 });
      courtyard(60, 6, 13, 9, { floor: 'concrete', doors: ['s', 'w'], inner: 'crate', innerDensity: 0.05, mossy: 'moss' });
      courtyard(8, 40, 11, 9, { floor: 'concrete', doors: ['n', 'e'], inner: 'crate', innerDensity: 0.05, flood: 2 });
      courtyard(48, 38, 13, 10, { floor: 'concrete', doors: ['n', 'w'], inner: 'barrel', innerDensity: 0.04, mossy: 'moss' });
      courtyard(66, 44, 12, 9, { floor: 'concrete', doors: ['n', 'w'], inner: 'crate', innerDensity: 0.05, flood: 2 });
      courtyard(36, 24, 14, 12, { floor: 'concrete', doors: ['e', 'w'], inner: 'crate', innerDensity: 0.04, mossy: 'moss' }); // the broken forum
      // flood pools — each wears a mud shore ring so the shoreline is a seam to
      // hide on, not a bare-grass trap.
      const pool = (cx, cy, r) => { clearing(cx, cy, r + 1.7, 'mud'); clearing(cx, cy, r, 'water'); };
      pool(22, 20, 3); pool(58, 22, 2.5);
      pool(30, 50, 3); pool(72, 26, 2.5);
      // rubble lines + snags outside the walls
      coverRow(20, 17, 1, 0, 6, 'boulder', 3);
      coverRow(56, 54, 1, 0, 6, 'boulder', 3);
      coverCluster(52, 18, 'boulder', 5, 2.5);
      coverCluster(24, 36, 'dead_tree', 4, 2.5);
      // deliberate moss seams in the open ground between courtyards
      seamStrip(10, 26, 22, 26, 'grass', 'moss', 1);
      seamStrip(62, 36, 78, 38, 'grass', 'moss', 1);
      // dead-margin fixes: SW moss tongue off the road + rubble, east-edge moss
      // band, west-edge strip — each barren margin gets a seam AND paired cover.
      seamStrip(13, 58, 40, 58, 'grass', 'moss', 1);
      coverCluster(22, 58, 'boulder', 4, 2); coverPair(11, 55, 'boulder');
      // north margin above the courtyards (either side of the processional road)
      seamStrip(20, 2, 37, 2, 'grass', 'moss', 1); seamStrip(47, 2, 56, 2, 'grass', 'moss', 1);
      coverPair(22, 1, 'boulder', 2, 1); coverPair(50, 1, 'boulder', 2, 1);
      seamStrip(81, 8, 81, 24, 'grass', 'moss', 1);
      coverPair(79, 11, 'boulder'); coverPair(80, 18, 'boulder', 2, 2); coverPair(81, 50, 'boulder', 1, 2);
      seamStrip(1, 6, 1, 22, 'grass', 'moss', 1);
      coverPair(2, 10, 'boulder', 1, 2);
      seamStrip(1, 44, 1, 60, 'grass', 'moss', 1);
      coverPair(2, 47, 'boulder', 1, 2); coverPair(2, 55, 'boulder', 1, 2);
      // pair up the open-field rubble into real LoS shadows (lone boulders cast none)
      coverPair(29, 40, 'boulder'); coverPair(23, 34, 'boulder', 2, -1);
      coverPair(55, 28, 'boulder'); coverPair(33, 14, 'boulder', 2, -1);
      coverPair(68, 21, 'boulder'); coverPair(30, 27, 'boulder', 2, -1);
    } },

  // IDENTITY: lava ribbons cross the field, broken by narrow causeways — every
  // ribbon has a 1-tile rock rim, so the brave hide on the seam beside the fire.
  { name: 'cinderfield', display: 'Cinderfield — seams through the fire', biome: 'xeno',
    cols: 88, rows: 62, base: 'ash', seed: 333, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'rock', count: 6, minR: 3, maxR: 5 }, { key: 'crystal', count: 2, minR: 2, maxR: 3 }, { key: 'dirt', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'boulder', on: ['rock'], density: 0.22 }, { type: 'boulder', on: ['ash'], density: 0.02 }, { type: 'dead_tree', on: ['ash'], density: 0.03 }, { type: 'alien_pod', on: ['crystal'], density: 0.08 } ],
    design({ carvePath, seamStrip, clearing, coverCluster, coverPair, bridge, fillRect, clearDisc }) {
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
      // SECOND southern crossing (east, cols 77-79): a rock causeway punched through
      // the lower ribbon so one camped seeker can't gate the whole south field.
      bridge(77, 38, 'v', 11, 3, 'rock');
      // the original south gap is patrol ground now — reserved so no hider spawns
      // inside the most-trafficked cells on the map.
      clearDisc(46, 44, 3.5);
      // NE crossing of the upper ribbon: widen the 2-tile pinch to a full 3 dry columns
      fillRect(66, 11, 3, 8, 'rock');
      // rock seams threading the safe mid-field
      seamStrip(8, 28, 30, 30, 'ash', 'rock', 1);
      seamStrip(36, 26, 50, 24, 'ash', 'rock', 1);
      seamStrip(66, 26, 82, 30, 'ash', 'rock', 1);
      seamStrip(20, 52, 40, 56, 'ash', 'dirt', 1);
      // SE field was flat single-tone ash: terrain paint only (openPct3 sits at the
      // shipped floor, so no new cover objects out here — seams, not props).
      clearing(74, 55, 3.5, 'dirt');
      seamStrip(63, 52, 71, 57, 'ash', 'dirt', 1);
      // NE top strip: bare ash shelf above the upper ribbon — a rock seam + one
      // boulder pair so the strip's spawns aren't naked.
      seamStrip(72, 3, 84, 5, 'ash', 'rock', 1);
      coverPair(76, 2, 'boulder', 2, -1);
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
    cover: [ { type: 'ice_spike', on: ['ice'], density: 0.05 }, { type: 'ice_spike', on: ['snow'], density: 0.02 }, { type: 'dead_tree', on: ['snow'], density: 0.02 }, { type: 'boulder', on: ['rock'], density: 0.25 }, { type: 'crate', on: ['concrete'], density: 0.02 }, { type: 'barrel', on: ['metal'], density: 0.05 } ],
    design({ fillRect, carvePath, bridge, coverRow, courtyard, clearing, checkerboard, coverCluster, coverPair, clearDisc, put }) {
      // the harbor: south water with a wavy shoreline
      fillRect(0, 50, 96, 16, 'water');
      carvePath([[-2, 50], [12, 51], [30, 49], [52, 51], [70, 49], [90, 51], [98, 50]], 3, 'water', { jitter: 1.2 });
      // quay crate stacks go down BEFORE the wharf lane is reserved: three small
      // stacks are the only cover allowed on the quay, breaking the sterile
      // 96-tile sightline into readable segments without killing the danger road.
      put(30, 44, 'crate'); put(31, 45, 'crate');
      put(48, 45, 'crate'); put(49, 46, 'crate');
      put(65, 45, 'crate'); put(66, 44, 'crate');
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
      // pier tips + the far-corner floe were spawn death traps (14+ walk-tiles from
      // land, one catwalk out) — reserve them so hider spawns pull shoreward.
      clearDisc(12, 59, 2.5); clearDisc(35, 60, 2.5); clearDisc(58, 58, 2.5);
      clearDisc(81, 60, 2.5); clearDisc(90, 60, 3);
      // ice floes drifting between the piers
      clearing(22, 56, 2.5, 'ice'); clearing(46, 58, 3, 'ice');
      clearing(70, 57, 2.5, 'ice'); clearing(90, 60, 2, 'ice');
      // outer harbor was 300+ cells of featureless water: stepping-stone floes and
      // moored buoy crates give the deep rows hides and swim waypoints. The floes
      // are reserved (clearDisc) so they read as relocation hides, not far-water
      // spawn traps like the old pier tips.
      clearing(7, 61, 2, 'ice'); clearing(20, 62, 2, 'ice');
      clearing(55, 63, 2, 'ice'); clearing(78, 63, 2, 'ice');
      clearDisc(7, 61, 2.5); clearDisc(20, 62, 2.5); clearDisc(55, 63, 2.5); clearDisc(78, 63, 2.5);
      put(33, 64, 'crate'); put(68, 62, 'crate'); put(12, 64, 'crate');
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
      // west margin + NE snowfield leaned on lone ice spikes over uniform snow:
      // small dirt/rock patches for seams, plus paired spikes for real shadows.
      clearing(3, 18, 2, 'dirt'); coverPair(2, 15, 'ice_spike', 1, 2);
      clearing(89, 6, 2.5, 'rock'); coverPair(91, 11, 'ice_spike', 2, 1);
      clearing(90, 23, 2.2, 'dirt'); coverPair(86, 22, 'ice_spike', 2, 1);
      clearing(12, 23, 2, 'rock'); coverPair(9, 20, 'dead_tree', 2, 1);
      clearing(78, 2, 1.8, 'dirt'); coverPair(75, 3, 'ice_spike', 2, 1);
      clearing(92, 36, 2.5, 'rock'); coverPair(88, 34, 'dead_tree', 2, 1);
      clearing(20, 2, 1.8, 'dirt'); coverPair(16, 2, 'ice_spike', 2, 1);
    } },

  // IDENTITY: a crate-maze junkyard cut by wide, cover-free patrol lanes — dart
  // between LoS shadow pockets, or blend on the dirt/metal scrap seams.
  { name: 'scrapline', display: 'Scrapline — junkyard alleys', biome: 'downtown',
    cols: 84, rows: 60, base: 'dirt', seed: 555, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'metal', count: 5, minR: 2, maxR: 4 }, { key: 'mud', count: 2, minR: 2, maxR: 3 }, { key: 'rock', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'crate', on: ['metal'], density: 0.06 }, { type: 'crate', on: ['dirt'], density: 0.015 }, { type: 'barrel', on: ['metal'], density: 0.04 }, { type: 'barrel', on: ['dirt'], density: 0.008 }, { type: 'boulder', on: ['rock'], density: 0.2 } ],
    design({ carvePath, clearing, seamStrip, coverRow, coverCluster, coverPair, courtyard }) {
      // lane-break clusters go down FIRST (the lanes are reserved right after, so
      // these four are the only cover on the bands): crossing a lane becomes a
      // read past a known shadow, not a full-map-length coin flip.
      coverCluster(27, 10, 'crate', 3, 1.5);
      coverCluster(70, 19, 'barrel', 3, 1.5);
      coverCluster(13, 41, 'crate', 3, 1.5);
      coverCluster(56, 45, 'barrel', 3, 1.5);
      // the lanes: a concrete grid kept clear so hunters sweep believably
      carvePath([[-2, 19], [86, 19]], 3, 'concrete', { clear: true });
      carvePath([[-2, 41], [86, 41]], 3, 'concrete', { clear: true });
      carvePath([[27, -2], [27, 62]], 3, 'concrete', { clear: true });
      carvePath([[56, -2], [56, 62]], 3, 'concrete', { clear: true });
      clearing(27, 19, 4, 'concrete', { clear: true }); // patrol hub plazas
      clearing(56, 41, 4, 'concrete', { clear: true });
      // Each yard gets its own stamp signature (the old yards were 2-3 byte-identical
      // motifs repeated nine times).
      // yard A (NW): tight horizontal crate alleys, offset starts, one barrel run
      coverRow(4, 4, 1, 0, 18, 'crate', 4); coverRow(6, 7, 1, 0, 16, 'crate', 3);
      coverRow(4, 10, 1, 0, 18, 'barrel', 5); coverRow(7, 13, 1, 0, 15, 'crate', 4);
      // yard B (N): vertical columns — reads opposite of A from the lanes
      coverRow(33, 5, 0, 1, 10, 'crate', 3); coverRow(37, 6, 0, 1, 9, 'crate', 4);
      coverRow(41, 5, 0, 1, 10, 'barrel', 5); coverRow(45, 6, 0, 1, 9, 'crate', 3);
      coverRow(49, 5, 0, 1, 10, 'crate', 4);
      // yard C (NE): diagonal scrap drifts + a metal strip feeding the weak pocket
      coverRow(62, 4, 1, 1, 9, 'crate', 4); coverRow(67, 4, 1, 1, 9, 'barrel', 3);
      coverRow(72, 4, 1, 1, 9, 'crate', 5);
      seamStrip(75, 9, 83, 12, 'dirt', 'metal', 1);
      coverPair(79, 8, 'crate');
      // yard D (mid-left): barrel-heavy, wider alley pitch than A
      coverRow(4, 25, 1, 0, 18, 'crate', 3); coverRow(4, 29, 1, 0, 18, 'barrel', 4);
      coverRow(5, 33, 1, 0, 17, 'crate', 5); coverPair(10, 36, 'barrel');
      // block E: the crusher shed (the landmark compound — untouched)
      courtyard(34, 24, 12, 9, { floor: 'metal', doors: ['e', 's'], inner: 'barrel', innerDensity: 0.06 });
      seamStrip(62, 26, 80, 26, 'dirt', 'metal', 1);
      seamStrip(62, 32, 80, 34, 'dirt', 'metal', 1);
      coverCluster(66, 29, 'barrel', 6, 3);
      coverCluster(76, 36, 'crate', 5, 2.5);
      // yard E (SW): sparse crate runs woven with boulder tire-piles
      coverRow(4, 46, 1, 0, 18, 'crate', 5); coverCluster(9, 50, 'boulder', 4, 2);
      coverRow(6, 53, 1, 0, 16, 'crate', 4); coverCluster(17, 56, 'boulder', 3, 1.5);
      coverRow(4, 57, 1, 0, 12, 'barrel', 3);
      // south-center yard: mud wash + a sump puddle + crate pairs (was bare dirt)
      coverCluster(36, 48, 'boulder', 5, 2.5); coverCluster(46, 53, 'boulder', 5, 2.5);
      seamStrip(32, 50, 52, 50, 'dirt', 'mud', 1);
      seamStrip(33, 56, 49, 57, 'dirt', 'mud', 1);
      clearing(43, 55, 2.2, 'mud'); clearing(43, 55, 1.2, 'water');
      coverPair(38, 55, 'crate'); coverPair(47, 57, 'crate', -2, 1); coverPair(30, 57, 'barrel', 2, -1);
      // thin pockets flanking the compound and below the east metal strips
      coverPair(51, 26, 'barrel', 2, 1); coverPair(64, 37, 'crate', 2, -1);
      // yard F (SE): loose crate/barrel lattice, offset from E's rhythm
      coverRow(62, 46, 0, 1, 11, 'crate', 3); coverRow(66, 47, 0, 1, 10, 'barrel', 4);
      coverRow(70, 46, 0, 1, 11, 'crate', 5); coverRow(74, 48, 0, 1, 9, 'barrel', 3);
      coverRow(78, 46, 0, 1, 11, 'crate', 4);
    } },

  // IDENTITY: a deliberate 2-tone mosaic — checkerboard and striped plots behind
  // hedgerows, every plot border a Split Camo seam. The paint-to-match playground.
  { name: 'gardens', display: 'Twin Gardens — two-tone topiary maze', biome: 'greenwood',
    cols: 80, rows: 60, base: 'grass', seed: 666, spawnMode: 'spread', hiderCount: 20,
    patches: [ { key: 'foliage', count: 3, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.15 }, { type: 'tree', on: ['grass'], density: 0.012 }, { type: 'boulder', on: ['moss'], density: 0.02 } ],
    design({ carvePath, checkerboard, stripes, clearing, seamStrip, coverRow, coverCluster, coverPair, fillRect }) {
      // sand walks — the patrol grid, kept clear
      carvePath([[-2, 15], [82, 15]], 2, 'sand', { clear: true });
      carvePath([[-2, 44], [82, 44]], 2, 'sand', { clear: true });
      carvePath([[20, -2], [20, 62]], 2, 'sand', { clear: true });
      carvePath([[59, -2], [59, 62]], 2, 'sand', { clear: true });
      // the plots — a different 2-tone pairing in every bed, but each bed now has
      // solid 3-5 wide interiors (bordered plots, wide stripes, coarse checkers):
      // seams are the bed BORDERS you travel to, not a tax on every standing cell.
      const bed = (x, y, w, h, outer, inner) => { fillRect(x, y, w, h, outer); fillRect(x + 2, y + 2, w - 4, h - 4, inner); };
      bed(4, 3, 13, 9, 'dirt', 'grass');
      stripes(25, 3, 13, 9, 'h', ['moss', 'grass'], 4);
      checkerboard(64, 3, 13, 9, ['dirt', 'sand'], 4);
      stripes(4, 20, 13, 10, 'h', ['dirt', 'grass'], 5);
      bed(25, 20, 13, 10, 'moss', 'dirt');
      checkerboard(64, 20, 13, 10, ['grass', 'moss'], 5);
      stripes(4, 48, 13, 9, 'v', ['sand', 'grass'], 4);
      stripes(25, 48, 13, 9, 'v', ['moss', 'dirt'], 4);
      bed(45, 48, 11, 9, 'dirt', 'grass');
      stripes(64, 48, 13, 9, 'h', ['grass', 'sand'], 4);
      // central pond with a sand beach ring
      clearing(40, 30, 6, 'sand'); clearing(40, 30, 4, 'water');
      // hedgerows with slip gaps between the beds
      coverRow(4, 12, 1, 0, 14, 'tree', 4); coverRow(25, 12, 1, 0, 14, 'tree', 5);
      coverRow(64, 12, 1, 0, 14, 'tree', 4); coverRow(4, 41, 1, 0, 14, 'tree', 5);
      coverRow(64, 41, 1, 0, 14, 'tree', 4);
      coverRow(23, 20, 0, 1, 10, 'tree', 4); coverRow(62, 20, 0, 1, 10, 'tree', 5);
      // southern third was cover-starved (0.8-1.9% vs 4.5-7.1% up north): dashed
      // hedgerows mirroring rows 12/41, south of the row-44 walk.
      coverRow(4, 47, 1, 0, 14, 'tree', 4); coverRow(25, 47, 1, 0, 14, 'tree', 5);
      coverRow(45, 47, 1, 0, 11, 'tree', 4); coverRow(64, 47, 1, 0, 14, 'tree', 4);
      // west margin: the (1,36)/(1,51)-style edge spawns were naked uniform grass
      // next to the SW seeker — dirt fringes to paint against + shadow pairs.
      seamStrip(1, 30, 1, 42, 'grass', 'dirt', 1);
      coverPair(2, 33, 'tree'); coverPair(2, 38, 'boulder', 1, 2);
      seamStrip(1, 48, 1, 58, 'grass', 'dirt', 1);
      coverPair(2, 52, 'tree', 1, 2);
      // staggered pairs where lone singles read as noise: a second dashed column
      // beside the col-23 trees, plus paired strays around the pond and the south beds
      coverRow(24, 21, 0, 1, 10, 'tree', 4);
      coverPair(33, 38, 'tree'); coverPair(45, 41, 'tree', 2, -1); coverPair(50, 37, 'tree');
      coverPair(9, 53, 'tree'); coverPair(30, 52, 'tree', 2, -1); coverPair(48, 53, 'boulder');
      coverPair(69, 54, 'tree'); coverPair(37, 58, 'tree', 2, -1);
      // margin strays (N + S edges) + a garden stone pair on the pond's north shore
      coverPair(30, 1, 'tree'); coverPair(55, 2, 'tree', 2, -1); coverPair(42, 24, 'boulder', 2, -1);
      coverPair(14, 2, 'tree', 2, -1); coverPair(69, 1, 'boulder', 2, 1); coverPair(24, 58, 'tree', 2, -1);
      // topiary + garden stones
      coverCluster(10, 31, 'boulder', 4, 2); coverCluster(70, 33, 'boulder', 4, 2);
      coverCluster(48, 8, 'tree', 5, 2.5); coverCluster(32, 55, 'tree', 4, 2);
    } },
];

mkdirSync('maps', { recursive: true });
const manifest = [];
// ---------------------------------------------------------------------------
// ENRICH (P21): a deterministic detail pass applied to EVERY map after build.
// Goal: more places to hide, more ground worth painting — without touching
// hazards, walls, spawns, or patrol space. Four rules, all bounded:
//   R1 dead-zone fill  — any cell far from every hide option gets a sibling
//                        terrain freckle nearby (kills the >6-distance deserts)
//   R2 spawn pockets   — every hider spawn gets a 2-tone seam within reach
//   R3 freckles        — uniform interiors get small sibling patches (paint targets)
//   R4 cover slits     — sparse pairs 1 gap apart (LoS shadows), capped so
//                        UFO patrol pools never starve
// This pass deliberately ends the "legacy six byte-identical" policy — the
// owner asked for more detail on ALL levels. Regenerate + validate as always.
const SIBLING = { grass:['dirt','foliage'], dirt:['grass','rock'], sand:['rock','dirt'],
  snow:['ice','rock'], ice:['snow'], concrete:['metal','dirt'], metal:['concrete'],
  moss:['crystal','ash'], mud:['foliage','grass'], rock:['dirt'], foliage:['grass'],
  ash:['rock','crystal'], crystal:['moss'] };
const PAIR_TYPE = { greenwood:'tree', dunes:'boulder', tundra:'ice_spike',
  downtown:'crate', xeno:'alien_pod', bog:'dead_tree' };
function enrich(map, seed){
  const rnd = rngFactory((Math.imul(seed ^ 0x51ed270b, 2246822519) >>> 0) || 1);
  const { cols, rows } = map.grid, t = map.terrain;
  const NOPAINT = new Set(['void','water','lava']);
  const cov = new Map(); for (const o of map.objects) cov.set(o.x+','+o.y, o.type);
  const spawnCells = new Set(map.spawns.map(s=>s.x+','+s.y));
  const seekers = map.spawns.filter(s=>s.role==='seeker');
  const terr = (x,y)=> (x>=0&&y>=0&&x<cols&&y<rows)? t[y][x] : 'void';
  const nearSeeker = (x,y,r)=> seekers.some(s=>Math.max(Math.abs(s.x-x),Math.abs(s.y-y))<=r);
  const seamAt = (x,y)=>{ const a=terr(x,y); if(a==='void') return false;
    return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{ const b=terr(x+dx,y+dy); return b!=='void'&&b!==a; }); };
  const within = (x,y,r,pred)=>{ for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++) if(pred(x+dx,y+dy)) return true; return false; };
  const paintable = (x,y)=> x>=1&&y>=1&&x<cols-1&&y<rows-1 && !NOPAINT.has(terr(x,y)) && !cov.has(x+','+y) && !spawnCells.has(x+','+y);
  const freckle = (x,y)=>{ const sib=SIBLING[terr(x,y)]; if(!sib||!paintable(x,y)) return false;
    const k=sib[(rnd()*sib.length)|0]; t[y][x]=k;
    const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][(rnd()*4)|0];
    if(rnd()<0.6 && paintable(x+dx,y+dy)) t[y+dy][x+dx]=k;
    return true; };
  let nR1=0,nR2=0,nR3=0,nR4=0,nR5=0;
  // R5: hider spawns parked within 6 tiles of a seeker are spawn-lottery losses — relocate them
  // to the nearest fair cell (walkable, non-hazard, uncovered, ≥6 from every seeker, ≥3 from other hiders)
  for(const s of map.spawns){ if(s.role!=='hider') continue;
    if(!nearSeeker(s.x,s.y,5)) continue;
    let best=null,bd=1e9;
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++){
      if(NOPAINT.has(terr(x,y))||cov.has(x+','+y)) continue;
      if(nearSeeker(x,y,5)) continue;
      if(map.spawns.some(o=>o!==s&&o.role==='hider'&&Math.max(Math.abs(o.x-x),Math.abs(o.y-y))<3)) continue;
      const d=(x-s.x)*(x-s.x)+(y-s.y)*(y-s.y); if(d<bd){ bd=d; best=[x,y]; } }
    if(best){ spawnCells.delete(s.x+','+s.y); s.x=best[0]; s.y=best[1]; spawnCells.add(s.x+','+s.y); nR5++; }
  }
  // R1: sweep a lattice; any spot with no seam AND no cover within 4 gets a freckle
  for(let y=3;y<rows-3;y+=4) for(let x=3;x<cols-3;x+=4){
    if(NOPAINT.has(terr(x,y))) continue;
    if(within(x,y,4,(a,b)=>seamAt(a,b)) || within(x,y,4,(a,b)=>cov.has(a+','+b))) continue;
    if(freckle(x+((rnd()*3)|0)-1, y+((rnd()*3)|0)-1)) nR1++;
  }
  // R2: every hider spawn gets a seam within 3 (paint one just outside arm's reach, never under them)
  for(const s of map.spawns){ if(s.role!=='hider') continue;
    if(within(s.x,s.y,3,(a,b)=>seamAt(a,b))) continue;
    for(let tries=0;tries<12;tries++){ const dx=((rnd()*5)|0)-2, dy=((rnd()*5)|0)-2;
      if(Math.max(Math.abs(dx),Math.abs(dy))<1) continue;
      if(freckle(s.x+dx,s.y+dy)){ nR2++; break; } }
  }
  // R3: pepper uniform interiors with paint targets
  const nF=(cols*rows/130)|0;
  for(let i=0;i<nF;i++){ const x=1+((rnd()*(cols-2))|0), y=1+((rnd()*(rows-2))|0);
    const a=terr(x,y); if(NOPAINT.has(a)||!SIBLING[a]) continue;
    if(terr(x+1,y)!==a||terr(x-1,y)!==a||terr(x,y+1)!==a||terr(x,y-1)!==a) continue;   // uniform interior only
    if(nearSeeker(x,y,2)) continue;
    if(freckle(x,y)) nR3++;
  }
  // R4: sparse cover slits (pair with a 1-cell gap), far from spawns and existing cover
  const pt=PAIR_TYPE[map.biome]||'boulder';
  const maxPairs=Math.min((cols*rows/300)|0, Math.round(map.objects.length*0.06)+2);
  for(let i=0;i<maxPairs*6 && nR4<maxPairs;i++){
    const x=2+((rnd()*(cols-5))|0), y=2+((rnd()*(rows-5))|0);
    const vert=rnd()<0.5, x2=vert?x:x+2, y2=vert?y+2:y;
    const okCell=(a,b)=> !NOPAINT.has(terr(a,b)) && !cov.has(a+','+b) && !spawnCells.has(a+','+b);
    if(!okCell(x,y)||!okCell(x2,y2)) continue;
    if(within(x,y,2,(a,b)=>cov.has(a+','+b)) || nearSeeker(x,y,3)) continue;
    if(map.spawns.some(s=>Math.max(Math.abs(s.x-x),Math.abs(s.y-y))<=3)) continue;
    cov.set(x+','+y,pt); cov.set(x2+','+y2,pt);
    map.objects.push({x,y,type:pt},{x:x2,y:y2,type:pt}); nR4++;
  }
  console.log(`  enrich ${map.name}: respawned ${nR5} · dead-fill ${nR1} · spawn-pockets ${nR2} · freckles ${nR3} · cover-slits ${nR4}×2`);
  return map;
}

for (const th of THEMES) {
  const map = enrich(makeMap(th), (th.seed||1)*2654435761>>>0);
  writeFileSync(`maps/${th.name}.json`, JSON.stringify(map));
  manifest.push({ file: `maps/${th.name}.json`, name: th.name, display: th.display, biome: map.biome || 'greenwood' });
  console.log(`wrote maps/${th.name}.json  ${map.grid.cols}x${map.grid.rows}  ${map.objects.length} props  ${map.spawns.length} spawns`);
}
writeFileSync('maps/levels.json', JSON.stringify(manifest, null, 2));
console.log(`wrote maps/levels.json  (${manifest.length} levels)`);
