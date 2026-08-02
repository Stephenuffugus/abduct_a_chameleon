/* WHAT COLOUR IS THE GROUND, REALLY?
 *
 *   cd test && node ground_colour.mjs [../abduct-3d.html] [seeds]
 *
 * This is a camouflage game. The one verb is "match the ground you are standing on",
 * the paint studio names an exact swatch out of TERRAIN, and the camo scorer measures
 * you against that same table entry. So if the GROUND does not render as the colour
 * the game is asking you to copy, the whole decision the game is built on is invisible.
 *
 * It reads the pixel back off the GPU at a known cell via window.__aac3dGround, walks
 * enough seeds to hit most of the sixteen terrains, and prints rendered vs table for
 * each. Run it after touching a light, a normal or the tone mapping.
 */
import http from 'http'; import fs from 'fs'; import path from 'path';
import { createRequire } from 'module';
const puppeteer = createRequire(import.meta.url)('/workspaces/lucid-winds/node_modules/puppeteer');
const GAME = path.resolve(process.argv[2] || '../abduct-3d.html');
const SEEDS = +(process.argv[3] || 10);
const ROOT = path.dirname(GAME);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.glb':'model/gltf-binary','.css':'text/css'};
const srv = await new Promise(r=>{const s=http.createServer((q,p)=>{let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/'+path.basename(GAME);
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){p.writeHead(404);return p.end();}
 p.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':'no-store'}); fs.createReadStream(f).pipe(p);});s.listen(0,'127.0.0.1',()=>r(s));});
const base = `http://127.0.0.1:${srv.address().port}/${path.basename(GAME)}`;
const b = await puppeteer.launch({headless:'new',args:['--no-sandbox','--disable-setuid-sandbox','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader','--disable-dev-shm-usage']});
const p = await b.newPage();
await p.setViewport({width:800,height:500,deviceScaleFactor:1});
await p.goto(base,{waitUntil:'domcontentloaded',timeout:90000});
for(let i=0,d=false;i<40&&!d;i++){for(const f of p.frames()){try{if(await f.evaluate(()=>{const x=[...document.querySelectorAll('button,div')].find(e=>/^\s*launch\s*$/i.test(e.textContent||''));if(x){x.click();return true;}return false;})){d=true;break;}}catch{}} if(!d)await new Promise(r=>setTimeout(r,500));}
await new Promise(r=>setTimeout(r,3000));
for(const id of ['howtoGo','tapStart']){try{await p.evaluate(i=>{const e=document.getElementById(i);if(e&&getComputedStyle(e).display!=='none')e.click();},id);}catch{}}
await new Promise(r=>setTimeout(r,5000));

/* Walk the player around each map so the probe cell lands on different terrains,
 * because __aac3dGround samples a fixed offset from wherever the body is standing. */
const seen = new Map();
for(let i=0;i<SEEDS;i++){
  const seed = 2000 + i*4801;
  const want = await p.evaluate(s=>{ const m=window.__aac3dMakeMap(s); window.__aac3dSetMap(m); return m.name; }, seed);
  for(let t=0;t<40;t++){ await new Promise(r=>setTimeout(r,250));
    const L = await p.evaluate(()=>window.__aac3dLevel(2)); if(L && L.map===want) break; }
  for(const [dx,dz] of [[0,0],[18,0],[-18,0],[0,18],[0,-18],[26,26],[-26,-26],[26,-26],[-26,26]]){
    const g = await p.evaluate(([x,z])=>{ window.__aac3dTeleport(x,z); return null; }, [dx,dz]).catch(()=>null);
    await new Promise(r=>setTimeout(r,120));
    const m = await p.evaluate(()=>{ try { return window.__aac3dGround(); } catch(e){ return {err:String(e)}; } });
    if(!m || m.err || !m.under) continue;
    if(!seen.has(m.under)) seen.set(m.under, { table:m.tableSRGB, hex:m.tableHex, samples:[] });
    seen.get(m.under).samples.push(m.rendered);
  }
}

const lum = c => 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
function hue(c){ const r=c[0]/255,g=c[1]/255,bl=c[2]/255, mx=Math.max(r,g,bl), mn=Math.min(r,g,bl), d=mx-mn;
  if(d<1e-4) return null;
  let h; if(mx===r) h=((g-bl)/d)%6; else if(mx===g) h=(bl-r)/d+2; else h=(r-g)/d+4;
  return ((h*60)%360+360)%360; }
function hueGap(a,b){ if(a==null||b==null) return null; const d=Math.abs(a-b)%360; return d>180?360-d:d; }

const rows = [];
for(const [key,v] of seen){
  const n = v.samples.length;
  const avg = [0,1,2].map(i => Math.round(v.samples.reduce((a,s)=>a+s[i],0)/n));
  rows.push({ key, hex:v.hex, table:v.table, got:avg, n,
              ratio:+(lum(avg)/Math.max(1,lum(v.table))).toFixed(2),
              hueOff: hueGap(hue(v.table), hue(avg)) });
}
rows.sort((a,b)=>a.ratio-b.ratio);
console.log('terrain     table            rendered         brightness   hue drift');
for(const r of rows)
  console.log('  ' + r.key.padEnd(10) + String(r.hex).padEnd(9) + ('('+r.table.join(',')+')').padEnd(16) +
    ('('+r.got.join(',')+')').padEnd(17) + (r.ratio*100).toFixed(0).padStart(4) + '%      ' +
    (r.hueOff==null?'  n/a':Math.round(r.hueOff)+'°'));
const rs = rows.map(r=>r.ratio);
console.log('\n' + rows.length + ' terrains sampled. brightness ' +
  (Math.min(...rs)*100).toFixed(0) + '% to ' + (Math.max(...rs)*100).toFixed(0) + '% of table, median ' +
  (rs.slice().sort((a,b)=>a-b)[rs.length>>1]*100).toFixed(0) + '%');

/* THE TWO RULES, and they are the game's rules rather than art direction.
   1. NO TERRAIN GOES DARK. The night ate the palette twice: measured before this
      gate existed, ASH rendered (3,1,11) - black - and ICE rendered at 40% of its
      table colour, because the whole playfield was being lit from underneath.
      35% is well below any deliberate night grade and well above a black floor.
   2. TWO TERRAINS MUST NOT RENDER AS THE SAME COLOUR. This is a camouflage game.
      The player is asked to copy the ground and is scored against TERRAIN[key];
      if two grounds are indistinguishable on screen then the decision the whole
      game is built on is invisible, whatever the scorer says. 28 is roughly the
      point at which two flat fills stop reading as one on a phone at arm's length.
   Deliberately NOT asserted: absolute brightness or hue. How dark the night is and
   how warm the lights are belong to the Director, not to a gate. */
const bad = [];
const DARK = 0.35, APART = 28;
for(const r of rows) if(r.ratio < DARK)
  bad.push(`${r.key} renders at ${(r.ratio*100).toFixed(0)}% of its table colour (${r.got.join(',')} vs ${r.table.join(',')}) - the night is eating the palette again`);
for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++){
  const d = Math.hypot(rows[i].got[0]-rows[j].got[0], rows[i].got[1]-rows[j].got[1], rows[i].got[2]-rows[j].got[2]);
  if(d < APART) bad.push(`${rows[i].key} and ${rows[j].key} render ${d.toFixed(0)} apart (${rows[i].got.join(',')} vs ${rows[j].got.join(',')}) - a player cannot tell which ground they are standing on`);
}
if(rows.length < 6) bad.push(`only ${rows.length} terrains were sampled - not enough to judge the palette`);
if(bad.length){ console.log('\nFAIL ground_colour:'); bad.slice(0,8).forEach(x=>console.log('   - '+x));
  console.log('\n   NOTE (2026-08-02): this gate is NOT in `npm run all` yet, and it is red on');
  console.log('   purpose. Fixing the terrain winding (the whole playfield was lit from');
  console.log('   underneath) revealed that the lights are still carrying the compensation a');
  console.log('   previous session added FOR that bug, so the warm night crushes dirt, mud and');
  console.log('   grass onto each other. The night grade is the Director\'s call; this is the');
  console.log('   measurement that should drive it. Wire it into `all` once he has picked.'); }
else console.log('ok   ground_colour: every terrain reaches at least ' + (DARK*100) + '% of its table colour and no two render alike');
await b.close(); srv.close();
process.exit(bad.length?1:0);
