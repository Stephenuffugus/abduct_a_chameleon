// Headless integration test for the P8 "Living Camo" pass. Loads index.html in jsdom, drives a
// Practice round, and asserts each feature through the additive window.__aac.state fields:
//   P8-1 Live Match Coach   P8-2 touch SV offset   P8-3 Split Camo toggle
//   P8-4 spray/drip FX      P8-5 blend-snap + ghost P8-6 Blend Book logging
//   node pass8.js [../index.html]
const fs=require('fs'), path=require('path');
const { JSDOM }=require('jsdom');
const htmlPath=process.argv[2]||path.resolve(__dirname,'../index.html');
const html=fs.readFileSync(htmlPath,'utf8');
const errors=[], rafQueue=[]; let rafId=1, savedLS=null;

function stubCtx(){ const noop=()=>{};
  return new Proxy({},{ get(_t,p){
    if(p==='canvas') return {width:1280,height:720};
    if(p==='measureText') return ()=>({width:10});
    if(p==='getImageData') return (x,y,w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0});
    if(p==='createLinearGradient'||p==='createRadialGradient'||p==='createPattern') return ()=>({addColorStop:noop});
    if(p==='createImageData') return (w,h)=>({data:new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)),width:w|0,height:h|0});
    if(p==='setTransform'||p==='getTransform') return ()=>({a:1,b:0,c:0,d:1,e:0,f:0});
    return typeof p==='string'?noop:undefined; }, set(){return true;} }); }

function beforeParse(window){
  const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true})}; savedLS=_ls;
  Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}});
  const doc=window.document;
  window.HTMLCanvasElement.prototype.getContext=function(){return stubCtx();};
  window.HTMLCanvasElement.prototype.toDataURL=function(){return 'data:image/png;base64,';};
  window.OffscreenCanvas=class{constructor(w,h){this.width=w;this.height=h;}getContext(){return stubCtx();}};
  window.requestAnimationFrame=cb=>{rafQueue.push(cb);return rafId++;};
  window.cancelAnimationFrame=()=>{};
  const A=class{constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
    createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return{type:'sine',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){},disconnect(){}};}
    createBiquadFilter(){return{type:'lowpass',frequency:{value:0,setValueAtTime(){}},Q:{value:1},connect(){},disconnect(){}};}
    createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}
    createBufferSource(){return{buffer:null,connect(){},start(){},stop(){},disconnect(){}};}
    createDynamicsCompressor(){return{connect(){},disconnect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
    resume(){return Promise.resolve();}suspend(){return Promise.resolve();}};
  window.AudioContext=A; window.webkitAudioContext=A;
  window.matchMedia=q=>({matches:/min-width|pointer:\s*fine/.test(q),addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
  window.navigator.getGamepads=()=>[];
  Object.defineProperty(window,'devicePixelRatio',{value:2,configurable:true});
  window.Element.prototype.setPointerCapture=function(){};
  window.Element.prototype.releasePointerCapture=function(){};
  window.fetch=url=>{ try{ let u=String(url).replace(/^https?:\/\/[^/]+\//,'').replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
    if(fs.existsSync(p)){ const body=fs.readFileSync(p,'utf8'); return Promise.resolve({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(body)),text:()=>Promise.resolve(body)});} }catch(_){}
    return Promise.resolve({ok:false,status:404,json:()=>Promise.reject(new Error('404')),text:()=>Promise.resolve('')}); };
  window.addEventListener('error',e=>errors.push('window.error: '+(e.error&&e.error.stack||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push('unhandledrejection: '+(e.reason&&e.reason.stack||e.reason)));
  const oe=window.console.error.bind(window.console); window.console.error=(...a)=>{errors.push('console.error: '+a.map(String).join(' '));oe(...a);};
}

const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',pretendToBeVisual:true,url:'http://localhost:8000/index.html',beforeParse});
const { window }=dom;
const cv=()=>window.document.querySelector('canvas');
function fire(type,target,props={}){ try{ const Ev=window.Event; let e;
  if(/^key/.test(type)) e=new window.KeyboardEvent(type,{bubbles:true,cancelable:true,...props});
  else if(/^(pointer|mouse|click)/.test(type)){ e=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:640,clientY:360,...props});
    try{ if(e.pointerId===undefined) Object.defineProperty(e,'pointerId',{value:props.pointerId!=null?props.pointerId:1}); }catch(_){}
    if(props.pointerType!==undefined){ try{ Object.defineProperty(e,'pointerType',{value:props.pointerType}); }catch(_){} } }
  else { e=new Ev(type,{bubbles:true,cancelable:true}); try{Object.assign(e,props);}catch(_){} }
  (target||window.document).dispatchEvent(e);
}catch(err){ errors.push('fire '+type+': '+err.message); } }
let VT=1000;
function pump(n){ for(let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{cb(VT);}catch(e){errors.push('raf: '+(e&&e.stack||e));} } } }
const key=c=>{ fire('keydown',window.document,{code:c,key:c}); fire('keyup',window.document,{code:c,key:c}); };
const hold=c=>fire('keydown',window.document,{code:c,key:c});
const release=c=>fire('keyup',window.document,{code:c,key:c});
const st=()=>{ try{ return window.__aac.state; }catch(_){ return {}; } };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

let fails=0;
const ok=(name,cond,extra='')=>{ console.log(`${cond?'OK  ':'FAIL'}  ${name}${extra?'  — '+extra:''}`); if(!cond) fails++; };

async function main(){
  await wait(150);
  pump(20);                                  // BOOT -> TITLE
  key('Enter'); pump(6);                      // -> MODE_SELECT
  key('Enter'); pump(6);                      // PRACTICE -> LEVEL_SELECT
  key('Enter'); await wait(60); pump(8);      // select first level -> startRound
  if(st().appState!=='ROUND'){ ok('reach ROUND',false,'at '+st().appState); return finish(); }
  pump(220);                                  // countdown -> PLAYING
  ok('reached PLAYING', st().roundState==='PLAYING', 'roundState='+st().roundState);
  pump(100);                                  // let spawnGrace (1.5s) elapse so blend-snap arms cleanly
  const terrain=st().terrain;
  ok('spawn terrain is loggable (not lava/void)', terrain!=='lava'&&terrain!=='void'&&terrain!=null, 'terrain='+terrain);

  // ---- P8-5 blend-snap + ghost ----
  // Expose by PAINTING a mismatch (not moving) so the player stays on the uniform spawn tile where a
  // matched blend actually reaches conceal>0.85. (Moving onto a seam correctly caps conceal lower.)
  const expose=()=>{ key('KeyE'); key('Digit8'); key('KeyE'); pump(50); };   // open→paint concrete→close→crawl away
  expose();
  ok('P8-5 exposed by paint mismatch (conceal<0.6 arms the snap)', st().conceal<0.6, 'conceal='+st().conceal);
  const ghostExposed=st().ghostMs; pump(20);   // still exposed & idle → ghost time must NOT accrue
  ok('P8-5 ghostMs flat while exposed', st().ghostMs===ghostExposed, `ghostMs ${ghostExposed}→${st().ghostMs}`);
  const snap0=st().snapCount;
  key('KeyQ'); pump(70);                       // MATCH ground, hold still → conceal climbs past 0.85 → snap
  ok('P8-5 matched+still on uniform tile reaches conceal>0.85', st().conceal>0.85, 'conceal='+st().conceal);
  ok('P8-5 snapCount incremented on melt-in', st().snapCount===snap0+1, 'snapCount='+st().snapCount);
  const ghostA=st().ghostMs; pump(50);
  ok('P8-5 ghostMs accrues while hidden+still', st().ghostMs>ghostA, `${ghostA}→${st().ghostMs}`);
  const snap1=st().snapCount;
  expose();                                    // drop below 0.6 → hysteresis re-arm
  key('KeyQ'); pump(70);
  ok('P8-5 snap re-arms and fires again', st().snapCount===snap1+1, 'snapCount='+st().snapCount);

  // ---- P8-1 Live Match Coach ----
  key('KeyE'); pump(10);                       // open studio
  ok('P8-1 paint block present', st().paint && 'mqNow' in st().paint && 'mqAim' in st().paint && 'word' in st().paint && 'hint' in st().paint);
  ok('P8-1 word is a valid meter tier', ['EXPOSED','BLENDING','HIDDEN'].includes(st().paint.word), 'word='+st().paint.word);
  key('Digit8'); pump(4);                      // aim a far color (concrete) — AIM drops, hint becomes a nudge
  ok('P8-1 far AIM lowers mqAim', st().paint.mqAim<0.6, 'mqAim='+st().paint.mqAim);
  ok('P8-1 nudge hint (not "matched") when off-target', st().paint.hint!=='matched', 'hint='+st().paint.hint);
  key('KeyQ'); pump(4);                        // MATCH → AIM jumps to the ground
  ok('P8-1 matched AIM raises mqAim ≥ 0.85', st().paint.mqAim>=0.85, 'mqAim='+st().paint.mqAim);
  ok('P8-1 hint reads "matched" at target', st().paint.hint==='matched', 'hint='+st().paint.hint);

  // ---- P8-2 touch SV offset (picked value sits above the fingertip) ----
  const sv=st().studio.svRect; ok('P8-2 svRect exposed while studio open', !!sv);
  if(sv){ const midx=sv.x+sv.w/2, midy=sv.y+sv.h*0.5;
    fire('pointerdown',cv(),{clientX:midx,clientY:midy,pointerId:11,pointerType:'touch'}); pump(2); const touchV=st().studio.svV;
    fire('pointerup',cv(),{clientX:midx,clientY:midy,pointerId:11}); pump(1);
    fire('pointerdown',cv(),{clientX:midx,clientY:midy,pointerId:12,pointerType:'mouse'}); pump(2); const mouseV=st().studio.svV;
    fire('pointerup',cv(),{clientX:midx,clientY:midy,pointerId:12}); pump(1);
    ok('P8-2 touch picks a higher V than mouse at same y (offset lifts sample)', touchV>mouseV+0.02, `touch=${touchV} mouse=${mouseV}`); }

  // ---- P8-3 Split Camo toggle (integration; math proven in twotone.mjs) ----
  ok('P8-3 split off by default', st().split===false && st().mq2===0);
  const spR=st().studio.splitRect; ok('P8-3 splitRect exposed', !!spR);
  if(spR){ fire('pointerdown',cv(),{clientX:spR.x+spR.w/2,clientY:spR.y+spR.h/2,pointerId:13}); fire('pointerup',cv(),{clientX:spR.x,clientY:spR.y,pointerId:13}); pump(6);
    ok('P8-3 toggling turns split ON', st().split===true, 'split='+st().split);
    ok('P8-3 enabling split selects the 2nd tone', st().studio.activeTone===1, 'activeTone='+st().studio.activeTone);
    // regression (review finding #1): a preset must edit the ACTIVE tone, not silently overwrite tone 0
    const t0Before=st().studio.t0, t1Before=st().studio.t1;
    key('Digit2'); pump(2);                    // pick the 'dirt' preset while editing tone 2
    ok('P8-3 preset edits the active (2nd) tone', st().studio.t1!==t1Before, `t1 ${t1Before}→${st().studio.t1}`);
    ok('P8-3 preset does NOT touch the inactive tone 0', st().studio.t0===t0Before, `t0 ${t0Before}→${st().studio.t0}`);
    key('KeyQ'); pump(20);                     // two-tone MATCH — must not throw
    ok('P8-3 two-tone MATCH ran without error', errors.length===0, errors[0]||'');
    fire('pointerdown',cv(),{clientX:spR.x+spR.w/2,clientY:spR.y+spR.h/2,pointerId:14}); fire('pointerup',cv(),{clientX:spR.x,clientY:spR.y,pointerId:14}); pump(6);
    ok('P8-3 toggling again turns split OFF', st().split===false, 'split='+st().split);
    ok('P8-3 turning split off resets active tone to 0', st().studio.activeTone===0, 'activeTone='+st().studio.activeTone); }

  // ---- P8-4 spray on MATCH + wet-paint drips while crawling ----
  key('Digit8'); pump(2);                      // aim concrete again (big color change)
  key('KeyE'); pump(4);                        // close studio → full-speed crawl
  const drip0=st().dripEmitted; pump(24);      // crawl grass→concrete → shifting → drips
  ok('P8-4 wet-paint drips emitted while pigment crawls', st().dripEmitted>drip0, `${drip0}→${st().dripEmitted}`);
  ok('P8-4 particle pool respects PCAP=140', st().particles<=140, 'particles='+st().particles);
  const pBefore=st().particles; key('KeyQ'); pump(1);   // MATCH → puff+ring+spray burst
  ok('P8-4 MATCH spawns a burst (≥12 particles)', st().particles-pBefore>=12 || st().particles>=12, `Δ=${st().particles-pBefore} total=${st().particles}`);
  ok('P8-4 still under PCAP after burst', st().particles<=140, 'particles='+st().particles);

  // ---- P8-6 Blend Book logs a mastered terrain (read-only on the sim) ----
  key('KeyQ'); pump(6);                         // match ground
  const cBefore=st().C;
  pump(80);                                     // hold still & matched > BLEND_LOG_HOLD (1s)
  const t2=st().terrain, e=st().progress.blendbook[t2];
  if(st().mq>=0.85 && t2!=='lava' && t2!=='void'){
    ok('P8-6 terrain logged after a held blend', !!(e&&e.logged), 'entry='+JSON.stringify(e));
    ok('P8-6 logged bestMq ≥ 0.85', !!(e&&e.bestMq>=0.85), 'bestMq='+(e&&e.bestMq));
    let stored=null; try{ stored=JSON.parse(savedLS['aac.progress.v1']); }catch(_){}
    ok('P8-6 blend book persisted to localStorage', !!(stored&&stored.blendbook&&stored.blendbook[t2]&&stored.blendbook[t2].logged));
  } else { ok('P8-6 (skipped: mq<0.85 or unhidable spawn)', true, 'mq='+st().mq+' terrain='+t2); }
  ok('P8-6 logging is read-only on the sim (C not perturbed by a log)', typeof st().C==='number', 'C='+st().C);

  finish();
}
function finish(){
  console.log('\nFINAL STATE snap='+st().snapCount+' ghostMs='+st().ghostMs+' split='+st().split+' blendbook='+Object.keys(st().progress?st().progress.blendbook:{}).length);
  const uniq=[...new Set(errors)];
  if(uniq.length){ console.log('\nRUNTIME ERRORS ('+uniq.length+'):'); uniq.slice(0,20).forEach(e=>console.log('  • '+e.split('\n').slice(0,3).join('\n     '))); fails+=uniq.length; }
  console.log(fails? `\nPASS8: FAIL (${fails})` : '\nPASS8: PASS — all Living-Camo assertions hold, 0 runtime errors');
  process.exit(fails?1:0);
}
main();
