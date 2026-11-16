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
  let golesTotal = "";
  // ¿Qué eligió la gente? (se muestra cuando la quiniela ya cerró)
  const barra = (p) => !p.reparto ? "" : `<div class="reparto" title="Lo que eligió la gente">${(p.empate ? ["L", "E", "V"] : ["L", "V"])
    .filter((x) => p.reparto[x] > 0).map((x) => `<span class="r${x}" style="width:${p.reparto[x]}%">${p.reparto[x] >= 12 ? `${x} ${p.reparto[x]}%` : ""}</span>`).join("")}</div>`;
  const marcador = (p) => (p.goles_local !== null && p.goles_local !== undefined ? `${p.goles_local}-${p.goles_visita}` : NOMBRES[p.resultado]);

  function pintar() {
    if (!q) {
      $("q-card").innerHTML = `
        <h2 class="titulo-sec">⚽ Quiniela diaria</h2>
        <p>La próxima quiniela se publica todos los días a partir de las 5:00 pm. ${C.discord ? `Entérate primero en el <a href="${C.discord}" target="_blank" rel="noopener">Discord</a>.` : ""}</p>`;
      return;
    }
    const mia = q.mia;
    const puedeJugar = usuario && !mia && !q.cerrada;
    const total = q.partidos.length;

    let estado = "";
    if (q.anulada) estado = `<div class="error">Esta quiniela se anuló porque se cancelaron ${q.cancelados} partidos. No hay premio este día.</div>`;
    else if (q.calificada) estado = mia ? (mia.anulada ? `<div class="error">Tu quiniela fue anulada por no cumplir las bases.</div>`
      : `<div class="${mia.aciertos === total ? "exito" : "aviso"}">Le atinaste a <b>${mia.aciertos} de ${total}</b>. ${mia.aciertos === total ? (q.ganadores && q.ganadores.length && q.ganadores[0].empatados > 1 ? "¡Le atinaste a todo! Hubo empate y se decidió por el total de goles: mira abajo quién ganó." : "¡GANASTE! Te escribimos por WhatsApp para entregarte tu premio 🏆") : mia.aciertos === total - 1 ? "¡Estuviste a uno del premio! Mañana hay otra." : "Mañana hay otra oportunidad."}</div>`)
      : `<div class="aviso">Esta quiniela ya tiene resultados.</div>`;
    else if (mia) estado = `<div class="exito">✅ Ya enviaste tu quiniela${q.cerrada ? ". Esperando resultados…" : ". ¡Suerte!"}${mia.goles !== null && mia.goles !== undefined ? ` Tu desempate: <b>${mia.goles} goles</b>.` : ""}</div>`;
    else if (q.cerrada) estado = `<div class="aviso">La quiniela ya cerró. Vuelve mañana.</div>`;
    else if (!usuario) estado = `<div class="aviso">Para jugar necesitas una cuenta gratis. Es rápido.</div>`;

    $("q-card").innerHTML = `
      <h2 class="titulo-sec">⚽ Quiniela del ${esc(fmtFecha(q.fecha))}</h2>
      <div class="premio">
        <div><small>PREMIO DEL DÍA</small><div class="monto">${pesos(q.cerrada && q.premio_final !== undefined ? q.premio_final : q.premio)}</div></div>
        <div style="text-align:right;font-weight:700">Atínale a los ${total}<br>y es tuyo</div>
      </div>
      <p style="margin:0 0 4px">${q.cerrada ? "Cerró" : "Cierra"}: <b>${esc(fmtHora(q.cierre))}</b> (hora CDMX)${q.cerrada ? "" : ` · <span class="cuenta" id="cuenta"></span>`}</p>
      <p style="font-size:.9rem;margin:0 0 6px">Elige <b>L</b> (gana local), <b>E</b> (empate) o <b>V</b> (gana visita). Donde no hay empate (NFL, NBA, béisbol) solo aparecen L y V. Una quiniela por persona al día. ${q.participantes} participando.</p>
      <p class="ayuda" style="margin:0 0 6px">Si se cancela 1 partido, el premio baja a ${pesos(q.premio_cancelado)}; si se cancelan 2 o más, la quiniela se anula. Si varios le atinan a todo, gana quien más se acerque al total de goles. <a href="/bases">Ver bases</a></p>
      ${estado}
      <div id="partidos">${q.partidos.map((p) => {
        const mio = mia && mia.picks[p.id];
        const botones = (p.empate ? ["L", "E", "V"] : ["L", "V"]).map((x) => {
          let cls = "pick";
          if (mio) {
            if (mio === x) cls += p.resultado ? (p.resultado === "C" || p.resultado === x ? " ok" : " mal") : " sel";
            if (p.resultado === x && mio !== x) cls += " res";
          } else if (picks[p.id] === x) cls += " sel";
          return `<button class="${cls}" data-p="${p.id}" data-v="${x}" ${puedeJugar ? "" : "disabled"} aria-label="${NOMBRES[x]}">${x}</button>`;
        }).join("");
        return `<div class="partido">
          ${p.liga ? `<span class="liga">${esc(p.liga)}</span>` : ""}
          <div class="eq">${esc(p.local)}</div><div class="picks">${botones}</div><div class="eq v">${esc(p.visita)}</div>
          <div class="fecha">${esc(p.hora || "")}${p.resultado ? ` · Resultado: <b>${esc(marcador(p))}</b>` : ""}</div>
          ${barra(p)}
        </div>`;
      }).join("")}</div>
      <div id="acciones" style="margin-top:16px"></div>
      ${q.calificada && q.ganadores && !q.anulada ? `<div style="margin-top:16px">${q.ganadores.length
        ? `<b>🏆 Ganador:</b> ${esc(q.ganadores[0].apodo)} (${pesos(q.ganadores[0].monto)})${q.ganadores[0].empatados > 1 ? ` · Desempate entre ${q.ganadores[0].empatados} por total de goles (${q.total_goles}).` : ""}`
        : "Nadie le atinó a todos esta vez."}</div>` : ""}`;

    const acc = $("acciones");
    if (puedeJugar) {
      acc.innerHTML = `
        <div style="margin-bottom:14px">
          <label for="goles">Desempate: ¿cuántos goles habrá en total en los ${total} partidos?</label>
          <input type="number" id="goles" min="0" max="99" inputmode="numeric" placeholder="Ej. 12" value="${esc(golesTotal)}">
          <div class="ayuda">Solo cuenta si varios le atinan a todo: gana quien más se acerque.</div>
        </div>
        <div id="q-error" class="error" hidden></div>
        <div class="fila"><button class="btn btn-pri" id="enviar"></button></div>
        <p class="ayuda" style="text-align:center">Una vez enviada no se puede cambiar.</p>`;
      const boton = () => {
        const faltan = q.partidos.filter((p) => !picks[p.id]).length;
        const sinGoles = !/^\d{1,2}$/.test(golesTotal);
        $("enviar").disabled = faltan > 0 || sinGoles;
        $("enviar").textContent = faltan ? `Te faltan ${faltan} partido(s)` : sinGoles ? "Escribe tu desempate de goles" : "Enviar mi quiniela";
      };
      boton();
      $("goles").oninput = () => { golesTotal = $("goles").value.trim(); boton(); };
      document.querySelectorAll(".pick").forEach((b) => b.onclick = () => { picks[b.dataset.p] = b.dataset.v; pintar(); });
      $("enviar").onclick = enviar;
    } else if (!usuario && !q.cerrada) {
      acc.innerHTML = `<div class="fila"><a class="btn btn-pri" href="/entrar?nueva=1&volver=/quiniela">Crear cuenta y jugar</a><a class="btn btn-sec" href="/entrar?volver=/quiniela">Ya tengo cuenta</a></div>`;
    } else if (mia) {
      acc.innerHTML = `${MC.discord("corto", "¡Ya jugaste! Ahora vive los partidos con la comunidad")}
        <div class="fila" style="margin-top:12px"><button class="btn btn-wa" id="retar">Retar a un compa por WhatsApp</button></div>`;
      $("retar").onclick = () => MC.compartirWhatsApp(`😎 Ya llené la quiniela de ${C.marca}: si le atinas a los ${total} partidos te ganas ${pesos(q.premio)}. Es gratis: ${MC.urlConMiRef("/quiniela")}`);
    }
    if (!q.cerrada) cuentaRegresiva();
  }

  async function enviar(e) {
    if (!confirm("¿Enviar tu quiniela? Ya no podrás cambiarla.")) return;
    e.target.disabled = true;
    try {
      await MC.api("POST", `/api/quiniela/${q.id}/enviar`, { picks, goles: Number(golesTotal) });
      q.mia = { picks: { ...picks }, aciertos: null, anulada: false, goles: Number(golesTotal) };
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
      <p class="ayuda" style="margin:0 0 6px">La barra muestra qué eligió la gente: <b style="color:var(--amarillo)">L</b> · <b>E</b> · <b style="color:#ff9f43">V</b></p>
      <p style="margin:0 0 8px">${ej.anulada ? "Anulada: se cancelaron 2 o más partidos." : ej.calificada ? "Terminada." : `Van ${listos} de ${total} resultados.`} ${ej.participantes} participantes.${mia && mia.goles !== null && mia.goles !== undefined ? ` Tu desempate: ${mia.goles} goles.` : ""}</p>
      ${ej.partidos.map((p) => {
        const mio = mia && mia.picks[p.id];
        const ok = p.resultado && mio && (p.resultado === "C" || p.resultado === mio);
        return `<div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)">
          <span>${esc(p.local)} vs ${esc(p.visita)}</span>
          <span>${mio ? `Tú: <b>${mio}</b> · ` : ""}${p.resultado ? `<span class="badge ${mio ? (ok ? "verde" : "rojo") : "gris"}">${esc(marcador(p))}</span>` : '<span class="badge gris">Pendiente</span>'}</span>
          ${barra(p).replace('class="reparto"', 'class="reparto" style="flex-basis:100%"')}
        </div>`;
      }).join("")}
      ${ej.calificada && ej.ganadores && !ej.anulada ? `<p style="margin-top:12px">${ej.ganadores.length ? `🏆 ${esc(ej.ganadores[0].apodo)} (${pesos(ej.ganadores[0].monto)})${ej.ganadores[0].empatados > 1 ? ` · desempate por goles (${ej.total_goles})` : ""}` : "Nadie le atinó a todos."}</p>` : ""}`;
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
        <span style="color:var(--muted)">${x.anulada ? "Anulada (2 o más partidos cancelados)" : x.ganadores.length ? `🏆 ${esc(x.ganadores[0].apodo)} (${pesos(x.ganadores[0].monto)})` : "Sin ganador"}</span>
      </div>`).join("");
  }).catch(() => {});
})();
