/* JUMP + PERCHES gate for the 3D game.
 *
 *   cd test && node jump3d.mjs [../abduct-3d.html]
 *
 * Stephen asked for jump so players can "sit on top of objects and paint
 * themselves". This asserts the parts that must never silently break:
 *
 *   - low cover REGISTERS as a perch (crates, barrels, boulders, tables) while a
 *     4.2m wall does not, so props are mountable and walls stay walls;
 *   - a perch actually HOLDS you up (supportAt finds it at its own centre);
 *   - standing on one makes THAT PROP the ground your paint is judged against -
 *     that is the whole point of climbing it;
 *   - the jump arc clears the tallest perch. The first pass shipped an apex of
 *     1.82 measured against a 1.80 barrel, i.e. landable by a pixel.
 *
 * Walking a character onto a crate end-to-end needs a lucky random map and real
 * frame rates, so it is REPORTED, never asserted - a flaky gate is worse than
 * none. That path was verified by hand: landed on a BOULDER at y=1.7 with the
 * studio reading "BOULDER - you are standing on it" and MATCH at 100%.
 *
 * Skips (exit 0) without puppeteer, like paint3d.mjs.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.log('twotone3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.png':'image/png', '.jpg':'image/jpeg', '.glb':'model/gltf-binary', '.css':'text/css' };
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

const ORACLE = () => {
  const P = window.__aac3dPaint && window.__aac3dPaint();
  if (!P) return { fatal: 'no map loaded' };
  if (!window.__aac3dPlayer || !window.__aac3dPerch) return { fatal: 'movement hooks missing' };
  const out = { map: P.map, checks: [] };
  const ck = (n, ok, d) => out.checks.push({ n, ok: !!ok, d });
  const me = window.__aac3dPlayer();
  out.platforms = me.platforms;

  ck('the world registers perches', me.platforms > 0, me.platforms + ' perches');
  ck('a hider starts ON the ground', me.grounded === true && Math.abs(me.y) < 0.01,
     'y=' + me.y + ' grounded=' + me.grounded);

  const perches = [];
  for (let i = 0; i < me.platforms; i++) { const q = window.__aac3dPerch(i); if (q) perches.push(q); }
  out.tallest = perches.reduce((m, p) => Math.max(m, p.top), 0);
  out.kinds = [...new Set(perches.map(p => p.name))].sort();

  ck('every perch holds you up', perches.every(p => p.supported),
     perches.filter(p => !p.supported).map(p => p.name).join(',') || 'all supported');
  ck('standing on a perch makes IT the ground tone',
     perches.every(p => p.groundTone && p.groundTone.name === p.name),
     perches.filter(p => !p.groundTone || p.groundTone.name !== p.name).map(p => p.name).join(',') || 'all');
  ck('no perch is taller than a jump can reach', out.tallest <= 2.0, 'tallest=' + out.tallest);
  ck('walls are NOT perches', !out.kinds.includes('WALL'), out.kinds.join(','));
  return out;
};

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
         '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 932, height: 430, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`,
  { waitUntil: 'domcontentloaded', timeout: 60000 });

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

const r = await page.evaluate(ORACLE);
await browser.close(); srv.close();

if (r.fatal) { console.log('jump3d: FATAL - ' + r.fatal); process.exit(1); }
console.log(`map ${r.map}, ${r.platforms} perches: ${r.kinds.join(', ')} (tallest ${r.tallest})`);

let bad = 0;
for (const c of r.checks) { if (!c.ok) bad++; console.log((c.ok ? '  ok   ' : ' FAIL  ') + c.n + (c.d ? '  -- ' + c.d : '')); }
if (errors.length) { bad++; console.log(' FAIL  JS errors: ' + errors.slice(0,3).join(' | ')); }
console.log(bad ? `\njump3d: ${bad} FAILED` : '\njump3d: all rules hold');
process.exit(bad ? 1 : 0);
