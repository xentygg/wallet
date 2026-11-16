// Funciones compartidas: mascota, encabezado, pie, sesión, referidos y compartir.
(function () {
  const C = window.CONFIG;

  // ---------- Almacenamiento seguro ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---------- API del servidor ----------
  async function api(metodo, ruta, cuerpo) {
    const r = await fetch(ruta, {
      method: metodo,
      headers: cuerpo ? { "Content-Type": "application/json" } : {},
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      credentials: "same-origin"
    });
    let datos = {};
    try { datos = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(datos.error || "No se pudo conectar. Intenta de nuevo."); err.estado = r.status; throw err; }
    return datos;
  }

  // ---------- Referidos ----------
  // Si alguien llega con ?ref=CODIGO, se guarda para asociarlo cuando cree su cuenta.
  const refEntrante = new URLSearchParams(location.search).get("ref");
  if (refEntrante && /^[A-Z0-9]{4,12}$/i.test(refEntrante) && !store.get("mc_ref_origen")) store.set("mc_ref_origen", refEntrante.toUpperCase());

  // Enlace para invitar: usa el código de la cuenta si hay sesión
  function urlConMiRef(path) {
    const u = new URL(path || "/", location.origin);
    const codigo = store.get("mc_mi_codigo_cuenta");
    if (codigo) u.searchParams.set("ref", codigo);
    return u.toString();
  }

  // Botón de registro a la plataforma: abre WhatsApp con un mensaje listo
  function urlRegistro() {
    const origen = store.get("mc_ref_origen");
    const texto = C.registro.mensaje + (origen ? `\nMe invitó: ${origen}` : "");
    return "https://wa.me/" + C.whatsappOrganizador + "?text=" + encodeURIComponent(texto);
  }

  function compartirWhatsApp(texto, numero) {
    const base = numero ? "https://wa.me/" + numero : "https://wa.me/";
    window.open(base + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
  }

  const esc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : String(s); return d.innerHTML; };

  // ---------- Mascota (imágenes de Don Gato del proyecto de TikTok) ----------
  const gato = `<img src="/img/don-gato.webp" alt="${C.marca}, la mascota" width="640" height="837">`;
  const avatar = `<img src="/img/perfil.webp" alt="${C.marca}" width="256" height="256">`;

  // ---------- Encabezado y pie ----------
  function header(activa) {
    const link = (href, txt, key, id) => `<a href="${href}" class="${activa === key ? "activo" : ""}"${id ? ` id="${id}"` : ""}>${txt}</a>`;
    return `
    <header class="top">
      <a class="logo" href="/">${avatar}<span>${C.marca}</span></a>
      <nav>
        ${link("/trivia", "Trivia", "trivia")}
        ${link("/quiniela", "Quiniela", "quiniela")}
        ${link("/entrar", "Entrar", "perfil", "nav-cuenta")}
      </nav>
    </header>`;
  }

  function footer() {
    const aviso = C.registro.soloMayores
      ? `<p class="aviso">🔞 Contenido para mayores de 18 años. Juega con responsabilidad: es entretenimiento, no una forma de ingreso. Una cuenta por persona.</p>`
      : "";
    return `
    <footer class="pie">
      ${aviso}
      <p><a href="${C.tiktok}" target="_blank" rel="noopener">TikTok</a> · ${C.grupoWhatsApp
        ? `<a href="${C.grupoWhatsApp}" target="_blank" rel="noopener">Grupo de WhatsApp</a>`
        : `<a href="https://wa.me/${C.whatsappOrganizador}" target="_blank" rel="noopener">WhatsApp</a>`}
        · <a href="/bases">Bases de la quiniela</a> · <a href="/privacidad">Aviso de privacidad</a></p>
      <p class="mini">© ${new Date().getFullYear()} ${C.marca}. Trivias y quinielas gratuitas para la comunidad.</p>
    </footer>`;
  }

  // Monta encabezado y pie, y revisa si hay sesión. Devuelve el usuario (o null).
  async function montar(activa) {
    document.getElementById("header").innerHTML = header(activa);
    document.getElementById("footer").innerHTML = footer();
    document.title = document.title.replace("{marca}", C.marca);
    let usuario = null;
    try { usuario = (await api("GET", "/api/yo")).usuario; } catch (e) {}
    const nav = document.getElementById("nav-cuenta");
    if (usuario) {
      store.set("mc_mi_codigo_cuenta", usuario.ref_code);
      nav.textContent = "Mi perfil";
      nav.href = "/perfil";
    } else {
      store.del("mc_mi_codigo_cuenta");
    }
    return usuario;
  }

  window.MC = { store, api, esc, urlConMiRef, urlRegistro, compartirWhatsApp, gato, avatar, montar };
})();
