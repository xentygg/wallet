// Quiniela: el aficionado elige L/E/V, y se manda un mensaje con sus picks al WhatsApp del organizador.
(function () {
  const C = window.CONFIG, Q = window.QUINIELA;
  MC.montar("quiniela");
  const $ = (id) => document.getElementById(id);
  const esc = (s) => { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; };

  const clave = "mc_quiniela_" + Q.titulo;
  const guardado = MC.store.get(clave, { picks: {}, nombre: "" });
  const cierre = new Date(Q.cierre);
  const cerrada = Date.now() > cierre.getTime();

  $("q-titulo").textContent = "⚽ " + Q.titulo;
  $("q-premio").textContent = Q.premio || "";
  $("q-info").innerHTML = cerrada
    ? `<span class="cerrada">Quiniela cerrada.</span> Revisa la tabla y espera la siguiente jornada.`
    : `Cierra: ${cierre.toLocaleString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} (hora CDMX)`;

  $("partidos").innerHTML = Q.partidos.map(p => `
    <div class="partido">
      <div class="eq">${esc(p.local)}</div>
      <div class="picks" data-id="${esc(p.id)}">
        ${["L", "E", "V"].map(x => `<button class="pick" data-v="${x}" ${cerrada ? "disabled" : ""}>${x}</button>`).join("")}
      </div>
      <div class="eq v">${esc(p.visita)}</div>
      <div class="fecha">${esc(p.fecha || "")}</div>
    </div>`).join("");

  $("nombre").value = guardado.nombre || "";

  function refrescar() {
    document.querySelectorAll(".picks").forEach(g => {
      g.querySelectorAll(".pick").forEach(b => b.classList.toggle("sel", guardado.picks[g.dataset.id] === b.dataset.v));
    });
    const faltan = Q.partidos.filter(p => !guardado.picks[p.id]).length;
    const nombreOk = $("nombre").value.trim().length > 1;
    $("enviar").disabled = cerrada || faltan > 0 || !nombreOk;
    $("faltan").textContent = cerrada ? "" : faltan > 0 ? `Te faltan ${faltan} partido(s).` : !nombreOk ? "Escribe tu nombre para enviar." : "¡Lista! Envíala antes del cierre.";
    MC.store.set(clave, guardado);
  }

  document.querySelectorAll(".pick").forEach(b => b.onclick = () => {
    guardado.picks[b.closest(".picks").dataset.id] = b.dataset.v;
    refrescar();
  });
  $("nombre").oninput = () => { guardado.nombre = $("nombre").value; refrescar(); };

  $("enviar").onclick = () => {
    const lineas = Q.partidos.map(p => `${p.local} vs ${p.visita}: ${guardado.picks[p.id]}`);
    const texto = `😎 QUINIELA ${C.marca}\n${Q.titulo}\nNombre: ${guardado.nombre.trim()}\n\n${lineas.join("\n")}\n\nCódigo: ${MC.miCodigo}`;
    MC.compartirWhatsApp(texto, C.whatsappOrganizador);
  };

  $("tabla").innerHTML = (window.TABLA || [])
    .slice().sort((a, b) => b.puntos - a.puntos)
    .map((t, i) => `<tr><td>${["🥇", "🥈", "🥉"][i] || i + 1}</td><td>${esc(t.nombre)}</td><td class="num">${t.puntos}</td></tr>`).join("")
    || `<tr><td colspan="3" style="color:var(--muted)">Aún no hay resultados.</td></tr>`;

  refrescar();
})();
