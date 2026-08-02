/* THE ABDUCTION FILES are FOUND, not browsed.
 *
 *   cd test && node files3d.mjs [../abduct-3d.html]
 *
 * This shipped as a library: NEXT walked all 1000 pages from a cold start.
 * Stephen: "i like the story notes but they need to be earned. starting with all
 * 1000 is just dumb and id never want to read them but if i found them each game
 * id read them if displayed as they came."
 *
 * The rules that make it a reward instead of a menu:
 *   1. A NEW PLAYER OWNS NOTHING. The reader must not hand out the archive.
 *   2. WALKING INTO A WRECK GIVES YOU A PAGE, and the card announces it.
 *   3. THE READER ONLY SHOWS WHAT YOU OWN — paging never exceeds your archive.
 *   4. A WRECK PAYS ONCE. Standing on it is not a page printer.
 *   5. IT SURVIVES A RELOAD, and the old key migrates rather than being lost.
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
catch { console.log('files3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const MIME = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css' };
const srv = await new Promise(r => { const s = http.createServer((q, p) => {
  let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/' + path.basename(GAME);
  const f = path.join(ROOT, u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { p.writeHead(404); return p.end(); }
  p.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control':'no-store' });
  fs.createReadStream(f).pipe(p); }); s.listen(0, '127.0.0.1', () => r(s)); });
const url = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
         '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 500, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url, { waitUntil:'domcontentloaded', timeout:90000 });
/* ⛔ THE VENDOR LOBBY IS SKIPPED NOW (insertCoin({skipLobby:true})), so there is no
   "Launch" button to find and this hunt used to burn its full 40 x 500ms fallback in
   EVERY 3D gate - about twenty seconds each, several minutes across the suite, looking
   for a button that no longer exists. Bail the moment our own rules card is up. */
const _pastVendor = async () => { try { return await page.evaluate(()=>{ const h=document.getElementById('howto');
  return !!(h && getComputedStyle(h).display!=='none') || !!window.__aac3dRound; }); } catch { return false; } };
for (let i = 0, d = false; i < 40 && !d; i++) {
  if(await _pastVendor()) break;
  for (const f of page.frames()) {
    try { if (await f.evaluate(() => { const x = [...document.querySelectorAll('button,div')]
      .find(e => /^\s*launch\s*$/i.test(e.textContent||'')); if (x) { x.click(); return true; } return false; })) { d = true; break; } }
    catch {}
  }
  if (!d) await new Promise(r => setTimeout(r, 500));
}
await new Promise(r => setTimeout(r, 3000));
for (const id of ['howtoGo','tapStart']) {
  try { await page.evaluate(i => { const e = document.getElementById(i);
    if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
}
await new Promise(r => setTimeout(r, 5000));

const bad = [];
/* a genuinely new player: no archive on disk */
await page.evaluate(() => { try { localStorage.removeItem('aac3d_files_found');
  localStorage.removeItem('aac3d_files_read'); } catch(e){} });
await page.reload({ waitUntil:'domcontentloaded', timeout:90000 });
for (let i = 0, d = false; i < 40 && !d; i++) {
  for (const f of page.frames()) {
    try { if (await f.evaluate(() => { const x = [...document.querySelectorAll('button,div')]
      .find(e => /^\s*launch\s*$/i.test(e.textContent||'')); if (x) { x.click(); return true; } return false; })) { d = true; break; } }
    catch {}
  }
  if (!d) await new Promise(r => setTimeout(r, 500));
}
await new Promise(r => setTimeout(r, 3000));
for (const id of ['howtoGo','tapStart']) {
  try { await page.evaluate(i => { const e = document.getElementById(i);
    if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
}
await new Promise(r => setTimeout(r, 5000));

// 1. a new player owns nothing, even after opening the reader and pressing NEXT
const fresh = await page.evaluate(() => {
  window.__aac3dFiles.open();
  window.__aac3dFiles.next(); window.__aac3dFiles.next();
  const st = window.__aac3dFiles.state();
  window.__aac3dFiles.close();
  return { ...st, bodyText: (document.getElementById('hwBody')||{}).textContent || '' };
});
if (fresh.found !== 0) bad.push(`a brand new player already owns ${fresh.found} pages`);
if (fresh.owned !== 0) bad.push(`the reader offered ${fresh.owned} pages to somebody who found none`);
if (!/wreck|valley/i.test(fresh.bodyText)) bad.push('the empty archive does not tell you where pages come from');

// 2. walk to the nearest wreck
const walked = await page.evaluate(async () => {
  const w = window.__aac3dWrecks ? window.__aac3dWrecks() : null;
  if (!w || !w.list.length) return { none: true };
  const t = w.list[0];
  window.__aac3dTeleport(t.x, t.z);
  /* ⛔ POLL, DO NOT SLEEP. wreckTick only checks every 0.25s and only from the
     render loop, so a fixed wait is a race against the frame rate — this failed
     inside a full gate suite on a 2-core box and passed alone, which is the
     signature of a timing assumption, not a bug. Hold position and wait for the
     outcome, up to a few seconds. */
  for (let i = 0; i < 40 && window.__aac3dFiles.state().found === 0; i++) {
    window.__aac3dTeleport(t.x, t.z);
    await new Promise(r => setTimeout(r, 100));
  }
  return { none:false, wrecks:w.list.length, st: window.__aac3dFiles.state(),
           cardUp: document.getElementById('recov').classList.contains('on'),
           why: (document.getElementById('recovWhy')||{}).textContent || '' };
});
if (walked.none) bad.push('the map generated no wrecks at all - there is nowhere to find a page');
else {
  if (walked.st.found !== 1) bad.push(`walking into a wreck gave ${walked.st.found} pages, expected 1`);
  if (!walked.cardUp) bad.push('no recovery card appeared - finding a page was not an event');
  if (!/RECOVERED/i.test(walked.why)) bad.push(`the card did not say what happened ("${walked.why}")`);
}

// 3+4. the reader shows only what you own, and a wreck pays once
const after = await page.evaluate(async () => {
  window.__aac3dFiles.open();
  for (let i = 0; i < 6; i++) window.__aac3dFiles.next();     // page well past the archive
  const st = window.__aac3dFiles.state();
  window.__aac3dFiles.close();
  const w = window.__aac3dWrecks().list[0];
  for (let i = 0; i < 15; i++) {              // sit on the spent wreck and see if it pays again
    window.__aac3dTeleport(w.x, w.z);
    await new Promise(r => setTimeout(r, 100));
  }
  return { st, after: window.__aac3dFiles.state().found };
});
if (after.st.owned !== 1) bad.push(`the reader thinks you own ${after.st.owned} pages, you own 1`);
if (after.st.idx !== 0) bad.push(`paging ran past the end of your archive (idx ${after.st.idx} of 1)`);
if (after.after !== 1) bad.push(`standing on a spent wreck printed more pages (${after.after})`);

// 5. it survives a reload
await page.reload({ waitUntil:'domcontentloaded', timeout:90000 });
await new Promise(r => setTimeout(r, 6000));
const kept = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('aac3d_files_found') || '[]').length; } catch(e) { return -1; }
});
if (kept !== 1) bad.push(`the archive did not survive a reload (${kept} pages on disk)`);

if (errs.length) bad.push('JS errors: ' + errs.slice(0,3).join(' | '));
if (bad.length) { console.log('FAIL files3d'); bad.forEach(b => console.log('   - ' + b)); }
else console.log(`ok   files3d  new player owns 0, ${walked.wrecks} wrecks on the map, walking into one ` +
  `recovers exactly 1 with a card, the reader shows only what you own, a spent wreck pays nothing, survives a reload`);

await browser.close(); srv.close();
process.exit(bad.length ? 1 : 0);
