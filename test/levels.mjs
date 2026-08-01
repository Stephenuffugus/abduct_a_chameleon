/* LEVEL DESIGN MEASURING STICK — authored maps vs the generator.
 *
 *   cd test && node levels.mjs [../abduct-3d.html] [randomSeeds]
 *
 * The Director likes downtown and ruins and calls the random maps trash. This
 * says WHY, in numbers, by running window.__aac3dLevel() against the REAL built
 * world (the solids array buildWorld produced, the real targetTonesAt) rather
 * than a re-implementation of the rules — which is how the last generator got
 * certified while sealing 91% of maps.
 *
 * The column that matters most is TWO-TONE: the fraction of walkable ground
 * where a hider stands beside cover whose colour differs from the ground under
 * them. That is the fraction of the map on which the game's central decision
 * exists. Everywhere else one tap of MATCH GROUND is a perfect answer.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const SEEDS = +(process.argv[3] || 8);
const ROOT = path.dirname(GAME);

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.log('levels: puppeteer not installed - SKIPPED'); process.exit(0); }

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
const url = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
         '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 600, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
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

const AUTHORED = JSON.parse(fs.readFileSync(path.join(ROOT, 'maps/levels.json'), 'utf8'))
  .map(l => (l.file || '').replace(/^maps\//, '').replace(/\.json$/, '')).filter(Boolean);

const rows = [];
for (const name of AUTHORED) {
  try {
    await page.evaluate(n => window.__aac3dLoadMap(n), name);
    await new Promise(r => setTimeout(r, 1400));
    rows.push({ kind: 'authored', ...(await page.evaluate(() => window.__aac3dLevel(0.5))) });
  } catch (e) { console.log(`  (${name} failed: ${String(e).slice(0,80)})`); }
}
for (let i = 0; i < SEEDS; i++) {
  await page.evaluate(s => { const m = window.__aac3dMakeMap ? window.__aac3dMakeMap(s) : null;
    if (m) window.__aac3dSetMap(m); }, 1000 + i * 7919).catch(()=>{});
  await new Promise(r => setTimeout(r, 1400));
  rows.push({ kind: 'random', ...(await page.evaluate(() => window.__aac3dLevel(0.5))) });
}

const f = (v, w) => String(v).padStart(w);
console.log('\n' + 'map'.padEnd(16) + f('walls',6) + f('objs',6) + f('tgts',6) +
  f('regions',8) + f('strand',7) + f('coverMed',9) + f('far>6m',8) + f('TWO-TONE',9));
console.log('-'.repeat(76));
const show = r => console.log(String(r.map).slice(0,15).padEnd(16) + f(r.walls,6) + f(r.objects,6) +
  f(r.paintTargets,6) + f(r.regions,8) + f(r.strandedSpawns,7) + f(r.coverDist.median,9) +
  f((r.farFromCoverPct*100).toFixed(0)+'%',8) + f((r.twoToneOpportunity*100).toFixed(0)+'%',9));
for (const r of rows.filter(r => r.kind === 'authored')) show(r);
console.log('-'.repeat(76));
for (const r of rows.filter(r => r.kind === 'random')) show(r);

const avg = (rs, k) => rs.length ? (rs.reduce((a,b)=>a+k(b),0)/rs.length) : 0;
const A = rows.filter(r=>r.kind==='authored'), R = rows.filter(r=>r.kind==='random');
console.log('\nAVERAGES        walls  two-tone  far>6m  stranded');
for (const [n, rs] of [['authored', A], ['random  ', R]]) {
  if (!rs.length) continue;
  console.log(`  ${n}      ${avg(rs,r=>r.walls).toFixed(0).padStart(5)}` +
    `   ${(avg(rs,r=>r.twoToneOpportunity)*100).toFixed(0).padStart(5)}%` +
    `   ${(avg(rs,r=>r.farFromCoverPct)*100).toFixed(0).padStart(4)}%` +
    `   ${avg(rs,r=>r.strandedSpawns).toFixed(2).padStart(5)}`);
}
if (errs.length) console.log('\nJS errors: ' + errs.slice(0,3).join(' | '));
await browser.close(); srv.close();
