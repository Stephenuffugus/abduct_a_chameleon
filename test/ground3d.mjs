/* LEVEL GENERATOR acceptance gate for abduct-3d.html
 *
 *   cd test && node ground3d.mjs [../abduct-3d.html] [seeds]
 *
 * A previous structure generator was measured SEALING 91% of maps and stranding
 * hider spawns on 24% of seeds, and nothing caught it until somebody ran a flood
 * fill by hand. This is that flood fill, made permanent, plus the two numbers
 * that decide whether a map is worth playing at all.
 *
 * It runs against the REAL built world via window.__aac3dLevel(): free space is
 * flood filled at 0.5m using the actual blocking predicate (inside any solid's
 * AABB inflated by PLAYER_RADIUS 0.6), not a re-implementation of it.
 *
 * The four rules:
 *   1. NO STRANDED SPAWN. A hider must never begin the round in a sealed pocket.
 *      Hard failure, zero tolerance.
 *   2. THE MAP IS ONE PLACE. The largest free region must hold >=97% of free
 *      space, so no meaningful area is walled off from the rest.
 *   3. THE PAINT MUST HAVE A DECISION. twoToneOpportunity >= 25% of walkable
 *      ground, or one tap of MATCH GROUND solves the whole level.
 *   4. THERE MUST BE SOMEWHERE TO DUCK. overheadCoverPct >= 5%. hasLOS gates the
 *      beam, so a roof is the strongest move a hider has; it was measured at
 *      0.00% on eight of the twelve authored maps, which is why this exists.
 *
 * Skips cleanly (exit 0) without puppeteer.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const SEEDS = +(process.argv[3] || 14);
const ROOT = path.dirname(GAME);

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.log('ground3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css' };
const srv = await new Promise(res => {
  const s = http.createServer((req, rq) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/' + path.basename(GAME);
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end(); }
    rq.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    fs.createReadStream(f).pipe(rq);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
         '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`,
  { waitUntil:'domcontentloaded', timeout:90000 });
for (let i = 0, done = false; i < 40 && !done; i++) {
  for (const f of page.frames()) {
    try { if (await f.evaluate(() => { const b = [...document.querySelectorAll('button,div')]
      .find(x => /^\s*launch\s*$/i.test(x.textContent || '')); if (b) { b.click(); return true; } return false; })) { done = true; break; } }
    catch {}
  }
  if (!done) await new Promise(r => setTimeout(r, 500));
}
await new Promise(r => setTimeout(r, 3000));
for (const id of ['howtoGo','tapStart']) {
  try { await page.evaluate(i => { const e = document.getElementById(i);
    if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
}
await new Promise(r => setTimeout(r, 5000));

const bad = [];
const rows = [];
for (let i = 0; i < SEEDS; i++) {
  const seed = 1000 + i * 7919;
  await page.evaluate(s => window.__aac3dSetMap(window.__aac3dMakeMap(s)), seed);
  await new Promise(r => setTimeout(r, 1500));
  const L = await page.evaluate(() => window.__aac3dLevel(0.5));
  rows.push(L);
  const tag = `seed ${seed} (${L.map})`;
  if (L.strandedSpawns > 0)
    bad.push(`${tag}: ${L.strandedSpawns} of ${L.hiderSpawns} HIDER SPAWNS ARE SEALED OFF`);
  if (L.biggestRegionPct < 0.97)
    bad.push(`${tag}: the map is in pieces - largest free region holds only ${(L.biggestRegionPct*100).toFixed(0)}% of free space (${L.regions} regions)`);
  if (L.twoToneOpportunity < 0.25)
    bad.push(`${tag}: the paint has a decision on only ${(L.twoToneOpportunity*100).toFixed(0)}% of the map - one MATCH GROUND tap solves the level`);
  if (L.overheadCoverPct < 0.05)
    bad.push(`${tag}: only ${(L.overheadCoverPct*100).toFixed(0)}% of the map has anything overhead - nowhere to duck`);
}
if (errs.length) bad.push('JS errors: ' + errs.slice(0,3).join(' | '));

const avg = k => (rows.reduce((a,b)=>a+k(b),0)/Math.max(1,rows.length));
if (bad.length) { console.log(`FAIL ground3d (${SEEDS} seeds)`); bad.slice(0,12).forEach(b => console.log('   - ' + b)); }
else console.log(`ok   ground3d  ${SEEDS} seeds: 0 stranded spawns, one connected map, ` +
  `two-tone ${(avg(r=>r.twoToneOpportunity)*100).toFixed(0)}%, overhead ${(avg(r=>r.overheadCoverPct)*100).toFixed(0)}%, ` +
  `${avg(r=>r.objects).toFixed(0)} objects avg`);

await browser.close(); srv.close();
process.exit(bad.length ? 1 : 0);
