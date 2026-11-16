// Subida de videos para los tickets de Discord (Discord sin Nitro solo deja archivos de 10 MB).
// - Cada ticket recibe un enlace personal: /subir-video?t=<canal>.<firma>
// - El video se guarda en <carpeta de datos>/videos y se avisa en el ticket.
// - Solo el administrador (con sesión en el panel) puede verlo. Se borran solos a los 30 días.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DIR = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, "..", "dongato.db")), "videos");
const MAX_BYTES = 500 * 1024 * 1024;
const DIAS = 30;

// La firma usa un secreto del servidor (si no hay uno propio, se deriva del token del bot)
const secreto = () => process.env.VIDEO_SECRET || crypto.createHash("sha256").update("videos|" + (process.env.DISCORD_BOT_TOKEN || "")).digest("hex");
const firma = (canal) => crypto.createHmac("sha256", secreto()).update(String(canal)).digest("hex").slice(0, 24);
const tokenDe = (canal) => `${canal}.${firma(canal)}`;
function canalDeToken(t) {
  const m = /^(\d{5,25})\.([a-f0-9]{24})$/.exec(String(t || ""));
  if (!m) return null;
  const ok = crypto.timingSafeEqual(Buffer.from(m[2]), Buffer.from(firma(m[1])));
  return ok ? m[1] : null;
}
const disponible = () => Boolean(process.env.VIDEO_SECRET || process.env.DISCORD_BOT_TOKEN);

const EXT = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/3gpp": "3gp", "video/x-matroska": "mkv", "video/x-msvideo": "avi" };
const TIPO = Object.fromEntries(Object.entries(EXT).map(([k, v]) => [v, k]));

// Guarda el cuerpo de la petición en disco (sin cargarlo en memoria). Regresa { archivo, bytes }.
function guardar(req, canal) {
  return new Promise((resolve, reject) => {
    const tipo = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (!EXT[tipo]) return reject(Object.assign(new Error("Solo se aceptan videos (mp4, mov, webm…)."), { estado: 415 }));
    const largo = Number(req.headers["content-length"] || 0);
    if (largo > MAX_BYTES) return reject(Object.assign(new Error("El video pesa más de 500 MB."), { estado: 413 }));
    fs.mkdirSync(DIR, { recursive: true });
    const archivo = `${canal}-${Date.now()}.${EXT[tipo]}`;
    const ruta = path.join(DIR, archivo);
    const out = fs.createWriteStream(ruta, { flags: "wx" });
    let bytes = 0, roto = false;
    const fallar = (e) => { if (roto) return; roto = true; out.destroy(); fs.rm(ruta, { force: true }, () => {}); reject(e); };
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > MAX_BYTES) { fallar(Object.assign(new Error("El video pesa más de 500 MB."), { estado: 413 })); req.destroy(); }
    });
    req.on("error", fallar);
    out.on("error", fallar);
    out.on("finish", () => { if (!roto) resolve({ archivo, bytes }); });
    req.pipe(out);
  });
}

// Envía un video al navegador del administrador (con soporte para adelantar/atrasar)
function servir(req, res, archivo) {
  if (!/^\d{5,25}-\d{10,15}\.[a-z0-9]{2,5}$/.test(archivo)) { res.writeHead(400); return res.end(); }
  const ruta = path.join(DIR, archivo);
  fs.stat(ruta, (err, st) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Este video ya no existe (se borran a los 30 días)."); }
    const tipo = TIPO[path.extname(archivo).slice(1)] || "application/octet-stream";
    const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (rango) {
      const ini = rango[1] ? Number(rango[1]) : 0, fin = rango[2] ? Math.min(Number(rango[2]), st.size - 1) : st.size - 1;
      if (ini >= st.size || ini > fin) { res.writeHead(416, { "Content-Range": `bytes */${st.size}` }); return res.end(); }
      res.writeHead(206, { "Content-Type": tipo, "Content-Length": fin - ini + 1, "Content-Range": `bytes ${ini}-${fin}/${st.size}`, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
      return fs.createReadStream(ruta, { start: ini, end: fin }).pipe(res);
    }
    res.writeHead(200, { "Content-Type": tipo, "Content-Length": st.size, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
    fs.createReadStream(ruta).pipe(res);
  });
}

function limpiarViejos() {
  fs.readdir(DIR, (err, archivos) => {
    if (err) return;
    const limite = Date.now() - DIAS * 86400000;
    for (const a of archivos) fs.stat(path.join(DIR, a), (e, st) => { if (!e && st.mtimeMs < limite) fs.rm(path.join(DIR, a), { force: true }, () => {}); });
  });
}
setInterval(limpiarViejos, 6 * 3600000).unref();
setTimeout(limpiarViejos, 60000).unref();

const tamano = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
module.exports = { tokenDe, canalDeToken, guardar, servir, disponible, tamano, DIR, MAX_BYTES };
