// Refill de bank en Discord: canales de información por casino, tickets privados, canal de pagos
// y filtro de enlaces para los aficionados. Solo se activa si la marca tiene marcas/<id>/casinos.json.
const fs = require("node:fs");
const path = require("node:path");
const { api, espera, leerConfig, CONFIG_PATH } = require("./discord");
const MARCA = require("./marca");
const videos = require("./videos");

const VIEW = 1n << 10n, SEND = 1n << 11n, REACT = 1n << 6n, HISTORY = 1n << 16n, ATTACH = 1n << 15n, EMBED = 1n << 14n,
  MANAGE_MSG = 1n << 13n;
const THREADS = (1n << 35n) | (1n << 36n) | (1n << 38n);
const s = (n) => String(n);
const EDAD = Boolean(MARCA.discord_bloqueo_edad);   // aviso de "¿eres mayor de 18?" al entrar al canal

function leerCasinos() {
  try { return JSON.parse(fs.readFileSync(path.join(MARCA.dir, "casinos.json"), "utf8")).casinos || null; } catch { return null; }
}

// ---------- textos ----------
const NUNCA = "⚠️ **Nunca** te pediremos NIP, CVV, fecha de vencimiento, contraseñas ni que nos deposites dinero. Si alguien te lo pide, es una estafa: repórtalo.";

function infoCasino(c, abrirTicket) {
  const pasos = [
    `**No** haberte registrado antes en ${c.nombre}: solo cuentas nuevas.`,
    c.enlace ? `Regístrate **únicamente con este enlace:** ${c.enlace}` : "Regístrate **únicamente con el enlace de este canal** (se publica aquí muy pronto).",
    c.video ? "**Graba la pantalla** mientras haces el registro, de principio a fin." : "Al terminar el registro, copia tu **ID de jugador único** que te da la app. (Aquí **no** necesitas grabar video.)",
    c.verificacion === "obligatoria" ? "**Verifica tu cuenta: es obligatorio** en este casino." : "Verificar tu cuenta es **opcional**.",
    `Abre un ticket en <#${abrirTicket}> y envía: ${c.video ? "tu **video del registro**" : "tu **ID de jugador**"} y el **número de tu tarjeta de débito o tu CLABE**, a tu nombre, para depositarte.`,
    `Te depositamos el refill a tu tarjeta y tú lo depositas en tu cuenta de ${c.nombre}.`,
    "Envíanos en el mismo ticket una **captura de pantalla** cuando ya hayas metido el dinero al casino.",
  ];
  return [
    `# 🎰 ${c.nombre.toUpperCase()} · Refill de bank`,
    "🔞 **Solo mayores de 18 años.**" + (c.aviso_edad ? ` ${c.aviso_edad}` : ""),
    "",
    "**Pasos para recibir tu refill:**",
    ...pasos.map((p, i) => `**${i + 1}.** ${p}`),
    "",
    NUNCA,
    "🎲 Juega con responsabilidad: es entretenimiento, no una forma de ingreso.",
  ].join("\n");
}

const TEXTO_ABRIR = (pagos) => `# 🎫 Tickets del refill de bank
Abre un ticket para enviarnos tus datos de forma **privada**: solo tú y el equipo ${MARCA.de} lo pueden ver.

**En tu ticket nos mandas:**
• De qué casino es tu registro.
• Tu **video del registro** (o tu **ID de jugador** si es Jugabet).
• El **número de tu tarjeta de débito o tu CLABE**, a tu nombre, para depositarte.
• Después, la **captura** de cuando ya depositaste en el casino.

Las pruebas de los depósitos que hacemos están en <#${pagos}>.
🔞 Solo mayores de 18 años.

${NUNCA}`;

const TEXTO_PAGOS = `# ✅ Pagos realizados
Aquí publicamos las pruebas de los refills que ya depositamos, para que veas que es real. Solo el equipo puede escribir en este canal.
🔒 En las capturas se tapan siempre los datos personales.`;

const TEXTO_TICKET = (uid, canal) => `👋 ¡Hola <@${uid}>! Este es tu ticket privado. Mándanos aquí:

**1.** ¿De qué casino es tu registro? (Winpot, Sportium, Jugabet, Winner o Stake)
**2.** Tu **video del registro**. En **Jugabet**, en lugar del video, tu **ID de jugador**.
   📹 **¿Tu video pesa mucho para Discord?** Súbelo aquí, es privado y solo lo ve el equipo: ${MARCA.sitio_url}/subir-video?t=${videos.tokenDe(canal)}
**3.** El **número de tu tarjeta de débito o tu CLABE**, a tu nombre, para depositarte.
**4.** Cuando ya hayas depositado en el casino, la **captura** del depósito.

En cuanto revisemos tu información te contestamos aquí mismo.
${NUNCA}`;

// ---------- utilidades ----------
async function publicarOEditar(canalId, cuerpo, yoId) {
  const msgs = await api("GET", `/channels/${canalId}/messages?limit=50`);
  const mio = msgs.slice().reverse().find((m) => m.author && m.author.id === yoId && (m.type === 0 || m.type === undefined) && m.content);
  if (mio) {
    if (mio.content !== cuerpo.content || cuerpo.components) await api("PATCH", `/channels/${canalId}/messages/${mio.id}`, cuerpo);
    return "editado";
  }
  const m = await api("POST", `/channels/${canalId}/messages`, cuerpo);
  await api("PUT", `/channels/${canalId}/pins/${m.id}`).catch(() => {});
  return "publicado";
}

// ---------- configuración (la llama discord-configurar.js) ----------
async function configurar({ guildId, roles, canales, existentes, cfgPrevia, avisos, yoId }) {
  const casinos = leerCasinos();
  if (!casinos) return {};
  const dueno = roles.dongato, admin = roles.admin, mod = roles.moderador;
  const staff = [dueno, admin, mod].filter(Boolean);
  const buscar = (nombre, tipo, padre) => existentes.find((c) => c.name === nombre && c.type === tipo && (padre === undefined || c.parent_id === padre));
  const crear = async (cuerpo) => { const ch = await api("POST", `/guilds/${guildId}/channels`, cuerpo); existentes.push(ch); console.log(`  + ${cuerpo.type === 4 ? "categoría" : "canal"} ${cuerpo.name}`); await espera(400); return ch; };
  const lectura = (escriben) => [
    { id: guildId, type: 0, allow: s(VIEW | REACT | HISTORY), deny: s(SEND | THREADS) },
    ...escriben.map((id) => ({ id, type: 0, allow: s(SEND | ATTACH | EMBED), deny: "0" })),
  ];
  const privado = [
    { id: guildId, type: 0, allow: "0", deny: s(VIEW) },
    ...staff.map((id) => ({ id, type: 0, allow: s(VIEW | SEND | HISTORY | ATTACH | EMBED), deny: "0" })),
  ];
  const nuevos = {};

  // 1) Categoría de casinos (todo +18) y un canal de solo lectura por casino
  let cat = buscar("🎰 REFILL DE BANK", 4) || await crear({ name: "🎰 REFILL DE BANK", type: 4 });
  // 2) Tickets
  let catT = buscar("🎫 TICKETS", 4) || await crear({ name: "🎫 TICKETS", type: 4 });
  let abrir = buscar("🎫・abrir-ticket", 0, catT.id) || await crear({ name: "🎫・abrir-ticket", type: 0, parent_id: catT.id, nsfw: EDAD,
    topic: "Abre aquí tu ticket privado para el refill de bank. Solo +18.", permission_overwrites: lectura([dueno, admin]) });
  let avisosT = buscar("🔔・tickets-nuevos", 0, catT.id) || await crear({ name: "🔔・tickets-nuevos", type: 0, parent_id: catT.id,
    topic: "Solo el equipo: aquí llega un aviso por cada ticket nuevo.", permission_overwrites: privado });
  // 3) Pagos realizados: solo escriben el dueño (👑) y Admin
  let pagos = buscar("✅・pagos-realizados", 0, cat.id) || await crear({ name: "✅・pagos-realizados", type: 0, parent_id: cat.id, nsfw: EDAD,
    topic: "Pruebas de los refills que ya depositamos.", permission_overwrites: lectura([dueno, admin]) });

  const casinoIds = {};
  for (const c of casinos) {
    let ch = buscar(c.canal, 0, cat.id) || await crear({ name: c.canal, type: 0, parent_id: cat.id, nsfw: EDAD,
      topic: `Cómo recibir tu refill de bank en ${c.nombre}. Solo +18.`, permission_overwrites: lectura([dueno, admin]) });
    casinoIds[c.clave] = ch.id;
  }
  // Aplicar el ajuste de edad también a los canales que ya existían
  for (const ch of [abrir, pagos, ...casinos.map((c) => existentes.find((x) => x.id === casinoIds[c.clave]))]) {
    if (ch && Boolean(ch.nsfw) !== EDAD) { await api("PATCH", `/channels/${ch.id}`, { nsfw: EDAD }).catch(() => {}); ch.nsfw = EDAD; await espera(400); }
  }
  Object.assign(nuevos, { cat_casinos: cat.id, cat_tickets: catT.id, abrir_ticket: abrir.id, tickets_nuevos: avisosT.id, pagos: pagos.id, casinos: casinoIds });

  // 4) Mensajes: info de cada casino, botón para abrir ticket, canal de pagos
  for (const c of casinos) {
    const r = await publicarOEditar(casinoIds[c.clave], { content: infoCasino(c, abrir.id), allowed_mentions: { parse: [] } }, yoId);
    console.log(`  ✓ información de ${c.nombre} (${r})`); await espera(400);
  }
  await publicarOEditar(abrir.id, {
    content: TEXTO_ABRIR(pagos.id), allowed_mentions: { parse: [] },
    components: [{ type: 1, components: [{ type: 2, style: 1, label: "Abrir ticket", emoji: { name: "🎫" }, custom_id: "ticket_abrir" }] }],
  }, yoId);
  console.log("  ✓ botón para abrir tickets");
  await publicarOEditar(pagos.id, { content: TEXTO_PAGOS, allowed_mentions: { parse: [] } }, yoId);

  // 5) AutoMod: bloquear enlaces a quien no sea del equipo (los tickets quedan exentos)
  try {
    const reglas = await api("GET", `/guilds/${guildId}/auto-moderation/rules`);
    const NOMBRE = "Sin enlaces para aficionados";
    const ticketsAbiertos = existentes.filter((x) => x.parent_id === catT.id && String(x.topic || "").startsWith("ticket:")).map((x) => x.id);
    const cuerpo = {
      name: NOMBRE, event_type: 1, trigger_type: 1, enabled: true,
      trigger_metadata: { regex_patterns: [
        "(?i)(https?://|www\\.)\\S+",
        "(?i)discord(\\.gg|app\\.com/invite|\\.com/invite)/\\S+",
        "(?i)\\b[a-z0-9-]+\\.(com|mx|net|org|gg|io|me|ly|xyz|app|co|bet|tv|link|site|online|club|vip)(/\\S*)?\\b",
      ] },
      actions: [{ type: 1, metadata: { custom_message: "🔗 Los aficionados no pueden enviar enlaces en este servidor." } }],
      exempt_roles: staff.concat(roles.vip ? [roles.vip] : []),
      exempt_channels: ticketsAbiertos.slice(0, 50),
    };
    const previa = reglas.find((r) => r.name === NOMBRE);
    const regla = previa ? await api("PATCH", `/guilds/${guildId}/auto-moderation/rules/${previa.id}`, cuerpo)
                         : await api("POST", `/guilds/${guildId}/auto-moderation/rules`, cuerpo);
    nuevos.automod_enlaces = regla.id;
    console.log("  ✓ filtro: los aficionados no pueden enviar enlaces");
  } catch (e) { avisos.push(`No pude crear el filtro de enlaces (${e.message}). Actívalo a mano en Ajustes del servidor → AutoMod.`); }

  return nuevos;
}

// ---------- tickets (los botones llegan por la conexión en vivo) ----------
async function responder(it, contenido) {
  await api("POST", `/interactions/${it.id}/${it.token}/callback`, { type: 4, data: { content: contenido, flags: 64, allowed_mentions: { parse: [] } } });
}

async function exentarEnlaces(cfg, canalId, exento) {
  if (!cfg.automod_enlaces) return;
  try {
    const r = await api("GET", `/guilds/${cfg.guild_id}/auto-moderation/rules/${cfg.automod_enlaces}`);
    const lista = new Set(r.exempt_channels || []);
    exento ? lista.add(canalId) : lista.delete(canalId);
    await api("PATCH", `/guilds/${cfg.guild_id}/auto-moderation/rules/${cfg.automod_enlaces}`, { exempt_channels: [...lista].slice(-50) });
  } catch {}
}

async function manejarInteraccion(it, anotar = () => {}) {
  const cfg = leerConfig();
  if (!cfg || !cfg.canales || !cfg.canales.cat_tickets || it.guild_id !== cfg.guild_id) return;
  const id = it.data && it.data.custom_id;
  const usuario = (it.member && it.member.user) || it.user;
  const staff = [cfg.roles.dongato, cfg.roles.admin, cfg.roles.moderador].filter(Boolean);

  if (id === "ticket_abrir") {
    const canales = await api("GET", `/guilds/${cfg.guild_id}/channels`);
    const abierto = canales.find((c) => c.parent_id === cfg.canales.cat_tickets && c.topic === `ticket:${usuario.id}`);
    if (abierto) return responder(it, `Ya tienes un ticket abierto: <#${abierto.id}>`);
    const nombre = ("ticket-" + String(usuario.username || "usuario").toLowerCase().replace(/[^a-z0-9]+/g, "-")).slice(0, 90);
    const ch = await api("POST", `/guilds/${cfg.guild_id}/channels`, {
      name: nombre, type: 0, parent_id: cfg.canales.cat_tickets, topic: `ticket:${usuario.id}`,
      permission_overwrites: [
        { id: cfg.guild_id, type: 0, allow: "0", deny: s(VIEW) },
        { id: usuario.id, type: 1, allow: s(VIEW | SEND | HISTORY | ATTACH | EMBED), deny: "0" },
        ...staff.map((r) => ({ id: r, type: 0, allow: s(VIEW | SEND | HISTORY | ATTACH | EMBED | MANAGE_MSG), deny: "0" })),
      ],
    });
    await exentarEnlaces(cfg, ch.id, true);
    await api("POST", `/channels/${ch.id}/messages`, {
      content: TEXTO_TICKET(usuario.id, ch.id), allowed_mentions: { users: [usuario.id] },
      components: [{ type: 1, components: [{ type: 2, style: 4, label: "Cerrar ticket", emoji: { name: "🔒" }, custom_id: "ticket_cerrar" }] }],
    });
    await responder(it, `✅ Listo, abrimos tu ticket privado: <#${ch.id}>`);
    if (cfg.canales.tickets_nuevos) {
      await api("POST", `/channels/${cfg.canales.tickets_nuevos}/messages`, {
        content: `🎫 **Ticket nuevo** de <@${usuario.id}> → <#${ch.id}> ${[cfg.roles.dongato, cfg.roles.admin].filter(Boolean).map((r) => `<@&${r}>`).join(" ")}`,
        allowed_mentions: { roles: [cfg.roles.dongato, cfg.roles.admin].filter(Boolean), users: [] },
      }).catch(() => {});
    }
    anotar("discord", `Ticket nuevo de ${usuario.username}.`);
    return;
  }

  if (id === "ticket_cerrar") {
    const ch = await api("GET", `/channels/${it.channel_id}`);
    if (!ch || ch.parent_id !== cfg.canales.cat_tickets || !String(ch.topic || "").startsWith("ticket:")) return responder(it, "Este botón solo funciona dentro de un ticket.");
    await api("POST", `/interactions/${it.id}/${it.token}/callback`, { type: 4, data: { content: `🔒 <@${usuario.id}> cerró el ticket. Se borrará en 10 segundos.`, allowed_mentions: { parse: [] } } });
    if (cfg.canales.tickets_nuevos) api("POST", `/channels/${cfg.canales.tickets_nuevos}/messages`, { content: `🔒 Ticket cerrado: **${ch.name}** (por <@${usuario.id}>)`, allowed_mentions: { parse: [] } }).catch(() => {});
    setTimeout(async () => {
      await exentarEnlaces(cfg, ch.id, false);
      await api("DELETE", `/channels/${ch.id}`).catch(() => {});
    }, Number(process.env.TICKET_BORRAR_MS ?? 10000)).unref?.();
  }
}

module.exports = { configurar, manejarInteraccion, leerCasinos, infoCasino };
