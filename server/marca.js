// Marca de esta instalación (Don Gato, El Licenciado…). Se elige con la variable MARCA (por defecto "dongato").
// Cada marca vive en marcas/<id>/: marca.json (textos del servidor y Discord) y public/ (archivos que reemplazan a los de public/).
const fs = require("node:fs");
const path = require("node:path");

const ID = (process.env.MARCA || "dongato").replace(/[^a-z0-9_-]/gi, "");
const DIR = path.join(__dirname, "..", "marcas", ID);
let datos = {};
try { datos = JSON.parse(fs.readFileSync(path.join(DIR, "marca.json"), "utf8")); }
catch { console.warn(`⚠️  No encontré marcas/${ID}/marca.json; uso los textos de Don Gato.`); }

const MARCA = {
  id: ID,
  dir: DIR,
  publico: path.join(DIR, "public"),
  nombre: "Don Gato", sitio_nombre: "Don Gato", de: "de Don Gato", firma_discord: "Don Gato 😎",
  sitio_url: "https://quinieladongato.com", rol_dueno: "👑 Don Gato", rol_aficionado: "😺 Aficionado", color: 0xffdd00,
  remate_reglas: "Si no cumples las reglas, Don Gato te saca del estadio. 🟥", remate_bienvenida: "¡Aquí no hay VAR que te salve!",
  discord_bloqueo_edad: true, discord_verificacion: 2,
  ...datos,
};
if (process.env.SITIO_URL) MARCA.sitio_url = process.env.SITIO_URL.replace(/\/$/, "");
module.exports = MARCA;
