// Conexión en vivo con Discord: da el rol de aficionado a quien entra y recibe los clics de los botones (tickets).
// Reglas para no exceder los límites de Discord (más de 1,000 inicios de sesión al día = token reiniciado):
//   - una sola conexión a la vez (los cierres de conexiones viejas se ignoran);
//   - cuando Discord pide reconectar, se REANUDA la sesión (no cuenta como inicio de sesión nuevo);
//   - esperas crecientes entre reintentos;
//   - freno de seguridad: si hay demasiados inicios de sesión en 24 h, se detiene y avisa en el panel.
const discord = require("./discord");
const casinos = require("./discord-casinos");
const db = require("./db");

const GATEWAY = process.env.DISCORD_GATEWAY_URL || "wss://gateway.discord.gg/?v=10&encoding=json";
const INTENT_MIEMBROS = 1 << 1; // GUILD_MEMBERS (privilegiado)
const MAX_INICIOS_DIA = Number(process.env.DISCORD_MAX_INICIOS || 100);   // Discord corta en 1,000
const FATALES = new Set([4004, 4010, 4011, 4012, 4013]);                 // token malo, versión o intents inválidos

let ws = null, latido = null, pendiente = null, detenido = false, intents = INTENT_MIEMBROS;
let secuencia = null, sesion = null, urlReanudar = null, reintentos = 0, ackPendiente = false, estableSince = 0;
let anotar = (tipo, msg) => console.log(`[discord] ${tipo}: ${msg}`);

// ---------- freno de seguridad (se guarda en la base de datos para sobrevivir reinicios) ----------
function iniciosRecientes() {
  let lista = [];
  try { lista = JSON.parse(db.ajuste("discord_inicios") || "[]"); } catch {}
  return lista.filter((t) => Date.now() - t < 86400000);
}
function registrarInicio() {
  const lista = iniciosRecientes(); lista.push(Date.now());
  db.ponerAjuste("discord_inicios", JSON.stringify(lista));
  return lista.length;
}

function cerrar() {
  clearInterval(latido); latido = null;
  const viejo = ws; ws = null;                 // primero se suelta, para que su cierre no dispare otra reconexión
  if (viejo) { try { viejo.close(4000); } catch {} }
}

function programarReconexion(motivo, rapido = false) {
  cerrar();
  if (detenido || pendiente) return;           // nunca dos reconexiones pendientes
  const espera = rapido ? 1000 + Math.random() * 2000 : Math.min(300000, 5000 * 2 ** reintentos++) + Math.random() * 1000;
  console.log(`[discord] reconectando en ${Math.round(espera / 1000)}s (${motivo})`);
  pendiente = setTimeout(() => { pendiente = null; conectar(); }, espera);
  pendiente.unref?.();
}

function detener(tipo, msg) {
  detenido = true; cerrar();
  if (pendiente) { clearTimeout(pendiente); pendiente = null; }
  anotar(tipo, msg);
}

async function darRolAficionado(miembro) {
  const cfg = discord.leerConfig();
  if (!cfg || !cfg.roles || !cfg.roles.aficionado || miembro.guild_id !== cfg.guild_id || (miembro.user && miembro.user.bot)) return;
  try {
    await discord.api("PUT", `/guilds/${cfg.guild_id}/members/${miembro.user.id}/roles/${cfg.roles.aficionado}`);
  } catch (e) {
    anotar("error", `No pude dar el rol de aficionado a ${miembro.user.username}: ${e.message}. Revisa que el rol del bot esté hasta arriba en Ajustes → Roles.`);
  }
}

function conectar() {
  if (detenido || ws) return;
  const token = process.env.DISCORD_BOT_TOKEN;
  const reanudar = Boolean(sesion && urlReanudar);
  const url = reanudar ? `${urlReanudar.replace(/\/$/, "")}/?v=10&encoding=json` : GATEWAY;
  let sock;
  try { sock = new WebSocket(url); } catch (e) { return programarReconexion(e.message); }
  ws = sock;
  const enviar = (o) => { if (ws === sock && sock.readyState === 1) sock.send(JSON.stringify(o)); };

  sock.onmessage = (ev) => {
    if (ws !== sock) return;
    let p;
    try { p = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString()); } catch { return; }
    if (p.s !== null && p.s !== undefined) secuencia = p.s;

    if (p.op === 10) {                                   // Hola: latidos y luego reanudar o iniciar sesión
      const intervalo = p.d.heartbeat_interval;
      ackPendiente = false;
      clearInterval(latido);
      setTimeout(() => {
        if (ws !== sock) return;
        enviar({ op: 1, d: secuencia });
        latido = setInterval(() => {
          if (ws !== sock) return clearInterval(latido);
          if (ackPendiente) return programarReconexion("Discord dejó de responder", true);   // conexión muerta: reanudar
          ackPendiente = true; enviar({ op: 1, d: secuencia });
        }, intervalo);
        latido.unref?.();
      }, Math.random() * intervalo).unref?.();
      if (reanudar) {
        enviar({ op: 6, d: { token, session_id: sesion, seq: secuencia } });
      } else {
        const n = registrarInicio();
        if (n > MAX_INICIOS_DIA) return detener("error", `El bot de Discord se detuvo por seguridad: intentó iniciar sesión ${n} veces en 24 horas. Reinicia la página cuando lo revisemos (systemctl restart licenciado).`);
        enviar({ op: 2, d: { token, intents, properties: { os: "linux", browser: "quiniela", device: "quiniela" } } });
      }
    } else if (p.op === 11) {
      ackPendiente = false;
    } else if (p.op === 1) {
      enviar({ op: 1, d: secuencia });
    } else if (p.op === 7) {                              // Discord pide reconectar: se reanuda la sesión
      programarReconexion("Discord pidió reconectar", true);
    } else if (p.op === 9) {                              // sesión inválida
      if (!p.d) { sesion = null; urlReanudar = null; secuencia = null; }
      programarReconexion("sesión inválida", true);
    } else if (p.op === 0 && p.t === "READY") {
      sesion = p.d.session_id; urlReanudar = p.d.resume_gateway_url || null; estableSince = Date.now();
      console.log("[discord] conectado");
    } else if (p.op === 0 && p.t === "RESUMED") {
      estableSince = Date.now();
      console.log("[discord] sesión reanudada");
    } else if (p.op === 0 && p.t === "GUILD_MEMBER_ADD") {
      darRolAficionado(p.d);
    } else if (p.op === 0 && p.t === "INTERACTION_CREATE" && p.d && p.d.type === 3) {   // clic en un botón (tickets)
      casinos.manejarInteraccion(p.d, anotar).catch((e) => anotar("error", `Ticket: ${e.message}`));
    }
  };

  sock.onclose = (ev) => {
    if (ws !== sock) return;                              // cierre de una conexión vieja: no hacer nada
    clearInterval(latido); latido = null; ws = null;
    if (estableSince && Date.now() - estableSince > 60000) reintentos = 0;   // estuvo estable: reintentar pronto
    estableSince = 0;
    if (ev.code === 4014 && intents) {                    // intent de miembros sin activar: seguir sin él (los tickets funcionan)
      intents = 0; sesion = null; urlReanudar = null;
      anotar("aviso", 'Para dar el rol de aficionado automáticamente activa "Server Members Intent" en discord.com/developers → tu aplicación → Bot, y reinicia la página. Los tickets sí funcionan.');
      return programarReconexion("sin permiso de miembros");
    }
    if (ev.code === 4004) return detener("error", "El token del bot de Discord no es válido (quizá Discord lo reinició). Guarda el token nuevo y reinicia la página.");
    if (FATALES.has(ev.code)) return detener("error", `Discord cerró la conexión del bot (código ${ev.code}). Revisa la configuración del bot.`);
    if ([4007, 4009].includes(ev.code)) { sesion = null; urlReanudar = null; }   // sesión que ya no se puede reanudar
    programarReconexion(`cerró con código ${ev.code}`);
  };
  sock.onerror = () => {};                                // el cierre se maneja en onclose
}

function iniciar(fnAnotar) {
  if (fnAnotar) anotar = fnAnotar;
  const cfg = discord.leerConfig();
  if (!process.env.DISCORD_BOT_TOKEN || !cfg || !cfg.roles || !cfg.roles.aficionado) return;
  // Token nuevo (p. ej. después de que Discord lo reinició): el freno de seguridad empieza de cero
  const huella = require("node:crypto").createHash("sha256").update(process.env.DISCORD_BOT_TOKEN).digest("hex").slice(0, 16);
  if (db.ajuste("discord_token_huella") !== huella) { db.ponerAjuste("discord_token_huella", huella); db.ponerAjuste("discord_inicios", "[]"); }
  if (typeof WebSocket !== "function") return console.log("[discord] esta versión de Node no tiene WebSocket");
  conectar();
}

module.exports = { iniciar, detener: () => detener("aviso", "Conexión con Discord detenida."), _estado: () => ({ conectado: Boolean(ws), sesion, intentosHoy: iniciosRecientes().length }) };
