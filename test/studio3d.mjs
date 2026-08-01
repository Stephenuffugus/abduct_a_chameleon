/* PAINT STUDIO v2 acceptance gate — abduct-3d.html
 *
 *   cd test && node studio3d.mjs [../abduct-3d.html]
 *
 * paint3d.mjs proved the studio FITS and both exits are reachable. That was not
 * enough: on 2026-08-01 it fit perfectly and was still unusable, because the dock
 * ate 55% of the screen and setPaintOpen slammed the camera to the top-down sky
 * view, so the character you were painting rendered on ZERO pixels. The Director
 * could not test his own game.
 *
 * This gate asserts the things that make it USABLE, which are different from the
 * things that make it reachable:
 *
 *   - the dock leaves the majority of the screen to the character (<= 34%)
 *   - the character is actually ON SCREEN and reasonably large while painting
 *   - dragging ON the body PAINTS it (raycast -> intersect.uv -> the 128px skin)
 *   - dragging OFF the body ORBITS instead of painting
 *   - the four camera presets change the view, and SKY still gives the hunter's
 *     straight-down grading view
 *   - your own body stays OPAQUE in the studio (stillness drives camo to 1 while
 *     you stand there painting, which used to fade you to 16% - the better your
 *     paint, the less you could see of it)
 *   - the flat map is cut to the real body silhouette instead of a blank square
 *
 * Skips cleanly (exit 0) without puppeteer, same as its siblings.
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
catch { console.log('studio3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const VIEWPORTS = [[932, 430], [844, 390], [667, 375], [1280, 800]];
const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css' };

const serve = () => new Promise(res => {
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

/* Runs INSIDE the page. Returns measurements, never verdicts.
 * ⛔ Every camera and opacity value here is written by the RENDER LOOP, not by the
 * click handler. The first version of this gate read them synchronously and got
 * the previous frame's numbers - it reported SKY as "not overhead" and the body
 * as 70% opaque when both were already correct. Await real frames. */
const MEASURE = async () => {
  const $ = id => document.getElementById(id);
  const frame = (n = 2) => new Promise(res => {
    const step = () => (--n <= 0 ? res() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  const vw = innerWidth, vh = innerHeight;
  const S = window.__aac3dStudio;
  if (!S) return { fatal: 'window.__aac3dStudio missing (the studio has no probe)' };
  if (!$('tPaint') || !$('paint')) return { fatal: 'touch UI or paint panel missing' };

  $('tPaint').click();
  await frame(4);
  const p = $('paint'), pr = p.getBoundingClientRect();
  const out = { vw, vh,
    dockPct: Math.round(100 * (pr.width * pr.height) / (vw * vh)),
    dockW: Math.round(pr.width) };

  /* Where is the body on screen, and how big? Projecting the rig's bounding box
     is the only honest answer - "the camera is pointed at it" is not the same as
     "it is visible", which is exactly the bug this gate exists for. */
  const box = S.bodyScreenBox();
  out.body = box;
  out.bodyOnScreen = !!box && box.w > 0 && box.h > 0 &&
    box.cx > 0 && box.cx < vw && box.cy > 0 && box.cy < vh;
  /* it must not be hiding UNDER the dock either */
  out.bodyClearOfDock = !!box && box.cx < pr.left;
  out.bodyHeightPct = box ? Math.round(100 * box.h / vh) : 0;

  /* PAINT ON THE MODEL: aim at the body's own centre and drag. */
  const before = S.skinSignature();
  out.paintedOnModel = box ? S.pokeAt(box.cx, box.cy) : false;
  out.skinChanged = S.skinSignature() !== before;

  /* ORBIT OFF THE MODEL: a drag in empty space must turn the camera, not paint. */
  const yaw0 = S.state().yaw;
  const before2 = S.skinSignature();
  const emptyX = Math.max(4, Math.min(box ? box.cx - box.w : 20, pr.left - 20));
  out.orbitHitBody = S.pokeAt(emptyX, 12);          // near the top edge: sky, not body
  S.drag(emptyX, 12, emptyX + 120, 12);
  out.yawTurned = Math.abs(S.state().yaw - yaw0) > 0.15;
  out.orbitDidNotPaint = S.skinSignature() === before2;

  /* the four presets */
  const seen = {};
  for (const v of ['front', 'side', 'back', 'sky']) {
    const b = [...$('paintViews').children].find(x => x.dataset.v === v);
    b.click();
    await frame(3);
    const st = S.state();
    const bx = S.bodyScreenBox();
    seen[v] = { view: st.view, camY: Math.round(st.camY), yaw: +st.yaw.toFixed(2),
                bodyH: bx ? Math.round(100 * bx.h / vh) : 0, op: S.selfOpacity() };
  }
  out.presets = seen;
  out.skyIsOverhead = seen.sky.camY > seen.front.camY + 3;
  /* ⛔ "overhead" is not the same as "readable": at UFO_MIN_ALT+10 the body was
     7% of the screen, a dot you cannot judge a paint job by. */
  out.skyReadable = seen.sky.bodyH >= 12;
  /* SKY answers "what does the hunter see", so it must NOT be forced opaque the
     way the working views are - otherwise the one honest view lies. */
  out.skyTellsTruth = seen.sky.op <= seen.front.op;
  out.presetsDiffer = new Set(['front','side','back'].map(v => seen[v].yaw)).size === 3;

  [...$('paintViews').children].find(x => x.dataset.v === 'front').click();
  await frame(3);

  /* opacity: stand still long enough and camo climbs; the mirror must not fade */
  out.selfOpacity = S.selfOpacity();
  out.camo = +S.state().camo.toFixed(2);

  /* the flat map must be a BODY, not a square */
  out.maskCoverage = S.maskCoverage();

  /* zoom */
  const d0 = S.state().dist;
  S.wheel(emptyX, Math.round(vh / 2), -240);
  await frame(2);
  out.zoomedIn = S.state().dist < d0 - 0.05;

  $('paintDone').click();
  await frame(2);
  out.closed = p.classList.contains('hidden');
  out.bodyClassCleared = !document.body.classList.contains('painting');
  return out;
};

const srv = await serve();
const url = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
let failures = 0;

for (const [w, h] of VIEWPORTS) {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
           '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const touch = h < 700;
  await page.setViewport({ width: w, height: h, isMobile: touch, hasTouch: touch, deviceScaleFactor: 1 });
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
  /* desktop has no touch column, so the 🎨 button is hidden - the gate drives the
     same door a keyboard player uses */
  if (!touch) await page.evaluate(() => { document.getElementById('touchUI').classList.remove('hidden'); });

  const m = await page.evaluate(MEASURE);
  const bad = [];
  if (m.fatal) bad.push(m.fatal);
  else {
    if (m.dockPct > 34) bad.push(`the dock eats ${m.dockPct}% of the screen (was 55% - the bug); budget is 34%`);
    if (!m.bodyOnScreen) bad.push(`YOUR CHARACTER IS NOT ON SCREEN while painting it: ${JSON.stringify(m.body)}`);
    if (!m.bodyClearOfDock) bad.push('the character renders under the dock');
    if (m.bodyHeightPct < 18) bad.push(`the character is only ${m.bodyHeightPct}% of screen height - too small to paint`);
    if (!m.paintedOnModel) bad.push('a tap on the body did not hit it (raycast/uv failed)');
    if (!m.skinChanged) bad.push('painting on the model did NOT change the body skin');
    if (m.orbitHitBody) bad.push('the "empty space" probe hit the body - the orbit test is invalid');
    if (!m.yawTurned) bad.push('dragging empty space did not orbit the camera');
    if (!m.orbitDidNotPaint) bad.push('dragging empty space PAINTED - orbit and brush are not separated');
    if (!m.presetsDiffer) bad.push(`front/side/back do not give three different angles: ${JSON.stringify(m.presets)}`);
    if (!m.skyIsOverhead) bad.push(`SKY is not an overhead view: ${JSON.stringify(m.presets)}`);
    if (!m.skyReadable) bad.push(`SKY renders the body at ${m.presets.sky.bodyH}% of screen height - too small to judge a paint job by`);
    if (!m.skyTellsTruth) bad.push(`SKY forces your body opaque (${m.presets.sky.op}) - the view that exists to show what the hunter sees is lying`);
    if (m.selfOpacity < 0.99) bad.push(`your own body is ${Math.round(m.selfOpacity*100)}% opaque in the studio - you cannot see your own paint`);
    if (!(m.maskCoverage > 0.05 && m.maskCoverage < 0.92))
      bad.push(`the flat map silhouette covers ${Math.round(m.maskCoverage*100)}% - it is a square (or empty), not a body`);
    if (!m.zoomedIn) bad.push('zoom did nothing');
    if (!m.closed) bad.push('DONE did not close the studio');
    if (!m.bodyClassCleared) bad.push('body.painting stuck on after close');
  }
  if (errors.length) bad.push('JS errors: ' + errors.slice(0, 3).join(' | '));

  if (bad.length) { failures++; console.log(`FAIL ${w}x${h}`); bad.forEach(b => console.log('   - ' + b)); }
  else console.log(`ok   ${w}x${h}  dock ${m.dockW}px/${m.dockPct}%, body ${m.body.w}x${m.body.h} at ` +
    `(${m.body.cx},${m.body.cy}) = ${m.bodyHeightPct}% tall, model-paint ✓, orbit ✓, ` +
    `silhouette ${Math.round(m.maskCoverage*100)}%, opacity ${m.selfOpacity}`);

  await browser.close();
}

srv.close();
console.log(failures ? `\nstudio3d: ${failures} viewport(s) FAILED` : '\nstudio3d: all viewports pass');
process.exit(failures ? 1 : 0);
