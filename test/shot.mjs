/* Screenshot probe: what does the player ACTUALLY see?
 * node shot.mjs <game.html> <outdir> [width] [height]
 * Boots the real game in headless Chrome + swiftshader, gets past the lobby,
 * shoots: (1) the hider view, (2) the paint studio open.
 * Also reports how much of the viewport the paint panel eats.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

const GAME = path.resolve(process.argv[2]);
const OUT = path.resolve(process.argv[3] || '.');
const W = +(process.argv[4] || 932), H = +(process.argv[5] || 430);
const ROOT = path.dirname(GAME);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css','.webp':'image/webp' };
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
await page.setViewport({ width: W, height: H, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

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

const tag = `${W}x${H}`;
await page.screenshot({ path: path.join(OUT, `01-hider-${tag}.png`) });

const before = await page.evaluate(() => {
  const p = document.getElementById('paint'); const t = document.getElementById('tPaint');
  if (t) t.click();
  const b = p.getBoundingClientRect();
  return { panel: { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) },
           vw: innerWidth, vh: innerHeight,
           coverPct: Math.round(100 * (b.width * b.height) / (innerWidth * innerHeight)),
           view: (document.getElementById('viewmode') || {}).textContent };
});
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, `02-paint-${tag}.png`) });

console.log(JSON.stringify({ tag, ...before, errors: errors.slice(0, 3) }, null, 1));
await browser.close(); srv.close();
