/* CAN A PLAYER ACTUALLY CLIMB ONTO A ROOF?
 *
 *   cd test && node climb3d.mjs [../abduct-3d.html] [blocks]
 *
 * ⛔⛔ WHY THIS EXISTS, AND WHY jump3d IS NOT IT. Stephen has now asked THREE times for
 * the ability to stand on structures. jump3d has been green through all three, and here
 * is what it actually checks:
 *
 *     const APEX = 2.72, NEAR = 6.0;
 *     reach[i] = perches[i].top <= APEX;                     // ...then a graph walk
 *     ck('the block has a way onto its roof', kinds.includes('STEPS') && kinds.includes('ROOF'))
 *
 * It is a graph over the PLATFORM LIST using a model of a jump. It never moves a player,
 * never runs the collision code, and its roof check only asks whether the words STEPS and
 * ROOF both appear somewhere on the map - not whether any particular roof has any
 * particular staircase. A world where every staircase is on a different block from every
 * roof passes it perfectly.
 *
 * So this one climbs. It drives the real movement path - keydown events into the game's
 * own input, the real gravity, the real resolveWalls, the real supportAt - and asks the
 * only question that matters: standing at the foot of a block's steps and walking up
 * them like a person, do you end up on the roof?
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
let puppeteer;
try { puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('climb3d: puppeteer not installed - SKIPPED'); process.exit(0); }

const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const BLOCKS = +(process.argv[3] || 6);
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});

const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({ width: 900, height: 520, deviceScaleFactor: 1 });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`, {waitUntil:'domcontentloaded', timeout:90000});
await new Promise(r=>setTimeout(r, 9000));
await p.evaluate(()=>{ const g=document.getElementById('howtoGo'); if(g) g.click(); });
await new Promise(r=>setTimeout(r, 4000));

const bad = [], lines = [];
let tried = 0, made = 0;

for (let s = 0; s < BLOCKS; s++) {
  const seed = 4400 + s * 5171;
  const want = await p.evaluate(x => { const m = window.__aac3dMakeMap(x); window.__aac3dSetMap(m); return m.name; }, seed);
  let L = null;
  for (let t = 0; t < 60; t++) { await new Promise(r=>setTimeout(r, 250));
    L = await p.evaluate(()=>window.__aac3dLevel(2)); if (L && L.map === want) break; }
  if (!L || L.map !== want) continue;

  /* Find a staircase and the roof it is supposed to serve: the nearest ROOF to a STEPS. */
  const target = await p.evaluate(() => {
    const all = []; for (let i = 0; ; i++) { const q = window.__aac3dPerch(i); if (!q) break; all.push(q); if (i > 4000) break; }
    const steps = all.filter(q => q.name === 'STEPS');
    const roofs = all.filter(q => q.name === 'ROOF');
    if (!steps.length || !roofs.length) return null;
    let best = null;
    for (const st of steps) for (const rf of roofs) {
      const d = Math.hypot(st.cx - rf.cx, st.cz - rf.cz);
      if (!best || d < best.d) best = { d, st, rf };
    }
    return best;
  });
  if (!target) { lines.push(`  ${want}: no STEPS or no ROOF on this map`); continue; }
  if (target.d > 12) { lines.push(`  ${want}: nearest steps are ${target.d.toFixed(1)}m from the nearest roof - not a pair`); }

  /* Stand at the foot of the steps, facing them, and walk. Yaw is computed so "forward"
     points from the player at the staircase; the game's own key handling does the rest. */
  const res = await p.evaluate(async (t) => {
    const nap = ms => new Promise(r=>setTimeout(r,ms));
    const dx = t.st.cx - t.rf.cx, dz = t.st.cz - t.rf.cz;
    const len = Math.hypot(dx, dz) || 1;
    const startX = t.st.cx + (dx/len) * 3.5, startZ = t.st.cz + (dz/len) * 3.5;
    const yaw = Math.atan2(-(t.st.cx - startX), -(t.st.cz - startZ));   // face the steps
    window.__aac3dPlace(startX, 0, startZ, yaw);
    await nap(250);
    const before = window.__aac3dPlayer();
    const key = (code, type) => dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
    key('KeyW', 'keydown');
    let peak = before.y, jumps = 0;
    for (let f = 0; f < 200; f++) {
      /* jump whenever we are grounded and not already climbing, the way a person
         mashes it at the bottom of a step */
      const s2 = window.__aac3dPlayer();
      if (s2.grounded && jumps < 40) { key('Space','keydown'); await nap(16); key('Space','keyup'); jumps++; }
      await nap(30);
      const s3 = window.__aac3dPlayer();
      if (s3.y > peak) peak = s3.y;
    }
    key('KeyW', 'keyup');
    await nap(200);
    const after = window.__aac3dPlayer();
    return { startY: before.y, peak, endY: after.y, endOn: after.standingOn,
             moved: Math.hypot(after.x - startX, after.z - startZ) };
  }, target);

  /* ⛔ AND LOOK AT IT. Two hypotheses died to reading the source; the third came from
     a picture. Shoot the body where it gave up, from beside and slightly above, so the
     frame shows what it is standing against. */
  await p.evaluate(()=>{ const pl = window.__aac3dPlayer();
    window.__aac3dFreeCam(pl.x - 7, pl.y + 4, pl.z - 7, pl.x, pl.y + 0.8, pl.z);
    for(const id of ['tapStart','howto','settings']){ const e=document.getElementById(id); if(e) e.style.display='none'; }
    document.querySelectorAll('body > *').forEach(e=>{ if(e.tagName!=='CANVAS') e.style.visibility='hidden'; }); });
  await new Promise(r=>setTimeout(r,450));
  fs.writeFileSync(path.join('/tmp/claude-1000/-workspaces-lucid-winds/79b3a7f9-986f-4d21-a960-ea935fc533bd/scratchpad', 'climb-' + want + '.png'),
                   await p.screenshot({type:'png'}));
  await p.evaluate(()=>{ document.querySelectorAll('body > *').forEach(e=>{ e.style.visibility=''; });
    window.__aac3dFreeCam(null); });

  tried++;
  const roofTop = target.rf.top;
  const onRoof = res.endY >= roofTop - 0.6 || (res.endOn && res.endOn.name === 'ROOF');
  if (onRoof) made++;
  lines.push(`  ${want.padEnd(14)} steps top ${target.st.top.toFixed(1)}  roof top ${roofTop.toFixed(1)}  ` +
             `-> walked ${res.moved.toFixed(1)}m, peaked ${res.peak.toFixed(2)}, ended ${res.endY.toFixed(2)} ` +
             `on ${res.endOn ? res.endOn.name : 'the ground'}   ${onRoof ? 'ON THE ROOF' : 'did not get up'}`);
}

lines.forEach(l => console.log(l));
console.log(`\n  climbed onto ${made} of ${tried} roofs`);
if (errs.length) bad.push('JS errors: ' + [...new Set(errs)].slice(0,2).join(' | '));
/* The bar is deliberately not "all of them": a staircase can be legitimately blocked by
   another building on a random map. But if a player cannot climb ANY of them, "stand on
   the structures" is not a feature no matter what the platform list says. */
if (tried && made === 0) bad.push(`a player walked at ${tried} staircases and got onto NONE of the roofs - the platforms exist and nobody can reach them`);
else if (tried && made < tried * 0.5) bad.push(`only ${made} of ${tried} roofs could actually be climbed`);

await b.close(); srv.close();
if (bad.length) { console.log('\nFAIL climb3d:'); bad.forEach(x=>console.log('   - ' + x)); process.exit(1); }
console.log('\nok   climb3d  a player who walks at a staircase ends up on the roof');
