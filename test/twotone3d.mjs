/* TWO-TONE CAMO oracle for the 3D game — the sibling of twotone.mjs (2D P8).
 *
 *   cd test && node twotone3d.mjs [../abduct-3d.html]
 *
 * Asserts the model's rules against the REAL engine through window.__aac3dCamo,
 * which computes what a hypothetical paint job scores at a point. That means the
 * rules are checked without walking a character across a map, and a regression
 * in the weights fails here instead of in a playtest.
 *
 * The rules, carried over from the 2D model Stephen already playtested:
 *   1. One tone (open ground) → a split does NOTHING. Yesterday's calibration is
 *      untouched and a flood-fill still reads 100%.
 *   2. Beside cover you are seen against the cover AND the ground, so a single
 *      colour is TAXED. That tax is the whole decision; if it disappears, paint
 *      is a solved problem again.
 *   3. A two-tone coat beats every single colour and can reach ~100%.
 *   4. Two colours can NEVER score worse than one, so experimenting is safe.
 *   5. Which half wears which tone does not matter — each tone is scored by the
 *      half closest to it, so the player is never asked to solve a mapping.
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
  if (!P.sample) return { fatal: 'map has no paint targets to stand beside' };
  if (!window.__aac3dCamo) return { fatal: 'window.__aac3dCamo missing (oracle hook removed?)' };

  const t = P.sample, C = window.__aac3dCamo;
  const FAR = 400;                                   // comfortably outside any target radius
  const out = { map: P.map, targets: P.targets, checks: [] };
  const ck = (n, ok, d) => out.checks.push({ n, ok: !!ok, d });

  // rule 1 — open ground is a single tone and a split is inert
  const far = C(t.x + FAR, t.z + FAR, '#000000', '#000000');
  ck('open ground = one tone', far.tones.length === 1, JSON.stringify(far.tones));
  ck('split inert on one tone', far.split === false);
  const g = far.tones[0].hex;
  ck('flood-fill on open ground = 100%', C(t.x + FAR, t.z + FAR, g, g).mq >= 0.99);

  // rule 2/3 — beside cover, one colour is taxed and two colours fix it
  const on = C(t.x, t.z, '#000000', '#000000');
  ck('beside cover = two tones', on.tones.length === 2, JSON.stringify(on.tones));
  ck('second tone engages', on.split === true, 'w2=' + (on.tones[1] || {}).w);
  const cov = (on.tones.filter(x => x.kind === 'cover')[0] || {}).hex;
  const gnd = (on.tones.filter(x => x.kind === 'ground')[0] || {}).hex;
  const bestFlood = Math.max(C(t.x, t.z, gnd, gnd).mq, C(t.x, t.z, cov, cov).mq);
  const split = C(t.x, t.z, cov, gnd).mq;
  out.scores = { bestFlood: +bestFlood.toFixed(3), split: +split.toFixed(3) };
  ck('a single colour is TAXED beside cover', bestFlood < 0.95, 'bestFlood=' + bestFlood.toFixed(3));
  ck('two-tone beats every single colour', split > bestFlood + 0.05,
     split.toFixed(3) + ' vs ' + bestFlood.toFixed(3));
  ck('two-tone reaches ~100%', split >= 0.95, split.toFixed(3));

  // rule 5 — the halves are interchangeable
  ck('halves swapped score identically', Math.abs(C(t.x, t.z, gnd, cov).mq - split) < 1e-3);

  // rule 4 — two colours never worse than one, swept
  const PAL = ['#ff0000','#00ff00','#0000ff','#ffffff','#101010','#8040c0', cov, gnd];
  let worse = 0, n = 0;
  for (const a of PAL) for (const b of PAL) { const r = C(t.x, t.z, a, b); n++; if (r.mq + 1e-9 < r.single) worse++; }
  ck(`two colours never worse than one (${n} combos)`, worse === 0, worse + ' regressions');
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

/* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await page.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for (let i = 0, done = false; i < 40 && !done; i++) {
  if(await _pastVendor()) break;
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

if (r.fatal) { console.log('twotone3d: FATAL - ' + r.fatal); process.exit(1); }
console.log(`map ${r.map}, ${r.targets} paint targets`);
console.log(`beside cover: best single colour ${r.scores.bestFlood}, two-tone ${r.scores.split}`);
let bad = 0;
for (const c of r.checks) { if (!c.ok) bad++; console.log((c.ok ? '  ok   ' : ' FAIL  ') + c.n + (c.d ? '  -- ' + c.d : '')); }
if (errors.length) { bad++; console.log(' FAIL  JS errors: ' + errors.slice(0,3).join(' | ')); }
console.log(bad ? `\ntwotone3d: ${bad} FAILED` : '\ntwotone3d: all rules hold');
process.exit(bad ? 1 : 0);
