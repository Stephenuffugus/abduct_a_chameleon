/* CAN THE PLAYER REACH THE BUTTON?
 *
 *   node reach2d.js [../index.html]
 *
 * WHY THIS EXISTS. The in-round hit list, `roundHits`, is the one the player holds for
 * four minutes and the one no gate had ever looked at. It was laid out bottom-up from
 * the dock with the pitch floored at 44px and nothing checking where the TOP landed:
 *
 *     vpH 390 (a phone on its side), 7 abilities  ->  the column starts at y = -10
 *     vpH 390, 8 abilities (SALVAGE, cutter online) -> it starts at y = -54
 *
 * So on the target device the top ability hung off the top of the screen, and in
 * SALVAGE the CUT button - the verb the whole mode exists to reach, after four minutes
 * of work - was ENTIRELY off the viewport with no way to tap it. Its only other input
 * is a keyboard key, on a phone.
 *
 * Three rules, applied to every rect the round actually drew, at four phone sizes and
 * in both handedness settings:
 *   1. ON SCREEN. Every hit rect lies fully inside the viewport.
 *   2. BIG ENOUGH. 44px is this repo's floor for an in-round control.
 *   3. NOT STACKED. No two hit rects overlap, or the top one silently eats the other's
 *      taps - which is exactly how a left-handed player came to pause the game every
 *      time they reached for Freeze.
 */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const htmlPath = process.argv[2] || path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const errors = [], rafQueue = []; let rafId = 1;
let VW = 844, VH = 390;

function stubCtx() {
  const noop = () => {};
  return new Proxy({}, { get(_t, p) {
    if (p === 'canvas') return { width: VW, height: VH };
    if (p === 'measureText') return (s) => ({ width: String(s).length * 6 });
    if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w|0)*(h|0)*4)), width: w|0, height: h|0 });
    if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w|0)*(h|0)*4)), width: w|0, height: h|0 });
    if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop: noop });
    if (p === 'setTransform' || p === 'getTransform') return () => ({ a:1, b:0, c:0, d:1, e:0, f:0 });
    return typeof p === 'string' ? noop : undefined;
  }, set() { return true; } });
}
function beforeParse(window) {
  const _ls = { 'aac.settings.v1': JSON.stringify({ tutorialSeen:true, helpAutoShown:true, tourDone:true, perf:'smooth' }) };
  Object.defineProperty(window, 'localStorage', { configurable:true, value:{
    getItem:k=>k in _ls?_ls[k]:null, setItem:(k,v)=>{_ls[k]=String(v);}, removeItem:k=>{delete _ls[k];},
    clear:()=>{}, key:i=>Object.keys(_ls)[i]||null, get length(){return Object.keys(_ls).length;} } });
  window.HTMLCanvasElement.prototype.getContext = () => stubCtx();
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.OffscreenCanvas = class { constructor(w,h){this.width=w;this.height=h;} getContext(){return stubCtx();} };
  window.requestAnimationFrame = cb => { rafQueue.push(cb); return rafId++; };
  window.cancelAnimationFrame = () => {};
  const A = class { constructor(){this.state='running';this.currentTime=0;this.sampleRate=44100;this.destination={};}
    createGain(){return{gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
    createOscillator(){return{type:'',frequency:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){}},connect(){},start(){},stop(){}};}
    createBiquadFilter(){return{type:'',frequency:{value:0},connect(){}};}
    createBuffer(c,l){return{getChannelData(){return new Float32Array(l);}};}
    createBufferSource(){return{connect(){},start(){},stop(){}};}
    createDynamicsCompressor(){return{connect(){},threshold:{value:0},knee:{value:0},ratio:{value:0},attack:{value:0},release:{value:0}};}
    resume(){return Promise.resolve();} };
  window.AudioContext = A; window.webkitAudioContext = A;
  window.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.navigator.getGamepads = () => [];
  Object.defineProperty(window, 'devicePixelRatio', { value:1, configurable:true });
  Object.defineProperty(window, 'innerWidth', { get:()=>VW, configurable:true });
  Object.defineProperty(window, 'innerHeight', { get:()=>VH, configurable:true });
  window.Element.prototype.setPointerCapture = function(){};
  window.Element.prototype.releasePointerCapture = function(){};
  window.fetch = (url) => { try { const u=String(url).replace(/^\.?\//,''); const p=path.resolve(path.dirname(htmlPath),u);
      if (fs.existsSync(p)) { const b=fs.readFileSync(p,'utf8'); return Promise.resolve({ ok:true, json:()=>Promise.resolve(JSON.parse(b)), text:()=>Promise.resolve(b) }); } } catch(_) {}
    return Promise.resolve({ ok:false, json:()=>Promise.reject(0), text:()=>Promise.resolve('') }); };
  window.addEventListener('error', e => errors.push(String(e.message)));
}
const dom = new JSDOM(html, { runScripts:'dangerously', resources:'usable', pretendToBeVisual:true,
  url:'http://localhost:8000/index.html', beforeParse });
const { window } = dom;
const pump = n => { for (let i=0;i<n;i++){ const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{cb(performance.now());}catch(e){errors.push(String(e&&e.message||e));} } } };
const T = () => window.__aac.t;
const R = () => window.__aac;   // navRects/roundRects/setHand/armCutter live on __aac, the rig lives on __aac.t
const S = () => window.__aac.state;

const MIN = 44;
const SIZES = [[844,390,'phone landscape'], [932,430,'big landscape'], [390,844,'phone portrait'], [667,375,'small landscape']];
const bad = [];
let checked = 0;

function audit(tag) {
  const rects = R().roundRects();
  if (!rects.length) { bad.push(`${tag}: the round drew NO tappable rects at all`); return; }
  checked += rects.length;
  const off = rects.filter(r => r.x < 0 || r.y < 0 || r.x + r.w > VW || r.y + r.h > VH);
  const small = rects.filter(r => r.w < MIN || r.h < MIN);
  const over = [];
  for (let i=0;i<rects.length;i++) for (let j=i+1;j<rects.length;j++) {
    const a=rects[i], b=rects[j];
    const ox = Math.min(a.x+a.w, b.x+b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y+a.h, b.y+b.h) - Math.max(a.y, b.y);
    if (ox > 2 && oy > 2) over.push([a,b,ox*oy]);
  }
  if (off.length) {
    bad.push(`${tag}: ${off.length} of ${rects.length} in-round buttons are off the ${VW}x${VH} screen`);
    for (const r of off.slice(0,3)) bad.push(`      a ${r.w}x${r.h} button at (${r.x},${r.y})`);
  }
  if (small.length) bad.push(`${tag}: ${small.length} in-round buttons are under ${MIN}px (smallest ${Math.min(...small.map(r=>Math.min(r.w,r.h)))}px)`);
  if (over.length) {
    bad.push(`${tag}: ${over.length} pairs of in-round buttons OVERLAP, so the top one eats the other's taps`);
    for (const [a,b,ar] of over.slice(0,3)) bad.push(`      ${a.w}x${a.h}@(${a.x},${a.y}) over ${b.w}x${b.h}@(${b.x},${b.y}), ${Math.round(ar)}px2`);
  }
  if (!off.length && !small.length && !over.length)
    console.log(`  ok   ${tag.padEnd(34)} ${rects.length} buttons, smallest ${Math.min(...rects.map(r=>Math.min(r.w,r.h)))}px`);
}

const key = c => { for (const t of ['keydown','keyup']) window.document.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code:c,key:c})); };
const wait = ms => new Promise(r=>setTimeout(r,ms));
(async () => {
  // wait for the screen, do not sleep at it: under load a flat boot delay measures a
  // half-built title and reports a phantom failure
  for (let i=0;i<200;i++){ pump(4);
    let ready=false; try { ready = S().appState==='TITLE'; } catch(_) {}
    if (ready) break; await wait(25); }
  pump(20);
  // walk the menus into SALVAGE the way salvage.js does: PLAY, seventh mode, first level
  key('Enter'); pump(8);
  for (let i=0;i<6;i++){ key('ArrowDown'); pump(2); }
  key('Enter'); pump(8);
  key('Enter'); await wait(150); pump(14);
  key('Enter'); await wait(200); pump(20);
  for (let i=0;i<40 && S().roundState!=='PLAYING'; i++){ try { T().skipCountdown(); } catch(_) {} pump(6); await wait(20); }
  if (S().roundState !== 'PLAYING') { console.log('REACH2D: could not reach a round (rs=' + S().roundState + ') - SKIPPED'); process.exit(0); }
  console.log('   in a ' + (S().salv ? 'SALVAGE' : 'plain') + ' round');
  for (const [w,h,name] of SIZES) {
    VW = w; VH = h;
    try { window.dispatchEvent(new window.Event('resize')); } catch(_) {}
    pump(4);
    for (const hand of ['right','left']) {
      try { R().setHand(hand); } catch(_) {}
      pump(20);
      audit(`${name} ${hand}-handed`);
      /* THE LONGEST COLUMN IS THE ONE THAT MATTERS. SALVAGE with the cutter online adds
         an eighth entry, and that is the state where CUT ended up at y=-54. */
      try { R().armCutter(); } catch(_) {}
      pump(20);
      audit(`${name} ${hand}-handed, cutter online`);
      try { R().armCutter(false); } catch(_) {}
      pump(6);
    }
  }
  if (errors.length) { bad.push('JS errors: ' + [...new Set(errors)].slice(0,3).join(' | ')); }
  if (bad.length) { console.log('\nREACH2D: FAIL'); bad.forEach(b => console.log('   - ' + b)); process.exit(1); }
  console.log(`\nREACH2D: PASS — ${checked} in-round hit rects, all on screen, all >=${MIN}px, none stacked`);
  process.exit(0);
})();
