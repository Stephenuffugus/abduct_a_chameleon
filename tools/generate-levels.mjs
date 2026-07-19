// ABDUCTEE — themed level generator
// Produces large open SCANNER-format maps for camouflage hide-and-seek.
// Run:  node tools/generate-levels.mjs      (writes maps/*.json + maps/levels.json)
//
// Each theme picks a base terrain, stamps organic terrain patches to camouflage
// against, scatters theme-appropriate cover, and distributes seeker/hider spawns.
// Terrain keys must match the TERRAIN table in the game (index.html):
//   void grass dirt water rock concrete foliage metal sand snow ice mud moss lava ash crystal
// Cover types must match addCover() in the game:
//   tree boulder crate barrel wall cactus dead_tree ice_spike alien_pod

import { writeFileSync, mkdirSync } from 'fs';

function rngFactory(seed){ let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function makeMap(cfg){
  const { name, display, cols, rows, base, patches = [], cover = [], buildings = 0, hazards = [], seed = 1 } = cfg;
  const rnd = rngFactory(seed);
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
  const put = (x, y, type) => {
    const k = x + ',' + y;
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
  const seekPts = [[cols * 0.15, rows * 0.15], [cols * 0.85, rows * 0.15], [cols * 0.85, rows * 0.85], [cols * 0.15, rows * 0.85], [cols * 0.5, rows * 0.5]];
  for (const [sx, sy] of seekPts) {
    let best = null, bd = Infinity;
    for (const [x, y] of open) { const d = (x - sx) ** 2 + (y - sy) ** 2; if (d < bd) { bd = d; best = [x, y]; } }
    if (best) spawns.push({ x: best[0], y: best[1], role: 'seeker' });
  }
  for (let i = 0; i < 16; i++) { const c = open[Math.floor(rnd() * open.length)]; if (c) spawns.push({ x: c[0], y: c[1], role: 'hider' }); }

  return { format: 'scanner-map', version: 1, name, grid: { cols, rows }, terrain: t, objects: objs, spawns };
}

const THEMES = [
  { name: 'greenwood', display: 'Greenwood — dense forest', cols: 72, rows: 54, base: 'grass', seed: 11,
    patches: [ { key: 'foliage', count: 7, minR: 4, maxR: 7 }, { key: 'water', count: 2, minR: 3, maxR: 5 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 }, { key: 'rock', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'tree', on: ['foliage'], density: 0.20 }, { type: 'tree', on: ['grass'], density: 0.05 }, { type: 'boulder', on: ['rock'], density: 0.30 }, { type: 'dead_tree', on: ['foliage'], density: 0.03 }, { type: 'crate', on: ['dirt'], density: 0.02 } ] },

  { name: 'dunes', display: 'Dunes — desert flats', cols: 74, rows: 54, base: 'sand', seed: 22,
    patches: [ { key: 'rock', count: 4, minR: 3, maxR: 6 }, { key: 'dirt', count: 3, minR: 2, maxR: 4 }, { key: 'water', count: 1, minR: 2, maxR: 3 } ],
    cover: [ { type: 'cactus', on: ['sand'], density: 0.035 }, { type: 'boulder', on: ['rock'], density: 0.25 }, { type: 'boulder', on: ['sand'], density: 0.01 }, { type: 'dead_tree', on: ['sand'], density: 0.012 }, { type: 'crate', on: ['dirt'], density: 0.02 } ] },

  { name: 'tundra', display: 'Tundra — frozen north', cols: 72, rows: 54, base: 'snow', seed: 33,
    patches: [ { key: 'ice', count: 5, minR: 3, maxR: 6 }, { key: 'rock', count: 3, minR: 2, maxR: 4 }, { key: 'water', count: 1, minR: 2, maxR: 3 } ],
    cover: [ { type: 'ice_spike', on: ['ice'], density: 0.06 }, { type: 'ice_spike', on: ['snow'], density: 0.02 }, { type: 'dead_tree', on: ['snow'], density: 0.02 }, { type: 'boulder', on: ['rock'], density: 0.28 } ] },

  { name: 'downtown', display: 'Downtown — city blocks', cols: 68, rows: 52, base: 'concrete', seed: 44, buildings: 14,
    patches: [ { key: 'metal', count: 4, minR: 2, maxR: 4 }, { key: 'grass', count: 4, minR: 3, maxR: 5 }, { key: 'dirt', count: 2, minR: 2, maxR: 3 } ],
    cover: [ { type: 'tree', on: ['grass'], density: 0.10 }, { type: 'crate', on: ['concrete'], density: 0.015 }, { type: 'barrel', on: ['metal'], density: 0.03 }, { type: 'barrel', on: ['concrete'], density: 0.008 } ] },

  { name: 'xeno', display: 'Xeno — alien world', cols: 72, rows: 54, base: 'moss', seed: 55,
    patches: [ { key: 'crystal', count: 5, minR: 3, maxR: 5 }, { key: 'water', count: 2, minR: 2, maxR: 4 }, { key: 'lava', count: 2, minR: 2, maxR: 4 }, { key: 'ash', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'alien_pod', on: ['moss'], density: 0.04 }, { type: 'alien_pod', on: ['crystal'], density: 0.04 }, { type: 'boulder', on: ['crystal'], density: 0.10 }, { type: 'dead_tree', on: ['ash'], density: 0.05 } ] },

  { name: 'bog', display: 'Bog — sunken swamp', cols: 70, rows: 52, base: 'mud', seed: 66,
    patches: [ { key: 'water', count: 7, minR: 3, maxR: 6 }, { key: 'foliage', count: 4, minR: 3, maxR: 5 }, { key: 'grass', count: 2, minR: 2, maxR: 4 } ],
    cover: [ { type: 'dead_tree', on: ['mud'], density: 0.05 }, { type: 'dead_tree', on: ['foliage'], density: 0.06 }, { type: 'boulder', on: ['mud'], density: 0.015 }, { type: 'tree', on: ['grass'], density: 0.08 } ] },
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
