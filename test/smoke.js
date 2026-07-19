// Headless smoke test for a single-file Canvas2D game.
// Loads the HTML in jsdom, stubs canvas/audio/raf/fetch, pumps frames,
// fires input events, and reports any runtime error. No real browser needed.
//
//   node smoke.js /path/to/index.html [frames]
//
// Requires the game to use a CLASSIC <script> (not type=module) so jsdom runs it.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = process.argv[2];
const FRAMES = parseInt(process.argv[3] || '180', 10);
if (!htmlPath) { console.error('usage: node smoke.js <html> [frames]'); process.exit(2); }

const html = fs.readFileSync(htmlPath, 'utf8');
const mapsDir = path.resolve(path.dirname(htmlPath), 'maps');

const errors = [];
const rafQueue = [];
let rafId = 1;

function stubCtx() {
  const noop = () => {};
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 1280, height: 720 };
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w|0) * (h|0) * 4)), width: w|0, height: h|0 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
        return () => ({ addColorStop: noop });
      if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1,(w|0)*(h|0)*4)), width:w|0, height:h|0 });
      if (prop === 'setTransform' || prop === 'getTransform') return () => ({ a:1,b:0,c:0,d:1,e:0,f:0 });
      // any other property: return a settable value store or a noop fn
      return typeof prop === 'string' ? noop : undefined;
    },
    set() { return true; },
  });
  return ctx;
}

function beforeParse(window) {
  try{ const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true})}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}

  const doc = window.document;
  // Canvas
  window.HTMLCanvasElement.prototype.getContext = function () { return stubCtx(); };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
  // OffscreenCanvas
  window.OffscreenCanvas = class { constructor(w, h){ this.width=w; this.height=h; } getContext(){ return stubCtx(); } };
  // rAF: capture callbacks; we pump them manually
  window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafId++; };
  window.cancelAnimationFrame = () => {};
  // Audio
  const AudioStub = class {
    constructor(){ this.state='running'; this.currentTime=0; this.sampleRate=44100; this.destination={}; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){}, disconnect(){} }; }
    createOscillator(){ return { type:'sine', frequency:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){}, start(){}, stop(){}, disconnect(){} }; }
    createBiquadFilter(){ return { type:'lowpass', frequency:{ value:0, setValueAtTime(){} }, Q:{value:1}, connect(){}, disconnect(){} }; }
    createBuffer(ch, len){ return { getChannelData(){ return new Float32Array(len); } }; }
    createBufferSource(){ return { buffer:null, connect(){}, start(){}, stop(){}, disconnect(){} }; }
    createDynamicsCompressor(){ return { connect(){}, disconnect(){}, threshold:{value:0}, knee:{value:0}, ratio:{value:0}, attack:{value:0}, release:{value:0} }; }
    resume(){ return Promise.resolve(); }
    suspend(){ return Promise.resolve(); }
  };
  window.AudioContext = AudioStub; window.webkitAudioContext = AudioStub;
  // matchMedia
  window.matchMedia = (q) => ({ matches: /min-width|pointer:\s*fine/.test(q) ? true : false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  // localStorage (jsdom has one, but ensure)
  if (!window.localStorage) {
    const store = {};
    window.localStorage = { getItem:(k)=> (k in store? store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:(k)=>{delete store[k];}, clear:()=>{for(const k in store)delete store[k];} };
  }
  // gamepad
  window.navigator.getGamepads = () => [];
  // devicePixelRatio
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  // pointer capture no-ops (jsdom lacks these)
  window.Element.prototype.setPointerCapture = function(){};
  window.Element.prototype.releasePointerCapture = function(){};
  window.Element.prototype.requestPointerLock = function(){ try{ Object.defineProperty(doc,'pointerLockElement',{value:this,configurable:true}); }catch(_){} doc.dispatchEvent(new window.Event('pointerlockchange')); };
  window.Document.prototype.exitPointerLock = function(){ try{ Object.defineProperty(doc,'pointerLockElement',{value:null,configurable:true}); }catch(_){} };
  // fetch: serve real files from maps/ so the level path is exercised
  window.fetch = (url) => {
    try {
      let u = String(url).replace(/^https?:\/\/[^/]+\//, '').replace(/^\.?\//, '');
      const p = path.resolve(path.dirname(htmlPath), u);
      if (fs.existsSync(p)) {
        const body = fs.readFileSync(p, 'utf8');
        return Promise.resolve({ ok:true, status:200, json:()=>Promise.resolve(JSON.parse(body)), text:()=>Promise.resolve(body) });
      }
    } catch(_) {}
    return Promise.resolve({ ok:false, status:404, json:()=>Promise.reject(new Error('404')), text:()=>Promise.resolve('') });
  };
  // capture errors
  window.addEventListener('error', (e) => errors.push('window.error: ' + (e.error && e.error.stack || e.message)));
  window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e.reason && e.reason.stack || e.reason)));
  const origErr = window.console.error.bind(window.console);
  window.console.error = (...a) => { errors.push('console.error: ' + a.map(String).join(' ')); origErr(...a); };
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'http://localhost:8000/index.html',
  beforeParse,
});

const { window } = dom;

function fire(type, target, props = {}) {
  try {
    const Ev = window.Event;
    let e;
    if (/^key/.test(type)) e = new window.KeyboardEvent(type, { bubbles:true, cancelable:true, ...props });
    else if (/^(pointer|mouse|click|drag|drop|wheel|contextmenu)/.test(type)) {
      e = new window.MouseEvent(type, { bubbles:true, cancelable:true, clientX:640, clientY:360, ...props });
      try { if (e.pointerId === undefined) Object.defineProperty(e, 'pointerId', { value: props.pointerId != null ? props.pointerId : 1 }); } catch(_){}
    }
    else if (/^touch/.test(type)) { e = new Ev(type, { bubbles:true, cancelable:true }); e.touches = props.touches||[]; e.changedTouches = props.changedTouches||props.touches||[]; }
    else { e = new Ev(type, { bubbles:true, cancelable:true }); try { Object.assign(e, props); } catch(_){} }
    (target || window.document).dispatchEvent(e);
  } catch (err) { errors.push('fire ' + type + ': ' + err.message); }
}

let VT = 1000;
function pump(n) {
  for (let i = 0; i < n; i++) {
    VT += 16.7;
    const cbs = rafQueue.splice(0, rafQueue.length);
    for (const cb of cbs) {
      try { cb(VT); } catch (e) { errors.push('raf: ' + (e && e.stack || e)); }
    }
  }
}
const key = (code) => { fire('keydown', window.document, { code, key: code }); fire('keyup', window.document, { code, key: code }); };
const hold = (code) => fire('keydown', window.document, { code, key: code });
const release = (code) => fire('keyup', window.document, { code, key: code });

// wait for a window predicate (checks a global the game exposes) across pumped frames
function pumpUntil(pred, maxFrames, per) {
  let f = 0; while (f < maxFrames) { pump(per || 4); f += (per || 4); if (pred()) return true; } return false;
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function main() {
  await wait(150);
  {
    const win = window; const cv = win.document.querySelector('canvas');
    const st = () => { try { return window.__aac.state; } catch(_) { return {}; } };
    pump(20);                                   // BOOT -> TITLE (loadLevels resolves)
    // TITLE: default highlighted = PLAY
    key('Enter'); pump(6);                      // -> MODE_SELECT
    key('Enter'); pump(6);                      // PRACTICE -> LEVEL_SELECT
    key('Enter'); await wait(60); pump(8);      // select first level -> async fetch + startRound
    if (st().appState !== 'ROUND') errors.push('flow: never reached ROUND (stuck at ' + st().appState + ')');
    // play out the countdown (~3s = ~180 frames) into PLAYING
    pump(220);
    if (st().roundState !== 'PLAYING') errors.push('flow: never reached PLAYING (at ' + st().roundState + ')');
    // move around, open the paint studio, match, repaint via presets, creep
    hold('KeyD'); pump(40); release('KeyD');
    hold('KeyW'); hold('ShiftLeft'); pump(30); release('KeyW'); release('ShiftLeft');
    key('KeyE'); pump(10);                      // open Studio
    // drag on the SV square + hue strip (screen-space, near bottom-center panel)
    fire('pointerdown', cv, { clientX: Math.floor(win.innerWidth/2 - 60), clientY: Math.floor(win.innerHeight - 200), pointerId: 2 });
    fire('pointermove', cv, { clientX: Math.floor(win.innerWidth/2 - 30), clientY: Math.floor(win.innerHeight - 160), pointerId: 2 });
    fire('pointerup', cv, { clientX: Math.floor(win.innerWidth/2 - 30), clientY: Math.floor(win.innerHeight - 160), pointerId: 2 });
    pump(10);
    key('KeyQ'); pump(20);                      // instant MATCH
    key('KeyBracketRight'); key('Comma'); key('Digit3'); pump(6); // studio hotkeys
    key('KeyE'); pump(10);                      // close Studio
    // joystick on left half + creep on right half (touch)
    fire('pointerdown', cv, { clientX: Math.floor(win.innerWidth*0.25), clientY: Math.floor(win.innerHeight*0.6), pointerId: 3 });
    fire('pointermove', cv, { clientX: Math.floor(win.innerWidth*0.25)+40, clientY: Math.floor(win.innerHeight*0.6)+20, pointerId: 3 });
    fire('pointerdown', cv, { clientX: Math.floor(win.innerWidth*0.8), clientY: Math.floor(win.innerHeight*0.6), pointerId: 4 });
    pump(120);                                  // move via joystick; let bots patrol/scan
    fire('pointerup', cv, { clientX: 100, clientY: 100, pointerId: 3 });
    fire('pointerup', cv, { clientX: 100, clientY: 100, pointerId: 4 });
    // pause / resume
    key('Escape'); pump(10); key('Escape'); pump(30);
    fire('resize', win); pump(20);
    pump(FRAMES);
    finish();
  }
}

function finish() {
  try { console.log('STATE:', JSON.stringify(window.__aac && window.__aac.state)); } catch (e) { console.log('STATE: <unavailable> ' + e.message); }
  const uniq = [...new Set(errors)];
  if (uniq.length) {
    console.log('SMOKE: FAIL (' + uniq.length + ' error type(s))');
    uniq.slice(0, 40).forEach(e => console.log('  • ' + e.split('\n').slice(0,4).join('\n     ')));
    process.exit(1);
  } else {
    console.log('SMOKE: PASS — booted, pumped ' + FRAMES + ' frames, fired input, no runtime errors. canvas=' + !!window.document.querySelector('canvas'));
    process.exit(0);
  }
}

main();
