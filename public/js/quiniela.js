// Quiniela diaria con cuentas: 5 partidos, una por persona al día, premio para quien le atine a todos.
(async function () {
  const C = window.CONFIG, esc = MC.esc;
  const $ = (id) => document.getElementById(id);
  const usuario = await MC.montar("quiniela");
  const NOMBRES = { L: "Local", E: "Empate", V: "Visita", C: "Cancelado" };
  const fmtFecha = (f) => new Date(f + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  const fmtHora = (iso) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", hour: "2-digit", minute: "2-digit" });
  const pesos = (n) => "$" + Number(n).toLocaleString("es-MX");

  let datos;
  try { datos = await MC.api("GET", "/api/quiniela"); }
  catch (e) { $("q-card").innerHTML = `<div class="error">${esc(e.message)}</div>`; return; }
  const q = datos.quiniela;
  const picks = {};

  function pintar() {
    if (!q) {
      $("q-card").innerHTML = `
        <h2 class="titulo-sec">⚽ Quiniela diaria</h2>
        <p>La quiniela de hoy se publica muy pronto. Síguenos en <a href="${C.tiktok}" target="_blank" rel="noopener">TikTok</a> para enterarte.</p>`;
      return;
    }
    const mia = q.mia;
    const puedeJugar = usuario && !mia && !q.cerrada;
    const total = q.partidos.length;

    let estado = "";
    if (q.calificada) estado = mia ? (mia.anulada ? `<div class="error">Tu quiniela fue anulada por no cumplir las bases.</div>`
      : `<div class="${mia.aciertos === total ? "exito" : "aviso"}">Le atinaste a <b>${mia.aciertos} de ${total}</b>. ${mia.aciertos === total ? "¡GANASTE! Te escribimos por WhatsApp para entregarte tu premio 🏆" : mia.aciertos === total - 1 ? "¡Estuviste a uno del premio! Mañana hay otra." : "Mañana hay otra oportunidad."}</div>`)
      : `<div class="aviso">Esta quiniela ya tiene resultados.</div>`;
    else if (mia) estado = `<div class="exito">✅ Ya enviaste tu quiniela${q.cerrada ? ". Esperando resultados…" : ". ¡Suerte!"}</div>`;
    else if (q.cerrada) estado = `<div class="aviso">La quiniela ya cerró. Vuelve mañana.</div>`;
    else if (!usuario) estado = `<div class="aviso">Para jugar necesitas una cuenta gratis. Es rápido.</div>`;

    $("q-card").innerHTML = `
      <h2 class="titulo-sec">⚽ Quiniela del ${esc(fmtFecha(q.fecha))}</h2>
      <div class="premio">
        <div><small>PREMIO DEL DÍA</small><div class="monto">${pesos(q.premio)}</div></div>
        <div style="text-align:right;font-weight:700">Atínale a los ${total}<br>y es tuyo</div>
      </div>
      <p style="margin:0 0 4px">${q.cerrada ? "Cerró" : "Cierra"}: <b>${esc(fmtHora(q.cierre))}</b> (hora CDMX)${q.cerrada ? "" : ` · <span class="cuenta" id="cuenta"></span>`}</p>
      <p style="font-size:.9rem;margin:0 0 6px">Elige <b>L</b> (gana local), <b>E</b> (empate) o <b>V</b> (gana visita). Donde no hay empate (NFL, NBA, béisbol) solo aparecen L y V. Una quiniela por persona al día. ${q.participantes} participando.</p>
      ${estado}
      <div id="partidos">${q.partidos.map((p) => {
        const mio = mia && mia.picks[p.id];
        const botones = (p.empate ? ["L", "E", "V"] : ["L", "V"]).map((x) => {
          let cls = "pick";
          if (mio) {
            if (mio === x) cls += q.calificada ? (p.resultado === "C" || p.resultado === x ? " ok" : " mal") : " sel";
            if (q.calificada && p.resultado === x && mio !== x) cls += " res";
          } else if (picks[p.id] === x) cls += " sel";
          return `<button class="${cls}" data-p="${p.id}" data-v="${x}" ${puedeJugar ? "" : "disabled"} aria-label="${NOMBRES[x]}">${x}</button>`;
        }).join("");
        return `<div class="partido">
          ${p.liga ? `<span class="liga">${esc(p.liga)}</span>` : ""}
          <div class="eq">${esc(p.local)}</div><div class="picks">${botones}</div><div class="eq v">${esc(p.visita)}</div>
          <div class="fecha">${esc(p.hora || "")}${q.calificada && p.resultado ? ` · Resultado: <b>${NOMBRES[p.resultado]}</b>` : ""}</div>
        </div>`;
      }).join("")}</div>
      <div id="acciones" style="margin-top:16px"></div>
      ${q.calificada && q.ganadores ? `<div style="margin-top:16px">${q.ganadores.length
        ? `<b>🏆 Ganador${q.ganadores.length > 1 ? "es" : ""}:</b> ${q.ganadores.map((g) => `${esc(g.apodo)} (${pesos(g.monto)})`).join(", ")}`
        : "Nadie le atinó a todos esta vez."}</div>` : ""}`;

    const acc = $("acciones");
    if (puedeJugar) {
      const faltan = q.partidos.filter((p) => !picks[p.id]).length;
      acc.innerHTML = `
        <div id="q-error" class="error" hidden></div>
        <div class="fila"><button class="btn btn-pri" id="enviar" ${faltan ? "disabled" : ""}>${faltan ? `Te faltan ${faltan} partido(s)` : "Enviar mi quiniela"}</button></div>
        <p class="ayuda" style="text-align:center">Una vez enviada no se puede cambiar.</p>`;
      document.querySelectorAll(".pick").forEach((b) => b.onclick = () => { picks[b.dataset.p] = b.dataset.v; pintar(); });
      $("enviar").onclick = enviar;
    } else if (!usuario && !q.cerrada) {
      acc.innerHTML = `<div class="fila"><a class="btn btn-pri" href="/entrar?nueva=1&volver=/quiniela">Crear cuenta y jugar</a><a class="btn btn-sec" href="/entrar?volver=/quiniela">Ya tengo cuenta</a></div>`;
    } else if (mia) {
      acc.innerHTML = `<div class="fila"><button class="btn btn-wa" id="retar">Retar a un compa por WhatsApp</button></div>`;
      $("retar").onclick = () => MC.compartirWhatsApp(`😎 Ya llené la quiniela de ${C.marca}: si le atinas a los ${total} partidos te ganas ${pesos(q.premio)}. Es gratis: ${MC.urlConMiRef("/quiniela")}`);
    }
    if (!q.cerrada) cuentaRegresiva();
  }

  async function enviar(e) {
    if (!confirm("¿Enviar tu quiniela? Ya no podrás cambiarla.")) return;
    e.target.disabled = true;
    try {
      await MC.api("POST", `/api/quiniela/${q.id}/enviar`, { picks });
      q.mia = { picks: { ...picks }, aciertos: null, anulada: false };
      q.participantes++;
      pintar();
    } catch (err) {
      $("q-error").textContent = err.message; $("q-error").hidden = false; e.target.disabled = false;
      if (err.estado === 401) location.href = "/entrar?volver=/quiniela";
    }
  }

  let reloj;
  function cuentaRegresiva() {
    clearInterval(reloj);
    const tick = () => {
      const el = $("cuenta"); if (!el) return;
      const ms = Date.parse(q.cierre) - Date.now();
      if (ms <= 0) { clearInterval(reloj); q.cerrada = true; pintar(); return; }
      const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
      el.textContent = `faltan ${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    };
    tick(); reloj = setInterval(tick, 1000);
  }

  pintar();

  // La quiniela que ya cerró y sigue en juego (cuando ya está abierta la del día siguiente)
  const ej = datos.enJuego;
  if (ej) {
    const total = ej.partidos.length, mia = ej.mia;
    const listos = ej.partidos.filter((p) => p.resultado).length;
    $("en-juego").hidden = false;
    $("en-juego").innerHTML = `
      <h2 class="titulo-sec">⏱️ En juego: quiniela del ${esc(fmtFecha(ej.fecha))}</h2>
      <p style="margin:0 0 8px">${ej.calificada ? "Terminada." : `Van ${listos} de ${total} resultados.`} ${ej.participantes} participantes.</p>
      ${ej.partidos.map((p) => {
        const mio = mia && mia.picks[p.id];
        const ok = p.resultado && mio && (p.resultado === "C" || p.resultado === mio);
        return `<div style="display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">
          <span>${esc(p.local)} vs ${esc(p.visita)}</span>
          <span>${mio ? `Tú: <b>${mio}</b> · ` : ""}${p.resultado ? `<span class="badge ${mio ? (ok ? "verde" : "rojo") : "gris"}">${NOMBRES[p.resultado]}</span>` : '<span class="badge gris">Pendiente</span>'}</span>
        </div>`;
      }).join("")}
      ${ej.calificada && ej.ganadores ? `<p style="margin-top:12px">${ej.ganadores.length ? `🏆 ${ej.ganadores.map((g) => `${esc(g.apodo)} (${pesos(g.monto)})`).join(", ")}` : "Nadie le atinó a todos."}</p>` : ""}`;
  }

  // Tabla semanal y resultados anteriores
  MC.api("GET", "/api/tabla").then((t) => {
    $("tabla").innerHTML = t.tabla.map((f, i) => `<tr><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(f.apodo)}</td><td class="num">${f.puntos}</td></tr>`).join("")
      || `<tr><td colspan="3" style="color:var(--muted)">Aún no hay resultados esta semana.</td></tr>`;
  }).catch(() => {});
  MC.api("GET", "/api/resultados").then((r) => {
    const lista = r.resultados.filter((x) => !q || x.id !== q.id);
    if (!lista.length) return;
    $("anteriores").innerHTML = lista.map((x) => `
      <div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <b>${esc(fmtFecha(x.fecha))}</b> · ${x.participantes} participantes<br>
        <span style="color:var(--muted)">${x.ganadores.length ? `🏆 ${x.ganadores.map((g) => `${esc(g.apodo)} (${pesos(g.monto)})`).join(", ")}` : "Sin ganador"}</span>
      </div>`).join("");
  }).catch(() => {});
})();
