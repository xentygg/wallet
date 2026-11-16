// Configura el servidor de Discord con la marca de esta instalación (MARCA=dongato, licenciado…) usando el bot.
// Uso (en el servidor, como root):
//   set -a; . /etc/dongato.env; set +a; node server/discord-configurar.js [--rebrand] [ID_DEL_SERVIDOR]
// Se puede correr varias veces: solo crea lo que falte y no borra nada.
// --rebrand: además cambia el nombre e ícono del servidor, el nombre y foto del bot, los nombres de los roles,
//            las descripciones de los canales y los mensajes fijos a la marca actual.
const fs = require("node:fs");
const path = require("node:path");
const { api, espera, CONFIG_PATH, SITIO } = require("./discord");
const MARCA = require("./marca");
const REBRAND = process.argv.includes("--rebrand");
const ARGS = process.argv.slice(2).filter((a) => !a.startsWith("--"));

const VIEW = 1n << 10n, SEND = 1n << 11n, REACT = 1n << 6n, HISTORY = 1n << 16n;
const ADMINISTRADOR = 1n << 3n, KICK = 1n << 1n, BAN = 1n << 2n, CANALES = 1n << 4n, AUDITORIA = 1n << 7n, MENSAJES = 1n << 13n,
  MENCIONAR_TODOS = 1n << 17n, APODOS = 1n << 27n, ROLES_P = 1n << 28n, SILENCIAR = 1n << 40n;

// Roles, de arriba hacia abajo. "auto": se le da a todos al entrar (lo hace la página con el bot).
const ROLES = [
  { clave: "dongato", nombre: MARCA.rol_dueno, anterior: MARCA.rol_dueno_anterior, color: MARCA.color, permisos: ADMINISTRADOR },
  { clave: "admin", nombre: "🛡️ Admin", color: 0xe4242c, permisos: KICK | BAN | CANALES | AUDITORIA | MENSAJES | MENCIONAR_TODOS | APODOS | ROLES_P | SILENCIAR },
  { clave: "moderador", nombre: "🔨 Moderador", color: 0x16b250, permisos: KICK | MENSAJES | APODOS | SILENCIAR },
  { clave: "ganador", nombre: "🏆 Ganador", color: 0xff9f43, permisos: 0n },
  { clave: "vip", nombre: "💎 VIP", color: 0xa855f7, permisos: 0n },
  { clave: "aficionado", nombre: MARCA.rol_aficionado, anterior: MARCA.rol_aficionado_anterior, color: 0xdcdde1, permisos: 0n, auto: true },
];
const THREADS = (1n << 35n) | (1n << 36n) | (1n << 38n);
const soloLectura = (everyoneId, staff) => [
  { id: everyoneId, type: 0, allow: String(VIEW | REACT | HISTORY), deny: String(SEND | THREADS) },
  ...staff.map((id) => ({ id, type: 0, allow: String(SEND), deny: "0" })), // Admin y Moderador sí pueden escribir
];

// Estructura del servidor. "clave" = nombre interno para que la página publique ahí.
const ESTRUCTURA = [
  { categoria: "📢 INFORMACIÓN", canales: [
    { clave: "bienvenida", nombre: "👋・bienvenida", tema: `Empieza aquí: qué es la comunidad ${MARCA.de} y cómo jugar.`, lectura: true },
    { clave: "reglas", nombre: "📜・reglas", tema: "Las reglas de la casa. Léelas antes de participar.", lectura: true },
    { clave: "anuncios", nombre: "📣・anuncios", tema: `Recompensas, premios y novedades ${MARCA.de}.`, lectura: true },
  ] },
  { categoria: "⚽ QUINIELA", canales: [
    { clave: "quiniela", nombre: "🎯・quiniela-del-día", tema: `La quiniela de cada día. Juega gratis en ${SITIO}/quiniela`, lectura: true },
    { clave: "envivo", nombre: "🔴・en-vivo", tema: "Comenta los partidos mientras se juegan." },
    { clave: "ganadores", nombre: "🏆・ganadores", tema: "Ganadores de la quiniela y comprobantes de pago.", lectura: true },
  ] },
  { categoria: "🎉 DINÁMICAS", canales: [
    { clave: "dinamicas", nombre: "🎉・dinámicas", tema: "Dinámicas y retos con premio, exclusivos del Discord. Solo mayores de 18.", mayores: true },
    { clave: "trivia", nombre: "🧠・trivia", tema: `Preguntas y retos ${MARCA.de}. ¿Sabes o nomás opinas?` },
  ] },
  { categoria: "💬 COMUNIDAD", canales: [
    { clave: "platica", nombre: "💬・platica-libre", tema: "De todo un poco. Respeto ante todo." },
    { clave: "ligamx", nombre: "🇲🇽・liga-mx", tema: "Todo sobre la Liga MX." },
    { clave: "internacional", nombre: "🌍・futbol-internacional", tema: "Champions, Premier, LaLiga y más." },
    { clave: "voz", nombre: "🔊 Platica en vivo", voz: true },
  ] },
];

const REGLAS = `**Reglas de la comunidad ${MARCA.de}**

**1.** Respeto ante todo. Se vale el pique, no los insultos.
**2.** Nada de spam, publicidad ni enlaces sospechosos.
**3.** Una cuenta por persona. Las cuentas duplicadas pierden sus premios.
**4.** Las dinámicas con premio son solo para mayores de 18 años.
**5.** Los premios se entregan solo por los medios oficiales ${MARCA.de}. Nadie del equipo te va a pedir contraseñas ni pagos.
**6.** Las bases de la quiniela están en ${SITIO}/bases

${MARCA.remate_reglas}`;

const bienvenida = (c) => `**¡Bienvenido a la comunidad ${MARCA.de}! ⚽**
Aquí se juega la quiniela diaria, se viven los partidos y se presume quién sí sabe.

🎯 **Juega gratis:** ${SITIO} — atínale a los 5 partidos y gana $300.
🎁 **Recompensas exclusivas, premios más grandes y dinámicas** en <#${c.anuncios}> y <#${c.dinamicas}>.
⚽ La quiniela de cada día aparece en <#${c.quiniela}> y los ganadores en <#${c.ganadores}>.

Lee <#${c.reglas}> y preséntate en <#${c.platica}>. ${MARCA.remate_bienvenida}`;

const ANUNCIOS = `**📣 Aquí se anuncia todo lo bueno**
Recompensas exclusivas para los miembros, premios más grandes que en la página y dinámicas especiales. Activa las notificaciones de este canal para no perderte nada. 🔔`;

const QUINIELA = `**🎯 Quiniela del día**
Todos los días a partir de las 5:00 pm se publica aquí la quiniela del día siguiente. Juégala gratis en ${SITIO}/quiniela y comenta los partidos en el canal de en vivo.`;

async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Falta DISCORD_BOT_TOKEN. Guárdalo primero en /etc/dongato.env.");

  // 1. ¿En qué servidor está el bot?
  const guilds = await api("GET", "/users/@me/guilds");
  let guildId = ARGS[0];
  if (!guildId) {
    if (guilds.length === 0) throw new Error("El bot no está en ningún servidor. Invítalo primero con el enlace del portal de desarrolladores.");
    if (guilds.length > 1) throw new Error("El bot está en varios servidores: " + guilds.map((g) => `${g.name} (${g.id})`).join(", ") + ". Vuelve a correr el comando agregando el número del servidor al final.");
    guildId = guilds[0].id;
  }
  const guild = guilds.find((g) => g.id === guildId) || (await api("GET", `/guilds/${guildId}`));
  console.log(`Configurando el servidor "${guild.name}"…`);

  let cfgPrevia = {};
  try { cfgPrevia = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch {}
  if (cfgPrevia.guild_id && cfgPrevia.guild_id !== guildId) cfgPrevia = {};

  // 2. Roles con colores (solo crea los que falten; si existen, les pone el nombre y color de la marca)
  let rolesExistentes = await api("GET", `/guilds/${guildId}/roles`);
  const roles = {};
  for (const r of ROLES) {
    let rol = rolesExistentes.find((x) => cfgPrevia.roles && x.id === cfgPrevia.roles[r.clave])
      || rolesExistentes.find((x) => x.name === r.nombre)
      || (r.anterior && rolesExistentes.find((x) => x.name === r.anterior));
    if (rol && (rol.name !== r.nombre || rol.color !== r.color)) {
      try {
        await api("PATCH", `/guilds/${guildId}/roles/${rol.id}`, { name: r.nombre, color: r.color, hoist: true });
        if (rol.name !== r.nombre) console.log(`  ✎ rol ${rol.name} → ${r.nombre}`);
      } catch (e) { console.log(`  ! No pude cambiar el rol ${rol.name}: ${e.message}`); }
      await espera(400);
    }
    if (!rol) {
      rol = await api("POST", `/guilds/${guildId}/roles`, { name: r.nombre, color: r.color, hoist: true, mentionable: r.clave !== "aficionado", permissions: String(r.permisos) });
      console.log(`  + rol ${r.nombre}`);
      await espera(400);
    }
    roles[r.clave] = rol.id;
  }
  // Orden: Don Gato arriba, Aficionado abajo (justo debajo del rol del bot)
  const avisos = [];
  try {
    const yo = await api("GET", "/users/@me");
    const miembroBot = await api("GET", `/guilds/${guildId}/members/${yo.id}`);
    rolesExistentes = await api("GET", `/guilds/${guildId}/roles`);
    const topeBot = Math.max(0, ...rolesExistentes.filter((x) => miembroBot.roles.includes(x.id)).map((x) => x.position));
    const nuestros = ROLES.map((r) => roles[r.clave]);
    if (topeBot <= nuestros.length) throw new Error("rol del bot muy abajo");
    await api("PATCH", `/guilds/${guildId}/roles`, nuestros.map((id, i) => ({ id, position: topeBot - 1 - i })));
    console.log("  ✓ orden de los roles");
  } catch (e) {
    avisos.push('Para que los roles queden en orden y el bot pueda darlos: en Discord ve a Ajustes del servidor → Roles y arrastra el rol del bot (el que tiene ícono de bot) hasta arriba de todo. Luego vuelve a correr este comando.');
  }
  const staff = [roles.admin, roles.moderador];

  // 3. Categorías y canales (solo crea lo que falte)
  let existentes = await api("GET", `/guilds/${guildId}/channels`);
  const buscar = (nombre, tipo, padre) => existentes.find((c) => c.name === nombre && c.type === tipo && (padre === undefined || c.parent_id === padre));
  const canales = {};
  let posicion = 0;
  for (const grupo of ESTRUCTURA) {
    let cat = buscar(grupo.categoria, 4);
    if (!cat) {
      cat = await api("POST", `/guilds/${guildId}/channels`, { name: grupo.categoria, type: 4, position: posicion });
      existentes.push(cat);
      console.log(`  + categoría ${grupo.categoria}`);
      await espera(400);
    }
    posicion++;
    for (const c of grupo.canales) {
      const tipo = c.voz ? 2 : 0;
      let ch = buscar(c.nombre, tipo, cat.id);
      if (!ch) {
        const cuerpo = { name: c.nombre, type: tipo, parent_id: cat.id };
        if (!c.voz) cuerpo.topic = c.tema;
        if (c.lectura) cuerpo.permission_overwrites = soloLectura(guildId, staff);
        if (c.mayores) cuerpo.nsfw = true; // canal con restricción de edad (+18)
        ch = await api("POST", `/guilds/${guildId}/channels`, cuerpo);
        existentes.push(ch);
        console.log(`  + canal ${c.nombre}`);
        await espera(400);
      } else {
        // Canales que ya existían: dar permiso de escribir a Admin y Moderador, y poner la descripción de la marca
        if (c.lectura) for (const id of staff) await api("PUT", `/channels/${ch.id}/permissions/${id}`, { type: 0, allow: String(SEND), deny: "0" }).catch(() => {});
        if (REBRAND && !c.voz && ch.topic !== c.tema) { await api("PATCH", `/channels/${ch.id}`, { topic: c.tema }).catch(() => {}); await espera(400); }
      }
      canales[c.clave] = ch.id;
    }
  }

  // 4. Rol Don Gato para el dueño del servidor y Aficionado para quienes ya estén
  try {
    const info = await api("GET", `/guilds/${guildId}`);
    await api("PUT", `/guilds/${guildId}/members/${info.owner_id}/roles/${roles.dongato}`);
    console.log(`  ✓ te di el rol ${MARCA.rol_dueno}`);
  } catch (e) { avisos.push(`No pude darte el rol ${MARCA.rol_dueno} (${e.message}). Dátelo tú en Ajustes del servidor → Roles.`); }
  let miembros = null;
  try { miembros = await api("GET", `/guilds/${guildId}/members?limit=1000`); }
  catch (e) { avisos.push(`Para dar el rol ${MARCA.rol_aficionado} automáticamente: en discord.com/developers → tu aplicación → Bot, activa "Server Members Intent" y guarda. Luego vuelve a correr este comando.`); }
  if (miembros) {
    let n = 0, fallos = 0;
    for (const m of miembros) {
      if ((m.user && m.user.bot) || m.roles.includes(roles.aficionado)) continue;
      try { await api("PUT", `/guilds/${guildId}/members/${m.user.id}/roles/${roles.aficionado}`); n++; } catch { fallos++; }
      await espera(300);
    }
    console.log(`  ✓ rol ${MARCA.rol_aficionado} para ${n} miembro(s) que ya estaban`);
    if (fallos) avisos.push(`No pude dar ${MARCA.rol_aficionado} a ${fallos} miembro(s): sube el rol del bot hasta arriba en Ajustes del servidor → Roles y vuelve a correr este comando.`);
  }

  // 5. Mensajes fijos: si el canal está vacío se publican; con --rebrand se editan los que puso el bot
  const yoBot = await api("GET", "/users/@me");
  const publicarSiVacio = async (clave, contenido) => {
    const msgs = await api("GET", `/channels/${canales[clave]}/messages?limit=50`);
    if (msgs.length) {
      if (!REBRAND) return;
      // Solo mensajes normales del bot (tipo 0), no los avisos automáticos de Discord como "fijó un mensaje"
      const mio = msgs.slice().reverse().find((m) => m.author && m.author.id === yoBot.id && (m.type === 0 || m.type === undefined)
        && m.content && !(m.embeds && m.embeds.length));
      if (mio && mio.content !== contenido) {
        try {
          await api("PATCH", `/channels/${canales[clave]}/messages/${mio.id}`, { content: contenido, allowed_mentions: { parse: [] } });
          console.log(`  ✎ mensaje de ${clave} actualizado`);
        } catch (e) { avisos.push(`No pude actualizar el mensaje de #${clave} (${e.message}). Edítalo a mano si hace falta.`); }
        await espera(400);
      }
      return;
    }
    const m = await api("POST", `/channels/${canales[clave]}/messages`, { content: contenido, allowed_mentions: { parse: [] } });
    await api("PUT", `/channels/${canales[clave]}/pins/${m.id}`).catch(() => {});
    console.log(`  + mensaje en ${clave}`);
    await espera(400);
  };
  await publicarSiVacio("reglas", REGLAS);
  await publicarSiVacio("bienvenida", bienvenida(canales));
  await publicarSiVacio("anuncios", ANUNCIOS);
  await publicarSiVacio("quiniela", QUINIELA);

  // 6. Ajustes del servidor: ícono, seguridad media, avisos de nuevos miembros en bienvenida
  const ajustes = { verification_level: 2, explicit_content_filter: 2, default_message_notifications: 1, system_channel_id: canales.bienvenida };
  const icono = [path.join(MARCA.dir, "discord-icono.png"), path.join(__dirname, "..", "deploy", "discord-icono.png")].find((f) => fs.existsSync(f));
  const iconoData = icono ? "data:image/png;base64," + fs.readFileSync(icono).toString("base64") : null;
  if (iconoData && (!guild.icon || REBRAND)) ajustes.icon = iconoData;
  if (REBRAND) ajustes.name = MARCA.nombre;
  try { await api("PATCH", `/guilds/${guildId}`, ajustes); console.log(`  ✓ ${REBRAND ? `servidor renombrado a "${MARCA.nombre}", ` : ""}ícono y seguridad del servidor`); }
  catch (e) { console.log("  ! No pude cambiar el nombre, ícono o seguridad: " + e.message); }
  if (REBRAND) {   // nombre y foto del propio bot (Discord limita los cambios de nombre a 2 por hora)
    try { await api("PATCH", "/users/@me", { username: MARCA.nombre, ...(iconoData ? { avatar: iconoData } : {}) }); console.log(`  ✓ el bot ahora se llama "${MARCA.nombre}"`); }
    catch (e) { avisos.push(`No pude cambiar el nombre o la foto del bot (${e.message}). Cámbialos en discord.com/developers → tu aplicación → Bot.`); }
  }

  // 7. Enlace de invitación permanente (se conserva el mismo)
  let invitacion = cfgPrevia.invitacion || null;
  if (!invitacion) {
    const inv = await api("POST", `/channels/${canales.bienvenida}/invites`, { max_age: 0, max_uses: 0, unique: false });
    invitacion = `https://discord.gg/${inv.code}`;
  }

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ guild_id: guildId, canales, roles, invitacion }, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o644);

  console.log("\n============================================================");
  console.log(`  ¡Listo! Tu servidor de Discord quedó configurado.`);
  console.log(`  ENLACE DE INVITACIÓN:  ${invitacion}`);
  console.log("  La página ya lo usa sola. Recárgala con Ctrl + F5.");
  console.log("============================================================");
  if (avisos.length) { console.log("\n⚠️  Pendientes:"); avisos.forEach((a) => console.log("  - " + a)); }
}

main().catch((e) => { console.error("\n❌ " + e.message); process.exit(1); });
