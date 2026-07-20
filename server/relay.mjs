// Abduct a Chameleon — tiny multiplayer relay + static game host.
//   npm install && npm start           (serves the game AND the relay on PORT, default 8080)
// One process does everything: http://host/ is the game, ws://host/ws is the relay.
// The relay is a dumb pipe: it pairs two clients into a room by 4-letter code and
// forwards messages between them. All game logic lives in the clients (host-authoritative).
//
// Deploy anywhere Node runs: Render/Railway/Fly free tiers, a VPS, or the game's own host.
// If the game is served elsewhere (static hosting), deploy just this and point the game
// at it with  ?mp=wss://your-relay.example.com/ws
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join, normalize } from 'path';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8080;
const ROOT = process.env.GAME_ROOT || join(process.cwd(), '..');   // repo root (index.html + maps/)
const MIME = { '.html':'text/html', '.json':'application/json', '.js':'text/javascript',
  '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon' };

const http = createServer((req, res) => {
  try {
    let p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = normalize(join(ROOT, p));
    if (!f.startsWith(normalize(ROOT)) || !existsSync(f) || !statSync(f).isFile()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream',
      'Cache-Control': 'no-cache' });
    res.end(readFileSync(f));
  } catch (e) { res.writeHead(500); res.end('err'); }
});

const wss = new WebSocketServer({ server: http, path: '/ws' });
const rooms = new Map();   // code -> { host, guest }
const codeOf = new Map();  // ws -> code
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I/O — kid-readable codes
const mkCode = () => { let c; do { c = Array.from({length:4},()=>ALPHA[Math.floor(Math.random()*ALPHA.length)]).join(''); } while (rooms.has(c)); return c; };
const send = (ws, o) => { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); } catch (_) {} };
const peerOf = (ws) => { const r = rooms.get(codeOf.get(ws)); return r ? (r.host === ws ? r.guest : r.host) : null; };

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (_) { return; }
    if (m.t === 'host') {
      if (codeOf.has(ws)) return;
      const code = mkCode(); rooms.set(code, { host: ws, guest: null }); codeOf.set(ws, code);
      send(ws, { t: 'hosted', code });
    } else if (m.t === 'join') {
      const code = String(m.code || '').toUpperCase().trim();
      const r = rooms.get(code);
      if (!r) { send(ws, { t: 'err', why: 'no such room' }); return; }
      if (r.guest) { send(ws, { t: 'err', why: 'room is full' }); return; }
      r.guest = ws; codeOf.set(ws, code);
      send(ws, { t: 'joined', code });
      send(r.host, { t: 'peer', on: true });
      send(ws, { t: 'peer', on: true });
    } else if (m.t === 'msg') {
      send(peerOf(ws), { t: 'msg', data: m.data });   // the whole relay, right here
    } else if (m.t === 'leave') { drop(ws); }
  });
  ws.on('close', () => drop(ws));
  ws.on('error', () => drop(ws));
});

function drop(ws) {
  const code = codeOf.get(ws); if (!code) return;
  codeOf.delete(ws);
  const r = rooms.get(code); if (!r) return;
  const peer = r.host === ws ? r.guest : r.host;
  if (peer) { send(peer, { t: 'peer', on: false }); codeOf.delete(peer); }
  rooms.delete(code);
}

setInterval(() => {                                   // keepalive sweep (free tiers idle-kill quiet sockets)
  for (const ws of wss.clients) {
    if (!ws.isAlive) { try { ws.terminate(); } catch (_) {} continue; }
    ws.isAlive = false; try { ws.ping(); } catch (_) {}
  }
}, 25000);

http.listen(PORT, () => console.log(`abduct relay+game on :${PORT}  (game: http://localhost:${PORT}/  relay: /ws)`));
