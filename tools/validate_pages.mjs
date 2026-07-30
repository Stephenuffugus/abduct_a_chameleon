/* validate_pages.mjs — the gate every Abduction Files bank must pass.
   node tools/validate_pages.mjs
   Checks, in order of how badly each one would embarrass us on a real screen:
     numbers unique and in range      (a duplicate page number breaks the shelf)
     body length 40 to 90 words       (short reads thin, long overflows the panel)
     no dash characters at all        (house rule for player copy)
     heading present and under 40     (it has to fit one line on a phone)
     openings unique across ALL banks (they are shuffled; twins read as a bug)
     thread tag known                 (a typo would silently vanish from a filter)
   Exits non zero so npm run all can gate on it. */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'pages');
const THREADS = new Set(['FR', 'SF', 'HW', 'IW']);
const MINW = 40, MAXW = 90, MAXH = 40, MAXN = 1000;

const files = readdirSync(DIR).filter(f => /^files-\d+\.js$/.test(f)).sort();
if (!files.length) { console.error('no page banks found in pages/'); process.exit(2); }

const problems = [];
const seenN = new Map();
const seenOpen = new Map();
let total = 0;
const byThread = { FR: 0, SF: 0, HW: 0, IW: 0 };

for (const f of files) {
  const src = readFileSync(join(DIR, f), 'utf8');
  /* the banks are plain browser scripts, so evaluate the array literal rather
     than importing: keeps the bank format dependency free */
  const m = src.match(/var P = \[([\s\S]*?)\n  \];/);
  if (!m) { problems.push(`${f}: could not find the page array`); continue; }
  let pages;
  try { pages = eval('[' + m[1] + ']'); }
  catch (e) { problems.push(`${f}: array does not parse: ${e.message}`); continue; }

  for (const p of pages) {
    total++;
    const id = `${f} page ${p && p.n}`;
    if (!p || typeof p.n !== 'number') { problems.push(`${id}: missing number`); continue; }
    if (p.n < 1 || p.n > MAXN) problems.push(`${id}: number out of 1..${MAXN}`);
    if (seenN.has(p.n)) problems.push(`${id}: duplicate of ${seenN.get(p.n)}`);
    seenN.set(p.n, id);

    if (!THREADS.has(p.t)) problems.push(`${id}: unknown thread "${p.t}"`);
    else byThread[p.t]++;

    if (!p.h || !p.h.length) problems.push(`${id}: no heading`);
    else if (p.h.length > MAXH) problems.push(`${id}: heading ${p.h.length} chars, over ${MAXH}`);

    const body = String(p.b || '');
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words < MINW || words > MAXW) problems.push(`${id}: ${words} words, want ${MINW} to ${MAXW}`);

    /* every dash shape, in the body AND the heading */
    const dash = (body + ' ' + (p.h || '')).match(/[—–−]| - |--/);
    if (dash) problems.push(`${id}: contains a dash (${JSON.stringify(dash[0])})`);

    const open = body.slice(0, 34).toLowerCase();
    if (seenOpen.has(open)) problems.push(`${id}: opens like ${seenOpen.get(open)}`);
    seenOpen.set(open, id);
  }
}

console.log(`banks: ${files.join(', ')}`);
console.log(`pages: ${total} of ${MAXN}  (FR ${byThread.FR} · SF ${byThread.SF} · HW ${byThread.HW} · IW ${byThread.IW})`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error('  ' + p);
  process.exit(1);
}
console.log('all pages valid');
