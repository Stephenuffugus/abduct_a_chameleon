/* THE NIGHT GRADE, AS A CONTACT SHEET.
 *
 *   cd test && node nightsheet.mjs [../abduct-3d.html] [outfile.png]
 *
 * Fixing the terrain winding (the whole playfield was being lit from underneath, ash
 * rendering as (3,1,11) black) left the lights carrying the compensation a previous
 * session added FOR that bug. They are now double-counting: bright terrains read closer
 * to daylight than to night, and grass lands at 54% of its table colour with 53 degrees
 * of hue drift - olive, not green, on the commonest ground in the game.
 *
 * How dark the night is is the Director's call and not a gate's. So this renders the SAME
 * frame under each candidate and annotates every one with the two numbers that are NOT a
 * matter of taste:
 *
 *   CLOSEST PAIR - the smallest distance between any two terrains as they actually
 *                  render. This is a camouflage game; if two grounds look the same, the
 *                  decision the whole game is built on is invisible. Under about 28 they
 *                  read as one colour on a phone at arm's length.
 *   GRASS DRIFT  - how far grass has rotated away from its own hue. The paint studio
 *                  names an exact swatch and the scorer measures against it, so a green
 *                  that renders brown is the game lying about what it is asking for.
 *
 * Pick by eye; the numbers are there to stop a pretty option that breaks the game.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const require_ = createRequire(import.meta.url);
let puppeteer, napi;
try { puppeteer = require_('/workspaces/lucid-winds/node_modules/puppeteer'); }
catch { console.log('nightsheet: puppeteer not installed - SKIPPED'); process.exit(0); }
try { napi = require_('@napi-rs/canvas'); }
catch { console.log('nightsheet: @napi-rs/canvas not installed - SKIPPED'); process.exit(0); }

const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const OUT  = path.resolve(process.argv[3] || '/tmp/aac-nightsheet.png');
const ROOT = path.dirname(GAME);

/* THE CANDIDATES. A is exactly what ships today, so the sheet always contains the thing
   being compared against. The rest move ONE idea each rather than three at once, because
   a sheet where every tile differs in every way is a sheet nobody can choose from. */
const CANDIDATES = [
  /* ⛔ THE FIRST SHEET WAS USELESS AND IT IS WORTH SAYING WHY. I bracketed around the
     CURRENT setting - 103%, 98%, 93%, 92%, 86%, 101% - and every tile came out looking
     like daylight, because the current setting is itself the thing in question. Six
     options nobody can tell apart is not a choice, it is a slower way of changing
     nothing. This spans the actual space instead: from what ships down to a night that
     is probably too dark, so the answer is somewhere INSIDE the sheet rather than off
     the end of it. */
  { key:'A', name:'AS IT SHIPS',  note:'the lights as they are now - this reads as daylight',
    cfg:{ hemi:2.6, moon:1.9, warm:0.9 } },
  { key:'B', name:'EVENING',      note:'a quarter down, still warm',
    cfg:{ hemi:1.9, moon:1.5, warm:0.7 } },
  { key:'C', name:'DUSK',         note:'half way; the sand stops shouting',
    cfg:{ hemi:1.3, moon:1.1, warm:0.5 } },
  { key:'D', name:'NIGHT',        note:'the moon leads, the horizon is a whisper',
    cfg:{ hemi:0.85, moon:1.0, warm:0.22 } },
  { key:'E', name:'MOONLIT NIGHT',note:'same darkness as D, cooler and more directional',
    cfg:{ hemi:0.7, moon:1.5, warm:0.12, hemiSky:0xAFC6FF } },
  { key:'F', name:'DEEP NIGHT',   note:'almost certainly too dark - the far end of the bracket',
    cfg:{ hemi:0.5, moon:0.8, warm:0.10 } },
];


const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png',
  '.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});

const SHOT_W = 560, SHOT_H = 340;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox',
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({ width: SHOT_W, height: SHOT_H, deviceScaleFactor: 2 });
await p.goto(`http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`, {waitUntil:'domcontentloaded', timeout:90000});
await new Promise(r=>setTimeout(r, 9000));
await p.evaluate(()=>{ const g=document.getElementById('howtoGo'); if(g) g.click(); });
await new Promise(r=>setTimeout(r, 4000));

/* One fixed map and one fixed camera for every tile, or the sheet compares scenery
   instead of light. This seed has grass, dirt, rock and water in one frame. */
const SEED = 20260802;
const want = await p.evaluate(s => { const m = window.__aac3dMakeMap(s); window.__aac3dSetMap(m); return m.name; }, SEED);
for (let t = 0; t < 60; t++) { await new Promise(r=>setTimeout(r, 250));
  const L = await p.evaluate(()=>window.__aac3dLevel(2)); if (L && L.map === want) break; }
await p.evaluate(()=>{ window.__aac3dTeleport(0, 0); });
await new Promise(r=>setTimeout(r, 700));

const lum = c => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
function hue(c){ const r=c[0]/255,g=c[1]/255,bl=c[2]/255, mx=Math.max(r,g,bl), mn=Math.min(r,g,bl), d=mx-mn;
  if(d<1e-4) return null;
  let h; if(mx===r) h=((g-bl)/d)%6; else if(mx===g) h=(bl-r)/d+2; else h=(r-g)/d+4;
  return ((h*60)%360+360)%360; }
const hueGap = (a,z)=>{ if(a==null||z==null) return null; const d=Math.abs(a-z)%360; return d>180?360-d:d; };

const tiles = [];
for (const C of CANDIDATES) {
  await p.evaluate(cfg => window.__aac3dLights(cfg), C.cfg);
  await new Promise(r=>setTimeout(r, 600));

  /* ⛔ ABSOLUTE CAMERA, AND PUT THE BODY BACK FIRST. The first version placed the camera
     relative to __aac3dPlayer(), and the measurement pass below teleports the player all
     over the map - so tile A was shot from the spawn and B through F from wherever the
     last teleport had left them. A contact sheet whose whole claim is "same map, same
     camera, same frame" was comparing three different frames. Fixed numbers, every time. */
  await p.evaluate(()=>window.__aac3dTeleport(0, 0));
  await new Promise(r=>setTimeout(r, 350));
  await p.evaluate(()=>window.__aac3dFreeCam(-11, 4.2, -11, 6, 0.8, 6));
  await new Promise(r=>setTimeout(r, 500));
  /* Hide the curtain AND the game's own HUD: this sheet is a question about light, and
     two thirds of every tile was chrome that is identical in all six. */
  await p.evaluate(()=>{
    for(const id of ['tapStart','howto','settings']){ const e=document.getElementById(id); if(e) e.style.display='none'; }
    document.querySelectorAll('body > *').forEach(e=>{ if(e.tagName!=='CANVAS' && e.id!=='c') e.style.visibility='hidden'; });
  });
  const png = await p.screenshot({ type:'png' });
  fs.writeFileSync(path.join(path.dirname(OUT), 'nightsheet-' + C.key + '.png'), png);   // raw, so a blank sheet is debuggable
  await p.evaluate(()=>{ document.querySelectorAll('body > *').forEach(e=>{ e.style.visibility=''; }); });
  await p.evaluate(()=>window.__aac3dFreeCam(null));

  /* the numbers: walk a few spots and read the ground back off the GPU */
  const seen = new Map();
  for (const [dx,dz] of [[0,0],[16,0],[-16,0],[0,16],[0,-16],[24,24],[-24,-24]]) {
    await p.evaluate(([x,z])=>window.__aac3dTeleport(x,z), [dx,dz]);
    await new Promise(r=>setTimeout(r, 90));
    const m = await p.evaluate(()=>{ try { return window.__aac3dGround(); } catch(e){ return null; } });
    if (!m || !m.under) continue;
    if (!seen.has(m.under)) seen.set(m.under, { table:m.tableSRGB, got:[] });
    seen.get(m.under).got.push(m.rendered);
  }
  const rows = [...seen.entries()].map(([k,v])=>{
    const n = v.got.length;
    const avg = [0,1,2].map(i => Math.round(v.got.reduce((a,s)=>a+s[i],0)/n));
    return { k, table:v.table, got:avg };
  });
  let closest = Infinity, pair = '';
  for (let i=0;i<rows.length;i++) for (let j=i+1;j<rows.length;j++){
    const d = Math.hypot(rows[i].got[0]-rows[j].got[0], rows[i].got[1]-rows[j].got[1], rows[i].got[2]-rows[j].got[2]);
    if (d < closest) { closest = d; pair = rows[i].k + '/' + rows[j].k; }
  }
  const g = rows.find(r=>r.k==='grass');
  const drift = g ? hueGap(hue(g.table), hue(g.got)) : null;
  const bright = rows.length ? Math.round(100 * rows.reduce((a,r)=>a + lum(r.got)/Math.max(1,lum(r.table)), 0) / rows.length) : 0;

  tiles.push({ ...C, png, closest: isFinite(closest) ? Math.round(closest) : null, pair,
               drift: drift==null ? null : Math.round(drift), bright, terrains: rows.length });
  console.log(`  ${C.key} ${C.name.padEnd(12)} closest pair ${String(isFinite(closest)?Math.round(closest):'-').padStart(3)} (${pair})   grass drift ${drift==null?'  -':String(Math.round(drift)).padStart(3)}deg   brightness ${bright}%   ${rows.length} terrains`);
}
await b.close(); srv.close();

/* ---- compose ---- */
const COLS = 2, PAD = 18, HDR = 96, CAPTION = 84;
const TW = SHOT_W, TH = SHOT_H;
const rowsN = Math.ceil(tiles.length / COLS);
const W = PAD + COLS * (TW + PAD);
const H = HDR + rowsN * (TH + CAPTION + PAD) + PAD;
const cv = napi.createCanvas(W, H); const x = cv.getContext('2d');
x.fillStyle = '#0B0F1C'; x.fillRect(0,0,W,H);
x.fillStyle = '#F2B33D'; x.font = '700 26px sans-serif';
x.fillText('THE NIGHT GRADE — pick one', PAD, 40);
x.fillStyle = '#8A93AD'; x.font = '400 14px sans-serif';
x.fillText('Same map, same camera, same frame. Only the three lights change.', PAD, 64);
x.fillStyle = '#6F7891'; x.font = '400 12px sans-serif';
x.fillText('CLOSEST PAIR = how far apart the two most similar grounds render. Under 28 a player cannot tell them apart, and this is a camouflage game.', PAD, 84);

for (let i = 0; i < tiles.length; i++) {
  const t = tiles[i];
  const cx = PAD + (i % COLS) * (TW + PAD);
  const cy = HDR + Math.floor(i / COLS) * (TH + CAPTION + PAD);
  const img = await napi.loadImage(Buffer.from(t.png));   // ⛔ `new Image(); img.src = buf`
  x.drawImage(img, cx, cy, TW, TH);                      //   never decodes: every tile was blank
  x.strokeStyle = '#2A3350'; x.lineWidth = 1; x.strokeRect(cx+0.5, cy+0.5, TW-1, TH-1);

  x.fillStyle = '#F2B33D'; x.font = '700 17px sans-serif';
  x.fillText(`${t.key}  ${t.name}`, cx, cy + TH + 22);
  x.fillStyle = '#8A93AD'; x.font = '400 13px sans-serif';
  x.fillText(t.note, cx, cy + TH + 40);

  /* ⛔ three captions at fixed x ran into each other and off the tile. Measure and lay
     them out, which is the same lesson the 2D how-to card taught this morning. */
  const warnPair = t.closest != null && t.closest < 28;
  x.font = '600 12px sans-serif';
  let lx = cx;
  const chip = (txt, col) => { x.fillStyle = col; x.fillText(txt, lx, cy + TH + 57); lx += x.measureText(txt).width + 18; };
  chip(`closest pair ${t.closest ?? '-'}${t.pair ? ' ('+t.pair+')' : ''}`, warnPair ? '#E0655E' : '#3AC0A0');
  chip(`grass drift ${t.drift ?? '-'}\u00B0`, (t.drift ?? 0) > 35 ? '#E0A030' : '#8A93AD');
  chip(`${t.bright}% bright`, '#6F7891');
  x.fillStyle = '#5A6377'; x.font = '400 11px sans-serif';
  x.fillText(`hemi ${t.cfg.hemi}  moon ${t.cfg.moon}  warm ${t.cfg.warm}`, cx, cy + TH + 74);
}
fs.writeFileSync(OUT, cv.toBuffer('image/png'));
console.log('\nwrote ' + OUT);
