// Funciones compartidas: mascota, encabezado, pie, referidos y compartir.
(function () {
  const C = window.CONFIG;

  // ---------- Almacenamiento seguro ----------
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---------- Referidos ----------
  // Si alguien llega con ?ref=CODIGO, se guarda. Cada visitante también recibe su propio código para compartir.
  const params = new URLSearchParams(location.search);
  const refEntrante = params.get("ref");
  if (refEntrante && !store.get("mc_ref_origen")) store.set("mc_ref_origen", refEntrante.slice(0, 40));
  let miCodigo = store.get("mc_mi_codigo");
  if (!miCodigo) { miCodigo = Math.random().toString(36).slice(2, 8).toUpperCase(); store.set("mc_mi_codigo", miCodigo); }

  function urlConMiRef(path) {
    const u = new URL(path || location.pathname, location.href);
    u.searchParams.set("ref", miCodigo);
    return u.toString();
  }

  function urlRegistro() {
    const r = C.registro;
    try {
      const u = new URL(r.url);
      const origen = store.get("mc_ref_origen");
      if (r.parametroReferido && origen) u.searchParams.set(r.parametroReferido, origen);
      return u.toString();
    } catch (e) { return r.url; }
  }

  function compartirWhatsApp(texto, numero) {
    const base = numero ? "https://wa.me/" + numero : "https://wa.me/";
    window.open(base + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
  }

  // ---------- Mascota (imágenes de Don Gato del proyecto de TikTok) ----------
  const gato = `<img src="img/don-gato.webp" alt="${C.marca}, la mascota" width="640" height="837">`;
  const avatar = `<img src="img/perfil.webp" alt="${C.marca}" width="256" height="256">`;

  // ---------- Encabezado y pie ----------
  function header(activa) {
    const link = (href, txt, key) => `<a href="${href}" class="${activa === key ? "activo" : ""}">${txt}</a>`;
    return `
    <header class="top">
      <a class="logo" href="index.html">${avatar}<span>${C.marca}</span></a>
      <nav>
        ${link("index.html", "Inicio", "inicio")}
        ${link("trivia.html", "Trivia", "trivia")}
        ${link("quiniela.html", "Quiniela", "quiniela")}
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
      <p><a href="${C.tiktok}" target="_blank" rel="noopener">TikTok</a> · <a href="${C.canalWhatsApp}" target="_blank" rel="noopener">Comunidad en WhatsApp</a></p>
      <p class="mini">© ${new Date().getFullYear()} ${C.marca}. Trivias y quinielas gratuitas para la comunidad.</p>
    </footer>`;
  }

  function montar(activa) {
    document.getElementById("header").innerHTML = header(activa);
    document.getElementById("footer").innerHTML = footer();
    document.title = document.title.replace("{marca}", C.marca);
  }

  const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

  window.MC = { store, miCodigo, urlConMiRef, urlRegistro, compartirWhatsApp, gato, avatar, montar, azar };
})();
