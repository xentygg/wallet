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

  // ---------- Mascota (SVG) ----------
  const gato = `
  <svg viewBox="0 0 120 120" class="gato" role="img" aria-label="Mr. Cat, la mascota">
    <polygon points="22,48 30,10 54,34" fill="#f28c28"/>
    <polygon points="98,48 90,10 66,34" fill="#f28c28"/>
    <polygon points="29,40 33,20 46,33" fill="#ffc9a3"/>
    <polygon points="91,40 87,20 74,33" fill="#ffc9a3"/>
    <ellipse cx="60" cy="62" rx="42" ry="38" fill="#f28c28"/>
    <path d="M44 30 q4 8 0 14 M60 26 q4 9 0 16 M76 30 q4 8 0 14" stroke="#d9701a" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="60" cy="76" rx="22" ry="16" fill="#ffe3cc"/>
    <ellipse cx="44" cy="58" rx="7" ry="9" fill="#1d1d1d"/><ellipse cx="76" cy="58" rx="7" ry="9" fill="#1d1d1d"/>
    <circle cx="46" cy="55" r="2.6" fill="#fff"/><circle cx="78" cy="55" r="2.6" fill="#fff"/>
    <path d="M56 70 h8 l-4 5 z" fill="#e85a7a"/>
    <path d="M60 75 q-5 7 -11 3 M60 75 q5 7 11 3" stroke="#1d1d1d" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M30 70 h-20 M31 76 l-19 4 M90 70 h20 M89 76 l19 4" stroke="#1d1d1d" stroke-width="1.6" stroke-linecap="round"/>
    <polygon points="60,100 40,91 40,109" fill="#0f8a4a"/>
    <polygon points="60,100 80,91 80,109" fill="#d62f3a"/>
    <circle cx="60" cy="100" r="5" fill="#fff"/>
  </svg>`;

  // ---------- Encabezado y pie ----------
  function header(activa) {
    const link = (href, txt, key) => `<a href="${href}" class="${activa === key ? "activo" : ""}">${txt}</a>`;
    return `
    <header class="top">
      <a class="logo" href="index.html">${gato}<span>${C.marca}</span></a>
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

  window.MC = { store, miCodigo, urlConMiRef, urlRegistro, compartirWhatsApp, gato, montar };
})();
