// Quiniela automática con API-Football.
// - Arma la quiniela de mañana cada tarde (y la de hoy si falta y todavía hay partidos).
// - Califica sola cuando los partidos terminan.
// Necesita la variable API_FOOTBALL_KEY en /etc/dongato.env. Sin clave, no hace nada.
const db = require("./db");
const AJUSTES = require("./ajustes-automatico");

const API_URL = (process.env.API_FOOTBALL_URL || "https://v3.football.api-sports.io").replace(/\/$/, "");
const API_KEY = process.env.API_FOOTBALL_KEY || "";
const ZONA = "America/Mexico_City";

let deps = null;               // funciones del servidor: calificar, reglasDe, ganadoresDe, fechaMX, sumarDias
let corriendo = false;
const ultimoIntento = new Map(); // fecha -> ms del último intento de armar (para no gastar consultas)
let ultimaRevision = 0;

const activo = () => Boolean(API_KEY) && AJUSTES.activo;
function anotar(tipo, mensaje) {
  db.prepare("INSERT INTO auto_log (tipo, mensaje) VALUES (?, ?)").run(tipo, String(mensaje).slice(0, 500));
  db.prepare("DELETE FROM auto_log WHERE id <= (SELECT MAX(id) - 300 FROM auto_log)").run();
  console.log(`[automático] ${tipo}: ${mensaje}`);
}

async function consultar(ruta, params) {
  const url = API_URL + ruta + "?" + new URLSearchParams(params);
  const r = await fetch(url, { headers: { "x-apisports-key": API_KEY }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`API-Football respondió ${r.status}`);
  const j = await r.json();
  const errores = j.errors && (Array.isArray(j.errors) ? j.errors : Object.values(j.errors));
  if (errores && errores.length) throw new Error("API-Football: " + errores.join(" · "));
  return j.response || [];
}

const horaMX = (ts) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hour12: false }).format(new Date(ts * 1000)));
const etiquetaHora = (ts) => {
  const t = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts * 1000));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// ¿Qué tan preferida es la liga de este partido? (posición en AJUSTES.ligas, o -1 si no está)
function prioridadDe(f) {
  const nombre = String(f.league?.name || ""), local = f.teams?.home?.name, visita = f.teams?.away?.name;
  return AJUSTES.ligas.findIndex((l) => {
    const coincide = (l.id !== undefined && l.id === f.league?.id && (!l.buscar || new RegExp(l.buscar, "i").test(nombre)))
      || (l.buscar && new RegExp(l.buscar, "i").test(nombre));
    return coincide && (!l.soloEquipos || l.soloEquipos.includes(local) || l.soloEquipos.includes(visita));
  });
}
const enEspanol = (equipo) => (AJUSTES.selecciones && AJUSTES.selecciones[equipo]) || equipo;

// Elige los partidos: primero por orden de liga, luego por hora. Prefiere partidos desde la hora mínima.
function elegir(fixtures, minTs) {
  const candidatos = fixtures.filter((f) => f.fixture?.status?.short === "NS" && f.fixture.timestamp >= minTs && prioridadDe(f) >= 0);
  const pr = new Map(candidatos.map((f) => [f, prioridadDe(f)]));
  const orden = (a, b) => pr.get(a) - pr.get(b) || a.fixture.timestamp - b.fixture.timestamp;
  const preferidos = candidatos.filter((f) => horaMX(f.fixture.timestamp) >= AJUSTES.horaMinimaPartido).sort(orden);
  let elegidos = preferidos.slice(0, AJUSTES.partidos);
  if (elegidos.length < AJUSTES.partidos) {
    const resto = candidatos.filter((f) => !elegidos.includes(f)).sort(orden);
    elegidos = elegidos.concat(resto.slice(0, AJUSTES.partidos - elegidos.length));
  }
  return elegidos.sort((a, b) => a.fixture.timestamp - b.fixture.timestamp);
}

// Para el panel: qué ligas había ese día (ayuda a encontrar ids nuevos)
function resumenLigas(fixtures) {
  const c = new Map();
  for (const f of fixtures) {
    if (f.fixture?.status?.short !== "NS") continue;
    const k = `${f.league?.name} (id ${f.league?.id})`; c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ×${n}`).join(", ") || "ninguna";
}

async function armar(fecha, minTs) {
  if (db.prepare("SELECT 1 FROM quinielas WHERE fecha = ?").get(fecha)) return false;
  const ult = ultimoIntento.get(fecha) || 0;
  if (Date.now() - ult < 60 * 60000) return false; // máximo un intento por hora
  ultimoIntento.set(fecha, Date.now());

  const fixtures = await consultar("/fixtures", { date: fecha, timezone: ZONA });
  const elegidos = elegir(fixtures, minTs);
  if (elegidos.length < AJUSTES.minimoPartidos) {
    anotar("aviso", `No hay suficientes partidos para la quiniela del ${fecha} (encontré ${elegidos.length}). Lo vuelvo a intentar en una hora. Ligas con partidos ese día: ${resumenLigas(fixtures)}.`);
    return false;
  }
  const primero = elegidos[0].fixture.timestamp * 1000;
  const cierre = new Date(primero - AJUSTES.minutosCierreAntes * 60000).toISOString();

  let qidNueva;
  db.exec("BEGIN");
  try {
    const r = db.prepare("INSERT INTO quinielas (fecha, cierre, premio, premio_cancelado, auto) VALUES (?, ?, ?, ?, 1)").run(fecha, cierre, AJUSTES.premio, AJUSTES.premioConCancelado);
    const ins = db.prepare("INSERT INTO partidos (quiniela_id, orden, liga, local, visita, hora, empate, fixture_id) VALUES (?, ?, ?, ?, ?, ?, 1, ?)");
    elegidos.forEach((f, i) => ins.run(r.lastInsertRowid, i + 1, String(f.league.name).slice(0, 30), enEspanol(String(f.teams.home.name)).slice(0, 40),
      enEspanol(String(f.teams.away.name)).slice(0, 40), etiquetaHora(f.fixture.timestamp), f.fixture.id));
    qidNueva = r.lastInsertRowid;
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  deps.avisarQuinielaDiscord(Number(qidNueva));
  anotar("quiniela", `Publiqué la quiniela del ${fecha}: ${elegidos.map((f) => `${enEspanol(f.teams.home.name)} vs ${enEspanol(f.teams.away.name)} (${f.league.name}, id ${f.league.id})`).join(" · ")}`);
  return true;
}

// Resultado según las bases: marcador al final del tiempo reglamentario (90 min + reposición, sin tiempos extra ni penales).
// Suspendido o cancelado = C. Devuelve { r, h, a } o null si aún no termina.
const FINALES = new Set(["FT", "AET", "PEN"]);
const CANCELADOS = new Set(["PST", "CANC", "ABD", "AWD", "WO"]);
function resultadoDe(f) {
  const st = f.fixture?.status?.short;
  if (CANCELADOS.has(st)) return { r: "C", h: null, a: null };
  if (!FINALES.has(st)) return null;
  const ft = f.score?.fulltime;
  const h = ft && ft.home !== null && ft.home !== undefined ? ft.home : f.goals?.home;
  const a = ft && ft.away !== null && ft.away !== undefined ? ft.away : f.goals?.away;
  if (h === null || h === undefined || a === null || a === undefined) return null;
  return { r: h > a ? "L" : h < a ? "V" : "E", h, a };
}

async function revisarResultados() {
  const ahora = new Date().toISOString();
  const pendientes = db.prepare(`SELECT p.id, p.quiniela_id, p.fixture_id, p.local, p.visita FROM partidos p JOIN quinielas q ON q.id = p.quiniela_id
                                 WHERE q.calificada = 0 AND q.cierre <= ? AND p.fixture_id IS NOT NULL AND p.resultado IS NULL`).all(ahora);
  if (!pendientes.length) return;
  const porId = new Map(pendientes.map((p) => [p.fixture_id, p]));
  const ids = [...porId.keys()];
  const quinielas = new Set();
  for (let i = 0; i < ids.length; i += 20) {
    const fixtures = await consultar("/fixtures", { ids: ids.slice(i, i + 20).join("-"), timezone: ZONA });
    for (const f of fixtures) {
      const p = porId.get(f.fixture?.id);
      const x = p && resultadoDe(f);
      if (!x) continue;
      db.prepare("UPDATE partidos SET resultado = ?, goles_local = ?, goles_visita = ? WHERE id = ? AND resultado IS NULL").run(x.r, x.h, x.a, p.id);
      quinielas.add(p.quiniela_id);
      anotar("resultado", `${p.local} vs ${p.visita}: ${x.r === "C" ? "cancelado o suspendido (cuenta como acierto; el premio baja)" : `${x.h}-${x.a}`}`);
    }
  }
  for (const qid of quinielas) {
    if (!deps.calificar(qid)) continue;
    const r = deps.reglasDe(qid);
    const g = deps.ganadoresDe({ id: qid })[0];
    if (r.anulada) anotar("aviso", `Quiniela del ${r.q.fecha} ANULADA: se cancelaron ${r.cancelados} partidos. No hay premio.`);
    else anotar(g ? "ganador" : "calificada", g
      ? `Quiniela del ${r.q.fecha} calificada. 🏆 Ganador: ${g.apodo} (${g.telefono}), $${g.monto}${g.empatados > 1 ? `. Desempate entre ${g.empatados} por total de goles (${r.totalGoles}).` : "."} Revisa su INE y paga desde el panel.`
      : `Quiniela del ${r.q.fecha} calificada. Nadie le atinó a todos.`);
    deps.avisarResultadosDiscord(qid);
  }
}

// Un ciclo: arma lo que falte y revisa resultados. "forzar" ignora las esperas (botón del panel).
async function ciclo(forzar = false) {
  if (!activo() || corriendo) return;
  corriendo = true;
  try {
    if (forzar) { ultimoIntento.clear(); ultimaRevision = 0; }
    const hoy = deps.fechaMX(), manana = deps.sumarDias(hoy, 1);
    const horaAhora = Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hour12: false }).format(new Date()));
    const ahoraTs = Math.floor(Date.now() / 1000);
    // Mañana: se arma desde la hora indicada de hoy, con todos los partidos de mañana disponibles
    if (horaAhora >= AJUSTES.horaArmarManana || forzar) await armar(manana, ahoraTs + 3600);
    // Hoy: solo si falta (por ejemplo, el primer día), con partidos que empiecen en al menos 90 minutos
    if (horaAhora < 21) await armar(hoy, ahoraTs + 90 * 60);
    if (forzar || Date.now() - ultimaRevision >= AJUSTES.minutosEntreRevisiones * 60000) {
      ultimaRevision = Date.now();
      await revisarResultados();
    }
  } catch (e) {
    anotar("error", e.message);
  } finally {
    corriendo = false;
  }
}

function iniciar(dependencias) {
  deps = dependencias;
  if (!AJUSTES.activo) return console.log("[automático] desactivado en ajustes-automatico.js");
  if (!API_KEY) return console.log("[automático] falta API_FOOTBALL_KEY: la quiniela automática está apagada");
  anotar("inicio", "Quiniela automática encendida.");
  setTimeout(() => ciclo(), 5000);
  setInterval(() => ciclo(), 10 * 60000).unref();
}

module.exports = { iniciar, ciclo, activo, _pruebas: { elegir, resultadoDe, prioridadDe, resumenLigas } };
