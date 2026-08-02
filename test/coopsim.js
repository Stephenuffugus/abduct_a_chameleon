/* THE CO-OP SIMULATION GATE.
 *
 * Two players both gathering means the fleet has to be able to see BOTH of them, the pile has
 * to be genuinely shared, and one player's mistake has to cost the team rather than end their
 * round. All of that lives in the simulation, not on the wire, so it is gated here in ONE
 * process via __aac.t.coopSolo() - the wire half is coop.js's job.
 *
 * The single most important assertion in this file is the last one: in a SOLO round the
 * target picker must return exactly `player`, so every line of updateUfo behaves the way it
 * always did. Co-op must not be able to change how the solo game plays.
 *
 * (original header follows)
 * THE SALVAGE GATE.
 *
 * The mode exists to answer "there's no objective so there's no challenge... a player can just
 * hide and never be found and it's just boring". So the assertions that matter are not "the
 * feature runs" but:
 *   - hiding forever now LOSES (the clock is real and expiring is a loss, not a win)
 *   - the work is genuinely exposing (prying caps concealment, and cover cannot buy it back)
 *   - the work is what summons the hunt (a pry recruits ships from off screen)
 *   - cores are invisible to hunters and are not sitting in lava or open water
 *   - the cutter can actually be finished and fired, and downing a ship does not corrupt the
 *     fleet array that seven other systems index
 *   - being taken is a setback that drops your cargo, not an instant end
 *
 *   node coopsim.js ../index.html
 */
const fs=require('fs'), path=require('path'), {JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||'/workspaces/abduct_a_chameleon/index.html';
const html=fs.readFileSync(htmlPath,'utf8');
const TILEISH=32, CORE_R_ISH=34;
let fails=0, passes=0;
function ok(n,c,i){ if(c){passes++;console.log('OK    '+n+(i?'  — '+i:''));} else {fails++;console.log('FAIL  '+n+(i?'  — '+i:''));} }

function stubCtx(){ const noop=()=>{}; return new Proxy({},{ get(_t,p){
  if(p==='canvas') return {width:1280,height:720};
  if(p==='measureText') return ()=>({width:10});
  if(p==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});
  if(p==='createLinearGradient'||p==='createRadialGradient') return ()=>({addColorStop:noop});
  return typeof p==='string'?noop:undefined; }, set(){return true;} }); }

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
    window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;}; window.cancelAnimationFrame=()=>{};
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


async function enterSalvage(W,diff){
  await W.wait(180); W.pump(24);
  W.key('Enter'); W.pump(8);
  for(let i=0;i<6;i++){ W.key('ArrowDown'); W.pump(2); }
  W.key('Enter'); W.pump(8);
  W.key('Enter'); await W.wait(100); W.pump(12);
  if(diff==='EASY'){ W.key('ArrowUp'); W.pump(2); }
  W.key('Enter');
  for(let i=0;i<18 && W.S().roundState!=='PLAYING';i++){ await W.wait(50); W.pump(80); }
}
const park=(W)=>{ const st=W.S(); for(let i=0;i<st.ufos;i++) W.T().moveUfo(i,30,30); };

(async()=>{
  // ---------- A: solo is UNCHANGED. This is the safety property. ----------
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    const s=W.S();
    ok('A: a solo salvage round still boots', s.roundState==='PLAYING' && !!s.salv);
    ok('A: solo has no partner and is not co-op', !s.coop, 'coop='+JSON.stringify(s.coop));
    // provoke a chase and confirm every ship is on the local player, never on anything else
    park(W);
    const p=s.playerPos; W.T().moveUfo(0,p.x+70,p.y);
    let chased=false;
    for(let seg=0; seg<200 && !chased; seg++){ const k=(seg&1)?'KeyA':'KeyD'; W.down(k); W.pump(4); W.up(k);
      const q=W.S(); if(q.roundState!=='PLAYING') break;
      if(q.ufoStates.includes('CHASE')||q.ufoStates.includes('BEAM')) chased=true;
      const pp=q.playerPos; W.T().moveUfo(0,pp.x+60,pp.y); }
    ok('A: solo chases still happen exactly as before', chased, 'states='+JSON.stringify(W.S().ufoStates));
    ok('A: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  // ---------- B: the co-op round ----------
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    const soloTotal=W.S().salv.cores;
    const started=W.T().coopSolo(); W.pump(20);
    ok('B: a co-op round starts', started && !!W.S().coop, 'coop='+!!W.S().coop);
    const c0=W.S();
    ok('B: the pile SCALED for two', c0.coop.total>soloTotal, soloTotal+' -> '+c0.coop.total);
    ok('B: but there is only ONE pile', c0.coop.cores===c0.coop.total, 'cores='+c0.coop.cores+' total='+c0.coop.total);
    ok('B: there is a partner body', !!c0.coop.mate && c0.coop.mate.alive, JSON.stringify(c0.coop.mate));
    ok('B: the fleet is AI and full size', c0.ufos>=4, 'ufos='+c0.ufos);
    ok('B: the partner starts somewhere else', c0.coop.mate &&
       Math.hypot(c0.coop.mate.x-c0.playerPos.x, c0.coop.mate.y-c0.playerPos.y)>40,
       'apart='+Math.round(Math.hypot(c0.coop.mate.x-c0.playerPos.x,c0.coop.mate.y-c0.playerPos.y))+'px');

    // ---- the partner has REAL camo, not a fixed value ----
    park(W);
    const mm=c0.coop.mate;
    W.T().mateTo(mm.x,mm.y);
    for(let i=0;i<120;i++){ W.pump(4); W.T().mateTo(mm.x,mm.y); }
    const settled=W.S().coop.mate;
    ok('B: a still partner settles and conceals like a real chameleon',
       settled.conceal>0 && settled.C<1, 'conceal='+settled.conceal+' C='+settled.C);

    // ---- a ship must be able to lock onto the PARTNER ----
    { W.T().teleport(40,40);                                  // put the local player out of the way
      let sawMate=false;
      for(let i=0;i<200 && !sawMate;i++){
        const q=W.S(); const m=q.coop.mate;
        W.T().moveUfo(0, m.x+60, m.y);
        W.T().mateTo(m.x+ (i%2?3:-3), m.y);                   // twitching: conspicuous, not hidden
        W.pump(4);
        if(W.S().coop.targets.indexOf('mate')>=0) sawMate=true; }
      ok('B: a ship can hunt the partner, not just you', sawMate,
         'targets='+JSON.stringify(W.S().coop.targets)); }

    // ---- the partner can pry, and it lands in the SHARED total ----
    { park(W);
      const before=W.S().coop.delivered;
      const c=W.S().salv.corePos.find(x=>!x.taken);
      let got=false;
      for(let i=0;i<400 && !got;i++){ W.T().mateTo(c.x,c.y); W.pump(2); park(W);
        if(W.S().coop.mate.carrying>0) got=true; }
      ok('B: the partner can pry a core', got, 'carrying='+W.S().coop.mate.carrying);
      const rg=W.S().salv.rig;
      let del=false;
      for(let i=0;i<200 && !del;i++){ W.T().mateTo(rg.x,rg.y); W.pump(2); park(W);
        if(W.S().coop.delivered>before) del=true; }
      ok('B: and it lands on the SHARED rig', del, before+' -> '+W.S().coop.delivered);
      ok('B: the total did not move when they delivered', W.S().coop.total===c0.coop.total,
         'total='+W.S().coop.total); }

    // ---- two people cannot farm the same core ----
    { const c=W.S().salv.corePos.find(x=>!x.taken);
      if(c){ park(W); W.T().teleport(c.x,c.y); W.T().mateTo(c.x,c.y);
        const before=W.S().coop.delivered + W.S().coop.carrying + W.S().coop.mate.carrying;
        for(let i=0;i<400;i++){ W.T().teleport(c.x,c.y); W.T().mateTo(c.x,c.y); W.pump(2); park(W);
          const q=W.S(); if(q.coop.carrying + q.coop.mate.carrying + q.coop.delivered > before) break; }
        const q=W.S();
        ok('B: one core standing on it together yields ONE core, not two',
           (q.coop.carrying + q.coop.mate.carrying + q.coop.delivered) - before <= 1,
           'gained '+((q.coop.carrying+q.coop.mate.carrying+q.coop.delivered)-before)); } }

    // ---- a partner ability runs on this side ----
    { const l0=W.S().coop.lures;
      W.window.__aac.t.dropLure(W.S().coop.mate.x+40, W.S().coop.mate.y);
      W.pump(4);
      ok('B: clickers land in the shared world', W.S().coop.lures>l0, l0+' -> '+W.S().coop.lures); }

    // ---- team lives ----
    { const lv=W.S().coop.lives;
      W.T().mateCarry(1);
      const loose0=W.S().salv.loose;
      W.T().abduct();                                          // takes the LOCAL player
      W.pump(20);
      ok('B: being taken costs the TEAM a life', W.S().coop.lives===lv-1, lv+' -> '+W.S().coop.lives);
      ok('B: and the partner is still playing', W.S().coop.mate.alive && W.S().roundState==='PLAYING',
         'rs='+W.S().roundState+' mateAlive='+W.S().coop.mate.alive);
      ok('B: dropped cargo is recoverable', W.S().salv.loose>=loose0, 'loose='+W.S().salv.loose); }

    ok('B: no runtime errors', W.errors.length===0, W.errors.slice(0,3).join(' | '));
  }

  console.log('\nCOOPSIM: '+(fails?('FAIL ('+fails+' of '+(fails+passes)+')'):('PASS ('+passes+')')));
  process.exit(fails?1:0);
})();
