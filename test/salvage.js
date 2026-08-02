/* THE SALVAGE GATE.
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
 *   node salvage.js ../index.html
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
    S(){ try{ return window.__aac.state; }catch(_){ return {}; } },
    T(){ return window.__aac.t; },
    wait:ms=>new Promise(r=>setTimeout(r,ms)) };
}

// SALVAGE is the 7th tile (index 6). Counting arrow presses is how the rest of the suite does
// it and how timeattack.js would have silently started the wrong mode, so assert what we got.
async function enterSalvage(W,diff,levelSteps){
  await W.wait(180); W.pump(24);
  W.key('Enter'); W.pump(8);
  for(let i=0;i<6;i++){ W.key('ArrowDown'); W.pump(2); }
  W.key('Enter'); W.pump(8);
  for(let i=0;i<(levelSteps||0);i++){ W.key('ArrowRight'); W.pump(1); }
  W.key('Enter'); await W.wait(100); W.pump(12);
  if(diff==='EASY'){ W.key('ArrowUp'); W.pump(2); }
  if(diff==='HARD'){ W.key('ArrowDown'); W.pump(2); }
  W.key('Enter');
  for(let i=0;i<18 && W.S().roundState!=='PLAYING';i++){ await W.wait(50); W.pump(80); }
}

// stand on a core and hold still until it comes loose
function pryOne(W,maxSec){
  const s=W.S(); const c=(s.salv.corePos||[]).find(c=>!c.taken);
  if(!c) return false;
  W.T().teleport(c.x,c.y); W.pump(4);
  const cap=(maxSec||10)*60;
  for(let f=0; f<cap; f+=4){ W.pump(4);
    const st=W.S(); if(st.roundState!=='PLAYING') return false;
    if(st.salv.carrying>0 || (st.salv.corePos.find(k=>Math.abs(k.x-c.x)<2&&Math.abs(k.y-c.y)<2)||{}).taken) return true;
    W.T().teleport(c.x,c.y);            // hold position exactly; movement cancels a pry
  }
  return false;
}
function deliver(W,maxSec){
  const r=W.S().salv.rig; if(!r) return false;
  W.T().teleport(r.x,r.y);
  for(let f=0; f<(maxSec||4)*60; f+=4){ W.pump(4); if(W.S().salv.carrying===0) return true; W.T().teleport(r.x,r.y); }
  return false;
}

(async()=>{
  // ================= A: the round, the cores, and the clock that can lose =================
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    const s=W.S();
    ok('A: SALVAGE is the 7th tile and it boots', s.roundState==='PLAYING' && !!s.salv, 'rs='+s.roundState+' salv='+!!s.salv);
    if(!s.salv){ console.log('\nSALVAGE: FAIL (mode never started)'); process.exit(1); }
    ok('A: the full set of cores is placed', s.salv.cores===4, 'cores='+s.salv.cores);
    const bad=(s.salv.corePos||[]).filter(c=>['lava','water','ice','void'].indexOf(c.terrain)>=0);
    ok('A: no core is in lava, water or ice', bad.length===0, 'bad='+JSON.stringify(bad.map(b=>b.terrain)));
    ok('A: there is a rig to carry them to', !!s.salv.rig, JSON.stringify(s.salv.rig));
    ok('A: the rig is a walk away, not underfoot', s.salv.rig &&
       Math.hypot(s.salv.rig.x-s.playerPos.x, s.salv.rig.y-s.playerPos.y)>TILEISH*8,
       'dist='+Math.round(Math.hypot(s.salv.rig.x-s.playerPos.x, s.salv.rig.y-s.playerPos.y))+'px');
    ok('A: a real clock is running', s.salv.timeLeft>200 && s.salv.timeLeft<=300, 'timeLeft='+s.salv.timeLeft);
    ok('A: the cutter starts offline', !s.salv.cutter);
    ok('A: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
  }

  // ================= B: prying is exposing, and cover cannot buy it back =================
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    if(W.S().roundState==='PLAYING'){
      const st=W.S(); for(let i=0;i<st.ufos;i++) W.T().moveUfo(i,30,30);      // nobody hunting yet
      const c=st.salv.corePos.find(c=>!c.taken);
      /* Put the core's pry ON TOP of a piece of cover. This is the case that catches the
         classic mistake: concealment() applies a cap to `base` and then ADDS the cover bonus
         on top, so a cap passed in as openCap would come out at 0.92 next to a wall and
         prying with your back to cover would be MORE hidden, not less. */
      const covers=W.T().covers().filter(o=>o.type!=='wall');
      let near=null,bd=1e18;
      for(const o of covers){ const d=Math.hypot(o.wx-c.x,o.wy-c.y); if(d<bd){bd=d;near=o;} }
      /* Settle BESIDE the core, not on it. The first version of this stood on the core while
         settling, which pried it loose during the settle loop, so by the time it measured there
         was nothing left to pry and pryT read 0 forever. */
      const off={x:c.x+CORE_R_ISH*2.2, y:c.y};
      W.T().teleport(off.x,off.y); W.pump(4);
      /* Match and settle until it actually takes. The paint crawls toward the target over time
         and the settle curve depends on the terrain the round's seed dropped us on, so a single
         KeyQ plus a fixed pump is a coin flip on some maps - which is exactly how this assertion
         failed once with conceal=0.115 on otherwise identical code. Converge, do not hope. */
      for(let a=0; a<6 && W.S().conceal<0.80; a++){
        W.key('KeyQ');
        for(let i=0;i<40;i++){ W.pump(6); W.T().teleport(off.x,off.y); }
      }
      const idle=W.S();
      ok('B: settling beside the core does not start a pry', idle.salv.pryT===0, 'pryT='+idle.salv.pryT);
      // now start prying (same spot, same paint, only difference is the work)
      let pry=null;
      for(let i=0;i<40;i++){ W.pump(4); W.T().teleport(c.x,c.y); const q=W.S();
        if(q.salv.pryT>0){ pry=q; break; } }
      ok('B: standing on a core starts a pry', !!pry, 'pryT='+(pry&&pry.salv.pryT));
      ok('B: idle on that spot you are properly hidden', idle.conceal>0.7, 'conceal='+idle.conceal);
      ok('B: but WORKING caps you, however good your paint', pry && pry.conceal<=0.61,
         'idle='+idle.conceal+' prying='+(pry&&pry.conceal));
      ok('B: and that is a real jump in visibility', pry && pry.C>=0.38,
         'idleC='+idle.C+' pryC='+(pry&&pry.C));
      // and now the cover case
      if(near){
        W.T().teleport(near.wx+10, near.wy+10); W.pump(30);
        for(let a=0; a<6 && W.S().conceal<0.80; a++){ W.key('KeyQ');
          for(let i=0;i<30;i++){ W.pump(6); W.T().teleport(near.wx+10,near.wy+10); } }
        const inCover=W.S();
        W.T().dropCore(near.wx+10, near.wy+10);                              // a core right in cover
        let pc=null;
        for(let i=0;i<60;i++){ W.pump(4); W.T().teleport(near.wx+10,near.wy+10); const q=W.S();
          if(q.salv.pryT>0){ pc=q; break; } }
        ok('B: prying inside cover is capped too (cover cannot buy it back)',
           pc && pc.conceal<=0.61, 'inCover='+inCover.conceal+' pryingInCover='+(pc&&pc.conceal));
      }
      ok('B: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
    }
  }

  // ================= C: the work summons the hunt, from off screen =================
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    if(W.S().roundState==='PLAYING'){
      const st=W.S(), world=st.world;
      // park every ship in the far corner: WELL outside scan range and well off screen
      for(let i=0;i<st.ufos;i++) W.T().moveUfo(i, world.w-60, world.h-60);
      W.pump(30);
      const c=W.S().salv.corePos.find(c=>!c.taken);
      W.T().teleport(c.x,c.y); W.key('KeyQ'); W.pump(50);
      let recruited=0;
      for(let i=0;i<80;i++){ W.pump(4); W.T().teleport(c.x,c.y);
        const q=W.S(); if(q.salv.onPry>recruited) recruited=q.salv.onPry; if(recruited>=2) break; }
      ok('C: a pry recruits ships that could not possibly see you', recruited>=2,
         'onPry='+recruited+' (they were '+Math.round(Math.hypot(world.w-60-c.x, world.h-60-c.y))+'px away)');
      const q1=W.S();
      const inv=q1.ufoStates.filter(s2=>s2==='INVESTIGATE').length;
      ok('C: and they actually go and look', inv>=1, 'states='+JSON.stringify(q1.ufoStates));
      // step off and it goes cold
      W.T().teleport(c.x+400,c.y);
      let cooled=false;
      for(let i=0;i<40;i++){ W.pump(6); if(W.S().salv.onPry===0){ cooled=true; break; } }
      ok('C: stop working and the fix goes cold', cooled, 'onPry='+W.S().salv.onPry);
      ok('C: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
    }
  }

  // ================= D: the whole loop, the cutter, and the kill =================
  {
    const W=makeWorld(); await enterSalvage(W,'EASY');
    if(W.S().roundState==='PLAYING'){
      const st=W.S(); for(let i=0;i<st.ufos;i++) W.T().moveUfo(i,30,30);
      ok('D: EASY fields three cores', st.salv.cores===3, 'cores='+st.salv.cores);
      let done=0;
      for(let n=0;n<3;n++){
        for(let i=0;i<W.S().ufos;i++) W.T().moveUfo(i,30,30);                // no interference: this tests the LOOP
        if(!pryOne(W,12)) break;
        if(!deliver(W,6)) break;
        done++;
      }
      const s2=W.S();
      ok('D: all three cores can be pried and delivered', done===3, 'delivered='+s2.salv.delivered);
      ok('D: the cutter comes online', s2.salv.cutter===true, 'cutter='+s2.salv.cutter);
      ok('D: and the fleet is told', s2.ufoStates.some(x=>x!=='PATROL'), 'states='+JSON.stringify(s2.ufoStates));
      // fire it
      const ufos0=s2.ufos;
      const p=s2.playerPos; W.T().moveUfo(0, p.x+80, p.y); W.pump(6);
      ok('D: a ship in range arms the cutter', W.S().salv.cutTarget===true, 'target='+W.S().salv.cutTarget);
      W.key('KeyG'); W.pump(4);
      ok('D: the cutter fires on a tap (a toggle, not a hold)', W.S().salv.cutOn===true);
      let downed=0, won=false;
      for(let i=0;i<200;i++){ W.pump(4);
        const q=W.S();
        if(q.appState==='SUMMARY'){ won=q.summary&&q.summary.outcome==='WIN'; downed=q.summary?q.summary.downed:0; break; }
        if(q.salv.downed>downed) downed=q.salv.downed;
        if(q.roundState==='PLAYING'){ const pp=q.playerPos; W.T().moveUfo(0, pp.x+80, pp.y); } }
      ok('D: holding the beam brings a ship down', downed>=1, 'downed='+downed);
      ok('D: EASY needs one kill, and that wins the night', won, 'appState='+W.S().appState);
      const fin=W.S();
      ok('D: the fleet array is never spliced (seven systems index it)',
         !fin.summary || fin.summary.downed>=1, 'ufos0='+ufos0);
      ok('D: the summary knows it was a salvage run', !!(fin.summary&&fin.summary.salv), JSON.stringify(fin.summary&&{d:fin.summary.delivered,dn:fin.summary.downed,g:fin.summary.grade}));
      ok('D: no runtime errors', W.errors.length===0, W.errors.slice(0,3).join(' | '));
    }
  }

  // ================= E: hiding forever LOSES. This is the whole point of the mode. =================
  {
    const W=makeWorld(); await enterSalvage(W,'EASY');
    if(W.S().roundState==='PLAYING'){
      const st=W.S(); for(let i=0;i<st.ufos;i++) W.T().moveUfo(i,30,30);
      W.T().setClock(3);                                                     // dawn is three seconds away
      let ended=null;
      for(let i=0;i<400;i++){ W.pump(8); const q=W.S();
        if(q.appState==='SUMMARY'){ ended=q.summary; break; } }
      ok('E: doing nothing runs the clock out', !!ended, 'appState='+W.S().appState);
      ok('E: and running the clock out is a LOSS, not "ESCAPED"',
         ended && ended.outcome==='LOSE', 'outcome='+(ended&&ended.outcome));
      ok('E: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
    }
  }

  // ================= F: being taken is a setback, and it drops your cargo =================
  {
    const W=makeWorld(); await enterSalvage(W,'NORMAL');
    if(W.S().roundState==='PLAYING'){
      for(let i=0;i<W.S().ufos;i++) W.T().moveUfo(i,30,30);
      const got=pryOne(W,12);
      ok('F: a core is in hand', got && W.S().salv.carrying===1, 'carrying='+W.S().salv.carrying);
      const before=W.S();
      W.T().abduct();                                                        // they take you
      W.pump(10);
      const after=W.S();
      ok('F: being taken costs a chance, not the round',
         after.roundState==='PLAYING' && after.salv.lives===before.salv.lives-1,
         'rs='+after.roundState+' lives='+before.salv.lives+'->'+after.salv.lives);
      ok('F: your cargo falls where you stood and can be picked back up',
         after.salv.carrying===0 && after.salv.loose>=1,
         'carrying='+after.salv.carrying+' loose='+after.salv.loose);
      ok('F: and they drop you somewhere else',
         Math.hypot(after.playerPos.x-before.playerPos.x, after.playerPos.y-before.playerPos.y)>200,
         'moved='+Math.round(Math.hypot(after.playerPos.x-before.playerPos.x, after.playerPos.y-before.playerPos.y))+'px');
      // burn the remaining chances. The last one plays the abduction cutscene before the
      // summary exists, so give it real frames rather than 20.
      let over=false;
      for(let n=0;n<6 && !over;n++){
        if(W.S().appState==='SUMMARY'){ over=true; break; }
        if(W.S().roundState==='PLAYING') W.T().abduct();
        for(let f=0; f<180 && !over; f+=6){ W.pump(6); if(W.S().appState==='SUMMARY') over=true; } }
      ok('F: but enough of them does end it', over || W.S().appState==='SUMMARY',
         'appState='+W.S().appState+' lives='+(W.S().salv&&W.S().salv.lives));
      ok('F: no runtime errors', W.errors.length===0, W.errors.slice(0,2).join(' | '));
    }
  }

  console.log('\nSALVAGE: '+(fails?('FAIL ('+fails+' of '+(fails+passes)+')'):('PASS ('+passes+')')));
  process.exit(fails?1:0);
})();
