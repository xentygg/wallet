// Conexión con Discord por medio del bot de Don Gato.
// - Se configura una vez con server/discord-configurar.js (crea canales y guarda sus ids).
// - Después el servidor publica solo la quiniela del día y los ganadores.
// Sin DISCORD_BOT_TOKEN o sin configuración, no hace nada.
const fs = require("node:fs");

const API = (process.env.DISCORD_API_URL || "https://discord.com/api/v10").replace(/\/$/, "");
const TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const CONFIG_PATH = process.env.DISCORD_CONFIG_PATH || "/var/lib/dongato/discord.json";
const SITIO = (process.env.SITIO_URL || "https://quinieladongato.com").replace(/\/$/, "");
const AMARILLO = 0xffdd00;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(metodo, ruta, cuerpo, intentos = 4) {
  for (let i = 0; i < intentos; i++) {
    const r = await fetch(API + ruta, {
      method: metodo,
      headers: { Authorization: `Bot ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "DonGatoBot (quinieladongato.com, 1.0)" },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 429) { // límite de Discord: esperar lo que pida
      const j = await r.json().catch(() => ({}));
      await espera(Math.ceil((j.retry_after || 1) * 1000) + 200);
      continue;
    }
    const texto = await r.text();
    const datos = texto ? JSON.parse(texto) : null;
    if (!r.ok) {
      const err = new Error(`Discord ${r.status}: ${(datos && datos.message) || texto}`);
      err.estado = r.status;
      throw err;
    }
    return datos;
  }
  throw new Error("Discord: demasiadas peticiones seguidas, intenta más tarde.");
}

function leerConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch { return null; }
}
const activo = () => Boolean(TOKEN) && Boolean(leerConfig());

// Publica un mensaje en uno de los canales configurados ("quiniela" o "ganadores"). Nunca lanza error.
async function publicar(canal, mensaje, anotar = console.log) {
  const cfg = leerConfig();
  if (!TOKEN || !cfg || !cfg.canales || !cfg.canales[canal]) return false;
  try {
    await api("POST", `/channels/${cfg.canales[canal]}/messages`, mensaje);
    return true;
  } catch (e) {
    anotar("error", `No pude publicar en Discord (#${canal}): ${e.message}`);
    return false;
  }
}

const pesos = (n) => "$" + Number(n).toLocaleString("es-MX");
const fechaLarga = (f) => new Date(f + "T12:00:00Z").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

// Mensaje de la quiniela nueva
function mensajeQuiniela(q, partidos) {
  const cierre = Math.floor(Date.parse(q.cierre) / 1000);
  return {
    embeds: [{
      title: `⚽ Quiniela del ${fechaLarga(q.fecha)}`,
      url: `${SITIO}/quiniela`,
      color: AMARILLO,
      description: partidos.map((p, i) => `**${i + 1}.** ${p.local} vs ${p.visita}${p.liga ? ` · *${p.liga}*` : ""}${p.hora ? ` · ${p.hora}` : ""}`).join("\n"),
      fields: [
        { name: "🏆 Premio", value: `${pesos(q.premio)} si le atinas a los ${partidos.length}`, inline: true },
        { name: "⏰ Cierra", value: `<t:${cierre}:t> (<t:${cierre}:R>)`, inline: true },
        { name: "🎯 Juega gratis", value: `${SITIO}/quiniela` },
      ],
      footer: { text: "Una quiniela por persona al día · Don Gato 😎" },
    }],
  };
}

// Mensaje de resultados y ganador
function mensajeResultados(r, ganador) {
  const lineas = r.ps.map((p) => `${p.local} ${p.resultado === "C" ? "— cancelado —" : `**${p.goles_local ?? "?"}-${p.goles_visita ?? "?"}**`} ${p.visita}`);
  let titulo, texto;
  if (r.anulada) { titulo = "❌ Quiniela anulada"; texto = `Se cancelaron ${r.cancelados} partidos, así que hoy no hay premio. ¡Mañana hay otra!`; }
  else if (ganador) {
    titulo = `🏆 ¡Tenemos ganador: ${ganador.apodo}!`;
    texto = `Le atinó a todo y se lleva **${pesos(ganador.monto)}**.` + (ganador.empatados > 1 ? ` Hubo ${ganador.empatados} con todos los aciertos y ganó el desempate por total de goles (${r.totalGoles}).` : "");
  } else { titulo = "😿 Nadie le atinó a todos"; texto = "Hoy el premio se queda en casa. ¡Mañana hay otra oportunidad!"; }
  return {
    embeds: [{
      title: titulo,
      url: `${SITIO}/quiniela`,
      color: ganador ? AMARILLO : 0x2e2e2e,
      description: `${texto}\n\n**Resultados del ${fechaLarga(r.q.fecha)}:**\n${lineas.join("\n")}`,
      footer: { text: "Juega la de mañana en quinieladongato.com" },
    }],
  };
}

module.exports = { api, activo, publicar, leerConfig, mensajeQuiniela, mensajeResultados, CONFIG_PATH, SITIO, espera };
