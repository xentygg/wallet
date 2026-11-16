// Configura el servidor de Discord de Don Gato usando el bot.
// Uso (en el servidor, como root):
//   set -a; . /etc/dongato.env; set +a; node server/discord-configurar.js [ID_DEL_SERVIDOR]
// Se puede correr varias veces: solo crea lo que falte y no borra nada.
const fs = require("node:fs");
const path = require("node:path");
const { api, espera, CONFIG_PATH, SITIO } = require("./discord");

const VIEW = 1n << 10n, SEND = 1n << 11n, REACT = 1n << 6n, HISTORY = 1n << 16n;
const THREADS = (1n << 35n) | (1n << 36n) | (1n << 38n);
const soloLectura = (everyoneId) => [{ id: everyoneId, type: 0, allow: String(VIEW | REACT | HISTORY), deny: String(SEND | THREADS) }];

// Estructura del servidor. "clave" = nombre interno para que la página publique ahí.
const ESTRUCTURA = [
  { categoria: "📢 INFORMACIÓN", canales: [
    { clave: "bienvenida", nombre: "👋・bienvenida", tema: "Empieza aquí: qué es la comunidad de Don Gato y cómo jugar.", lectura: true },
    { clave: "reglas", nombre: "📜・reglas", tema: "Las reglas de la casa. Léelas antes de participar.", lectura: true },
    { clave: "anuncios", nombre: "📣・anuncios", tema: "Recompensas, premios y novedades de Don Gato.", lectura: true },
  ] },
  { categoria: "⚽ QUINIELA", canales: [
    { clave: "quiniela", nombre: "🎯・quiniela-del-día", tema: `La quiniela de cada día. Juega gratis en ${SITIO}/quiniela`, lectura: true },
    { clave: "envivo", nombre: "🔴・en-vivo", tema: "Comenta los partidos mientras se juegan." },
    { clave: "ganadores", nombre: "🏆・ganadores", tema: "Ganadores de la quiniela y comprobantes de pago.", lectura: true },
  ] },
  { categoria: "🎉 DINÁMICAS", canales: [
    { clave: "dinamicas", nombre: "🎉・dinámicas", tema: "Dinámicas y retos con premio, exclusivos del Discord. Solo mayores de 18.", mayores: true },
    { clave: "trivia", nombre: "🧠・trivia", tema: "Preguntas y retos de Don Gato. ¿Sabes o nomás opinas?" },
  ] },
  { categoria: "💬 COMUNIDAD", canales: [
    { clave: "platica", nombre: "💬・platica-libre", tema: "De todo un poco. Respeto ante todo." },
    { clave: "ligamx", nombre: "🇲🇽・liga-mx", tema: "Todo sobre la Liga MX." },
    { clave: "internacional", nombre: "🌍・futbol-internacional", tema: "Champions, Premier, LaLiga y más." },
    { clave: "voz", nombre: "🔊 Platica en vivo", voz: true },
  ] },
];

const REGLAS = `**Reglas de la comunidad de Don Gato 😎**

**1.** Respeto ante todo. Se vale el pique, no los insultos.
**2.** Nada de spam, publicidad ni enlaces sospechosos.
**3.** Una cuenta por persona. Las cuentas duplicadas pierden sus premios.
**4.** Las dinámicas con premio son solo para mayores de 18 años.
**5.** Los premios se entregan solo por los medios oficiales de Don Gato. Nadie del equipo te va a pedir contraseñas ni pagos.
**6.** Las bases de la quiniela están en ${SITIO}/bases

Si no cumples las reglas, Don Gato te saca del estadio. 🟥`;

const bienvenida = (c) => `**¡Bienvenido a la comunidad de Don Gato! 😎⚽**
Aquí se juega la quiniela diaria, se viven los partidos y se presume quién sí sabe.

🎯 **Juega gratis:** ${SITIO} — atínale a los 5 partidos y gana $300.
🎁 **Recompensas exclusivas, premios más grandes y dinámicas** en <#${c.anuncios}> y <#${c.dinamicas}>.
⚽ La quiniela de cada día aparece en <#${c.quiniela}> y los ganadores en <#${c.ganadores}>.

Lee <#${c.reglas}> y preséntate en <#${c.platica}>. ¡Aquí no hay VAR que te salve!`;

const ANUNCIOS = `**📣 Aquí se anuncia todo lo bueno**
Recompensas exclusivas para los miembros, premios más grandes que en la página y dinámicas especiales. Activa las notificaciones de este canal para no perderte nada. 🔔`;

const QUINIELA = `**🎯 Quiniela del día**
Todos los días a partir de las 5:00 pm se publica aquí la quiniela del día siguiente. Juégala gratis en ${SITIO}/quiniela y comenta los partidos en el canal de en vivo.`;

async function main() {
  if (!process.env.DISCORD_BOT_TOKEN) throw new Error("Falta DISCORD_BOT_TOKEN. Guárdalo primero en /etc/dongato.env.");

  // 1. ¿En qué servidor está el bot?
  const guilds = await api("GET", "/users/@me/guilds");
  let guildId = process.argv[2];
  if (!guildId) {
    if (guilds.length === 0) throw new Error("El bot no está en ningún servidor. Invítalo primero con el enlace del portal de desarrolladores.");
    if (guilds.length > 1) throw new Error("El bot está en varios servidores: " + guilds.map((g) => `${g.name} (${g.id})`).join(", ") + ". Vuelve a correr el comando agregando el número del servidor al final.");
    guildId = guilds[0].id;
  }
  const guild = guilds.find((g) => g.id === guildId) || (await api("GET", `/guilds/${guildId}`));
  console.log(`Configurando el servidor "${guild.name}"…`);

  // 2. Categorías y canales (solo crea lo que falte)
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
        if (c.lectura) cuerpo.permission_overwrites = soloLectura(guildId);
        if (c.mayores) cuerpo.nsfw = true; // canal con restricción de edad (+18)
        ch = await api("POST", `/guilds/${guildId}/channels`, cuerpo);
        existentes.push(ch);
        console.log(`  + canal ${c.nombre}`);
        await espera(400);
      }
      canales[c.clave] = ch.id;
    }
  }

  // 3. Mensajes fijos (solo si el canal está vacío)
  const publicarSiVacio = async (clave, contenido) => {
    const msgs = await api("GET", `/channels/${canales[clave]}/messages?limit=1`);
    if (msgs.length) return;
    const m = await api("POST", `/channels/${canales[clave]}/messages`, { content: contenido, allowed_mentions: { parse: [] } });
    await api("PUT", `/channels/${canales[clave]}/pins/${m.id}`).catch(() => {});
    console.log(`  + mensaje en ${clave}`);
    await espera(400);
  };
  await publicarSiVacio("reglas", REGLAS);
  await publicarSiVacio("bienvenida", bienvenida(canales));
  await publicarSiVacio("anuncios", ANUNCIOS);
  await publicarSiVacio("quiniela", QUINIELA);

  // 4. Ajustes del servidor: ícono, seguridad media, avisos de nuevos miembros en bienvenida
  const ajustes = { verification_level: 2, explicit_content_filter: 2, default_message_notifications: 1, system_channel_id: canales.bienvenida };
  const icono = path.join(__dirname, "..", "deploy", "discord-icono.png");
  if (!guild.icon && fs.existsSync(icono)) ajustes.icon = "data:image/png;base64," + fs.readFileSync(icono).toString("base64");
  try { await api("PATCH", `/guilds/${guildId}`, ajustes); console.log("  ✓ ícono y seguridad del servidor"); }
  catch (e) { console.log("  ! No pude cambiar el ícono o la seguridad: " + e.message); }

  // 5. Enlace de invitación permanente
  let cfgPrevia = {};
  try { cfgPrevia = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")); } catch {}
  let invitacion = cfgPrevia.guild_id === guildId ? cfgPrevia.invitacion : null;
  if (!invitacion) {
    const inv = await api("POST", `/channels/${canales.bienvenida}/invites`, { max_age: 0, max_uses: 0, unique: false });
    invitacion = `https://discord.gg/${inv.code}`;
  }

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ guild_id: guildId, canales, invitacion }, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o644);

  console.log("\n============================================================");
  console.log(`  ¡Listo! Tu servidor de Discord quedó configurado.`);
  console.log(`  ENLACE DE INVITACIÓN:  ${invitacion}`);
  console.log("  La página ya lo usa sola. Recárgala con Ctrl + F5.");
  console.log("============================================================");
}

main().catch((e) => { console.error("\n❌ " + e.message); process.exit(1); });
