// Quiniela compartida entre páginas del mismo servidor.
// - ORIGEN (la que tiene la clave de API-Football): expone sus quinielas en /api/sync/quinielas (con SYNC_TOKEN).
// - SEGUIDORA (SYNC_ORIGEN=http://127.0.0.1:3000 y el mismo SYNC_TOKEN): copia cada quiniela (partidos, cierre,
//   premio) y sus resultados. Cada página conserva sus propios jugadores, quinielas enviadas y ganadores.
const db = require("./db");

const ORIGEN = (process.env.SYNC_ORIGEN || "").replace(/\/$/, "");
const TOKEN = process.env.SYNC_TOKEN || "";
const DIAS_ATRAS = 3;

let deps = null, corriendo = false;
const avisados = new Set();
const esSeguidora = () => Boolean(ORIGEN && TOKEN);

// ---------- lado ORIGEN ----------
function quinielasParaCompartir(desde) {
  return db.prepare("SELECT id, fecha, cierre, premio, premio_cancelado FROM quinielas WHERE fecha >= ? ORDER BY fecha").all(desde).map((q) => ({
    ...q,
    partidos: db.prepare(`SELECT orden, liga, local, visita, hora, empate, fixture_id, resultado, goles_local, goles_visita
                          FROM partidos WHERE quiniela_id = ? ORDER BY orden`).all(q.id),
  }));
}

// ---------- lado SEGUIDORA ----------
function crearCopia(q) {
  db.exec("BEGIN");
  try {
    const r = db.prepare("INSERT INTO quinielas (fecha, cierre, premio, premio_cancelado, auto, origen_id) VALUES (?, ?, ?, ?, 2, ?)")
      .run(q.fecha, q.cierre, q.premio, q.premio_cancelado ?? 200, q.id);
    const ins = db.prepare(`INSERT INTO partidos (quiniela_id, orden, liga, local, visita, hora, empate, fixture_id, resultado, goles_local, goles_visita)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    for (const p of q.partidos) ins.run(r.lastInsertRowid, p.orden, p.liga, p.local, p.visita, p.hora, p.empate, p.fixture_id, p.resultado, p.goles_local, p.goles_visita);
    db.exec("COMMIT");
    return Number(r.lastInsertRowid);
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}

const entradasDe = (qid) => db.prepare("SELECT COUNT(*) n FROM entradas WHERE quiniela_id = ?").get(qid).n;
function avisarUnaVez(clave, tipo, msg) { if (!avisados.has(clave)) { avisados.add(clave); deps.anotar(tipo, msg); } }

async function sincronizar() {
  if (!esSeguidora() || corriendo) return;
  corriendo = true;
  try {
    const desde = deps.sumarDias(deps.fechaMX(), -DIAS_ATRAS);
    const r = await fetch(`${ORIGEN}/api/sync/quinielas?desde=${desde}`, { headers: { "x-sync-token": TOKEN }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(`el servicio de partidos respondió ${r.status}`);
    const { quinielas } = await r.json();
    const vistas = new Set();
    const pausado = db.autoPausado();   // apagado: solo se copian resultados de las quinielas que ya hay aquí
    for (const q of quinielas) {
      vistas.add(q.fecha);
      let local = db.prepare("SELECT * FROM quinielas WHERE fecha = ?").get(q.fecha);
      if (pausado && (!local || local.origen_id !== q.id)) continue;
      if (local && local.origen_id !== q.id) {
        if (entradasDe(local.id) === 0) { db.prepare("DELETE FROM quinielas WHERE id = ?").run(local.id); local = null; }   // la rehicieron en el origen
        else { avisarUnaVez(`dif-${q.fecha}-${q.id}`, "aviso", `La quiniela del ${q.fecha} tuvo cambios, pero ya hay quinielas enviadas: se conserva la que está publicada.`); continue; }
      }
      if (!local) {
        const id = crearCopia(q);
        deps.anotar("quiniela", `Publiqué la quiniela del ${q.fecha}: ${q.partidos.map((p) => `${p.local} vs ${p.visita}`).join(" · ")}`);
        deps.avisarQuinielaDiscord(id);
        local = db.prepare("SELECT * FROM quinielas WHERE id = ?").get(id);
      }
      // Resultados: copiar los que cambiaron y calificar
      const upd = db.prepare("UPDATE partidos SET resultado = ?, goles_local = ?, goles_visita = ? WHERE quiniela_id = ? AND orden = ?");
      let cambio = false;
      const actuales = db.prepare("SELECT orden, resultado, goles_local, goles_visita FROM partidos WHERE quiniela_id = ?").all(local.id);
      for (const p of q.partidos) {
        const a = actuales.find((x) => x.orden === p.orden);
        if (a && (a.resultado !== p.resultado || a.goles_local !== p.goles_local || a.goles_visita !== p.goles_visita)) {
          upd.run(p.resultado, p.goles_local, p.goles_visita, local.id, p.orden); cambio = true;
        }
      }
      if (cambio && deps.calificar(local.id)) {
        deps.anotar("calificada", `Quiniela del ${q.fecha} calificada.`);
        deps.avisarResultadosDiscord(local.id);
      }
    }
    // Si en el origen borraron una quiniela que aquí nadie ha jugado, se borra también
    if (!pausado) for (const l of db.prepare("SELECT id, fecha FROM quinielas WHERE fecha >= ? AND origen_id IS NOT NULL").all(desde)) {
      if (!vistas.has(l.fecha) && entradasDe(l.id) === 0) {
        db.prepare("DELETE FROM quinielas WHERE id = ?").run(l.id);
        deps.anotar("aviso", `Se retiró la quiniela del ${l.fecha}.`);
      }
    }
  } catch (e) {
    avisarUnaVez(`err-${e.message}`, "error", `No pude actualizar la quiniela: ${e.message}`);
  } finally { corriendo = false; }
}

function iniciar(dependencias) {
  deps = dependencias;
  if (!esSeguidora()) return;
  // Limpiar de la bitácora los mensajes viejos que mencionaban a la otra página
  db.prepare("DELETE FROM auto_log WHERE mensaje LIKE '%otra página%' OR mensaje LIKE '%otra (misma quiniela%' OR mensaje LIKE 'Copié la quiniela%'").run();
  db.prepare("UPDATE auto_log SET mensaje = 'Apagaste el modo automático: ya no se publican quinielas nuevas solas (las que ya están se siguen calificando).' WHERE mensaje LIKE 'Apagaste el modo automático: no se arman ni se copian%'").run();
  deps.anotar("inicio", "Quiniela automática encendida.");
  setTimeout(sincronizar, 4000);
  setInterval(sincronizar, 5 * 60000).unref();
}

module.exports = { iniciar, sincronizar, esSeguidora, quinielasParaCompartir, TOKEN };
