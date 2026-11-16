// Base de datos SQLite (incluida en Node 22, sin instalar nada extra).
const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "dongato.db");
const db = new DatabaseSync(DB_PATH);

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY,
  telefono      TEXT NOT NULL UNIQUE,      -- 10 dígitos, sin lada de país
  nombre        TEXT NOT NULL,             -- nombre completo, como en la INE (privado)
  apodo         TEXT NOT NULL,             -- lo que se ve en las tablas (público)
  pass_hash     TEXT NOT NULL,
  ref_code      TEXT NOT NULL UNIQUE,      -- su código para invitar
  invitado_por  TEXT,                      -- ref_code de quien lo invitó
  ip            TEXT,
  agente        TEXT,
  bloqueado     INTEGER NOT NULL DEFAULT 0,
  creado        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sesiones (
  token       TEXT PRIMARY KEY,
  usuario_id  INTEGER,                     -- NULL = sesión del administrador
  es_admin    INTEGER NOT NULL DEFAULT 0,
  expira      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quinielas (
  id      INTEGER PRIMARY KEY,
  fecha   TEXT NOT NULL UNIQUE,            -- AAAA-MM-DD (hora del centro de México)
  cierre  TEXT NOT NULL,                   -- fecha y hora ISO con zona, p. ej. 2026-11-20T18:55:00-06:00
  premio  INTEGER NOT NULL DEFAULT 300,
  calificada INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partidos (
  id          INTEGER PRIMARY KEY,
  quiniela_id INTEGER NOT NULL REFERENCES quinielas(id) ON DELETE CASCADE,
  orden       INTEGER NOT NULL,
  liga        TEXT NOT NULL DEFAULT '',
  local       TEXT NOT NULL,
  visita      TEXT NOT NULL,
  hora        TEXT NOT NULL DEFAULT '',
  resultado   TEXT                         -- L, E, V o C (cancelado: cuenta como acierto para todos)
);

CREATE TABLE IF NOT EXISTS entradas (
  id          INTEGER PRIMARY KEY,
  quiniela_id INTEGER NOT NULL REFERENCES quinielas(id) ON DELETE CASCADE,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id),
  picks       TEXT NOT NULL,               -- JSON {partido_id: "L"|"E"|"V"}
  aciertos    INTEGER,
  ip          TEXT,
  agente      TEXT,
  anulada     INTEGER NOT NULL DEFAULT 0,
  pagado      INTEGER NOT NULL DEFAULT 0,
  creado      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (quiniela_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS trivia (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha      TEXT NOT NULL,
  aciertos   INTEGER NOT NULL,
  total      INTEGER NOT NULL,
  PRIMARY KEY (usuario_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_entradas_usuario ON entradas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_ip ON usuarios(ip);
`);

// Actualizaciones de la base de datos (se aplican solas una vez)
const columnas = db.prepare("PRAGMA table_info(partidos)").all().map((c) => c.name);
if (!columnas.includes("empate")) db.exec("ALTER TABLE partidos ADD COLUMN empate INTEGER NOT NULL DEFAULT 1"); // 0 = sin empate (NFL, NBA, béisbol)
if (!columnas.includes("fixture_id")) db.exec("ALTER TABLE partidos ADD COLUMN fixture_id INTEGER"); // id del partido en API-Football (quinielas automáticas)
const colQ = db.prepare("PRAGMA table_info(quinielas)").all().map((c) => c.name);
if (!colQ.includes("auto")) db.exec("ALTER TABLE quinielas ADD COLUMN auto INTEGER NOT NULL DEFAULT 0");
if (!colQ.includes("discord_quiniela")) db.exec("ALTER TABLE quinielas ADD COLUMN discord_quiniela INTEGER NOT NULL DEFAULT 0");   // ya se anunció en Discord
if (!colQ.includes("discord_resultado")) db.exec("ALTER TABLE quinielas ADD COLUMN discord_resultado INTEGER NOT NULL DEFAULT 0"); // ya se publicó el ganador
if (!colQ.includes("premio_cancelado")) db.exec("ALTER TABLE quinielas ADD COLUMN premio_cancelado INTEGER NOT NULL DEFAULT 200"); // premio si se cancela 1 partido
if (!columnas.includes("goles_local")) db.exec("ALTER TABLE partidos ADD COLUMN goles_local INTEGER");   // marcador al final del tiempo reglamentario
if (!columnas.includes("goles_visita")) db.exec("ALTER TABLE partidos ADD COLUMN goles_visita INTEGER");
const colE = db.prepare("PRAGMA table_info(entradas)").all().map((c) => c.name);
if (!colE.includes("goles")) db.exec("ALTER TABLE entradas ADD COLUMN goles INTEGER"); // desempate: total de goles que adivinó
db.exec(`CREATE TABLE IF NOT EXISTS auto_log (
  id INTEGER PRIMARY KEY, creado TEXT NOT NULL DEFAULT (datetime('now')), tipo TEXT NOT NULL, mensaje TEXT NOT NULL
)`);

module.exports = db;
