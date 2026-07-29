// CAPTURE: the beam must be able to WIN — and stealth must still beat it.
// Born from the July playtest note "capture still not really possible": BEAM_TRACK_SPD sat
// below walk speed on every difficulty, so holding the stick outran the beam forever.
// Scenario A proves a fleeing, exposed player now gets abducted.
// Scenario B proves the honest escape (match + freeze) still breaks the lock.
// Scenario C proves Jessie's river rule: under a bridge deck you are unseeable.
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'..','index.html');
const html=fs.readFileSync(htmlPath,'utf8');
let failures=0;
function ok(name,cond,detail){ console.log((cond?'OK    ':'FAIL  ')+name+(detail?'  — '+detail:'')); if(!cond)failures++; }

function makeWorld(){
  const errors=[]; const rafQueue=[]; let rafId=1; let VT=1000;
  function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient')return()=>({addColorStop:noop});return typeof p==='string'?noop:undefined;},set(){return true;}});}
  function bp(window){
    try{ const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true,tourDone:true}),
      'aac.progress.v1':JSON.stringify({unlocks:['default','stand','wave','crouch'],equipped:{skin:'default'},stats:{plays:0,catches:0,bestSurvive:0,hardWin:0,heatBest:0},blendbook:{},biomeMedals:{},xp:1000000,challenges:{}})};   // xp maxed → every map unlocked
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
    window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};window.cancelAnimationFrame=()=>{};const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};window.fetch=(url)=>{try{let u=String(url).replace(/^\.?\//,'');const p=path.resolve(path.dirname(htmlPath),u);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));
  }
  const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
  const {window}=dom;
  const pump=n=>{for(let i=0;i<n;i++){VT+=16.7;const cbs=rafQueue.splice(0,rafQueue.length);for(const cb of cbs){try{cb(VT);}catch(e){errors.push('raf '+(e&&e.stack||e));}}}};
  const fire=(t,code)=>window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code}));
  return { window, errors, pump,
    key:c=>{fire('keydown',c);fire('keyup',c);}, down:c=>fire('keydown',c), up:c=>fire('keyup',c),
    S:()=>{try{return window.__aac.state;}catch(_){return{};}}, T:()=>window.__aac.t,
    wait:ms=>new Promise(r=>setTimeout(r,ms)) };
}

// menu-drive into a Survive round: levelSteps = ArrowRight presses on LEVEL_SELECT
async function enterSurvive(W, levelSteps, diff){ // diff: 'EASY'|'NORMAL'
  await W.wait(150); W.pump(20);
  W.key('Enter'); W.pump(6);                 // TITLE → MODE_SELECT
  W.key('ArrowDown'); W.pump(4); W.key('Enter'); W.pump(6);   // Survive → LEVEL_SELECT
  for(let i=0;i<levelSteps;i++){ W.key('ArrowRight'); W.pump(1); }
  W.key('Enter'); await W.wait(80); W.pump(10);               // → DIFFICULTY_SELECT (menuIndex=1: NORMAL)
  if(diff==='EASY'){ W.key('ArrowUp'); W.pump(2); }
  W.key('Enter');
  for(let i=0;i<12 && W.S().roundState!=='PLAYING';i++){ await W.wait(50); W.pump(80); }   // fetch + countdown
}

(async()=>{
  const TILE=32;

  // ---------- A: a fleeing, exposed player CAN be caught ----------
  {
    const W=makeWorld(); await enterSurvive(W,0,'NORMAL');
    let st=W.S();
    ok('A: NORMAL fields a real fleet', st.roundState==='PLAYING' && st.ufos>=4, 'ufos='+st.ufos+' rs='+st.roundState);
    // the complaint scenario: get SPOTTED (chase begins), then just walk away — the old free escape
    const pp=W.S().playerPos;
    W.T().moveUfo(0, pp.x+90, pp.y);
    for(let i=1;i<st.ufos;i++) W.T().moveUfo(i, 60, 60);
    let sawChase=false;
    for(let seg=0; seg<200 && !sawChase; seg++){ const k=(seg&1)?'KeyA':'KeyD'; W.down(k); W.pump(4); W.up(k);
      const s=W.S(); if(s.ufoStates.includes('CHASE')||s.ufoStates.includes('BEAM')){ sawChase=true; break; }
      // hold the sweep overhead until it commits — its own patrol would wander off between polls
      const u=s.ufoPos[0], p=s.playerPos;
      if(u && Math.hypot(u.x-p.x,u.y-p.y)>140) W.T().moveUfo(0, p.x+90, p.y); }
    ok('A: blatant wiggler gets spotted', sawChase);
    let caught=false, sawBeam=false, frames=0;
    for(let seg=0; seg<450 && !caught; seg++){        // ≈60 simulated seconds max
      const s=W.S(); if(s.roundState!=='PLAYING'){ caught = s.roundState==='CAUGHT'; break; }
      const u=s.ufoPos[0], p=s.playerPos;
      const hk=(p.x-u.x)>=0?'KeyD':'KeyA', vk=(p.y-u.y)>=0?'KeyS':'KeyW';   // run AWAY
      W.down(hk); W.down(vk); W.pump(8); frames+=8; W.up(hk); W.up(vk);
      const s2=W.S(); if(s2.ufoStates&&s2.ufoStates.includes('BEAM')) sawBeam=true;
      if(s2.roundState==='CAUGHT') caught=true;
    }
    ok('A: beam engaged on the runner', sawBeam);
    ok('A: running away is no longer a free escape — abducted', caught, 'simSec='+Math.round(frames/60));
    ok('A: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  // ---------- B: match + freeze still breaks the lock (stealth stays the answer) ----------
  {
    const W=makeWorld(); await enterSurvive(W,0,'NORMAL');
    const st=W.S(); const pp=st.playerPos;
    W.T().moveUfo(0, pp.x+70, pp.y);
    for(let i=1;i<st.ufos;i++) W.T().moveUfo(i, 60, 60);
    // wiggle in place: near-zero displacement but the movement beacon keeps C high, so the
    // hunter locks on (standing still would settle into hiding — spawn paint matches grass)
    let beamAt=-1;
    for(let seg=0; seg<220; seg++){ const k=(seg&1)?'KeyA':'KeyD'; W.down(k); W.pump(4); W.up(k);
      const s=W.S(); if(s.roundState!=='PLAYING') break;
      if(s.ufoStates.includes('BEAM')){ beamAt=seg; break; }
      const u=s.ufoPos[0], p=s.playerPos;
      if(u && u.s!=='CHASE' && Math.hypot(u.x-p.x,u.y-p.y)>140) W.T().moveUfo(0, p.x+90, p.y); }
    ok('B: beam locks the stood-still mismatch', beamAt>=0);
    // now the honest escape: instant-match the ground and freeze
    W.key('KeyQ'); W.down('Space');
    let alive=true, beamBroke=false;
    for(let seg=0; seg<160; seg++){ W.pump(8);
      const s=W.S(); if(s.roundState==='CAUGHT'){ alive=false; break; }
      if(!s.ufoStates.includes('BEAM')) beamBroke=true; }
    W.up('Space');
    const fin=W.S();
    ok('B: re-hide breaks the beam', beamBroke);
    ok('B: the hidden player survives the grip', alive, 'rs='+fin.roundState+' C='+fin.C);
    ok('B: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  // ---------- C: Jessie's river rule — under the bridge deck, unseen ----------
  {
    const W=makeWorld(); await enterSurvive(W,1,'NORMAL');   // levelOrder[1] = riverline
    let st=W.S();
    ok('C: riverline booted', st.roundState==='PLAYING' && st.terrain, 'rs='+st.roundState);
    for(let i=1;i<st.ufos;i++) W.T().moveUfo(i, 60, 60);
    // under the northern bridge deck (col 40, row 12) with a hunter parked 4 tiles due north
    const bx=(40+0.5)*TILE, by=(12+0.5)*TILE;
    W.T().teleport(bx,by);
    let maxSusp=0;
    for(let seg=0; seg<60; seg++){ W.T().moveUfo(0, bx, by-4*TILE); W.pump(6);
      const s=W.S(); if(s.ufoPos[0]) maxSusp=Math.max(maxSusp, s.ufoPos[0].susp); }
    const under=W.S();
    ok('C: under the deck the hunter sees NOTHING', maxSusp<0.05, 'maxSusp='+maxSusp+' terrain='+under.terrain);
    // same swimmer in open water, same hunter distance: spotted
    const ox=(41+0.5)*TILE, oy=(16+0.5)*TILE;
    W.T().teleport(ox,oy);
    let openSusp=0;
    for(let seg=0; seg<80; seg++){ W.T().moveUfo(0, ox, oy+4*TILE); W.pump(6);
      const s=W.S(); if(s.ufoPos[0]) openSusp=Math.max(openSusp, s.ufoPos[0].susp); }
    ok('C: the same swimmer in open water is noticed', openSusp>0.5, 'openSusp='+openSusp);
    ok('C: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  // ---------- D: the new tools — tongue zips to cover, burrow sinks into soft ground ----------
  {
    const W=makeWorld(); await enterSurvive(W,0,'NORMAL');
    const st=W.S();
    for(let i=0;i<st.ufos;i++) W.T().moveUfo(i, 60, 60);   // clear the sky for a tool check
    const tree=W.T().covers().find(c=>c.type==='tree');
    ok('D: found an anchor to aim at', !!tree);
    if(tree){
      W.T().teleport(tree.wx-110, tree.wy); W.pump(4);
      const before=W.S().playerPos;
      W.key('KeyB'); W.pump(50);                            // zip + settle
      const s=W.S(); const covers=W.T().covers();
      const nearest=Math.min(...covers.map(c=>Math.hypot(s.playerPos.x-c.wx, s.playerPos.y-c.wy)));
      const moved=Math.hypot(s.playerPos.x-before.x, s.playerPos.y-before.y);
      ok('D: tongue zipped the player to an anchor', nearest<48 && moved>25 && s.ability.tongueCd>0,
         'nearestCover='+Math.round(nearest)+' moved='+Math.round(moved)+' cd='+s.ability.tongueCd);
    }
    // burrow on soft ground: near-invisible while under, resurfaces on its own
    W.pump(30);
    const g=W.S();
    W.key('KeyX'); W.pump(10);
    const b=W.S();
    ok('D: burrow took (soft ground)', b.ability.burrowT>0, 'terrain='+g.terrain+' burrowT='+b.ability.burrowT);
    ok('D: underground is near-invisible', b.C<=0.05, 'C='+b.C);
    W.pump(200);                                            // BURROW_MAX 2.5s expires
    const a=W.S();
    ok('D: the ground gives you back', a.ability.burrowT===0 && a.ability.burrowCd>0, 'burrowT='+a.ability.burrowT);
    ok('D: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  console.log(failures? ('CAPTURE: FAIL ('+failures+')') : 'CAPTURE: PASS — the beam can win, stealth still beats it, the bridge shelters the river, the new tools work');
  process.exit(failures?1:0);
})();
