/* THE RUNNER GATE — "I ran in a line back and forth and never got abducted" (Stephen, Aug 2).
 *
 * capture.js already claims "running away is no longer a free escape", but it allows 60
 * simulated seconds and it keeps teleporting the saucer back on top of the player whenever
 * it drifts. Under those conditions almost any pursuit passes. The complaint was never
 * "impossible", it was "takes far too long", and a 60 second budget cannot see that.
 *
 * This measures the thing that was actually complained about, with no help for the ship:
 *   1. straight-line sprint, saucer starting one scan radius directly behind
 *   2. back-and-forth reversal, which the kinematics say is the DOMINANT strategy
 *      (a 180 costs the saucer nothing along the run axis, and buys the player 74px)
 * and it asserts a real time budget at each difficulty.
 *
 * The other half matters just as much and is asserted here too: a matched, settled player
 * hugging cover must STILL be safe. It would be trivial to make the runner catchable by
 * making the game brutal; the point is to kill running as a strategy while leaving hiding
 * exactly as strong as it was.
 *
 *   node runner.js ../index.html [EASY|NORMAL|HARD]
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||'/workspaces/abduct_a_chameleon/index.html';
const ONLY=(process.argv[3]||'').toUpperCase();
const html=fs.readFileSync(htmlPath,'utf8');

// Budgets: seconds of simulated play from the moment the ship commits to a CHASE.
// Derived from the closed-form pursuit model (see the commit message), with headroom.
const BUDGET={ EASY:{straight:14, juke:20}, NORMAL:{straight:10, juke:14}, HARD:{straight:8, juke:11} };

let fails=0, passes=0;
function ok(name,cond,info){ if(cond){ passes++; console.log('OK    '+name+(info?'  — '+info:'')); }
  else { fails++; console.log('FAIL  '+name+(info?'  — '+info:'')); } }

function stubCtx(){ const noop=()=>{}; return new Proxy({},{ get(_t,p){
  if(p==='canvas') return {width:1280,height:720};
  if(p==='measureText') return ()=>({width:10});
  if(p==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});
  if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop});
  return typeof p==='string'?noop:undefined; }, set(){ return true; } }); }

function makeWorld(){
  const errors=[], rafQueue=[]; let rafId=1, VT=1000;
  function bp(window){
    const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, helpAutoShown:true, tourDone:true, perf:'smooth'})};
    try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{
      getItem:k=>k in _ls?_ls[k]:null, setItem:(k,v)=>{_ls[k]=String(v);}, removeItem:k=>{delete _ls[k];},
      clear:()=>{for(const k in _ls)delete _ls[k];}, key:i=>Object.keys(_ls)[i]||null,
      get length(){return Object.keys(_ls).length;}}}); }catch(_){}
    window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();
    window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};
    window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};
    window.cancelAnimationFrame=()=>{};
    const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
      createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
      createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){}};}
      createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}
      createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}
      createBufferSource(){return{connect(){},start(){},stop(){}};}
      createDynamicsCompressor(){return{connect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
      resume(){return Promise.resolve();}};
    window.AudioContext=A; window.webkitAudioContext=A;
    window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
    window.navigator.getGamepads=()=>[];
    Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});
    window.Element.prototype.setPointerCapture=function(){}; window.Element.prototype.releasePointerCapture=function(){};
    window.fetch=(url)=>{ try{ const u=String(url).replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
      if(fs.existsSync(p)){ const b=fs.readFileSync(p,'utf8');
        return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)}); } }catch(_){}
      return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')}); };
    window.addEventListener('error',e=>errors.push('ERR '+(e.error&&e.error.stack||e.message)));
    window.addEventListener('unhandledrejection',e=>errors.push('REJ '+(e.reason&&e.reason.stack||e.reason)));
  }
  const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse:bp});
  const {window}=dom, doc=window.document;
  return { window, doc, errors,
    pump(n){ for(let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length);
      for(const cb of cbs){ try{ cb(VT); }catch(e){ errors.push('raf '+(e&&e.stack||e)); } } } },
    key(code){ for(const t of ['keydown','keyup']) doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code})); },
    down(code){ doc.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code,key:code})); },
    up(code){ doc.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code,key:code})); },
    S(){ try{ return window.__aac.state; }catch(_){ return {}; } },
    T(){ return window.__aac.t; },
    wait:ms=>new Promise(r=>setTimeout(r,ms)) };
}

async function enterSurvive(W,diff){
  await W.wait(160); W.pump(24);
  W.key('Enter'); W.pump(6);                                   // TITLE -> MODE_SELECT
  W.key('ArrowDown'); W.pump(4); W.key('Enter'); W.pump(6);    // Survive -> LEVEL_SELECT
  W.key('Enter'); await W.wait(90); W.pump(10);                // first level -> DIFFICULTY_SELECT (menuIndex 1 = NORMAL)
  if(diff==='EASY') { W.key('ArrowUp'); W.pump(2); }
  if(diff==='HARD') { W.key('ArrowDown'); W.pump(2); }
  W.key('Enter');
  for(let i=0;i<14 && W.S().roundState!=='PLAYING';i++){ await W.wait(50); W.pump(80); }
}

// park every ship except #0 in a far corner so exactly one pursuer is under test
function soloShip(W){ const st=W.S(); for(let i=1;i<st.ufos;i++) W.T().moveUfo(i,20,20); }

/* A CLEAN ROOM, because round seeds come from the wall clock and the first version of this
   gate swung between 5.7s and "never" on identical code. That is not a measurement.
   Terrain saving a runner is a legitimate escape and the game should allow it, but it is not
   what is being measured here, so put the runner somewhere terrain cannot intervene: a patch
   of ordinary walkable ground with no cover within 150px and room to run. Found by probing,
   not assumed, since maps differ. */
function findOpenSpot(W){
  const world=W.S().world, covers=W.T().covers();
  const LAND={grass:1,dirt:1,sand:1,rock:1,concrete:1,metal:1,ash:1,moss:1,snow:1};
  let best=null, bestClear=-1;
  for(let gx=0; gx<14; gx++) for(let gy=0; gy<10; gy++){
    const x=260+gx*((world.w-520)/13), y=200+gy*((world.h-400)/9);
    let clear=1e9; for(const c of covers){ const d=Math.hypot(c.wx-x,c.wy-y); if(d<clear) clear=d; }
    if(clear<=bestClear) continue;
    W.T().teleport(x,y); W.pump(2);
    const t=W.S().terrain; if(!LAND[t]) continue;
    bestClear=clear; best={x,y,clear,terrain:t};
  }
  if(best){ W.T().teleport(best.x,best.y); W.pump(2); }
  return best;
}

/* Drive until the ship commits to a CHASE, then return. The player wiggles in the open so
   conspicuity pins high; the ship is nudged back overhead only during this warm-up, never
   during the measured run. */
function provoke(W){
  for(let seg=0; seg<260; seg++){
    const k=(seg&1)?'KeyA':'KeyD'; W.down(k); W.pump(4); W.up(k);
    const s=W.S(); if(s.roundState!=='PLAYING') return false;
    if(s.ufoStates.includes('CHASE')||s.ufoStates.includes('BEAM')) return true;
    const u=s.ufoPos[0], p=s.playerPos;
    if(u && Math.hypot(u.x-p.x,u.y-p.y)>120) W.T().moveUfo(0, p.x+80, p.y);
  }
  return false;
}

/* Set the starting gun identically every time: the runner in open ground, the ship exactly
   one scan radius directly behind them on the run axis, already committed. From here on the
   ship gets no help of any kind. */
function lineUp(W){
  const spot=findOpenSpot(W);
  const got=provoke(W);
  const p=W.S().playerPos, R=W.S().region.scanR;
  W.T().teleport(spot?spot.x:p.x, spot?spot.y:p.y); W.pump(1);
  const p2=W.S().playerPos;
  W.T().moveUfo(0, p2.x-R, p2.y); W.pump(1);
  return { got, spot };
}

/* The measured run. mode 'straight' holds one direction; mode 'juke' reverses every
   `flipS` seconds, which is Stephen's exact input. No help for the ship after this point.
   A treadmill wrap keeps a long run inside the map without ever changing the geometry
   between the two actors (player and ship are moved by the same delta). */
function measure(W, mode, capS, flipS){
  const st0=W.S(), world=st0.world;
  let dir=1, frames=0, sawBeam=false, flipT=0;
  const FR=4;                                   // frames per input segment
  while(frames < capS*60){
    const s=W.S();
    if(s.roundState!=='PLAYING') return { caught:s.roundState==='CAUGHT', sec:frames/60, sawBeam };
    if(s.ufoStates && s.ufoStates.includes('BEAM')) sawBeam=true;
    if(mode==='juke'){ flipT+=FR/60; if(flipT>=flipS){ flipT=0; dir=-dir; } }
    if(process.env.AAC_TRACE && frames%30===0){ const u=s.ufoPos[0], p=s.playerPos;
      console.log('      t='+(frames/60).toFixed(1)+'  st='+(u&&u.s)+'  d='+(u?Math.round(Math.hypot(u.x-p.x,u.y-p.y)):'-')+
                  '  susp='+(u&&u.susp)+'  beam='+(u&&u.beam)+'  C='+s.C+'  terr='+s.terrain); }
    const k = dir>0 ? 'KeyD' : 'KeyA';
    W.down(k); W.pump(FR); W.up(k); frames+=FR;
    // treadmill: keep the runner off the map edge without altering the chase geometry
    const p=W.S().playerPos, u=W.S().ufoPos[0];
    if(p.x > world.w-140 || p.x < 140){
      const nx = p.x > world.w-140 ? 200 : world.w-200, dx = nx-p.x;
      W.T().teleport(nx, p.y); if(u) W.T().moveUfo(0, u.x+dx, u.y);
    }
  }
  return { caught:false, sec:frames/60, sawBeam };
}

(async()=>{
  const DIFFS = ONLY ? [ONLY] : ['EASY','NORMAL','HARD'];
  for(const D of DIFFS){
    const B=BUDGET[D];
    // ---- 1. the straight-line sprint ----
    { const W=makeWorld(); await enterSurvive(W,D);
      const st=W.S();
      ok(D+': round booted', st.roundState==='PLAYING', 'rs='+st.roundState+' ufos='+st.ufos);
      if(st.roundState==='PLAYING'){
        const t=st.tune;
        console.log('      tune: chase='+t.chase+' track='+t.track+' beamR='+t.beamR+' walk='+t.walk+' lock='+t.lock);
        ok(D+': a chasing ship outruns a walking player', t.chase>t.walk+15, 'chase='+t.chase+' walk='+t.walk);
        ok(D+': the tractor beam outruns a walking player', t.track>t.walk, 'track='+t.track+' walk='+t.walk);
        /* The constraint the original numbers could not satisfy: a pursuing saucer turns at
           TURN_RATE*2 = 6.4 rad/s, so its turning circle is track/6.4. If that circle is
           bigger than the beam ring, the ship physically cannot hold station over a moving
           target and the lock can never complete however fast you make it. */
        ok(D+': the beam ring can contain the tracker turning circle', t.track/6.4 < t.beamR,
           'turnRadius='+ (t.track/6.4).toFixed(1) +' beamR='+t.beamR);
        soloShip(W);
        const lu=lineUp(W);
        ok(D+': the runner gets chased', lu.got, lu.spot?('openGround '+lu.spot.terrain+' clear='+Math.round(lu.spot.clear)+'px'):'no open spot found');
        const r=measure(W,'straight',B.straight+6);
        ok(D+': a straight-line runner is abducted', r.caught, 'sec='+r.sec.toFixed(1)+' sawBeam='+r.sawBeam);
        ok(D+': and inside '+B.straight+'s', r.caught && r.sec<=B.straight, 'sec='+r.sec.toFixed(1));
        ok(D+': no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
      }
    }
    // ---- 2. the back-and-forth, which is what he actually did ----
    { const W=makeWorld(); await enterSurvive(W,D);
      if(W.S().roundState==='PLAYING'){
        soloShip(W); lineUp(W);
        const r=measure(W,'juke',B.juke+6,2.0);   // 2.0s period is the measured worst case for the ship
        ok(D+': a back-and-forth runner is abducted', r.caught, 'sec='+r.sec.toFixed(1)+' sawBeam='+r.sawBeam);
        ok(D+': and inside '+B.juke+'s', r.caught && r.sec<=B.juke, 'sec='+r.sec.toFixed(1));
      }
    }
  }

  /* ---- 3. THE COUNTER-GATE. Hiding must be exactly as strong as it was. ----
     Without this, every assertion above could be satisfied by simply making the hunters
     brutal, which would delete the game rather than fix it. */
  { const W=makeWorld(); await enterSurvive(W,'NORMAL');
    if(W.S().roundState==='PLAYING'){
      soloShip(W);
      const covers=W.T().covers().filter(c=>c.type!=='wall');
      const p0=W.S().playerPos;
      let near=covers[0]; let bd=1e18;
      for(const c of covers){ const d=(c.wx-p0.x)**2+(c.wy-p0.y)**2; if(d<bd){bd=d;near=c;} }
      if(near){ W.T().teleport(near.wx+14, near.wy+14); }
      W.key('KeyQ');                              // match the ground under us
      W.pump(80);
      W.down('Space');                            // and settle
      W.pump(180);
      const pp=W.S().playerPos; W.T().moveUfo(0, pp.x+40, pp.y);   // park a saucer right on top
      let maxSusp=0, caught=false;
      for(let i=0;i<200;i++){ W.pump(8); const s=W.S();
        if(s.roundState==='CAUGHT'){ caught=true; break; }
        for(const u of (s.ufoPos||[])) if(u.susp>maxSusp) maxSusp=u.susp; }
      W.up('Space');
      const f=W.S();
      ok('FAIR: a matched, settled player in cover is not caught', !caught, 'C='+f.C+' conceal='+f.conceal);
      ok('FAIR: and never even escalates to a chase', maxSusp<0.85, 'maxSusp='+maxSusp.toFixed(2)+' C='+f.C);
    }
  }

  console.log('\nRUNNER: '+(fails?('FAIL ('+fails+' of '+(fails+passes)+')'):('PASS ('+passes+')')));
  process.exit(fails?1:0);
})();
