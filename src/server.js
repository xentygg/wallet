// Servidor del overlay: lee el chat/regalos del live de TikTok, arma la cola de
// análisis y lo envía a la página (public/index.html) por Server-Sent Events.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { loadData } = require('./data');
const { buildStrengths, predict } = require('./model');

const PORT = Number(process.env.PORT || 3000);
const TIKTOK_USER = process.env.TIKTOK_USER || process.argv.find((a) => a.startsWith('@'))?.slice(1);
const DEMO = process.argv.includes('--demo');
const SHOW_MS = { gift: 20000, chat: 14000, auto: 12000 };

let leagues = [];  // [{ name, model, fixtures }]
let source = '';
const queue = [];  // pedidos pendientes
let current = null;
const clients = new Set();

// --- Utilidades -------------------------------------------------------------
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const ALIAS = { barca: 'barcelona', atleti: 'atletico', madrid: 'real madrid', city: 'manchester city', united: 'manchester united', spurs: 'tottenham', chivas: 'guadalajara', aguilas: 'america', rayados: 'monterrey' };

function findTeam(q) {
  q = norm(q);
  q = ALIAS[q] || q;
  for (const lg of leagues) for (const t of Object.keys(lg.model.teams)) if (norm(t) === q) return { lg, team: t };
  for (const lg of leagues) for (const t of Object.keys(lg.model.teams)) if (norm(t).includes(q)) return { lg, team: t };
  return null;
}

// "real madrid" -> su próximo partido; "madrid vs barca" -> ese cruce aunque no esté programado
function resolveRequest(text) {
  const parts = text.split(/\s+(?:vs?\.?|contra|-)\s+/i);
  if (parts.length === 2) {
    const a = findTeam(parts[0]), b = findTeam(parts[1]);
    if (a && b && a.lg === b.lg) return { lg: a.lg, home: a.team, away: b.team, date: 'Cruce hipotético' };
  }
  const t = findTeam(text);
  if (!t) return null;
  const fx = t.lg.fixtures.find((f) => f.home === t.team || f.away === t.team);
  return fx ? { lg: t.lg, ...fx } : null;
}

function analysis(req, by, tier) {
  const p = predict(req.lg.model, req.home, req.away);
  if (!p) return null;
  return { league: req.lg.name, date: req.date, by, tier, ...p };
}

// --- Cola y pantalla --------------------------------------------------------
function broadcast(ev) {
  const msg = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(msg);
}
const queueView = () => queue.map((q) => ({ by: q.by, tier: q.tier, match: `${q.home} vs ${q.away}` }));

function enqueue(text, by, tier) {
  const req = resolveRequest(text);
  if (!req) return broadcast({ type: 'toast', text: `@${by}: no encontré "${text}"` });
  const item = { ...req, by, tier };
  if (tier === 'gift') {
    const i = queue.findIndex((q) => q.tier !== 'gift');
    queue.splice(i === -1 ? queue.length : i, 0, item);
  } else {
    if (queue.some((q) => q.by === by) || queue.length >= 15) return; // 1 pedido por persona, cola acotada
    queue.push(item);
  }
  broadcast({ type: 'queue', items: queueView() });
  if (!current || current.tier === 'auto' || (tier === 'gift' && current.tier !== 'gift')) next();
}

let timer = null;
let autoIdx = 0;
function next() {
  clearTimeout(timer);
  let item = queue.shift();
  if (!item) {
    const all = leagues.flatMap((lg) => lg.fixtures.map((f) => ({ lg, ...f })));
    if (!all.length) return;
    item = { ...all[autoIdx++ % all.length], by: null, tier: 'auto' };
  }
  current = analysis(item, item.by, item.tier);
  broadcast({ type: 'analysis', data: current });
  broadcast({ type: 'queue', items: queueView() });
  timer = setTimeout(next, SHOW_MS[item.tier]);
}

// --- Eventos del live -------------------------------------------------------
const CMD = /^[!/](?:p|partido|analiza)\s+(.+)/i;

function onChat(user, comment) {
  const m = comment.match(CMD);
  if (m) enqueue(m[1], user, 'chat');
}

// Cualquier regalo da prioridad: el comentario más reciente de esa persona con !p
// pasa al frente; si no pidió nada, se muestra el agradecimiento.
const lastAsk = new Map();
function onGift(user, gift, count) {
  broadcast({ type: 'gift', user, gift, count });
  const ask = lastAsk.get(user);
  const idx = queue.findIndex((q) => q.by === user);
  if (idx !== -1) queue.splice(idx, 1);
  if (ask) enqueue(ask, user, 'gift');
}

function chatHook(user, comment) {
  const m = comment.match(CMD);
  if (m) lastAsk.set(user, m[1]);
  onChat(user, comment);
}

async function connectTikTok() {
  let lib;
  try { lib = require('tiktok-live-connector'); } catch { return console.log('Instala dependencias: npm install'); }
  const { TikTokLiveConnection, WebcastEvent } = lib;
  const conn = new TikTokLiveConnection(TIKTOK_USER);
  conn.on(WebcastEvent.CHAT, (d) => chatHook(d.user?.uniqueId || d.user?.nickname || 'anon', d.comment || ''));
  conn.on(WebcastEvent.GIFT, (d) => {
    // Los regalos en racha mandan varios eventos; contamos solo el final
    if (d.giftDetails?.giftType === 1 && !d.repeatEnd) return;
    onGift(d.user?.uniqueId || d.user?.nickname || 'anon', d.giftDetails?.giftName || 'regalo', d.repeatCount || 1);
  });
  conn.on(WebcastEvent.DISCONNECTED, () => { console.log('TikTok desconectado, reintento en 15 s'); setTimeout(() => conn.connect().catch(() => {}), 15000); });
  try {
    await conn.connect();
    console.log(`Conectado al live de @${TIKTOK_USER}`);
  } catch (e) {
    console.log(`No pude conectar con @${TIKTOK_USER} (¿estás en vivo?): ${e.message}. Reintento en 30 s`);
    setTimeout(connectTikTok, 30000);
  }
}

function startDemo() {
  const users = ['carlos_10', 'lauuu.fut', 'eltioapuestas', 'mx_gol', 'juanpi', 'sofi.cr7', 'neymarfan', 'el_profe'];
  const asks = ['!p real madrid', '!p barca', '!p america', '!p arsenal vs liverpool', '!p chivas', '!p city', '!p tigres vs monterrey', '!p betis', '!partido pumas'];
  const gifts = ['Rosa', 'TikTok', 'Corazón', 'Galaxia', 'León'];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  setInterval(() => {
    const u = pick(users);
    if (Math.random() < 0.25 && lastAsk.has(u)) onGift(u, pick(gifts), 1 + Math.floor(Math.random() * 5));
    else chatHook(u, pick(asks));
  }, 6000);
}

// --- HTTP -------------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res);
    res.write(`data: ${JSON.stringify({ type: 'hello', source })}\n\n`);
    if (current) res.write(`data: ${JSON.stringify({ type: 'analysis', data: current })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'queue', items: queueView() })}\n\n`);
    req.on('close', () => clients.delete(res));
    return;
  }
  // Para probar sin live: /test?u=usuario&msg=!p madrid  o  /test?u=usuario&gift=Rosa
  if (url.pathname === '/test') {
    const u = url.searchParams.get('u') || 'tester';
    if (url.searchParams.get('msg')) chatHook(u, url.searchParams.get('msg'));
    if (url.searchParams.get('gift')) onGift(u, url.searchParams.get('gift'), 1);
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }
  const file = path.join(__dirname, '..', 'public', url.pathname === '/' ? 'index.html' : path.normalize(url.pathname));
  if (!file.startsWith(path.join(__dirname, '..', 'public'))) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

async function main() {
  const data = await loadData();
  source = data.source;
  leagues = data.leagues.map((l) => ({ name: l.name, fixtures: l.fixtures, model: buildStrengths(l.results) }));
  console.log(`Datos: ${source} · ${leagues.map((l) => `${l.name}: ${l.fixtures.length} partidos`).join(' · ')}`);
  server.listen(PORT, () => console.log(`Overlay listo en http://localhost:${PORT}  (agrégalo en OBS como "Navegador", 1080x1920)`));
  setInterval(() => { // mantiene viva la conexión SSE
    for (const c of clients) c.write(': ping\n\n');
  }, 20000);
  next();
  if (TIKTOK_USER) connectTikTok();
  if (DEMO) { console.log('Modo demo: chat y regalos simulados'); startDemo(); }
  if (!TIKTOK_USER && !DEMO) console.log('Sin usuario de TikTok: usa "npm start -- @tuusuario" o "npm run demo"');
}

main().catch((e) => { console.error(e); process.exit(1); });
