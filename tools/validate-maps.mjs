// Validate every maps/*.json against the scanner-map contract + playability rules the game needs.
//   node tools/validate-maps.mjs            (all maps in the manifest)
//   node tools/validate-maps.mjs maps/foo.json ...   (specific files)
// Checks: format/version, grid matches terrain dims, known terrain + cover keys, spawns present + valid
// (hider on a non-hazard non-cover cell, seeker in-bounds non-void), and REACHABILITY (a flood-fill from a
// hider spawn over walkable ground covers a healthy fraction — i.e. the map isn't chopped into sealed pockets).
import { readFileSync } from 'fs';

const TERRAIN = new Set(['void','grass','dirt','water','rock','concrete','foliage','metal','sand','snow','ice','mud','moss','lava','ash','crystal']);
const COVER   = new Set(['tree','boulder','crate','barrel','wall','cactus','dead_tree','ice_spike','alien_pod']);
const MOVE_BLOCK = new Set(['wall']);            // matches index.html MOVE_BLOCK + void terrain
const HAZARD = new Set(['water','lava','void']); // hiders should not spawn here

let files = process.argv.slice(2);
if (!files.length) files = JSON.parse(readFileSync('maps/levels.json','utf8')).map(l => l.file);

let fails = 0;
const bad = (f,msg) => { console.log(`  ✗ ${msg}`); fails++; };

for (const file of files) {
  console.log(`\n${file}`);
  let m; try { m = JSON.parse(readFileSync(file,'utf8')); } catch(e){ bad(file,'unparseable: '+e.message); continue; }
  if (m.format !== 'scanner-map') bad(file,`format is "${m.format}" (want scanner-map)`);
  if (m.version !== 1) bad(file,`version ${m.version} (want 1)`);
  const cols=m.grid&&m.grid.cols, rows=m.grid&&m.grid.rows;
  if (!(cols>0&&rows>0)) { bad(file,'bad grid'); continue; }
  if (!Array.isArray(m.terrain) || m.terrain.length!==rows) bad(file,`terrain rows ${m.terrain&&m.terrain.length} != ${rows}`);
  let badKeys=new Set();
  for (let r=0;r<rows;r++){ const row=m.terrain[r]||[]; if(row.length!==cols) bad(file,`row ${r} width ${row.length} != ${cols}`);
    for (let c=0;c<cols;c++){ if(!TERRAIN.has(row[c])) badKeys.add(row[c]); } }
  if (badKeys.size) bad(file,'unknown terrain keys: '+[...badKeys].join(','));
  // cover grid + unknown cover
  const cover = Array.from({length:rows},()=>new Array(cols).fill(null));
  let badCover=new Set(), oob=0;
  for (const o of (m.objects||[])){ if(!COVER.has(o.type)) badCover.add(o.type);
    if(o.x<0||o.y<0||o.x>=cols||o.y>=rows){ oob++; continue; } cover[o.y][o.x]=o.type; }
  if (badCover.size) bad(file,'unknown cover types: '+[...badCover].join(','));
  if (oob) bad(file,`${oob} cover objects out of bounds`);
  const terr=(c,r)=> (r>=0&&c>=0&&r<rows&&c<cols)? m.terrain[r][c] : 'void';
  const walk=(c,r)=>{ if(terr(c,r)==='void') return false; const cv=cover[r] && cover[r][c]; return !(cv && MOVE_BLOCK.has(cv)); };
  // spawns
  const hiders=(m.spawns||[]).filter(s=>s.role==='hider'), seekers=(m.spawns||[]).filter(s=>s.role==='seeker');
  if (!hiders.length) bad(file,'no hider spawns');
  if (!seekers.length) bad(file,'no seeker spawns');
  for (const s of hiders){ if(s.x<0||s.y<0||s.x>=cols||s.y>=rows){ bad(file,`hider spawn OOB (${s.x},${s.y})`); continue; }
    if (HAZARD.has(terr(s.x,s.y))) bad(file,`hider spawn on hazard ${terr(s.x,s.y)} (${s.x},${s.y})`);
    if (cover[s.y][s.x]) bad(file,`hider spawn on cover ${cover[s.y][s.x]} (${s.x},${s.y})`); }
  for (const s of seekers){ if(s.x<0||s.y<0||s.x>=cols||s.y>=rows) bad(file,`seeker spawn OOB (${s.x},${s.y})`);
    else if (terr(s.x,s.y)==='void') bad(file,`seeker spawn on void (${s.x},${s.y})`); }
  // reachability: flood fill walkable from the first valid hider spawn
  const start = hiders.find(s=>walk(s.x,s.y)) || seekers.find(s=>walk(s.x,s.y));
  let walkTotal=0; for(let r=0;r<rows;r++)for(let c=0;c<cols;c++) if(walk(c,r)) walkTotal++;
  if (start && walkTotal){ const seen=new Uint8Array(cols*rows); const q=[[start.x,start.y]]; seen[start.y*cols+start.x]=1; let head=0,reach=0;
    while(head<q.length){ const [c,r]=q[head++]; reach++;
      for(const [nc,nr] of [[c+1,r],[c-1,r],[c,r+1],[c,r-1]]) if(nc>=0&&nr>=0&&nc<cols&&nr<rows&&!seen[nr*cols+nc]&&walk(nc,nr)){ seen[nr*cols+nc]=1; q.push([nc,nr]); } }
    const frac=reach/walkTotal;
    if (frac<0.6) bad(file,`reachable region only ${(frac*100|0)}% of walkable ground (map is chopped into sealed pockets)`);
    // every hider spawn should be in the main reachable region
    for (const s of hiders){ if(walk(s.x,s.y)&&!seen[s.y*cols+s.x]) bad(file,`hider spawn (${s.x},${s.y}) is stranded in a sealed pocket`); }
    console.log(`  · ${cols}x${rows}, ${(m.objects||[]).length} cover, ${hiders.length} hider / ${seekers.length} seeker spawns, ${(frac*100|0)}% reachable`);
  }
}
console.log(fails? `\n✗ ${fails} problem(s)` : `\n✓ all maps valid`);
process.exit(fails?1:0);
