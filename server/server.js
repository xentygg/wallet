// Servidor de Don Gato: sirve la página y la API de cuentas, quiniela, perfil y panel del administrador.
// Sin dependencias externas: solo Node 22.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const db = require("./db");
const MARCA = require("./marca");

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const ZONA = "America/Mexico_City";
const DIAS_SESION = 60;

if (ADMIN_PASSWORD.length < 10) console.warn("⚠️  ADMIN_PASSWORD no está definida o es muy corta: el panel de administrador estará desactivado.");

// ------------------------------------------------------------------ utilidades
const fechaMX = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
const diaUTC = (f) => { const [a, m, d] = f.split("-").map(Number); return Date.UTC(a, m - 1, d); };
const sumarDias = (f, n) => new Date(diaUTC(f) + n * 86400000).toISOString().slice(0, 10);
const lunesDe = (f) => { const dow = (new Date(diaUTC(f)).getUTCDay() + 6) % 7; return sumarDias(f, -dow); };

function hashPassword(pass) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(pass, sal, 64);
  return sal.toString("hex") + ":" + h.toString("hex");
}
function verificarPassword(pass, guardado) {
  const [salHex, hHex] = String(guardado).split(":");
  if (!salHex || !hHex) return false;
  const h = crypto.scryptSync(pass, Buffer.from(salHex, "hex"), 64);
  return crypto.timingSafeEqual(h, Buffer.from(hHex, "hex"));
}
function igualSeguro(a, b) {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Teléfono de México a 10 dígitos (acepta +52, 52, 521, espacios y guiones)
function normalizarTelefono(t) {
  let d = String(t || "").replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("521")) d = d.slice(3);
  else if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
  return /^\d{10}$/.test(d) ? d : null;
}
const limpiar = (s, max) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max);

function codigoRef() {
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  for (;;) {
    let c = "DG";
    for (const b of crypto.randomBytes(5)) c += abc[b % abc.length];
    if (!db.prepare("SELECT 1 FROM usuarios WHERE ref_code = ?").get(c)) return c;
  }
}

// ------------------------------------------------------------------ límites de intentos (contra fuerza bruta)
const intentos = new Map();
function limitar(clave, max, minutos) {
  const ahora = Date.now(), ventana = minutos * 60000;
  const lista = (intentos.get(clave) || []).filter((t) => ahora - t < ventana);
  lista.push(ahora);
  intentos.set(clave, lista);
  return lista.length > max;
}
setInterval(() => { const ahora = Date.now(); for (const [k, v] of intentos) if (v.every((t) => ahora - t > 3600000)) intentos.delete(k); }, 600000).unref();

// ------------------------------------------------------------------ peticiones
function ipDe(req) {
  const remota = req.socket.remoteAddress || "";
  const local = remota === "127.0.0.1" || remota === "::1" || remota === "::ffff:127.0.0.1";
  const xff = req.headers["x-forwarded-for"];
  return (local && xff ? String(xff).split(",")[0].trim() : remota).slice(0, 64);
}
function cookies(req) {
  const out = {};
  for (const par of String(req.headers.cookie || "").split(";")) {
    const i = par.indexOf("=");
    if (i > 0) out[par.slice(0, i).trim()] = decodeURIComponent(par.slice(i + 1).trim());
  }
  return out;
}
function leerJSON(req) {
  return new Promise((resolve, reject) => {
    if (!String(req.headers["content-type"] || "").startsWith("application/json")) return reject(new ErrorHTTP(415, "Formato no válido."));
    let datos = "";
    req.on("data", (c) => { datos += c; if (datos.length > 20000) { reject(new ErrorHTTP(413, "Demasiado grande.")); req.destroy(); } });
    req.on("end", () => { try { resolve(datos ? JSON.parse(datos) : {}); } catch { reject(new ErrorHTTP(400, "JSON no válido.")); } });
    req.on("error", reject);
  });
}
class ErrorHTTP extends Error { constructor(estado, msg) { super(msg); this.estado = estado; } }
const falla = (estado, msg) => { throw new ErrorHTTP(estado, msg); };

function responder(res, estado, cuerpo, extraHeaders = {}) {
  res.writeHead(estado, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders });
  res.end(JSON.stringify(cuerpo));
}
function cookieSesion(req, token, dias) {
  const seguro = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(dias * 86400)}${seguro}`;
}
function crearSesion(usuarioId, esAdmin, dias) {
  const token = crypto.randomBytes(32).toString("hex");
  const expira = new Date(Date.now() + dias * 86400000).toISOString();
  db.prepare("INSERT INTO sesiones (token, usuario_id, es_admin, expira) VALUES (?, ?, ?, ?)").run(token, usuarioId, esAdmin ? 1 : 0, expira);
  return token;
}
function sesionDe(req) {
  const token = cookies(req).sid;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const s = db.prepare("SELECT * FROM sesiones WHERE token = ?").get(token);
  if (!s) return null;
  if (s.expira < new Date().toISOString()) { db.prepare("DELETE FROM sesiones WHERE token = ?").run(token); return null; }
  return s;
}
function usuarioDe(req) {
  const s = sesionDe(req);
  if (!s || !s.usuario_id) return null;
  const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(s.usuario_id);
  return u && !u.bloqueado ? u : null;
}
const requiereUsuario = (req) => usuarioDe(req) || falla(401, "Necesitas iniciar sesión.");
function requiereAdmin(req) { const s = sesionDe(req); if (!s || !s.es_admin) falla(401, "Solo el administrador."); }

// ------------------------------------------------------------------ lógica de la quiniela
function partidosDe(qid) { return db.prepare("SELECT id, orden, liga, local, visita, hora, empate, resultado, goles_local, goles_visita FROM partidos WHERE quiniela_id = ? ORDER BY orden").all(qid); }

function calificar(qid) {
  const ps = partidosDe(qid);
  if (!ps.length || ps.some((p) => !p.resultado)) {
    db.prepare("UPDATE quinielas SET calificada = 0 WHERE id = ?").run(qid);
    db.prepare("UPDATE entradas SET aciertos = NULL WHERE quiniela_id = ?").run(qid);
    return false;
  }
  const upd = db.prepare("UPDATE entradas SET aciertos = ? WHERE id = ?");
  for (const e of db.prepare("SELECT id, picks FROM entradas WHERE quiniela_id = ?").all(qid)) {
    const picks = JSON.parse(e.picks);
    upd.run(ps.filter((p) => p.resultado === "C" || picks[p.id] === p.resultado).length, e.id);
  }
  db.prepare("UPDATE quinielas SET calificada = 1 WHERE id = ?").run(qid);
  return true;
}

// Reglas del premio: 1 partido cancelado = premio reducido; 2 o más = quiniela anulada (sin premio).
function reglasDe(qid) {
  const q = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(qid);
  const ps = partidosDe(qid);
  const cancelados = ps.filter((p) => p.resultado === "C").length;
  const conMarcador = ps.filter((p) => p.resultado && p.resultado !== "C");
  const totalGoles = conMarcador.every((p) => p.goles_local !== null && p.goles_visita !== null)
    ? conMarcador.reduce((s, p) => s + p.goles_local + p.goles_visita, 0) : null;
  return { q, ps, cancelados, anulada: cancelados >= 2, premio: cancelados === 1 ? q.premio_cancelado : q.premio, totalGoles };
}

// Un solo ganador: entre quienes le atinaron a todo, el que más se acerque al total de goles; si empatan, el que envió primero.
function ganadoresDe(qRef) {
  const r = reglasDe(qRef.id);
  if (!r.q || !r.q.calificada || r.anulada) return [];
  const perfectos = db.prepare(`SELECT e.id, e.usuario_id, e.pagado, e.goles, e.creado, u.apodo, u.nombre, u.telefono FROM entradas e JOIN usuarios u ON u.id = e.usuario_id
                                WHERE e.quiniela_id = ? AND e.anulada = 0 AND e.aciertos = ?`).all(r.q.id, r.ps.length);
  if (!perfectos.length) return [];
  const dif = (e) => (e.goles === null || r.totalGoles === null ? Infinity : Math.abs(e.goles - r.totalGoles));
  perfectos.sort((a, b) => dif(a) - dif(b) || a.creado.localeCompare(b.creado) || a.id - b.id);
  const g = perfectos[0];
  return [{ ...g, monto: r.premio, empatados: perfectos.length, diferencia: dif(g) === Infinity ? null : dif(g) }];
}

function rachas(usuarioId) {
  const fechas = db.prepare(`SELECT DISTINCT q.fecha FROM entradas e JOIN quinielas q ON q.id = e.quiniela_id
                             WHERE e.usuario_id = ? AND e.anulada = 0 ORDER BY q.fecha`).all(usuarioId).map((r) => r.fecha);
  let mejor = 0, run = 0, prev = null;
  for (const f of fechas) { run = prev && sumarDias(prev, 1) === f ? run + 1 : 1; mejor = Math.max(mejor, run); prev = f; }
  const hoy = fechaMX();
  const ultima = fechas[fechas.length - 1];
  const actual = ultima === hoy || ultima === sumarDias(hoy, -1) ? run : 0;
  return { actual, mejor };
}

function quinielaPublica(q, usuario) {
  const ps = partidosDe(q.id);
  const out = {
    id: q.id, fecha: q.fecha, cierre: q.cierre, premio: q.premio, calificada: !!q.calificada,
    cerrada: Date.now() >= Date.parse(q.cierre),
    participantes: db.prepare("SELECT COUNT(*) n FROM entradas WHERE quiniela_id = ? AND anulada = 0").get(q.id).n,
    partidos: ps.map((p) => ({ id: p.id, liga: p.liga, local: p.local, visita: p.visita, hora: p.hora, empate: !!p.empate,
      ...(Date.now() >= Date.parse(q.cierre) ? { resultado: p.resultado, goles_local: p.goles_local, goles_visita: p.goles_visita } : { resultado: null }) })),
  };
  if (usuario) {
    const e = db.prepare("SELECT picks, aciertos, anulada, goles FROM entradas WHERE quiniela_id = ? AND usuario_id = ?").get(q.id, usuario.id);
    out.mia = e ? { picks: JSON.parse(e.picks), aciertos: e.aciertos, anulada: !!e.anulada, goles: e.goles } : null;
  }
  const r = reglasDe(q.id);
  out.premio_cancelado = q.premio_cancelado;
  if (out.cerrada) {
    Object.assign(out, { cancelados: r.cancelados, anulada: r.anulada, premio_final: r.anulada ? 0 : r.premio, total_goles: r.totalGoles });
    // ¿Qué eligió la gente? Porcentaje de L/E/V por partido (solo después del cierre)
    const conteo = {};
    for (const e of db.prepare("SELECT picks FROM entradas WHERE quiniela_id = ? AND anulada = 0").all(q.id)) {
      for (const [pid, v] of Object.entries(JSON.parse(e.picks))) (conteo[pid] ||= { L: 0, E: 0, V: 0 })[v]++;
    }
    for (const p of out.partidos) {
      const c = conteo[p.id] || { L: 0, E: 0, V: 0 }, n = c.L + c.E + c.V;
      p.reparto = n ? { L: Math.round(c.L * 100 / n), E: Math.round(c.E * 100 / n), V: Math.round(c.V * 100 / n), n } : null;
    }
  }
  if (q.calificada) out.ganadores = ganadoresDe(q).map((g) => ({ apodo: g.apodo, monto: g.monto, empatados: g.empatados }));
  return out;
}

// ------------------------------------------------------------------ rutas de la API
const rutas = [];
const ruta = (metodo, patron, fn) => rutas.push({ metodo, re: new RegExp("^" + patron.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), fn });

// --- cuentas
ruta("POST", "/api/registro", async (req, res) => {
  const ip = ipDe(req);
  if (limitar("reg:" + ip, 5, 60)) falla(429, "Demasiados intentos. Espera un rato.");
  const b = await leerJSON(req);
  const telefono = normalizarTelefono(b.telefono);
  const nombre = limpiar(b.nombre, 80), apodo = limpiar(b.apodo, 24), pass = String(b.password || "");
  if (!telefono) falla(400, "Escribe un celular válido de 10 dígitos.");
  if (nombre.split(/\s+/).length < 2) falla(400, "Escribe tu nombre completo, como aparece en tu INE.");
  if (apodo.length < 2) falla(400, "Escribe un apodo de al menos 2 letras.");
  if (pass.length < 8) falla(400, "La contraseña debe tener al menos 8 caracteres.");
  if (b.mayor !== true || b.acepta !== true) falla(400, "Debes ser mayor de 18 años y aceptar las bases y el aviso de privacidad.");
  if (db.prepare("SELECT 1 FROM usuarios WHERE telefono = ?").get(telefono)) falla(409, "Ese celular ya tiene cuenta. Inicia sesión.");
  const ref = limpiar(b.ref, 12).toUpperCase();
  const invitadoPor = ref && db.prepare("SELECT 1 FROM usuarios WHERE ref_code = ?").get(ref) ? ref : null;
  const r = db.prepare(`INSERT INTO usuarios (telefono, nombre, apodo, pass_hash, ref_code, invitado_por, ip, agente)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(telefono, nombre, apodo, hashPassword(pass), codigoRef(), invitadoPor, ip, limpiar(req.headers["user-agent"], 300));
  const token = crearSesion(Number(r.lastInsertRowid), false, DIAS_SESION);
  responder(res, 201, { ok: true }, { "Set-Cookie": cookieSesion(req, token, DIAS_SESION) });
});

ruta("POST", "/api/entrar", async (req, res) => {
  const ip = ipDe(req);
  const b = await leerJSON(req);
  const telefono = normalizarTelefono(b.telefono);
  if (limitar("login:" + ip, 15, 15) || (telefono && limitar("login-tel:" + telefono, 8, 15))) falla(429, "Demasiados intentos. Espera 15 minutos.");
  const u = telefono && db.prepare("SELECT * FROM usuarios WHERE telefono = ?").get(telefono);
  if (!u || !verificarPassword(String(b.password || ""), u.pass_hash)) falla(401, "Celular o contraseña incorrectos.");
  if (u.bloqueado) falla(403, "Tu cuenta está suspendida. Escríbenos por WhatsApp.");
  const token = crearSesion(u.id, false, DIAS_SESION);
  responder(res, 200, { ok: true }, { "Set-Cookie": cookieSesion(req, token, DIAS_SESION) });
});

ruta("POST", "/api/salir", async (req, res) => {
  const s = sesionDe(req);
  if (s) db.prepare("DELETE FROM sesiones WHERE token = ?").run(s.token);
  responder(res, 200, { ok: true }, { "Set-Cookie": cookieSesion(req, "", 0) });
});

ruta("GET", "/api/yo", async (req, res) => {
  const u = usuarioDe(req);
  responder(res, 200, u ? { usuario: { apodo: u.apodo, ref_code: u.ref_code } } : { usuario: null });
});

// --- perfil
ruta("GET", "/api/perfil", async (req, res) => {
  const u = requiereUsuario(req);
  const hist = db.prepare(`SELECT q.id, q.fecha, q.premio, q.calificada, e.aciertos, e.anulada, e.pagado,
                             (SELECT COUNT(*) FROM partidos p WHERE p.quiniela_id = q.id) total
                           FROM entradas e JOIN quinielas q ON q.id = e.quiniela_id
                           WHERE e.usuario_id = ? ORDER BY q.fecha DESC LIMIT 60`).all(u.id);
  let premios = 0, perfectas = 0, aciertos = 0;
  for (const h of hist) {
    if (!h.calificada || h.anulada) continue;
    aciertos += h.aciertos;
    if (h.aciertos === h.total) {
      perfectas++;
      h.gano = ganadoresDe({ id: h.id, premio: h.premio, calificada: 1 }).find((g) => g.usuario_id === u.id)?.monto || 0;
      premios += h.gano;
    }
  }
  const trivia = db.prepare("SELECT COUNT(*) dias, COALESCE(SUM(aciertos),0) aciertos, COALESCE(SUM(total),0) total FROM trivia WHERE usuario_id = ?").get(u.id);
  const triviaHoy = db.prepare("SELECT aciertos, total FROM trivia WHERE usuario_id = ? AND fecha = ?").get(u.id, fechaMX());
  const racha = rachas(u.id);
  const invitados = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE invitado_por = ?").get(u.ref_code).n;
  const casi = hist.some((h) => h.calificada && !h.anulada && h.aciertos === h.total - 1);
  const triviaPerfecta = !!db.prepare("SELECT 1 FROM trivia WHERE usuario_id = ? AND aciertos = total").get(u.id);
  const logros = [
    { icono: "⚽", nombre: "Debut", desc: "Juega tu primera quiniela", ok: hist.length >= 1 },
    { icono: "🔥", nombre: "En racha", desc: "Juega 3 días seguidos", ok: racha.mejor >= 3 },
    { icono: "📅", nombre: "Semana completa", desc: "Juega 7 días seguidos", ok: racha.mejor >= 7 },
    { icono: "🗓️", nombre: "Fiel " + MARCA.de.replace(/^del /, "al ").replace(/^de /, "a "), desc: "Juega 30 días seguidos", ok: racha.mejor >= 30 },
    { icono: "😬", nombre: "A una del premio", desc: "Atínale a todos menos uno", ok: casi || perfectas > 0 },
    { icono: "🎯", nombre: "Perfecta", desc: "Atínale a todos los partidos", ok: perfectas > 0 },
    { icono: "🏆", nombre: "Campeón", desc: "Gana un premio", ok: premios > 0 },
    { icono: "🔟", nombre: "Veterano", desc: "Juega 10 quinielas", ok: hist.length >= 10 },
    { icono: "🧠", nombre: "Sabelotodo", desc: "Saca 5 de 5 en la trivia", ok: triviaPerfecta },
    { icono: "🤝", nombre: "Buen compa", desc: "Invita a 1 amigo", ok: invitados >= 1 },
    { icono: "📣", nombre: "Influencer", desc: "Invita a 5 amigos", ok: invitados >= 5 },
  ];
  responder(res, 200, {
    apodo: u.apodo, nombre: u.nombre, telefono: u.telefono.replace(/^(\d{3})\d{4}(\d{3})$/, "$1 **** $2"),
    desde: u.creado.slice(0, 10), ref_code: u.ref_code,
    invitados,
    quinielas: hist.length, perfectas, aciertos, premios, racha, logros,
    historial: hist.slice(0, 30).map((h) => ({ fecha: h.fecha, aciertos: h.calificada ? h.aciertos : null, total: h.total, anulada: !!h.anulada, gano: h.gano || 0, pagado: !!h.pagado })),
    trivia: { ...trivia, hoy: triviaHoy || null },
  });
});

// --- quiniela
ruta("GET", "/api/quiniela", async (req, res) => {
  const u = usuarioDe(req);
  const hoy = fechaMX(), ahora = new Date().toISOString();
  // La que se puede jugar (la próxima en cerrar) y la que ya cerró y sigue en juego o terminó hoy
  const abierta = db.prepare("SELECT * FROM quinielas WHERE cierre > ? ORDER BY cierre LIMIT 1").get(ahora);
  const enJuego = db.prepare("SELECT * FROM quinielas WHERE cierre <= ? AND (calificada = 0 OR fecha = ?) ORDER BY cierre DESC LIMIT 1").get(ahora, hoy);
  const principal = abierta || enJuego;
  responder(res, 200, {
    hoy, sesion: !!u,
    quiniela: principal ? quinielaPublica(principal, u) : null,
    enJuego: abierta && enJuego ? quinielaPublica(enJuego, u) : null,
  });
});

ruta("POST", "/api/quiniela/:id/enviar", async (req, res, p) => {
  const u = requiereUsuario(req);
  const b = await leerJSON(req);
  const q = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(Number(p.id)) || falla(404, "Quiniela no encontrada.");
  if (Date.now() >= Date.parse(q.cierre)) falla(400, "La quiniela ya cerró.");
  if (db.prepare("SELECT 1 FROM entradas WHERE quiniela_id = ? AND usuario_id = ?").get(q.id, u.id)) falla(409, "Ya enviaste tu quiniela de hoy. Solo se permite una por día.");
  const ps = partidosDe(q.id);
  const picks = {};
  for (const pt of ps) {
    const v = b.picks && b.picks[pt.id];
    if (!(pt.empate ? ["L", "E", "V"] : ["L", "V"]).includes(v)) falla(400, "Elige un resultado válido para cada partido.");
    picks[pt.id] = v;
  }
  const goles = Number(b.goles);
  if (!Number.isInteger(goles) || goles < 0 || goles > 99) falla(400, "Escribe cuántos goles crees que habrá en total (para el desempate).");
  db.prepare("INSERT INTO entradas (quiniela_id, usuario_id, picks, goles, ip, agente) VALUES (?, ?, ?, ?, ?, ?)")
    .run(q.id, u.id, JSON.stringify(picks), goles, ipDe(req), limpiar(req.headers["user-agent"], 300));
  responder(res, 201, { ok: true });
});

// Portada: quiniela abierta, muro de ganadores y números de la comunidad
ruta("GET", "/api/portada", async (req, res) => {
  const ahora = new Date().toISOString();
  const abierta = db.prepare("SELECT * FROM quinielas WHERE cierre > ? ORDER BY cierre LIMIT 1").get(ahora);
  const muro = [];
  let pagado = 0, ganadores = 0;
  for (const q of db.prepare("SELECT * FROM quinielas WHERE calificada = 1 ORDER BY fecha DESC LIMIT 400").all()) {
    for (const g of ganadoresDe(q)) {
      ganadores++;
      if (g.pagado) pagado += g.monto;
      if (muro.length < 10) muro.push({ apodo: g.apodo, fecha: q.fecha, monto: g.monto, pagado: !!g.pagado });
    }
  }
  responder(res, 200, {
    quiniela: abierta ? quinielaPublica(abierta, usuarioDe(req)) : null,
    muro, pagado, ganadores,
  });
});

ruta("GET", "/api/resultados", async (req, res) => {
  const qs = db.prepare("SELECT * FROM quinielas WHERE calificada = 1 ORDER BY fecha DESC LIMIT 7").all();
  responder(res, 200, { resultados: qs.map((q) => quinielaPublica(q, null)) });
});

ruta("GET", "/api/tabla", async (req, res) => {
  const lunes = lunesDe(fechaMX());
  const filas = db.prepare(`SELECT u.apodo, SUM(e.aciertos) puntos, COUNT(*) jugadas FROM entradas e
                            JOIN quinielas q ON q.id = e.quiniela_id JOIN usuarios u ON u.id = e.usuario_id
                            WHERE q.calificada = 1 AND e.anulada = 0 AND q.fecha >= ? AND u.bloqueado = 0
                            GROUP BY u.id ORDER BY puntos DESC, jugadas ASC LIMIT 20`).all(lunes);
  responder(res, 200, { desde: lunes, tabla: filas });
});

// --- trivia (guarda el resultado del día si hay sesión)
ruta("POST", "/api/trivia", async (req, res) => {
  const u = requiereUsuario(req);
  const b = await leerJSON(req);
  const total = Number(b.total), aciertos = Number(b.aciertos);
  if (!Number.isInteger(total) || total < 1 || total > 10 || !Number.isInteger(aciertos) || aciertos < 0 || aciertos > total) falla(400, "Datos no válidos.");
  db.prepare("INSERT OR IGNORE INTO trivia (usuario_id, fecha, aciertos, total) VALUES (?, ?, ?, ?)").run(u.id, fechaMX(), aciertos, total);
  responder(res, 200, { ok: true });
});

// --- administrador
ruta("POST", "/api/admin/entrar", async (req, res) => {
  if (limitar("admin:" + ipDe(req), 5, 15)) falla(429, "Demasiados intentos. Espera 15 minutos.");
  const b = await leerJSON(req);
  if (ADMIN_PASSWORD.length < 10 || !igualSeguro(String(b.password || ""), ADMIN_PASSWORD)) falla(401, "Contraseña incorrecta.");
  const token = crearSesion(null, true, 1);
  responder(res, 200, { ok: true }, { "Set-Cookie": cookieSesion(req, token, 1) });
});

ruta("GET", "/api/admin/quinielas", async (req, res) => {
  requiereAdmin(req);
  const qs = db.prepare(`SELECT q.*, (SELECT COUNT(*) FROM entradas e WHERE e.quiniela_id = q.id) entradas
                         FROM quinielas q ORDER BY fecha DESC LIMIT 30`).all();
  responder(res, 200, { hoy: fechaMX(), quinielas: qs });
});

ruta("POST", "/api/admin/quinielas", async (req, res) => {
  requiereAdmin(req);
  const b = await leerJSON(req);
  const fecha = String(b.fecha || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) falla(400, "Fecha no válida.");
  if (Number.isNaN(Date.parse(b.cierre))) falla(400, "Hora de cierre no válida.");
  const premio = Math.max(0, Math.round(Number(b.premio) || 0));
  const premioCancelado = b.premio_cancelado === undefined ? 200 : Math.max(0, Math.round(Number(b.premio_cancelado) || 0));
  const ps = Array.isArray(b.partidos) ? b.partidos : [];
  if (ps.length < 1 || ps.length > 10) falla(400, "Agrega entre 1 y 10 partidos.");
  for (const x of ps) if (!limpiar(x.local, 40) || !limpiar(x.visita, 40)) falla(400, "Cada partido necesita equipo local y visitante.");
  if (db.prepare("SELECT 1 FROM quinielas WHERE fecha = ?").get(fecha)) falla(409, "Ya existe una quiniela para esa fecha.");
  const r = db.prepare("INSERT INTO quinielas (fecha, cierre, premio, premio_cancelado) VALUES (?, ?, ?, ?)").run(fecha, new Date(b.cierre).toISOString(), premio, premioCancelado);
  const ins = db.prepare("INSERT INTO partidos (quiniela_id, orden, liga, local, visita, hora, empate) VALUES (?, ?, ?, ?, ?, ?, ?)");
  ps.forEach((x, i) => ins.run(r.lastInsertRowid, i + 1, limpiar(x.liga, 30), limpiar(x.local, 40), limpiar(x.visita, 40), limpiar(x.hora, 30), x.empate === false ? 0 : 1));
  avisarQuinielaDiscord(Number(r.lastInsertRowid));
  responder(res, 201, { ok: true, id: Number(r.lastInsertRowid) });
});

ruta("DELETE", "/api/admin/quinielas/:id", async (req, res, p) => {
  requiereAdmin(req);
  // Si ya hay quinielas enviadas, solo se borra confirmando (?forzar=1); se borran también esas quinielas.
  const n = db.prepare("SELECT COUNT(*) n FROM entradas WHERE quiniela_id = ?").get(Number(p.id)).n;
  if (n > 0 && !/[?&]forzar=1/.test(req.url)) falla(409, `Ya hay ${n} quiniela(s) enviada(s). Si la borras, se pierden.`);
  const q = db.prepare("SELECT fecha FROM quinielas WHERE id = ?").get(Number(p.id)) || falla(404, "No existe.");
  db.prepare("DELETE FROM quinielas WHERE id = ?").run(Number(p.id));
  anotarLog("aviso", `Borraste la quiniela del ${q.fecha}${n ? ` (con ${n} quiniela(s) enviada(s))` : ""}.`);
  responder(res, 200, { ok: true, fecha: q.fecha });
});

ruta("GET", "/api/admin/quinielas/:id", async (req, res, p) => {
  requiereAdmin(req);
  const q = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(Number(p.id)) || falla(404, "No existe.");
  const entradas = db.prepare(`SELECT e.id, e.picks, e.aciertos, e.goles, e.ip, e.agente, e.anulada, e.pagado, e.creado,
                                 u.id usuario_id, u.apodo, u.nombre, u.telefono, u.ip ip_registro, u.bloqueado
                               FROM entradas e JOIN usuarios u ON u.id = e.usuario_id WHERE e.quiniela_id = ? ORDER BY e.creado`).all(q.id);
  // Señales para revisar (no son prueba): misma IP o mismo aparato+IP en varias quinielas del día, o varias cuentas registradas desde la misma IP
  const porIp = {}, porAparato = {};
  for (const e of entradas) { porIp[e.ip] = (porIp[e.ip] || 0) + 1; const k = e.ip + "|" + e.agente; porAparato[k] = (porAparato[k] || 0) + 1; }
  const cuentasIp = db.prepare("SELECT COUNT(*) n FROM usuarios WHERE ip = ?");
  for (const e of entradas) {
    e.picks = JSON.parse(e.picks);
    e.alertas = [];
    if (porAparato[e.ip + "|" + e.agente] > 1) e.alertas.push(`Mismo aparato e IP que otras ${porAparato[e.ip + "|" + e.agente] - 1} quiniela(s) de hoy`);
    else if (porIp[e.ip] > 1) e.alertas.push(`Misma IP que otras ${porIp[e.ip] - 1} quiniela(s) de hoy (puede ser la misma red celular)`);
    const n = e.ip_registro ? cuentasIp.get(e.ip_registro).n : 0;
    if (n > 1) e.alertas.push(`${n} cuentas creadas desde la misma IP`);
  }
  const ganadores = ganadoresDe(q).map((g) => ({ entrada_id: g.id, monto: g.monto, empatados: g.empatados, diferencia: g.diferencia }));
  const r = reglasDe(q.id);
  responder(res, 200, { quiniela: q, partidos: partidosDe(q.id), entradas, ganadores,
    reglas: { cancelados: r.cancelados, anulada: r.anulada, premio: r.premio, total_goles: r.totalGoles } });
});

ruta("POST", "/api/admin/quinielas/:id/resultados", async (req, res, p) => {
  requiereAdmin(req);
  const b = await leerJSON(req);
  const qid = Number(p.id);
  const q = db.prepare("SELECT cierre FROM quinielas WHERE id = ?").get(qid) || falla(404, "No existe.");
  if (Date.now() < Date.parse(q.cierre)) falla(400, "La quiniela sigue abierta. Mete los resultados después de la hora de cierre.");
  // Cada partido: { local, visita } (marcador al final del tiempo reglamentario), { cancelado: true } o vacío (pendiente)
  // Primero se revisan todos; solo si todos están bien se guardan (todo o nada)
  const cambios = [];
  for (const pt of partidosDe(qid)) {
    const m = (b.marcadores || {})[pt.id] || {};
    if (m.cancelado) { cambios.push(["C", null, null, pt.id]); continue; }
    const gl = m.local === "" || m.local === null || m.local === undefined ? null : Number(m.local);
    const gv = m.visita === "" || m.visita === null || m.visita === undefined ? null : Number(m.visita);
    if (gl === null || gv === null) { cambios.push([null, null, null, pt.id]); continue; }
    if (![gl, gv].every((x) => Number.isInteger(x) && x >= 0 && x <= 200)) falla(400, `Marcador no válido en ${pt.local} vs ${pt.visita}.`);
    if (!pt.empate && gl === gv) falla(400, `${pt.local} vs ${pt.visita} no admite empate: pon el marcador final o márcalo como cancelado.`);
    cambios.push([gl > gv ? "L" : gl < gv ? "V" : "E", gl, gv, pt.id]);
  }
  const upd = db.prepare("UPDATE partidos SET resultado = ?, goles_local = ?, goles_visita = ? WHERE id = ? AND quiniela_id = ?");
  db.exec("BEGIN");
  try { for (const c of cambios) upd.run(...c, qid); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
  const calificada = calificar(qid);
  if (calificada) avisarResultadosDiscord(qid);
  responder(res, 200, { ok: true, calificada });
});

ruta("POST", "/api/admin/entradas/:id", async (req, res, p) => {
  requiereAdmin(req);
  const b = await leerJSON(req);
  const e = db.prepare("SELECT * FROM entradas WHERE id = ?").get(Number(p.id)) || falla(404, "No existe.");
  if (typeof b.anulada === "boolean") db.prepare("UPDATE entradas SET anulada = ? WHERE id = ?").run(b.anulada ? 1 : 0, e.id);
  if (typeof b.pagado === "boolean") db.prepare("UPDATE entradas SET pagado = ? WHERE id = ?").run(b.pagado ? 1 : 0, e.id);
  responder(res, 200, { ok: true });
});

ruta("POST", "/api/admin/usuarios/:id", async (req, res, p) => {
  requiereAdmin(req);
  const b = await leerJSON(req);
  if (typeof b.bloqueado === "boolean") {
    db.prepare("UPDATE usuarios SET bloqueado = ? WHERE id = ?").run(b.bloqueado ? 1 : 0, Number(p.id));
    if (b.bloqueado) db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(Number(p.id));
  }
  responder(res, 200, { ok: true });
});

ruta("GET", "/api/admin/usuarios", async (req, res) => {
  requiereAdmin(req);
  const usuarios = db.prepare(`SELECT u.id, u.apodo, u.nombre, u.telefono, u.ip, u.invitado_por, u.ref_code, u.bloqueado, u.creado,
                                 (SELECT COUNT(*) FROM usuarios x WHERE x.ip = u.ip) cuentas_misma_ip,
                                 (SELECT COUNT(*) FROM entradas e WHERE e.usuario_id = u.id) quinielas,
                                 (SELECT COUNT(*) FROM usuarios x WHERE x.invitado_por = u.ref_code) invitados
                               FROM usuarios u ORDER BY u.creado DESC LIMIT 500`).all();
  responder(res, 200, { total: db.prepare("SELECT COUNT(*) n FROM usuarios").get().n, usuarios });
});

// ------------------------------------------------------------------ archivos de la página
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };

function servirArchivo(req, res, ruta) {
  let rel = decodeURIComponent(ruta.split("?")[0]);
  if (rel.endsWith("/")) rel += "index.html";
  let archivo = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!archivo.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403); return res.end(); }
  // Los archivos de la marca (marcas/<id>/public) reemplazan a los generales
  const deMarca = path.normalize(path.join(MARCA.publico, rel));
  if (deMarca.startsWith(MARCA.publico + path.sep) && (fs.existsSync(deMarca) || fs.existsSync(deMarca + ".html"))) archivo = deMarca;
  fs.stat(archivo, (err, st) => {
    let final = archivo;
    if (err || !st.isFile()) {
      if (!path.extname(archivo) && fs.existsSync(archivo + ".html")) final = archivo + ".html"; // /perfil -> perfil.html
      else { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end('<meta charset="utf-8"><p>Página no encontrada. <a href="/">Volver al inicio</a></p>'); }
    }
    const ext = path.extname(final);
    res.writeHead(200, {
      "Content-Type": TIPOS[ext] || "application/octet-stream",
      "Cache-Control": [".webp", ".png", ".jpg", ".ttf"].includes(ext) ? "public, max-age=604800" : "no-cache",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(final).pipe(res);
  });
}

// ------------------------------------------------------------------ servidor
const servidor = http.createServer(async (req, res) => {
  const url = req.url || "/";
  if (url.startsWith("/api/")) {
    const ruta = url.split("?")[0];
    for (const r of rutas) {
      const m = r.metodo === req.method && ruta.match(r.re);
      if (!m) continue;
      try { return await r.fn(req, res, m.groups || {}); }
      catch (e) {
        if (e instanceof ErrorHTTP) return responder(res, e.estado, { error: e.message });
        console.error(e);
        return responder(res, 500, { error: "Algo falló. Intenta de nuevo." });
      }
    }
    return responder(res, 404, { error: "No encontrado." });
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); return res.end(); }
  try { servirArchivo(req, res, url); }
  catch { res.writeHead(400); res.end(); } // dirección mal formada
});

// Ningún error inesperado debe tumbar el servidor
process.on("uncaughtException", (e) => console.error("Error no controlado:", e));
process.on("unhandledRejection", (e) => console.error("Promesa rechazada:", e));

// Limpieza de sesiones vencidas cada hora
setInterval(() => db.prepare("DELETE FROM sesiones WHERE expira < ?").run(new Date().toISOString()), 3600000).unref();

// Estado de la quiniela automática (para el panel)
// ---------- Contador: visitas y clics (anónimo) ----------
const TIPOS_EVENTO = new Set(["visita", "clic_discord", "clic_whatsapp"]);
ruta("POST", "/api/evento", async (req, res) => {
  if (limitar("evento:" + ipDe(req), 120, 10)) return responder(res, 200, { ok: true });
  const b = await leerJSON(req);
  const v = String(b.v || "");
  if (TIPOS_EVENTO.has(b.tipo) && /^[a-z0-9]{8,32}$/.test(v)) {
    db.prepare("INSERT OR IGNORE INTO eventos (fecha, tipo, visitante) VALUES (?, ?, ?)").run(fechaMX(), b.tipo, v);
  }
  responder(res, 200, { ok: true });
});

// Embudo para el panel: visitantes → cuentas → jugaron → clic en Discord (+ datos reales del Discord)
ruta("GET", "/api/admin/embudo", async (req, res) => {
  requiereAdmin(req);
  const hoy = fechaMX(), desde = sumarDias(hoy, -6);
  const dias = [];
  for (let f = desde; f <= hoy; f = sumarDias(f, 1)) {
    const ev = (t) => db.prepare("SELECT COUNT(*) n FROM eventos WHERE fecha = ? AND tipo = ?").get(f, t).n;
    dias.push({
      fecha: f, visitantes: ev("visita"), clic_discord: ev("clic_discord"),
      cuentas: db.prepare("SELECT COUNT(*) n FROM usuarios WHERE date(creado, '-6 hours') = ?").get(f).n,
      jugaron: db.prepare("SELECT COUNT(DISTINCT usuario_id) n FROM entradas WHERE date(creado, '-6 hours') = ?").get(f).n,
    });
  }
  const unicos = (t) => db.prepare("SELECT COUNT(DISTINCT visitante) n FROM eventos WHERE fecha >= ? AND tipo = ?").get(desde, t).n;
  const total = {
    visitantes: unicos("visita"), clic_discord: unicos("clic_discord"), clic_whatsapp: unicos("clic_whatsapp"),
    cuentas: db.prepare("SELECT COUNT(*) n FROM usuarios WHERE date(creado, '-6 hours') >= ?").get(desde).n,
    jugaron: db.prepare("SELECT COUNT(DISTINCT usuario_id) n FROM entradas WHERE date(creado, '-6 hours') >= ?").get(desde).n,
    volvieron: db.prepare(`SELECT COUNT(*) n FROM (SELECT usuario_id FROM entradas e JOIN quinielas q ON q.id = e.quiniela_id
                           WHERE q.fecha >= ? GROUP BY usuario_id HAVING COUNT(*) >= 3)`).get(desde).n,
  };
  // Datos reales del Discord (si el bot está configurado)
  let discordInfo = null;
  const cfg = discord.leerConfig();
  if (discord.activo() && cfg) {
    try {
      const [g, invs] = await Promise.all([
        discord.api("GET", `/guilds/${cfg.guild_id}?with_counts=true`),
        discord.api("GET", `/guilds/${cfg.guild_id}/invites`).catch(() => []),
      ]);
      const codigo = String(cfg.invitacion || "").split("/").pop();
      const inv = invs.find((i) => i.code === codigo);
      discordInfo = { miembros: g.approximate_member_count ?? null, usos_invitacion: inv ? inv.uses : null };
    } catch (e) { discordInfo = { error: e.message }; }
  }
  responder(res, 200, { desde, hoy, dias, total, discord: discordInfo });
});

ruta("GET", "/api/admin/automatico", async (req, res) => {
  requiereAdmin(req);
  responder(res, 200, {
    activo: automatico.activo(),
    copia: sincronizar.esSeguidora(),
    log: db.prepare("SELECT creado, tipo, mensaje FROM auto_log ORDER BY id DESC LIMIT 40").all(),
  });
});
ruta("POST", "/api/admin/automatico/ahora", async (req, res) => {
  requiereAdmin(req);
  if (sincronizar.esSeguidora()) await sincronizar.sincronizar();
  else await automatico.ciclo(true);
  responder(res, 200, { ok: true });
});

module.exports = { servidor, normalizarTelefono, rachas, lunesDe, calificar, partidosDe, fechaMX, sumarDias };
// ---------- Discord: anunciar quinielas y ganadores (una sola vez cada cosa) ----------
const discord = require("./discord");
function anotarLog(tipo, mensaje) { db.prepare("INSERT INTO auto_log (tipo, mensaje) VALUES (?, ?)").run(tipo, String(mensaje).slice(0, 500)); }
function avisarQuinielaDiscord(qid) {
  const q = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(qid);
  if (!q || q.discord_quiniela || !discord.activo()) return;
  db.prepare("UPDATE quinielas SET discord_quiniela = 1 WHERE id = ?").run(qid);
  discord.publicar("quiniela", discord.mensajeQuiniela(q, partidosDe(qid)), anotarLog).then((ok) => {
    if (ok) anotarLog("discord", `Anuncié en Discord la quiniela del ${q.fecha}.`);
    else db.prepare("UPDATE quinielas SET discord_quiniela = 0 WHERE id = ?").run(qid);
  });
}
function avisarResultadosDiscord(qid) {
  const q = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(qid);
  if (!q || !q.calificada || q.discord_resultado || !discord.activo()) return;
  db.prepare("UPDATE quinielas SET discord_resultado = 1 WHERE id = ?").run(qid);
  const r = reglasDe(qid), g = ganadoresDe({ id: qid })[0];
  discord.publicar("ganadores", discord.mensajeResultados(r, g), anotarLog).then((ok) => {
    if (ok) anotarLog("discord", `Publiqué en Discord los resultados del ${q.fecha}.`);
    else db.prepare("UPDATE quinielas SET discord_resultado = 0 WHERE id = ?").run(qid);
  });
}
// Enlace de invitación para la página (lo crea server/discord-configurar.js)
ruta("GET", "/api/discord", async (req, res) => {
  const cfg = discord.leerConfig();
  responder(res, 200, { invitacion: cfg && cfg.invitacion ? cfg.invitacion : null });
});

const automatico = require("./automatico");
const sincronizar = require("./sincronizar");
// La otra página del servidor copia de aquí la quiniela (si ambas comparten SYNC_TOKEN)
ruta("GET", "/api/sync/quinielas", async (req, res) => {
  if (!sincronizar.TOKEN || !igualSeguro(String(req.headers["x-sync-token"] || ""), sincronizar.TOKEN)) falla(403, "No autorizado.");
  const desde = String(new URL(req.url, "http://x").searchParams.get("desde") || fechaMX());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) falla(400, "Fecha no válida.");
  responder(res, 200, { quinielas: sincronizar.quinielasParaCompartir(desde) });
});
servidor.listen(PORT, "127.0.0.1", () => {
  console.log(`${MARCA.sitio_nombre} (marca ${MARCA.id}) escuchando en http://127.0.0.1:${PORT}`);
  automatico.iniciar({ calificar, reglasDe, ganadoresDe, fechaMX, sumarDias, avisarQuinielaDiscord, avisarResultadosDiscord });
  require("./discord-gateway").iniciar(anotarLog);
  sincronizar.iniciar({ calificar, fechaMX, sumarDias, avisarQuinielaDiscord, avisarResultadosDiscord, anotar: anotarLog });
});
