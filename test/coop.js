/* CO-OP SALVAGE end-to-end: the REAL relay, TWO full game instances, both of them
 * chameleons, one shared pile of cores and an AI fleet that has to be able to see both.
 *
 * The assertions that matter are the ones that would make co-op two solo games sharing a
 * screen: the guest's stick has to move a body the HOST is simulating, the fleet has to be
 * able to target that body, a core pried by either player has to land in the SAME total, and
 * the verdict has to reach both players.
 *   node coop.js [../index.html]
 */
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const PORT=8294;
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')return()=>({addColorStop:noop});return typeof p==='string'?noop:undefined;},set(){return true;}});}
function makeWin(tag){
  const errors=[], rafQueue=[]; let rafId=1, VT=1000;
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, helpAutoShown:true, tourDone:true, perf:'smooth'})};
  const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
    url:`http://localhost:8000/index.html?mp=ws://localhost:${PORT}/ws&hide2p=5`,
    beforeParse(window){
      try{ Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}
      window.HTMLCanvasElement.prototype.getContext=()=>stubCtx();window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};
      window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};window.cancelAnimationFrame=()=>{};
      const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){}};}createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}createBufferSource(){return{connect(){},start(){},stop(){}};}resume(){return Promise.resolve();}};
      window.AudioContext=A;window.webkitAudioContext=A;window.matchMedia=q=>({matches:/min-width|fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});window.navigator.getGamepads=()=>[];Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});window.Element.prototype.setPointerCapture=function(){};window.Element.prototype.releasePointerCapture=function(){};
      window.fetch=(url)=>{try{let u=String(url).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,'').split('?')[0];const p=path.resolve(path.dirname(htmlPath),u);if(fs.existsSync(p)){const b=fs.readFileSync(p,'utf8');return Promise.resolve({ok:true,json:()=>Promise.resolve(JSON.parse(b)),text:()=>Promise.resolve(b)});}}catch(_){}return Promise.resolve({ok:false,json:()=>Promise.reject(0),text:()=>Promise.resolve('')});};
      if(typeof window.WebSocket==='undefined') window.WebSocket=require('ws');   // jsdom builds without WS get the real client
      if(process.env.TRACE==='1'){
        const W=window.WebSocket;
        window.WebSocket=class extends W{ constructor(u){ super(u); console.log('  ['+tag+'] WS new'); }
          close(...a){ console.log('  ['+tag+'] WS close() called from:\n'+new Error().stack.split('\n').slice(2,5).join('\n')); super.close(...a); }
          send(d){ const s=String(d); if(!s.includes('"st"')&&!s.includes('"in"')) console.log('  ['+tag+'] WS send '+s.slice(0,90)); super.send(d); } };
        const of=window.fetch; window.fetch=(u)=>{ console.log('  ['+tag+'] fetch '+u); return of(u); };
      }
      window.addEventListener('error',e=>errors.push(tag+' ERR '+(e.error&&e.error.stack||e.message)));
      window.addEventListener('unhandledrejection',e=>errors.push(tag+' REJ '+(e.reason&&e.reason.stack||e.reason)));
    }});
  const {window}=dom;
  return {
    tag, errors, window,
    pump(n){ for(let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{cb(VT);}catch(e){errors.push(tag+' raf '+(e&&e.stack||e));} } } },
    key(code){ for(const t of['keydown','keyup']) window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code})); },
    down(code){ window.document.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code,key:code})); },
    up(code){ window.document.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code,key:code})); },
    S(){ try{ return window.__aac.state; }catch(_){ return {}; } },
    T(){ try{ return window.__aac.t; }catch(_){ return {}; } },
    rects(){ try{ return window.__aac.navRects()||[]; }catch(_){ return []; } },
    /* Press by LABEL. online.js drove these screens by counting arrow presses, which is how
       adding one button above the one it wanted silently re-pointed it at a different mode.
       Also waits for the screen to be DRAWN: menuConfirm swallows any key whose navList still
       belongs to the previous screen (navListApp !== appState). */
    press(label){ const r=this.rects().find(x=>(x.label||'').toLowerCase().includes(label.toLowerCase()));
      if(!r) return false;
      for(const t of ['pointerdown','pointerup']){
        const e=new window.MouseEvent(t,{bubbles:true,cancelable:true,clientX:r.x+r.w/2,clientY:r.y+r.h/2});
        try{ Object.defineProperty(e,'pointerId',{value:1}); }catch(_){}
        window.document.querySelector('canvas').dispatchEvent(e); }
      return true; },
    T(){ try{ return window.__aac.t; }catch(_){ return {}; } },
  };
}

(async()=>{
  const relay=spawn(process.execPath,['relay.mjs'],{cwd:path.resolve(__dirname,'../server'),env:{...process.env,PORT:String(PORT)}});
  let relayUp=false; relay.stdout.on('data',d=>{ if(String(d).includes('relay')) relayUp=true; });
  for(let i=0;i<50&&!relayUp;i++) await wait(100);
  ok('relay boots', relayUp);
  const done=(c)=>{ try{relay.kill();}catch(_){} process.exit(c); };

  const A=makeWin('host'), B=makeWin('guest');
  const both=async(n,ms)=>{ A.pump(n); B.pump(n); await wait(ms==null?8:ms); };
  await wait(300); await both(20);

  // ---- lobby: host CO-OP (the first button on the ONLINE screen), guest joins ----
  for(let i=0;i<20 && A.S().appState!=='ONLINE'; i++){ A.press('Play Online'); await both(6,30); }
  ok('host reaches ONLINE', A.S().appState==='ONLINE', 'app='+A.S().appState);
  await both(8,40);
  ok('the co-op option exists in the lobby', A.rects().some(r=>/salvage/i.test(r.label||'')),
     'buttons='+JSON.stringify(A.rects().map(r=>r.label)));
  A.press('Host SALVAGE'); await both(6,80);
  for(let i=0;i<60 && !A.S().net.code;i++) await both(2,40);
  const code=A.S().net.code;
  ok('co-op room hosted', !!code && A.S().net.coop===true, 'code='+code+' coop='+A.S().net.coop);

  for(let i=0;i<20 && B.S().appState!=='ONLINE'; i++){ B.press('Play Online'); await both(6,30); }
  await both(8,40);
  B.press('Join with a code'); await both(6,60);
  ok('guest reaches code entry', B.S().appState==='ONLINE_JOIN', 'app='+B.S().appState);
  for(const ch of code) B.key('Key'+ch);
  await both(4,80);
  for(let i=0;i<60 && !(A.S().net.peer&&B.S().net.peer);i++) await both(2,40);
  ok('peers paired', A.S().net.peer===true && B.S().net.peer===true);

  for(let i=0;i<40 && A.S().appState!=='LEVEL_SELECT';i++) await both(2,40);
  ok('host is picking the ground', A.S().appState==='LEVEL_SELECT', 'app='+A.S().appState);
  await both(14,120);
  for(let i=0;i<25 && A.S().net.status!=='playing'; i++){
    const lv=A.rects()[0];
    if(lv){ const e=new A.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true,clientX:lv.x+lv.w/2,clientY:lv.y+lv.h/2});
      try{ Object.defineProperty(e,'pointerId',{value:3}); }catch(_){}
      A.window.document.querySelector('canvas').dispatchEvent(e);
      const u=new A.window.MouseEvent('pointerup',{bubbles:true,cancelable:true,clientX:lv.x+lv.w/2,clientY:lv.y+lv.h/2});
      try{ Object.defineProperty(u,'pointerId',{value:3}); }catch(_){}
      A.window.document.querySelector('canvas').dispatchEvent(u); }
    await both(8,120);
  }
  for(let i=0;i<90 && !(A.S().roundState==='PLAYING'&&B.S().roundState==='PLAYING');i++) await both(6,40);
  const a0=A.S(), b0=B.S();
  console.log('   A:', a0.appState, a0.roundState, 'net='+JSON.stringify(a0.net), 'coop='+JSON.stringify(a0.coop));
  console.log('   B:', b0.appState, b0.roundState, 'net='+JSON.stringify(b0.net), 'coop='+JSON.stringify(b0.coop));
  if(A.errors.length) console.log('   Aerr:', A.errors.slice(0,2));
  if(B.errors.length) console.log('   Berr:', B.errors.slice(0,2));
  ok('both players are in the round', a0.roundState==='PLAYING'&&b0.roundState==='PLAYING',
     'A='+a0.roundState+' B='+b0.roundState);
  ok('the guest joined a SALVAGE round, not a hunt', !!b0.coop && !!b0.salv, 'coop='+!!b0.coop+' salv='+!!b0.salv);
  ok('the guest sees the same objective total', b0.coop.total===a0.coop.total, 'A='+a0.coop.total+' B='+b0.coop.total);
  ok('the pile scaled for two', a0.coop.total>=6, 'total='+a0.coop.total);
  ok('the host is simulating a partner body', !!a0.coop.mate && a0.coop.mate.alive, JSON.stringify(a0.coop.mate));
  ok('there is a real AI fleet (not one remote ship)', a0.ufos>=4, 'ufos='+a0.ufos);

  // ---- the guest's stick has to move a body the HOST owns ----
  const m0={x:a0.coop.mate.x,y:a0.coop.mate.y};
  for(let i=0;i<40;i++){ B.down('KeyD'); await both(6,10); }
  B.up('KeyD'); await both(20,20);
  const m1=A.S().coop.mate;
  ok('the guest drives a body on the host', Math.hypot(m1.x-m0.x,m1.y-m0.y)>40,
     'moved '+Math.round(Math.hypot(m1.x-m0.x,m1.y-m0.y))+'px on the HOST');
  const bp=B.S().playerPos;
  ok('and the guest sees itself in about the same place', Math.hypot(bp.x-m1.x,bp.y-m1.y)<90,
     'host='+m1.x+','+m1.y+' guest='+bp.x+','+bp.y);

  // ---- the fleet must be able to hunt the partner ----
  { const st=A.S(); const mm=st.coop.mate;
    for(let i=0;i<st.ufos;i++) A.T? null : null;
    try{ A.window.__aac.t.teleport(40,40); }catch(_){}          // park the HOST far away
    for(let i=0;i<st.ufos;i++) try{ A.window.__aac.t.moveUfo(i, mm.x+70, mm.y); }catch(_){}
    let sawMate=false;
    for(let i=0;i<80 && !sawMate;i++){ await both(6,10);
      const q=A.S(); if(q.coop.targets.indexOf('mate')>=0) sawMate=true;
      const m=q.coop.mate; for(let j=0;j<1;j++) try{ A.window.__aac.t.moveUfo(j, m.x+70, m.y); }catch(_){} }
    ok('a ship can lock onto the partner, not just the host', sawMate,
       'targets='+JSON.stringify(A.S().coop.targets)); }

  // ---- a core pried by the GUEST lands in the SHARED total ----
  /* Drain the hide phase first. It is measured against the wall clock, so how much
     of it is left when this block starts depends on how fast the machine ran the
     blocks above - which made this the flakiest assertion in the suite. */
  { try{ A.window.__aac.t.endHidePhase(); B.window.__aac.t.endHidePhase(); }catch(_){}
    await both(6,6); }
  { const st=A.S();
    const c=(st.salv.corePos||[]).find(x=>!x.taken);
    try{ for(let i=0;i<st.ufos;i++) A.window.__aac.t.moveUfo(i,30,30); }catch(_){}
    const before=st.coop.delivered;
    let got=false;
    for(let i=0;i<260 && !got;i++){ try{ A.window.__aac.t.mateTo(c.x,c.y); }catch(_){}
      await both(4,4); if(A.S().coop.mate.carrying>0) got=true; }
    if(!got){ const q=A.S(); console.log('   pry probe: mate='+JSON.stringify(q.coop.mate)+
        ' core='+JSON.stringify(c)+' hide2p='+q.salv.hide2p+' grace='+q.salv.spawnGrace+
        ' dist='+Math.round(Math.hypot(q.coop.mate.x-c.x,q.coop.mate.y-c.y))); }
    ok('the guest can pry a core', got, 'carrying='+A.S().coop.mate.carrying);
    const rg=A.S().salv.rig;
    let delivered=false;
    for(let i=0;i<120 && !delivered;i++){ try{ A.window.__aac.t.mateTo(rg.x,rg.y); }catch(_){}
      await both(4,4); if(A.S().coop.delivered>before) delivered=true; }
    ok('and it lands on the SHARED rig', delivered, 'delivered '+before+' -> '+A.S().coop.delivered);
    for(let i=0;i<30;i++) await both(6,10);
    ok('the other player sees it too', B.S().coop.delivered===A.S().coop.delivered,
       'A='+A.S().coop.delivered+' B='+B.S().coop.delivered); }

  // ---- an ability the guest asks for happens on the host ----
  { const l0=A.S().coop.lures;
    B.key('KeyF'); await both(10,30);
    let landed=false;
    for(let i=0;i<40 && !landed;i++){ await both(4,10); if(A.S().coop.lures>l0) landed=true; }
    ok('a clicker thrown by the guest exists on the host', landed, 'lures '+l0+' -> '+A.S().coop.lures); }

  // ---- team lives, and the verdict reaching both players ----
  { const lv=A.S().coop.lives;
    try{ A.window.__aac.t.abduct(); }catch(_){}
    await both(20,20);
    ok('lives are a shared pool', A.S().coop.lives===lv-1, lv+' -> '+A.S().coop.lives);
    for(let i=0;i<40;i++) await both(6,10);
    ok('and the guest sees the same number', B.S().coop.lives===A.S().coop.lives,
       'A='+A.S().coop.lives+' B='+B.S().coop.lives); }

  { try{ A.window.__aac.t.setClock(0.5); }catch(_){}
    let over=false;
    for(let i=0;i<120 && !over;i++){ await both(6,10); if(A.S().appState==='SUMMARY') over=true; }
    ok('the round can end', over, 'A app='+A.S().appState);
    let guestTold=false;
    for(let i=0;i<80 && !guestTold;i++){ await both(6,15); if(B.S().appState==='SUMMARY') guestTold=true; }
    ok('and the verdict reaches the other player', guestTold, 'B app='+B.S().appState);
    const bs=B.S().summary;
    ok('the guest gets a salvage summary, not a hunt one', !!(bs&&bs.salv&&bs.coop), JSON.stringify(bs&&{salv:bs.salv,coop:bs.coop,outcome:bs.outcome})); }

  const errs=A.errors.concat(B.errors);
  ok('no runtime errors on either client', errs.length===0, errs.slice(0,3).join(' | '));
  console.log(fails? `\nCOOP: FAIL (${fails})` : '\nCOOP: PASS — two chameleons, one shared pile, one fleet that can see both');
  done(fails?1:0);
})();
