// P20 ONLINE end-to-end: boots the REAL relay, spins TWO full game instances (jsdom),
// hosts a room, joins by code, host picks a map, both enter the round, snapshots flow,
// the human hunter flies onto the still-unpainted hider, the beam catches — hunter wins.
//   node online.js [../index.html]
const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),{JSDOM}=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const PORT=8291;
let fails=0; const ok=(n,c,x='')=>{ console.log(`${c?'OK  ':'FAIL'}  ${n}${x?'  — '+x:''}`); if(!c) fails++; };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function stubCtx(){const noop=()=>{};return new Proxy({},{get(_t,p){if(p==='canvas')return{width:1280,height:720};if(p==='measureText')return()=>({width:10});if(p==='getImageData')return(x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4))});if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern')return()=>({addColorStop:noop});return typeof p==='string'?noop:undefined;},set(){return true;}});}
function makeWin(tag){
  const errors=[], rafQueue=[]; let rafId=1, VT=1000;
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true, tourDone:true, perf:'smooth'})};
  const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,
    url:`http://localhost:8000/index.html?mp=ws://localhost:${PORT}/ws`,
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
  };
}

(async()=>{
  // 1. the real relay
  const relay=spawn(process.execPath,['relay.mjs'],{cwd:path.resolve(__dirname,'../server'),env:{...process.env,PORT:String(PORT)}});
  let relayUp=false; relay.stdout.on('data',d=>{ if(String(d).includes('relay')) relayUp=true; });
  for(let i=0;i<50&&!relayUp;i++) await wait(100);
  ok('relay boots', relayUp);
  const done=(c)=>{ try{relay.kill();}catch(_){}
    process.exit(c); };

  const A=makeWin('host'), B=makeWin('guest');
  let _lA='',_lB='';
  const trace=()=>{ if(process.env.TRACE!=='1') return; const a=A.S(),b=B.S();
    const sa=(a.appState||'?')+'/'+(a.roundState||'-')+'/'+((a.net&&a.net.online)||'-')+'/'+((a.net&&a.net.status)||'-');
    const sb=(b.appState||'?')+'/'+(b.roundState||'-')+'/'+((b.net&&b.net.online)||'-')+'/'+((b.net&&b.net.status)||'-');
    if(sa!==_lA){ console.log('  A ->',sa); _lA=sa; } if(sb!==_lB){ console.log('  B ->',sb); _lB=sb; } };
  const both=async(n,ms)=>{ A.pump(n); B.pump(n); await wait(ms==null?8:ms); trace(); };
  await wait(300); await both(20);

  // 2. host a room
  A.key('ArrowDown'); A.pump(2); A.key('Enter'); A.pump(4);            // TITLE → Play Online
  ok('host reaches ONLINE screen', A.S().appState==='ONLINE', 'app='+A.S().appState);
  A.key('Enter'); await both(4,60);                                    // Host a game → ws connect
  for(let i=0;i<50 && !A.S().net.code;i++) await both(2,40);
  const code=A.S().net.code;
  ok('room hosted with a code', !!code, 'code='+code);

  // 3. guest joins by typing the code
  B.key('ArrowDown'); B.pump(2); B.key('Enter'); B.pump(4);            // TITLE → Play Online
  B.key('ArrowDown'); B.pump(2); B.key('Enter'); B.pump(4);            // Join with a code
  ok('guest reaches code entry', B.S().appState==='ONLINE_JOIN', 'app='+B.S().appState);
  for(const ch of code) B.key('Key'+ch);
  await both(4,80);
  for(let i=0;i<50 && !(A.S().net.peer&&B.S().net.peer);i++) await both(2,40);
  ok('peers paired', A.S().net.peer===true && B.S().net.peer===true, JSON.stringify({a:A.S().net,b:B.S().net}));
  await both(4,30);                                                    // let the new screen actually draw its buttons
  ok('host sent to pick a map', A.S().appState==='LEVEL_SELECT');

  // 4. host picks the first map → init/ready/start
  A.key('Enter'); await both(6,80);
  for(let i=0;i<80 && !(A.S().appState==='ROUND'&&B.S().appState==='ROUND');i++) await both(3,40);
  ok('both entered the round', A.S().appState==='ROUND'&&B.S().appState==='ROUND', 'a='+A.S().appState+' b='+B.S().appState);
  for(let i=0;i<120 && !(A.S().roundState==='PLAYING'&&B.S().roundState==='PLAYING');i++) await both(4,10);
  ok('both PLAYING after countdown', A.S().roundState==='PLAYING'&&B.S().roundState==='PLAYING');
  ok('roles wired (host hides, guest hunts)', A.S().net.online==='host'&&B.S().net.online==='guest'&&B.S().hunt&&B.S().hunt.bots===1,
     JSON.stringify({a:A.S().net.online,b:B.S().net.online,bots:B.S().hunt&&B.S().hunt.bots}));

  // 5. snapshots flow: the guest's streamed hider tracks the host's real position
  for(let i=0;i<40;i++) await both(3,15);
  const hp=A.S().playerPos, gp=(B.S().hunt&&B.S().hunt.botPos&&B.S().hunt.botPos[0])||null;
  const trackErr=gp?Math.hypot(hp.x-gp.x,hp.y-gp.y):1e9;
  ok('guest sees the hider via snapshots (≤48px)', !!gp && trackErr<=48, gp?('err='+trackErr.toFixed(1)+'px'):'no streamed hider');

  // 6. the hunt: guest flies onto the hider (who stays still and unpainted — C stays high)
  let caught=false;
  for(let step=0; step<900 && !caught; step++){
    const b=B.S(); if(!b.hunt) break;
    const me=b.playerPos, target=(b.hunt.botPos&&b.hunt.botPos[0])||me;
    const dx=target.x-me.x, dy=target.y-me.y;
    const hk=Math.abs(dx)>6?(dx>0?'KeyD':'KeyA'):null, vk=Math.abs(dy)>6?(dy>0?'KeyS':'KeyW'):null;
    if(hk) B.down(hk); if(vk) B.down(vk);
    await both(4,12);
    if(hk) B.up(hk); if(vk) B.up(vk);
    if(A.S().roundState==='CAUGHT'||A.S().appState==='SUMMARY') caught=true;
  }
  ok('the human hunter caught the hider', caught, 'hostState='+A.S().roundState+'/'+A.S().appState);

  // 7. both land on the verdict
  for(let i=0;i<120 && !(A.S().appState==='SUMMARY'&&B.S().appState==='SUMMARY');i++) await both(4,15);
  ok('both reach SUMMARY', A.S().appState==='SUMMARY'&&B.S().appState==='SUMMARY', 'a='+A.S().appState+' b='+B.S().appState);
  ok('host lost (ABDUCTED), guest won', A.S().summary&&A.S().summary.outcome==='LOSE' && B.S().summary&&B.S().summary.outcome==='WIN',
     JSON.stringify({a:A.S().summary&&A.S().summary.outcome, b:B.S().summary&&B.S().summary.outcome}));

  const errs=[...new Set([...A.errors,...B.errors])];
  if(errs.length){ console.log('ERRORS:'); errs.slice(0,8).forEach(e=>console.log('  • '+e.split('\n').slice(0,2).join(' '))); fails+=errs.length; }
  console.log(fails? `\nONLINE: FAIL (${fails})` : '\nONLINE: PASS — two humans, one relay, one catch: the 1v1 works end to end; 0 errors');
  done(fails?1:0);
})();
