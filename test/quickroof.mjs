/* Fast single-page check: are canopies being generated, and how much of the map
 * do they actually roof? The full levels.mjs table walks 12 authored maps and is
 * slow under swiftshader; this reuses one page for a few random seeds. */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const ROOT = path.dirname(GAME);
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css' };
const srv = await new Promise(r => { const s = http.createServer((q,p) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/' + path.basename(GAME);
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { p.writeHead(404); return p.end(); }
  p.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  fs.createReadStream(f).pipe(p); }); s.listen(0, '127.0.0.1', () => r(s)); });
const b = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const p = await b.newPage();
await p.setViewport({ width:900, height:600, deviceScaleFactor:1 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`,
  { waitUntil:'domcontentloaded', timeout:90000 });
for (let i=0, d=false; i<40 && !d; i++) {
  for (const f of p.frames()) {
    try { if (await f.evaluate(() => { const x = [...document.querySelectorAll('button,div')]
      .find(e => /^\s*launch\s*$/i.test(e.textContent||'')); if (x) { x.click(); return true; } return false; })) { d = true; break; } }
    catch {}
  }
  if (!d) await new Promise(r => setTimeout(r, 500));
}
await new Promise(r => setTimeout(r, 3000));
for (const id of ['howtoGo','tapStart']) {
  try { await p.evaluate(i => { const e = document.getElementById(i);
    if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
}
await new Promise(r => setTimeout(r, 5000));
for (let i = 0; i < 4; i++) {
  await p.evaluate(s => window.__aac3dSetMap(window.__aac3dMakeMap(s)), 2000 + i * 4111);
  await new Promise(r => setTimeout(r, 1600));
  const L = await p.evaluate(() => window.__aac3dLevel(0.9));
  const cn = L.byType.canopy || 0;   // __aac3dLevel already counts MAP.objects by type
  console.log(`${String(L.map).padEnd(14)} objs=${String(L.objects).padStart(4)} canopies=${String(cn).padStart(3)}` +
    `  ROOFED=${String((L.overheadCoverPct*100).toFixed(0)+'%').padStart(4)}` +
    `  twoTone=${String((L.twoToneOpportunity*100).toFixed(0)+'%').padStart(4)}` +
    `  regions=${L.regions} stranded=${L.strandedSpawns}` +
    `  losMeshes=${L.losMeshes} hasLOS=${L.losCastMs}ms`);
}
if (errs.length) console.log('JS errors:', errs.slice(0,2).join(' | '));
await b.close(); srv.close();
