// Real headless RENDERER: loads the game in jsdom but backs every canvas with
// @napi-rs/canvas (prebuilt Canvas2D), drives it to chosen scenes, and writes PNGs.
//   node render.js <html> <outDir> [W H DPR]
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const napi = require('@napi-rs/canvas');

const htmlPath = process.argv[2] || '/workspaces/abduct_a_chameleon/index.html';
const outDir = process.argv[3] || '.';
const W = parseInt(process.argv[4] || '960', 10);
const H = parseInt(process.argv[5] || '600', 10);
const DPR = parseInt(process.argv[6] || '2', 10);
fs.mkdirSync(outDir, { recursive: true });
const html = fs.readFileSync(htmlPath, 'utf8');

const errors = []; const rafQueue = []; let rafId = 1; let VT = 1000;

function beforeParse(window) {
  try{ const _ls={'aac.settings.v1':JSON.stringify({tutorialSeen:true})}; Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>k in _ls?_ls[k]:null,setItem:(k,v)=>{_ls[k]=String(v);},removeItem:k=>{delete _ls[k];},clear:()=>{for(const k in _ls)delete _ls[k];},key:i=>Object.keys(_ls)[i]||null,get length(){return Object.keys(_ls).length;}}}); }catch(_){}

  window.__napi = napi;
  // main canvas: prototype getContext backed by one full-size napi canvas
  window.HTMLCanvasElement.prototype.getContext = function () {
    if (!this.__napi) this.__napi = napi.createCanvas(W * DPR, H * DPR);
    return this.__napi.getContext('2d');
  };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
  // OffscreenCanvas + created <canvas> ARE napi canvases (valid drawImage sources)
  window.OffscreenCanvas = function (w, h) { return napi.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); };
  const origCreate = window.document.createElement.bind(window.document);
  window.document.createElement = function (tag) {
    if (String(tag).toLowerCase() === 'canvas') return napi.createCanvas(300, 150);
    return origCreate(tag);
  };
  window.requestAnimationFrame = (cb) => { rafQueue.push(cb); return rafId++; };
  window.cancelAnimationFrame = () => {};
  const A = class { constructor(){ this.state='running'; this.currentTime=0; this.sampleRate=44100; this.destination={}; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){}, disconnect(){} }; }
    createOscillator(){ return { type:'', frequency:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){}, linearRampToValueAtTime(){} }, connect(){}, start(){}, stop(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{ value:0 }, connect(){} }; }
    createBuffer(c,l){ return { getChannelData(){ return new Float32Array(l); } }; }
    createBufferSource(){ return { connect(){}, start(){}, stop(){} }; }
    createDynamicsCompressor(){ return { connect(){}, threshold:{value:0}, knee:{value:0}, ratio:{value:0}, attack:{value:0}, release:{value:0} }; }
    resume(){ return Promise.resolve(); } };
  window.AudioContext = A; window.webkitAudioContext = A;
  window.matchMedia = (q) => ({ matches: /min-width|fine/.test(q), addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.navigator.getGamepads = () => [];
  Object.defineProperty(window, 'devicePixelRatio', { value: DPR, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: W, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: H, configurable: true });
  window.Element.prototype.setPointerCapture = function(){};
  window.Element.prototype.releasePointerCapture = function(){};
  window.fetch = (url) => { try { let u = String(url).replace(/^\.?\//, '');
      const p = path.resolve(path.dirname(htmlPath), u);
      if (fs.existsSync(p)) { const b = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok:true, json:()=>Promise.resolve(JSON.parse(b)), text:()=>Promise.resolve(b) }); }
    } catch(_){} return Promise.resolve({ ok:false, json:()=>Promise.reject(0), text:()=>Promise.resolve('') }); };
  window.addEventListener('error', e => errors.push('ERR ' + (e.error && e.error.stack || e.message)));
  window.addEventListener('unhandledrejection', e => errors.push('REJ ' + (e.reason && e.reason.stack || e.reason)));
}

const dom = new JSDOM(html, { runScripts:'dangerously', resources:'usable', pretendToBeVisual:true, url:'http://localhost:8000/index.html', beforeParse });
const { window } = dom;
const doc = window.document;

function pump(n){ for(let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length); for(const cb of cbs){ try{ cb(VT); }catch(e){ errors.push('raf '+(e&&e.stack||e)); } } } }
function key(code){ for(const t of ['keydown','keyup']) doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code})); }
function down(code){ doc.dispatchEvent(new window.KeyboardEvent('keydown',{bubbles:true,cancelable:true,code,key:code})); }
function up(code){ doc.dispatchEvent(new window.KeyboardEvent('keyup',{bubbles:true,cancelable:true,code,key:code})); }
function tap(x,y,id){ for(const t of ['pointerdown','pointerup']){ const e=new window.MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y}); try{Object.defineProperty(e,'pointerId',{value:id||1});}catch(_){} doc.querySelector('canvas').dispatchEvent(e); } }
const S=()=>{ try{ return window.__aac.state; }catch(_){ return {}; } };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function shot(name){ const cv=doc.getElementById('game'); if(cv&&cv.__napi){ const p=path.join(outDir,name+'.jpg');
  let buf; try{ buf=cv.__napi.toBuffer('image/jpeg',82); }catch(_){ buf=cv.__napi.toBuffer('image/png'); }
  fs.writeFileSync(p, buf); console.log('shot', name, '->', S().appState+'/'+(S().roundState||''), buf.length+'b', errors.length?('ERRORS='+errors.length):''); } }

(async () => {
  await wait(160); pump(20);
  shot('01-title');
  // Wardrobe (P8-6 Blend Book + biome medals) — TITLE ▸ Wardrobe, then back
  key('ArrowDown'); pump(4); key('Enter'); pump(8); shot('10-wardrobe');
  key('Escape'); pump(8);                            // back to TITLE
  key('Enter'); pump(8); shot('02-mode');            // MODE_SELECT
  key('Enter'); pump(8); shot('03-level-practice');  // LEVEL_SELECT (practice)
  // let thumbnails fetch + build
  await wait(80); pump(12); shot('03b-level-thumbs');
  key('Enter'); await wait(80); pump(30);            // select first level -> practice round
  shot('04-countdown');
  pump(210); shot('05-playing');                     // PLAYING
  // move a bit so bots react + footsteps, then open studio
  down('KeyD'); pump(40); up('KeyD'); shot('06-moved');
  key('KeyE'); pump(12); shot('07-studio');          // paint studio open
  key('KeyQ'); pump(20); shot('08-matched');         // instant match
  // P8-3 two-tone: toggle split via its studio rect, match, capture the 2-tone studio + body
  { const sp = S().studio && S().studio.splitRect; if(sp){ tap(sp.x+sp.w/2, sp.y+sp.h/2, 5); pump(6); key('KeyQ'); pump(20); shot('08b-twotone'); } }
  key('KeyE'); pump(10);
  // survive mode gameplay + a difficulty screen
  key('Escape'); pump(6);                            // pause
  shot('09-pause');
  console.log('done. errors:', errors.length); if(errors.length) console.log(errors.slice(0,6));
  process.exit(0);
})();
