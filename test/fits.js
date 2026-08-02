/* DOES THE TEXT FIT ON THE SCREEN?
 *
 *   node fits.js [../index.html]
 *
 * WHY THIS EXISTS. HOW TO PLAY auto-shows on first boot, so it is the first thing any
 * new player reads. It was eighteen fixed-13.5px centred lines of up to 85 characters
 * drawn at vpW/2 with no wrapping, and at 390x740 every single line ran off BOTH edges
 * of the screen. Eighteen other gates were green. None of them could see it, because
 * none of them look at where the pixels land.
 *
 * This one does, and it does it the only way that generalises: it wraps a recording
 * ctx around the real one, so EVERY fillText the game performs is measured with the
 * font it was actually drawn in and checked against the viewport it was drawn into.
 * A new overlay written next year is covered the day it ships, without anybody
 * remembering to add it here.
 *
 * Two rules:
 *   1. NOTHING DRAWS OUTSIDE THE SCREEN. Allowing a small bleed for deliberate
 *      edge markers (the off-screen threat arrows are supposed to sit at the rim).
 *   2. NOTHING PLAYER-FACING IS UNDER 11px RENDERED, which is this project's 0.7rem
 *      floor. Reported separately so a caption is not confused with a clipped line.
 */
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const htmlPath = process.argv[2] || path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const errors = [], rafQueue = []; let rafId = 1;

/* The measuring ctx. jsdom has no text metrics at all, so width is modelled: a
 * proportional-font average of 0.52em, which is close enough that a line has to be
 * ~4% over the edge before it is reported. Under-reporting is the safe direction for
 * a gate whose failures are meant to be believed. */
const CHAR_W = 0.52;
let VW = 390, VH = 740, DPR = 1;   // DPR is read back from the game each sweep, not assumed
const drawn = [];
/* Font size is the number before "px", NOT parseFloat of the whole string: the game
   writes "800 42px system-ui", and parseFloat returns the WEIGHT. That mistake made
   the first run of this gate report the title as 3328px wide and fail everything. */
const fontPx = f => { const m = /(\d*\.?\d+)px/.exec(String(f)); return m ? parseFloat(m[1]) : 13; };
/* The game draws menus through applyScreenTransform (a translate+scale), so a fillText
   at x=cx is not at screen x=cx. Track the matrix the same way canvas does. Anything
   drawn under a ROTATION is skipped rather than guessed at - the off-screen threat
   arrows are rotated on purpose and are supposed to sit at the rim. */
function stubCtx() {
  const noop = () => {};
  const state = { font: '500 13px sans', textAlign: 'left', fillStyle: '#000' };
  let M = { a:1, b:0, c:0, d:1, e:0, f:0 };
  const stack = [];
  const mul = (m, n) => ({ a:m.a*n.a+m.c*n.b, b:m.b*n.a+m.d*n.b, c:m.a*n.c+m.c*n.d,
                           d:m.b*n.c+m.d*n.d, e:m.a*n.e+m.c*n.f+m.e, f:m.b*n.e+m.d*n.f+m.f });
  return new Proxy(state, {
    get(t, p) {
      if (p === 'canvas') return { width: VW, height: VH };
      if (p === 'measureText') return (s) => ({ width: String(s).length * CHAR_W * fontPx(t.font) });
      if (p === 'save') return () => { stack.push({ ...M }); };
      if (p === 'restore') return () => { if (stack.length) M = stack.pop(); };
      if (p === 'translate') return (x, y) => { M = mul(M, { a:1,b:0,c:0,d:1,e:x||0,f:y||0 }); };
      if (p === 'scale') return (x, y) => { M = mul(M, { a:x||1,b:0,c:0,d:(y==null?x:y)||1,e:0,f:0 }); };
      if (p === 'rotate') return (r) => { const c=Math.cos(r||0), s2=Math.sin(r||0); M = mul(M, { a:c,b:s2,c:-s2,d:c,e:0,f:0 }); };
      if (p === 'setTransform') return (a,b,c,d,e,f) => { M = (a && typeof a === 'object')
        ? { a:a.a,b:a.b,c:a.c,d:a.d,e:a.e,f:a.f } : { a:a||1,b:b||0,c:c||0,d:d||1,e:e||0,f:f||0 }; };
      if (p === 'resetTransform') return () => { M = { a:1,b:0,c:0,d:1,e:0,f:0 }; };
      if (p === 'getTransform') return () => ({ ...M });
      if (p === 'fillText' || p === 'strokeText') return (s, x, y) => {
        if (Math.abs(M.b) > 1e-6 || Math.abs(M.c) > 1e-6) return;   // rotated: rim markers, by design
        /* ⛔ DIVIDE BY DPR. applyScreenTransform is setTransform(dpr,0,0,dpr,0,0), the
           standard HiDPI pattern, so every coordinate coming through here is in DEVICE
           pixels while the viewport being judged is in CSS pixels. Comparing the two
           directly made this gate report the whole title screen as off-screen at a dpr
           of 1.5 - a 50% phantom failure on every string in the game. */
        const k = DPR || 1;
        const size = fontPx(t.font) * Math.abs(M.d || 1) / k;
        const w = String(s).length * CHAR_W * fontPx(t.font) * Math.abs(M.a || 1) / k;
        const sx = (M.a * x + M.c * y + M.e) / k, sy = (M.b * x + M.d * y + M.f) / k;
        const a = t.textAlign;
        const left = a === 'center' ? sx - w / 2 : a === 'right' ? sx - w : sx;
        drawn.push({ s: String(s), size, x: sx, y: sy, w, left, right: left + w, align: a });
      };
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') return () => ({ addColorStop: noop });
      if (p === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 });
      if (p === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 });
      if (p in t) return t[p];
      return typeof p === 'string' ? noop : undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

function beforeParse(window) {
  const _ls = { 'aac.settings.v1': JSON.stringify({ tutorialSeen: true, perf: 'smooth' }) };
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: k => k in _ls ? _ls[k] : null, setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: k => { delete _ls[k]; }, clear: () => {}, key: i => Object.keys(_ls)[i] || null,
    get length() { return Object.keys(_ls).length; } } });
  window.HTMLCanvasElement.prototype.getContext = () => stubCtx();
  window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,';
  window.OffscreenCanvas = class { constructor(w, h) { this.width = w; this.height = h; } getContext() { return stubCtx(); } };
  window.requestAnimationFrame = cb => { rafQueue.push(cb); return rafId++; };
  window.cancelAnimationFrame = () => {};
  const A = class { constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createOscillator() { return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect() {} }; }
    createBuffer(c, l) { return { getChannelData() { return new Float32Array(l); } }; }
    createBufferSource() { return { connect() {}, start() {}, stop() {} }; }
    createDynamicsCompressor() { return { connect() {}, threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } }; }
    resume() { return Promise.resolve(); } };
  window.AudioContext = A; window.webkitAudioContext = A;
  window.matchMedia = q => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.navigator.getGamepads = () => [];
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
  Object.defineProperty(window, 'innerWidth', { get: () => VW, configurable: true });
  Object.defineProperty(window, 'innerHeight', { get: () => VH, configurable: true });
  window.visualViewport = { get width() { return VW; }, get height() { return VH; }, addEventListener() {}, removeEventListener() {} };
  window.Element.prototype.setPointerCapture = function () {};
  window.Element.prototype.releasePointerCapture = function () {};
  window.fetch = (url) => { try { const u = String(url).replace(/^\.?\//, ''); const p = path.resolve(path.dirname(htmlPath), u);
      if (fs.existsSync(p)) { const b = fs.readFileSync(p, 'utf8'); return Promise.resolve({ ok: true, json: () => Promise.resolve(JSON.parse(b)), text: () => Promise.resolve(b) }); } } catch (_) {}
    return Promise.resolve({ ok: false, json: () => Promise.reject(0), text: () => Promise.resolve('') }); };
  window.addEventListener('error', e => errors.push(String(e.message)));
}

const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true,
  url: 'http://localhost:8000/index.html', beforeParse });
const { window } = dom, doc = window.document;
const pump = n => { for (let i = 0; i < n; i++) { const cbs = rafQueue.splice(0, rafQueue.length); for (const cb of cbs) { try { cb(performance.now()); } catch (e) { errors.push(String(e && e.message || e)); } } } };
const key = c => { for (const t of ['keydown', 'keyup']) doc.dispatchEvent(new window.KeyboardEvent(t, { bubbles: true, cancelable: true, code: c, key: c })); };

const SIZES = [[390, 740, 'phone portrait'], [844, 390, 'phone landscape'], [360, 640, 'small portrait'], [667, 375, 'small landscape']];
const BLEED = 4;      // deliberate rim markers (off-screen threat arrows) may kiss the edge
const MIN_PX = 11;    // this project's 0.7rem readability floor

let fails = 0;
const bad = [];
const uniq = a => { const seen=new Set(); return a.filter(d=>{ const k=d.s+'|'+Math.round(d.left)+'|'+Math.round(d.y); if(seen.has(k)) return false; seen.add(k); return true; }); };
function sweep(label, setup) {
  for (const [w, h, sizeName] of SIZES) {
    VW = w; VH = h;
    try { window.dispatchEvent(new window.Event('resize')); } catch (_) {}
    pump(6);
    try { setup(); } catch (e) { errors.push('setup ' + label + ': ' + e.message); }
    pump(8);
    try{ DPR = (window.__aac.state.vp && window.__aac.state.vp.dpr) || 1; }catch(_){ DPR = 1; }
    drawn.length = 0;
    pump(2);                                  // one clean frame is the sample
    const wide = drawn.filter(d => d.s.trim() && (d.left < -BLEED || d.right > VW + BLEED));
    const below = drawn.filter(d => d.s.trim() && (d.y < -BLEED || d.y > VH + BLEED));
    const tiny = drawn.filter(d => d.s.trim().length > 3 && d.size < MIN_PX);
    /* ⛔ AND NOTHING MAY BE DRAWN ON TOP OF ANYTHING ELSE. Bounds alone cannot see the
       worst of it: at 844x390 the wordmark rendered THROUGH the PLAY button and both
       were comfortably inside the screen. "Everything looks random and sloppy" is, in
       its most literal form, two strings in the same rectangle. */
    const box = d => ({ x0:d.left, x1:d.right, y0:d.y-d.size*0.62, y1:d.y+d.size*0.62 });
    const vis = uniq(drawn.filter(d => d.s.trim().length > 1));
    const over = [];
    for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
      const A = box(vis[i]), B = box(vis[j]);
      const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
      const oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (ox <= 2 || oy <= 2) continue;
      const small = Math.min((A.x1-A.x0)*(A.y1-A.y0), (B.x1-B.x0)*(B.y1-B.y0));
      if (small <= 0 || (ox*oy)/small < 0.35) continue;           // a clipped corner is not a collision
      over.push([vis[i], vis[j]]);
    }
    if (over.length) {
      fails++;
      bad.push(`${label} @ ${w}x${h} (${sizeName}): ${over.length} pairs of text OVERLAP each other`);
      for (const [a2, b2] of over.slice(0, 3))
        bad.push(`      "${a2.s.slice(0, 26)}" is drawn on top of "${b2.s.slice(0, 26)}"`);
    }
    const clipped = wide.concat(below);
    if (wide.length) {
      fails++;
      bad.push(`${label} @ ${w}x${h} (${sizeName}): ${uniq(wide).length} strings are WIDER than the screen`);
      for (const c of uniq(wide).slice(0, 3))
        bad.push(`      "${c.s.slice(0, 54)}" spans ${Math.round(c.left)}..${Math.round(c.right)} in ${w}px`);
    }
    if (below.length) {
      fails++;
      bad.push(`${label} @ ${w}x${h} (${sizeName}): ${uniq(below).length} strings are drawn OFF THE SCREEN vertically`);
      for (const c of uniq(below).slice(0, 3))
        bad.push(`      "${c.s.slice(0, 54)}" at y=${Math.round(c.y)} in a ${h}px screen`);
    }
    if (tiny.length) {
      fails++;
      bad.push(`${label} @ ${w}x${h}: ${tiny.length} strings under ${MIN_PX}px (smallest ${Math.min(...tiny.map(t => t.size)).toFixed(1)}px: "${tiny.sort((a, b) => a.size - b.size)[0].s.slice(0, 40)}")`);
    }
    if (!clipped.length && !tiny.length && !over.length) console.log(`  ok   ${label.padEnd(14)} ${String(w + 'x' + h).padEnd(9)} ${drawn.length} strings, widest ${Math.round(Math.max(0, ...drawn.map(d => d.w)))}px`);
  }
}

function tapLabel(re) {
  const rects = (window.__aac && window.__aac.navRects && window.__aac.navRects()) || [];
  const r = rects.find(n => re.test(n.label || ''));
  if (!r) return false;
  const x = r.x + r.w / 2, y = r.y + r.h / 2, cv = doc.querySelector('canvas');
  for (const t of ['pointerdown', 'pointerup']) {
    const ev = new window.Event(t, { bubbles: true, cancelable: true });
    Object.assign(ev, { clientX: x, clientY: y, pointerId: 91, pointerType: 'touch' });
    cv.dispatchEvent(ev);
  }
  return true;
}

setTimeout(() => {
  pump(30);
  /* helpAutoShown is left unset above, so the card is already open exactly the way a
     first-boot player meets it. That is the state that was broken, so that is the
     state this measures - no back door. */
  sweep('HOW TO PLAY', () => {});
  tapLabel(/Got it/i); pump(6);
  sweep('title menu', () => {});
  if (errors.length) { bad.push('JS errors: ' + [...new Set(errors)].slice(0, 3).join(' | ')); fails += 1; }
  if (bad.length) { console.log('\nFITS: FAIL'); bad.forEach(b => console.log('   - ' + b)); }
  else console.log('\nFITS: PASS — every string the game drew landed inside the screen at 4 phone sizes');
  process.exit(fails ? 1 : 0);
}, 1500);
