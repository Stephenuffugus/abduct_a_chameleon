/* JUMP + PERCHES gate for the 3D game.
 *
 *   cd test && node jump3d.mjs [../abduct-3d.html]
 *
 * Stephen asked for jump so players can "sit on top of objects and paint
 * themselves". This asserts the parts that must never silently break:
 *
 *   - low cover REGISTERS as a perch (crates, barrels, boulders, tables) while a
 *     4.2m wall does not, so props are mountable and walls stay walls;
 *   - a perch actually HOLDS you up (supportAt finds it at its own centre);
 *   - standing on one makes THAT PROP the ground your paint is judged against -
 *     that is the whole point of climbing it;
 *   - the jump arc clears the tallest perch. The first pass shipped an apex of
 *     1.82 measured against a 1.80 barrel, i.e. landable by a pixel.
 *
 * Walking a character onto a crate end-to-end needs a lucky random map and real
 * frame rates, so it is REPORTED, never asserted - a flaky gate is worse than
 * none. That path was verified by hand: landed on a BOULDER at y=1.7 with the
 * studio reading "BOULDER - you are standing on it" and MATCH at 100%.
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
  if (!window.__aac3dPlayer || !window.__aac3dPerch) return { fatal: 'movement hooks missing' };
  const out = { map: P.map, checks: [] };
  const ck = (n, ok, d) => out.checks.push({ n, ok: !!ok, d });
  const me = window.__aac3dPlayer();
  out.platforms = me.platforms;

  ck('the world registers perches', me.platforms > 0, me.platforms + ' perches');
  ck('a hider starts ON the ground', me.grounded === true && Math.abs(me.y) < 0.01,
     'y=' + me.y + ' grounded=' + me.grounded);

  const perches = [];
  for (let i = 0; i < me.platforms; i++) { const q = window.__aac3dPerch(i); if (q) perches.push(q); }
  out.tallest = perches.reduce((m, p) => Math.max(m, p.top), 0);
  out.kinds = [...new Set(perches.map(p => p.name))].sort();

  ck('every perch holds you up', perches.every(p => p.supported),
     perches.filter(p => !p.supported).map(p => p.name).join(',') || 'all supported');
  /* The ground tone must be A PERCH, not necessarily the one queried: pieces can
     legitimately stack (a bench tucked under a picnic table), and supportAt
     correctly returns the HIGHEST one covering the point. */
  const perchNames = new Set(perches.map(p => p.name));
  ck('standing on a perch makes a perch the ground tone',
     perches.every(p => p.groundTone && perchNames.has(p.groundTone.name)),
     perches.filter(p => !p.groundTone || !perchNames.has(p.groundTone.name)).map(p => p.name).join(',') || 'all');
  /* ⛔⛔ THIS RULE USED TO BE "no perch is taller than a jump can reach", and it
     was correct while every perch was a crate. Stephen, twice: "The roofs of the
     building all can't be stood upon. that's dumb." Roofs are perches now, three
     metres up, against a 2.75m jump apex - so the OLD rule would forbid the
     feature rather than test it.
     The rule that actually matters is unchanged in spirit: NOTHING IS STRANDED.
     A perch is legitimate if you can get to it - from the ground if it is inside
     jump reach, or from another reachable perch within a step or a jump. That is
     a graph, so walk it to a fixpoint. Anything left over is a platform the
     collision system offers and no player can ever use, which is exactly the lie
     the old rule existed to prevent. */
  /* NEAR is a HORIZONTAL hop, not a neighbouring tile. At HIDER_SPEED 10 and about
     three quarters of a second in the air a body crosses six metres easily, so a
     roof broken by one missing tile (3m of gap) is still one island, not two. */
  const APEX = 2.72, NEAR = 6.0;
  const reach = perches.map(p => p.top <= APEX);
  for(let pass=0; pass<12; pass++){
    let grew = false;
    for(let i=0;i<perches.length;i++){
      if(reach[i]) continue;
      for(let j=0;j<perches.length;j++){
        if(!reach[j] || i===j) continue;
        const dx = perches[i].cx - perches[j].cx, dz = perches[i].cz - perches[j].cz;
        if(dx*dx + dz*dz > NEAR*NEAR) continue;
        if(perches[i].top - perches[j].top <= APEX){ reach[i] = true; grew = true; break; }
      }
    }
    if(!grew) break;
  }
  const stranded = perches.filter((p,i)=> !reach[i]);
  out.stranded = stranded.length;
  out.strandedKinds = [...new Set(stranded.map(p=>p.name))].sort();
  ck('every perch can actually be reached', stranded.length === 0,
     stranded.length ? stranded.length + ' stranded: ' + out.strandedKinds.join(',')
                     : 'all ' + perches.length + ' reachable, tallest=' + out.tallest);
  ck('the block has a way onto its roof', out.kinds.includes('STEPS') && out.kinds.includes('ROOF'),
     out.kinds.includes('STEPS') ? (out.kinds.includes('ROOF') ? 'steps + roofs' : 'steps but NO standable roof')
                                 : 'NO STAIRCASE ON THE MAP');
  ck('walls are NOT perches', !out.kinds.includes('WALL'), out.kinds.join(','));
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

if (r.fatal) { console.log('jump3d: FATAL - ' + r.fatal); process.exit(1); }
console.log(`map ${r.map}, ${r.platforms} perches: ${r.kinds.join(', ')} (tallest ${r.tallest})`);

let bad = 0;
for (const c of r.checks) { if (!c.ok) bad++; console.log((c.ok ? '  ok   ' : ' FAIL  ') + c.n + (c.d ? '  -- ' + c.d : '')); }
if (errors.length) { bad++; console.log(' FAIL  JS errors: ' + errors.slice(0,3).join(' | ')); }
console.log(bad ? `\njump3d: ${bad} FAILED` : '\njump3d: all rules hold');
process.exit(bad ? 1 : 0);
