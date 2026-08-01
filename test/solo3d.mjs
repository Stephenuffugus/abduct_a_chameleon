/* SOLO FAIRNESS gate for abduct-3d.html
 *
 *   cd test && node solo3d.mjs [../abduct-3d.html]
 *
 * The Director, 2026-08-02: "when i go to play as a hider with just an AI i
 * literally start off being abducted so i can[t] even try the paint which is
 * most of the game." Measured before the fix, with a player who WALKS (which is
 * what you do while looking for a spot): first abduction at 20.4s, 30.1s, 72.4s.
 *
 * A solo player cannot outrun the hunter - HIDER_SPEED 10 vs a chase at
 * UFO_SPEED*0.8 = 14.4 - so camouflage is the ONLY escape, and the round has to
 * give them time to paint one. This gate asserts that it does:
 *
 *   1. HEAD START EXISTS and the bot is passive during it (high, no beam).
 *   2. A walking player is NOT caught during the head start. This is the exact
 *      failure that was reported, reproduced as a test.
 *   3. Painting cannot be punished by the LOCK: with the studio open the lock
 *      never builds. It is not a shield either - the beam ejects you.
 *   4. The beam draws a ground ring, so the catch radius is visible.
 *   5. The first-ever head start is longer than the repeat one.
 *
 * Skips cleanly (exit 0) without puppeteer.
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
catch { console.log('solo3d: puppeteer not installed - SKIPPED'); process.exit(0); }

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
await page.setViewport({ width: 932, height: 430, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
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

const bad = [];
const bot = () => page.evaluate(() => window.__aac3dBot && window.__aac3dBot());
const say = (ok, msg) => { if (!ok) bad.push(msg); return ok; };

let b = await bot();
if (!b) { console.log('solo3d: window.__aac3dBot missing'); process.exit(1); }

/* 1 + 5: the head start exists, and the first one is the generous one */
say(b.grace > 0, `no head start at all (grace ${b.grace}s) - this is the reported bug`);
say(b.graceFirst > b.graceAfter,
  `the first head start (${b.graceFirst}s) is not longer than repeats (${b.graceAfter}s)`);
const graceAtStart = b.grace;

/* the bot must be passive and high while the head start runs */
say(b.exists && !b.beaming, 'the bot is beaming during the head start');
say(!b.exists || b.alt > 20, `the bot is at altitude ${b.alt} during the head start - it should stand off high`);

/* 2: WALK for 20 seconds - the exact behaviour that got caught at 20.4s - and
      assert the head start held. */
await page.keyboard.down('KeyW');
const t0 = Date.now();
let caughtDuringGrace = false, minLock = 0;
while ((Date.now() - t0) / 1000 < 20) {
  await new Promise(r => setTimeout(r, 500));
  const s = await bot();
  if (s.catches > 0) { caughtDuringGrace = true; break; }
  minLock = Math.max(minLock, s.lock || 0);
}
await page.keyboard.up('KeyW');
say(!caughtDuringGrace, 'ABDUCTED WHILE WALKING INSIDE THE HEAD START - the reported bug is back');
say(minLock === 0, `the abduction lock reached ${minLock} during the head start`);

/* 3: painting must never be punished by the lock. End the grace, warm the bot
      up, park the player, open the studio and hold it open. */
await page.evaluate(() => { window.__aac3dBot('endGrace'); window.__aac3dBot('warmUp'); });
await page.evaluate(() => { const t = document.getElementById('tPaint'); if (t) t.click(); });
/* park it on top of us with a magenta coat: standing still to paint makes you
   HIDDEN, which is the whole point, so the dangerous case has to be staged or it
   is never exercised and the eject branch ships untested. */
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => window.__aac3dBot('provoke'));
const t1 = Date.now();
let lockWhilePainting = 0, sawEject = false, sawRing = false, sawBeam = false, reopened = 0;
while ((Date.now() - t1) / 1000 < 30) {
  await new Promise(r => setTimeout(r, 400));
  const s = await page.evaluate(() => {
    const st = window.__aac3dBot();
    return Object.assign(st, { paintOpen: !document.getElementById('paint').classList.contains('hidden') });
  });
  if (s.beaming) sawBeam = true;
  if (s.ringOn) sawRing = true;
  if (s.paintOpen) lockWhilePainting = Math.max(lockWhilePainting, s.lock || 0);
  if (sawBeam && !s.paintOpen && reopened < 3) {           // the beam ejected us: prove it, then go again
    sawEject = true; reopened++;
    await page.evaluate(() => { const t = document.getElementById('tPaint'); if (t) t.click();
      window.__aac3dBot('provoke'); });
  }
  if (sawBeam && sawRing && sawEject) break;
}
say(lockWhilePainting === 0,
  `the abduction lock built to ${lockWhilePainting} while the paint studio was OPEN - painting must never be punished by the lock`);
if (sawBeam) {
  say(sawRing, 'the bot beamed without drawing a ground ring - the catch radius is invisible');
  say(sawEject, 'the beam did not eject the player from the studio - painting is a shield, which it must not be');
} else {
  console.log('   (note: the bot never got a beam on the player even when provoked - eject/ring unproven this run)');
}

if (errors.length) bad.push('JS errors: ' + errors.slice(0, 3).join(' | '));

const fin = await bot();
if (bad.length) { console.log('FAIL solo3d'); bad.forEach(x => console.log('   - ' + x)); }
else console.log(`ok   solo3d  head start ${graceAtStart.toFixed(0)}s (first ${fin.graceFirst}s / repeat ${fin.graceAfter}s), ` +
  `survived a 20s walk inside it, lock 0 while painting` +
  (sawBeam ? `, beam ejects + rings` : '') + `, tier ${fin.tier}`);

await browser.close(); srv.close();
process.exit(bad.length ? 1 : 0);
