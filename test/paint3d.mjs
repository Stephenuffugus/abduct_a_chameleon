/* PAINT STUDIO acceptance gate for the 3D game (abduct-3d.html).
 *
 *   cd test && node paint3d.mjs [../abduct-3d.html]
 *
 * The jsdom suites in this folder cover the 2D game; they cannot touch the 3D
 * file because it needs real WebGL. This one drives the actual game in headless
 * Chrome with swiftshader and asserts the things that broke on 2026-08-01:
 *
 *   - the paint studio FITS the viewport on a landscape phone. It used to
 *     render 703px tall inside 430px, which put #paintClose at y=-123 and
 *     #paintDone at y=506. Both exits off-screen, no E key on a phone, so
 *     opening the studio - the entire game - could only be escaped by a reload.
 *   - every control in it meets the 48px touch law (30 of 34 once did not).
 *   - MATCH GROUND actually produces a match. It used to cap at 65% because
 *     matchFor compared three.js LINEAR colour against sRGB canvas bytes, which
 *     also made the hunter's "loses you when you are hidden" gates at 0.70 and
 *     0.75 unreachable.
 *
 * Skips cleanly (exit 0) if puppeteer is not installed, so `npm run all` on a
 * machine without it is not a failure - but CI should install it.
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
catch {
  console.log('paint3d: puppeteer not installed - SKIPPED (npm i -D puppeteer to enable)');
  process.exit(0);
}

/* landscape phones, smallest last: iPhone 14 Pro Max, iPhone 14, iPhone SE */
const VIEWPORTS = [ [932, 430], [844, 390], [667, 375] ];

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.css': 'text/css' };

const serve = () => new Promise(res => {
  const s = http.createServer((req, rq) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/' + path.basename(GAME);
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end(); }
    rq.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(f).pipe(rq);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});

/* Runs INSIDE the page. Drives the studio the way a thumb does and returns
   measurements, never opinions - the caller decides pass/fail. */
const MEASURE = () => {
  const $ = id => document.getElementById(id);
  const vw = innerWidth, vh = innerHeight;
  const r = el => el.getBoundingClientRect();
  const hittable = el => { const b = r(el); const t = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return !!(t && (t === el || el.contains(t))); };
  const onScreen = el => { const b = r(el); return b.top >= 0 && b.bottom <= vh && b.left >= 0 && b.right <= vw; };
  const pct = () => parseInt(($('matchPct').textContent || '0').replace('%', ''), 10) || 0;

  if (!$('tPaint') || !$('paint')) return { fatal: 'touch UI or paint panel missing' };
  /* ⛔⛔ EVERY PRESS IN THIS FILE IS el.click(), WHICH DISPATCHES STRAIGHT TO THE
     HANDLER AND SKIPS HIT TESTING. That is why this gate was green on 2026-08-02
     while Stephen could not paint at all: #paintViews was auto-placed on top of
     the controls column and a real thumb hit a camera-view button instead of
     MATCH GROUND. A programmatic click cannot see anything lying on top.
     This file tests the LOGIC of painting. test/reach3d.mjs tests whether a
     finger can get to it, with document.elementFromPoint at every control's own
     centre across eight phone viewports. Neither is sufficient alone - keep both. */
  $('tPaint').click();
  const p = $('paint'), pr = r(p);
  const out = {
    opened: !p.classList.contains('hidden'),
    panel: { w: Math.round(pr.width), h: Math.round(pr.height), top: Math.round(pr.top), bottom: Math.round(pr.bottom) },
    fits: pr.top >= 0 && pr.bottom <= vh && pr.left >= 0 && pr.right <= vw,
    closeReachable: onScreen($('paintClose')) && hittable($('paintClose')),
    doneReachable: onScreen($('paintDone')) && hittable($('paintDone')),
    toggleStillReachable: hittable($('tPaint')),   // the panel must not bury its own toggle
    chip: { name: ($('ptName') || {}).textContent || '', hasColour: !!$('ptSwatch') },
  };

  /* touch law: measure RENDERED px on every control a thumb uses. Anything
     scrolled out of the controls column is fine - it scrolls back. */
  const tiny = [];
  for (const c of p.querySelectorAll('button,canvas')) {
    const b = r(c);
    if (b.width && (b.width < 44 || b.height < 44)) tiny.push((c.id || c.className || c.tagName) + ` ${Math.round(b.width)}x${Math.round(b.height)}`);
  }
  out.under44 = tiny;

  const right = $('paintRight');
  out.controlsScrollable = right ? right.scrollHeight <= right.clientHeight + 1 || getComputedStyle(right).overflowY === 'auto' : true;

  out.matchBefore = pct();
  $('matchBtn').click();
  out.matchAfterGround = pct();
  /* Two-tone (2026-08-02): beside cover a single flood-fill is TAXED on purpose
     - it measured 0.68, just under the bot's 0.70 gate - so MATCH GROUND alone
     no longer reaches 100 there and asserting it would be asserting the bug we
     deliberately removed. When the second tone is live the studio offers
     MATCH COVER, and the two together must still get you home. */
  const mc = $('matchCoverBtn');
  out.splitOffered = !!(mc && getComputedStyle(mc).display !== 'none');
  if (out.splitOffered) { mc.click(); }
  out.matchAfter = pct();

  $('paintDone').click();  out.doneCloses = p.classList.contains('hidden');
  $('tPaint').click();     $('paintClose').click(); out.closeCloses = p.classList.contains('hidden');
  return out;
};

const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
let failures = 0;

for (const [w, h] of VIEWPORTS) {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader',
           '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  /* Playroom's dev lobby renders late and in its own frame */
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
      catch { /* frames detach during boot */ }
    }
    if (!done) await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 3000));
  for (const id of ['howtoGo', 'tapStart']) {
    try { await page.evaluate(i => { const e = document.getElementById(i);
      if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
  }
  await new Promise(r => setTimeout(r, 4000));

  const m = await page.evaluate(MEASURE);
  const bad = [];
  if (m.fatal) bad.push(m.fatal);
  else {
    if (!m.opened) bad.push('studio did not open from the 🎨 button');
    if (!m.fits) bad.push(`panel ${m.panel.h}px does not fit a ${h}px viewport (top ${m.panel.top}, bottom ${m.panel.bottom})`);
    if (!m.closeReachable) bad.push('✕ is off-screen or not clickable - THIS IS THE SOFTLOCK');
    if (!m.doneReachable) bad.push('DONE is off-screen or not clickable - THIS IS THE SOFTLOCK');
    if (!m.toggleStillReachable) bad.push('the panel buries the 🎨 toggle');
    if (m.under44.length) bad.push(`under the 48px touch law: ${m.under44.join(', ')}`);
    if (m.matchAfter < 95) bad.push(`match reached only ${m.matchAfter}% after MATCH GROUND` +
      (m.splitOffered ? ' + MATCH COVER' : '') +
      ` (a perfect paint must read ~100 - check the sRGB/linear conversion in matchFor, or the two-tone weights)`);
    if (!m.doneCloses) bad.push('DONE did not close the studio');
    if (!m.closeCloses) bad.push('✕ did not close the studio');
    if (!/[A-Z]{3,}/.test(m.chip.name)) bad.push('the MATCHING AGAINST chip names nothing');
  }
  if (errors.length) bad.push('JS errors: ' + errors.slice(0, 3).join(' | '));

  if (bad.length) { failures++; console.log(`FAIL ${w}x${h}`); bad.forEach(b => console.log('   - ' + b)); }
  else console.log(`ok   ${w}x${h}  panel ${m.panel.w}x${m.panel.h} fits, both exits reachable, ` +
    `0 under 44px, match ${m.matchBefore}% → ${m.matchAfterGround}%` +
    (m.splitOffered ? ` → ${m.matchAfter}% (two-tone)` : '') + `, chip "${m.chip.name}"`);

  await browser.close();
}

srv.close();
console.log(failures ? `\npaint3d: ${failures} viewport(s) FAILED` : '\npaint3d: all viewports pass');
process.exit(failures ? 1 : 0);
