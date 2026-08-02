/* Balance probe (not a gate): how does the solo hunter treat two kinds of player
 * at FULL difficulty, with the head start already spent?
 *   WALKER  - keeps moving, never paints. Should get caught: moving is the one
 *             thing that always gives you away.
 *   PAINTER - taps MATCH GROUND, then stands still. Should survive: that is the
 *             entire promise of the game.
 * node balance.mjs ../abduct-3d.html <secs> <mode>
 */
import http from 'http'; import fs from 'fs'; import path from 'path'; import puppeteer from 'puppeteer';
const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const SECS = +(process.argv[3] || 90), MODE = process.argv[4] || 'walk';
const ROOT = path.dirname(GAME);
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css' };
const srv = await new Promise(res => { const s = http.createServer((req, rq) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/' + path.basename(GAME);
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end(); }
  rq.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  fs.createReadStream(f).pipe(rq); }); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const browser = await puppeteer.launch({ headless:'new', args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width:932, height:430, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
await page.goto(url, { waitUntil:'domcontentloaded', timeout:60000 });
/* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await page.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for (let i=0, done=false; i<40 && !done; i++) {
  if(await _pastVendor()) break; for (const f of page.frames()) {
  try { if (await f.evaluate(() => { const b=[...document.querySelectorAll('button,div')]
    .find(x=>/^\s*launch\s*$/i.test(x.textContent||'')); if(b){b.click();return true;} return false; })) { done=true; break; } } catch {} }
  if (!done) await new Promise(r=>setTimeout(r,500)); }
await new Promise(r=>setTimeout(r,2500));
for (const id of ['howtoGo','tapStart']) { try { await page.evaluate(i=>{ const e=document.getElementById(i);
  if(e && getComputedStyle(e).display!=='none') e.click(); }, id); } catch {} }
await new Promise(r=>setTimeout(r,4000));

if (MODE === 'paint') {                       // find a spot, coat yourself, hold still
  await page.keyboard.down('KeyW'); await new Promise(r=>setTimeout(r,2500)); await page.keyboard.up('KeyW');
  await page.evaluate(() => { document.getElementById('tPaint').click(); });
  await new Promise(r=>setTimeout(r,600));
  await page.evaluate(() => { document.getElementById('matchBtn').click();
    const mc=document.getElementById('matchCoverBtn');
    if (mc && getComputedStyle(mc).display!=='none') mc.click();
    document.getElementById('paintDone').click(); });
}
await page.evaluate(()=>{ window.__aac3dBot('endGrace'); window.__aac3dBot('warmUp'); });
const t0 = Date.now(); let caught = [], peakLock = 0, sawChase = false, minDist = 999, camo = 0;
if (MODE === 'walk') await page.keyboard.down('KeyW');
while ((Date.now()-t0)/1000 < SECS) {
  await new Promise(r=>setTimeout(r,400));
  const s = await page.evaluate(()=>window.__aac3dBot());
  if (s.state === 'chase') sawChase = true;
  peakLock = Math.max(peakLock, s.lock||0); minDist = Math.min(minDist, s.dist||999); camo = s.camo;
  if (s.catches > caught.length) caught.push(+((Date.now()-t0)/1000).toFixed(1));
}
if (MODE === 'walk') await page.keyboard.up('KeyW');
console.log(JSON.stringify({ mode:MODE, secs:SECS, caught, sawChase, peakLock:+peakLock.toFixed(2),
  minDist:+minDist.toFixed(1), camo }));
await browser.close(); srv.close();
