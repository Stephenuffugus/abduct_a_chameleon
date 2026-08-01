/* WHAT DOES A SECOND PLAYER ACTUALLY EXPERIENCE?
 *
 *   node twoplayer.mjs [../abduct-3d.html] [joinDelaySeconds]
 *
 * The Director, 2026-08-02: "the chameleon 3D still doesnt let me play at all
 * before im abducted. i have not had a single second to try painting. the story
 * cards are popping up immediately when i get put in a ufo too."
 *
 * "Put in a UFO" means SEEKER, which means players.length >= 2 — so none of the
 * solo head start applies to him. This drives two real clients into one room and
 * reports, for each: role, whether a hide window was running when they arrived,
 * how long until they could be caught, and whether the Files blindfold appeared.
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, process.argv[2] || '../abduct-3d.html');
const JOIN_DELAY = +(process.argv[3] || 0);
const ROOT = path.dirname(GAME);

let puppeteer;
try { puppeteer = (await import('puppeteer')).default; }
catch { console.log('twoplayer: puppeteer not installed - SKIPPED'); process.exit(0); }

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
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;

const browser = await puppeteer.launch({ headless: 'new',
  args: ['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader',
         '--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage'] });

async function boot(label, url) {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 932, height: 430, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.log(`  [${label}] JS ERROR ${e.message.slice(0,110)}`));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
  for (let i = 0, done = false; i < 40 && !done; i++) {
    for (const f of p.frames()) {
      try { if (await f.evaluate(() => { const b = [...document.querySelectorAll('button,div')]
        .find(x => /^\s*launch\s*$/i.test(x.textContent || '')); if (b) { b.click(); return true; } return false; })) { done = true; break; } }
      catch {}
    }
    if (!done) await new Promise(r => setTimeout(r, 500));
  }
  await new Promise(r => setTimeout(r, 3000));
  for (const id of ['howtoGo','tapStart']) {
    try { await p.evaluate(i => { const e = document.getElementById(i);
      if (e && getComputedStyle(e).display !== 'none') e.click(); }, id); } catch {}
  }
  await new Promise(r => setTimeout(r, 4000));
  return { ctx, p, label };
}

/* what the player can see and what the rules say about them, right now */
const SNAP = () => {
  const g = (id) => { const e = document.getElementById(id); return e ? (e.textContent||'').trim() : null; };
  const shown = id => { const e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'; };
  const S = window.__aac3dRound ? window.__aac3dRound() : null;
  return { role: g('roleText'), players: g('pcount'), phase: S && S.phase, hideLeft: S && S.hideLeft,
    myHasRole: S && S.myHasRole, canBeCaught: S && S.canBeCaught, abducted: g('roleText') === 'Spectating',
    filesUp: shown('hidewait'), banner: (g('bannerTitle')||'') + ' / ' + (g('bannerSub')||'').slice(0,70) };
};

const A = await boot('P1', base);
/* Playroom writes the room into the URL; the second client must reuse it */
const room = await A.p.evaluate(() => location.hash || location.search);
console.log('room handle from client 1:', JSON.stringify(room));
const url2 = base + room;

if (JOIN_DELAY) { console.log(`waiting ${JOIN_DELAY}s before the second player joins...`);
  await new Promise(r => setTimeout(r, JOIN_DELAY*1000)); }
const B = await boot('P2', url2);

let last = 0;
for (const t of [0, 10, 30, 60]) {
  if (t > last) await new Promise(r => setTimeout(r, (t - last) * 1000));
  last = t;
  const a = await A.p.evaluate(SNAP), b = await B.p.evaluate(SNAP);
  console.log(`\n--- t+${t}s ---`);
  console.log('  P1', JSON.stringify(a));
  console.log('  P2', JSON.stringify(b));
}

await browser.close(); srv.close();
