// Shoot the front-of-house menus at real phone sizes and REPORT what is off screen.
// The mode grid had no scroll and a hardcoded 3-row height, so Time Attack sat below
// the fold on a 375x667 phone and nobody could tap it. A screenshot is the only gate
// that catches that; a green unit test never will.
//   node menushot.js <html> <outDir> [W H]
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const napi = require('@napi-rs/canvas');

const htmlPath = process.argv[2] || '/workspaces/abduct_a_chameleon/index.html';
const outDir   = process.argv[3] || '/tmp/aac-shots';
const W = parseInt(process.argv[4] || '375', 10);
const H = parseInt(process.argv[5] || '667', 10);
const DPR = 2;
fs.mkdirSync(outDir, { recursive: true });
const html = fs.readFileSync(htmlPath, 'utf8');

const errors = []; const rafQueue = []; let rafId = 1; let VT = 1000;

function beforeParse(window) {
  const _ls = { 'aac.settings.v1': JSON.stringify({ tutorialSeen: true, controlsSeen: true, helpAutoShown: true, tourDone: true }),
                'aac.progress.v1': JSON.stringify({ unlocks:['default','stand','wave','crouch'], equipped:{skin:'default'}, xp:1000000,
                                                    stats:{plays:9,catches:0,bestSurvive:0,hardWin:0,heatBest:0}, blendbook:{}, biomeMedals:{}, challenges:{}, daily:{lastDay:0,streak:0,bestStreak:0} }) };
  try { Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: k => (k in _ls ? _ls[k] : null), setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: k => { delete _ls[k]; }, clear: () => { for (const k in _ls) delete _ls[k]; },
    key: i => Object.keys(_ls)[i] || null, get length() { return Object.keys(_ls).length; } } }); } catch (_) {}

  window.__napi = napi;
  window.HTMLCanvasElement.prototype.getContext = function () {
    if (!this.__napi) this.__napi = napi.createCanvas(W * DPR, H * DPR);
    return this.__napi.getContext('2d');
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.OffscreenCanvas = function (w, h) { return napi.createCanvas(Math.max(1, w | 0), Math.max(1, h | 0)); };
  const origCreate = window.document.createElement.bind(window.document);
  window.document.createElement = function (tag) {
    if (String(tag).toLowerCase() === 'canvas') return napi.createCanvas(300, 150);
    return origCreate(tag);
  };
  window.requestAnimationFrame = cb => { rafQueue.push(cb); return rafId++; };
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
  window.matchMedia = q => ({ matches: /min-width|fine/.test(q), addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
  window.navigator.getGamepads = () => [];
  Object.defineProperty(window, 'devicePixelRatio', { value: DPR, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: W, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: H, configurable: true });
  window.Element.prototype.setPointerCapture = function(){};
  window.Element.prototype.releasePointerCapture = function(){};
  window.fetch = url => { try { const u = String(url).replace(/^\.?\//, '');
      const p = path.resolve(path.dirname(htmlPath), u);
      if (fs.existsSync(p)) { const b = fs.readFileSync(p, 'utf8');
        return Promise.resolve({ ok:true, json:()=>Promise.resolve(JSON.parse(b)), text:()=>Promise.resolve(b) }); }
    } catch (_) {} return Promise.resolve({ ok:false, json:()=>Promise.reject(0), text:()=>Promise.resolve('') }); };
  window.addEventListener('error', e => errors.push('ERR ' + (e.error && e.error.stack || e.message)));
  window.addEventListener('unhandledrejection', e => errors.push('REJ ' + (e.reason && e.reason.stack || e.reason)));
}

const dom = new JSDOM(html, { runScripts:'dangerously', resources:'usable', pretendToBeVisual:true, url:'http://localhost:8000/index.html', beforeParse });
const { window } = dom;
const doc = window.document;
const pump = n => { for (let i=0;i<n;i++){ VT+=16.7; const cbs=rafQueue.splice(0,rafQueue.length); for (const cb of cbs) { try { cb(VT); } catch(e){ errors.push('raf '+(e&&e.stack||e)); } } } };
const key = code => { for (const t of ['keydown','keyup']) doc.dispatchEvent(new window.KeyboardEvent(t,{bubbles:true,cancelable:true,code,key:code})); };
const S = () => { try { return window.__aac.state; } catch(_) { return {}; } };
const wait = ms => new Promise(r => setTimeout(r, ms));
const tag = W + 'x' + H;
function shot(name){ const cv=doc.getElementById('game'); if(!cv||!cv.__napi) return;
  const p=path.join(outDir, name+'-'+tag+'.jpg');
  let buf; try{ buf=cv.__napi.toBuffer('image/jpeg',86); }catch(_){ buf=cv.__napi.toBuffer('image/png'); }
  fs.writeFileSync(p, buf); console.log('  shot', path.basename(p), buf.length+'b'); }

/* The real gate: every nav rect the screen drew, and whether a thumb can actually hit it.
   Two rules, and the second one is the subtle half:
     FAIL  - any part of a rect sits outside the viewport, or a rect is under 48px
             (the house touch-target rule) while being FULLY drawn.
     clip  - a rect whose visible strip is short because a scrolling band clipped it.
             That is the scroll affordance working, not a bug, so it is reported and
             not counted, PROVIDED the screen really does scroll. A zero-height rect
             is a fully scrolled-out row, which is also correct.
   Without that distinction the gate cries wolf on every scrolling list and gets ignored,
   which is how the original fold bug survived. */
function auditNav(label, scrolls){
  let nav = []; try { nav = window.__aac.navRects() || []; } catch(_) {}
  console.log('\n== ' + label + ' @ ' + tag + ' == ' + nav.length + ' tappable rects' + (scrolls?' (scrolling band)':''));
  let bad = 0, clipped = 0;
  for (const r of nav){
    // a zero-height rect scrolled fully out of its band: inRect can never match it, so it is
    // not a control at all. Counting it would make the gate noisy, and a noisy gate gets ignored.
    if (r.h <= 0.5 || r.w <= 0.5) { clipped++; continue; }
    const off = (r.y + r.h) > H + 0.5 || r.y < -0.5 || (r.x + r.w) > W + 0.5 || r.x < -0.5;
    const short = r.h < 48 || r.w < 48;
    const isClip = scrolls && short && !off;          // a band clipped it, or it scrolled away
    const flags = [];
    if (off) flags.push('OUTSIDE THE VIEWPORT');
    if (short && !isClip) flags.push('UNDER 48px (' + Math.round(r.w) + 'x' + Math.round(r.h) + ')');
    if (isClip) clipped++;
    if (flags.length) bad++;
    console.log('   ' + (flags.length ? 'FAIL' : isClip ? 'clip' : 'ok  ') +
                '  y=' + Math.round(r.y) + '..' + Math.round(r.y+r.h) +
                '  x=' + Math.round(r.x) + '..' + Math.round(r.x+r.w) + '  "' + (r.label||'?') + '"' +
                (flags.length ? '   <<< ' + flags.join(' ') : ''));
  }
  if (clipped) console.log('   (' + clipped + ' clipped by the scroll band, reachable by scrolling)');
  return bad;
}

// Walk to a screen by NAME, never by counting arrow presses (which is how the existing
// suite navigates, and exactly why nobody noticed the fold).
function press(label){
  let nav = []; try { nav = window.__aac.navRects() || []; } catch(_) {}
  const i = nav.findIndex(r => (r.label||'').toLowerCase().includes(label.toLowerCase()));
  if (i < 0) { console.log('  !! no control matching "' + label + '" on ' + S().appState); return false; }
  const r = nav[i];
  for (const t of ['pointerdown','pointerup']){
    const e = new window.MouseEvent(t, { bubbles:true, cancelable:true, clientX:r.x+r.w/2, clientY:r.y+r.h/2 });
    try { Object.defineProperty(e,'pointerId',{value:1}); } catch(_) {}
    doc.querySelector('canvas').dispatchEvent(e);
  }
  pump(10); return true;
}

(async () => {
  await wait(220); pump(30);
  let bad = 0;
  shot('01-title');            bad += auditNav('TITLE', false);
  press('PLAY');               pump(10);
  shot('02-mode');             bad += auditNav('MODE_SELECT', true);
  // and again scrolled to the bottom, which is where the newest mode lives
  for (let i=0;i<8;i++){ const e=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:60});
    doc.querySelector('canvas').dispatchEvent(e); } pump(6);
  shot('02b-mode-scrolled');   bad += auditNav('MODE_SELECT (scrolled to the end)', true);
  // every mode must be fully hittable at SOME scroll offset, not just visible somewhere
  { const seen = {};
    for (let s=0; s<=14; s++){
      let nav=[]; try { nav = window.__aac.navRects()||[]; } catch(_){}
      for (const r of nav) if (r.h>=48 && r.w>=48 && r.y>=0 && r.y+r.h<=H) seen[r.label]=true;
      const e=new window.WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:-40});
      doc.querySelector('canvas').dispatchEvent(e); pump(3);
    }
    const want=['Practice','Survive','Heat','Daily','Hunt','Time Attack','Salvage','Back'];
    const missing = want.filter(w => !Object.keys(seen).some(k => k.includes(w)));
    console.log('\n   every mode reachable at 48px? ' + (missing.length ? 'NO, missing: '+missing.join(', ') : 'yes, all '+want.length));
    if (missing.length) bad += missing.length;
  }
  press('Salvage') || press('Survive'); pump(10);
  await wait(160); pump(20);
  shot('03-level');            bad += auditNav('LEVEL_SELECT', true);
  console.log('\nerrors:', errors.length, errors.slice(0,3));
  console.log(bad ? ('\nUNREACHABLE/UNDERSIZED CONTROLS: ' + bad) : '\nall controls on screen and >=44px');
  process.exit(bad ? 1 : 0);
})();
