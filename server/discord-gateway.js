// Conexión en vivo con Discord para dar el rol 😺 Aficionado a cada persona que entra al servidor.
// Requiere activar "Server Members Intent" en el portal de desarrolladores (Bot).
// Si no hay token, configuración o rol, no hace nada.
const discord = require("./discord");
const casinos = require("./discord-casinos");

const GATEWAY = process.env.DISCORD_GATEWAY_URL || "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENT_MIEMBROS = 1 << 1; // GUILD_MEMBERS (privilegiado)

let ws = null, latido = null, secuencia = null, reintentos = 0, detenido = false, intents = INTENT_MIEMBROS;
let anotar = (tipo, msg) => console.log(`[discord] ${tipo}: ${msg}`);

function cerrar() {
  clearInterval(latido); latido = null;
  if (ws) { try { ws.close(); } catch {} ws = null; }
}

function reconectar(motivo) {
  cerrar();
  if (detenido) return;
  const espera = Math.min(60000, 2000 * 2 ** reintentos++);
  if (motivo) console.log(`[discord] reconectando en ${espera / 1000}s (${motivo})`);
  setTimeout(conectar, espera).unref();
}

async function darRolAficionado(miembro) {
  const cfg = discord.leerConfig();
  if (!cfg || !cfg.roles || !cfg.roles.aficionado || miembro.guild_id !== cfg.guild_id || (miembro.user && miembro.user.bot)) return;
  try {
    await discord.api("PUT", `/guilds/${cfg.guild_id}/members/${miembro.user.id}/roles/${cfg.roles.aficionado}`);
  } catch (e) {
    anotar("error", `No pude dar el rol Aficionado a ${miembro.user.username}: ${e.message}. Revisa que el rol del bot esté hasta arriba en Ajustes → Roles.`);
  }
}

function conectar() {
  if (detenido) return;
  const token = process.env.DISCORD_BOT_TOKEN;
  try { ws = new WebSocket(GATEWAY); } catch (e) { return reconectar(e.message); }

  ws.onmessage = (ev) => {
    let p;
    try { p = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString()); } catch { return; }
    if (p.s !== null && p.s !== undefined) secuencia = p.s;
    if (p.op === 10) { // Hello: empezar latidos e identificarse
      clearInterval(latido);
      latido = setInterval(() => ws && ws.readyState === 1 && ws.send(JSON.stringify({ op: 1, d: secuencia })), p.d.heartbeat_interval);
      latido.unref();
      ws.send(JSON.stringify({ op: 2, d: { token, intents, properties: { os: "linux", browser: "dongato", device: "dongato" } } }));
    } else if (p.op === 1) {
      ws.send(JSON.stringify({ op: 1, d: secuencia }));
    } else if (p.op === 7 || p.op === 9) {
      reconectar("Discord pidió reconectar");
    } else if (p.op === 0 && p.t === "READY") {
      reintentos = 0;
      console.log("[discord] conectado: daré el rol Aficionado a quien entre");
    } else if (p.op === 0 && p.t === "GUILD_MEMBER_ADD") {
      darRolAficionado(p.d);
    } else if (p.op === 0 && p.t === "INTERACTION_CREATE" && p.d && p.d.type === 3) {   // clic en un botón (tickets)
      casinos.manejarInteraccion(p.d, anotar).catch((e) => anotar("error", `Ticket: ${e.message}`));
    }
  };
  ws.onclose = (ev) => {
    if (ev.code === 4014 && intents) { // intent no activado: seguir conectado sin él (los botones de tickets sí funcionan)
      intents = 0;
      anotar("aviso", 'Para dar el rol Aficionado automáticamente activa "Server Members Intent" en discord.com/developers → tu aplicación → Bot, y reinicia la página. Los tickets sí funcionan.');
      return reconectar("sin permiso de miembros");
    }
    if (ev.code === 4004) { detenido = true; cerrar(); anotar("error", "El token del bot de Discord no es válido."); return; }
    reconectar(`cerró con código ${ev.code}`);
  };
  ws.onerror = () => {}; // el cierre se maneja en onclose
}

function iniciar(fnAnotar) {
  if (fnAnotar) anotar = fnAnotar;
  const cfg = discord.leerConfig();
  if (!process.env.DISCORD_BOT_TOKEN || !cfg || !cfg.roles || !cfg.roles.aficionado) return;
  if (typeof WebSocket !== "function") return console.log("[discord] esta versión de Node no tiene WebSocket");
  conectar();
}

module.exports = { iniciar, detener: () => { detenido = true; cerrar(); } };
