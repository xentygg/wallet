// Trivia diaria: 5 preguntas iguales para todos cada día (como Wordle), con resultado para compartir.
(function () {
  const C = window.CONFIG;
  const N = 5;
  const INICIO = Date.UTC(2026, 10, 1); // 1 nov 2026 = trivia #1
  MC.montar("trivia");

  // Día según la hora del centro de México
  const hoyMX = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date()); // AAAA-MM-DD
  const [a, m, d] = hoyMX.split("-").map(Number);
  const numero = Math.floor((Date.UTC(a, m - 1, d) - INICIO) / 86400000) + 1;

  // Mezcla determinista según el día
  function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }
  const r = rng(numero * 7919 + 17);
  const idx = window.PREGUNTAS.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  const preguntas = idx.slice(0, Math.min(N, idx.length)).map(i => window.PREGUNTAS[i]);

  const clave = "mc_trivia_" + hoyMX;
  let estado = MC.store.get(clave, { respuestas: [] });

  const $ = (id) => document.getElementById(id);
  $("titulo").textContent = `🧠 Trivia diaria #${numero}`;

  function pintarProgreso(actual) {
    $("progreso").innerHTML = preguntas.map((p, i) => {
      const resp = estado.respuestas[i];
      const cls = resp === undefined ? (i === actual ? "actual" : "") : (resp === p.correcta ? "ok" : "mal");
      return `<i class="${cls}"></i>`;
    }).join("");
  }

  function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  function mostrarPregunta(i) {
    pintarProgreso(i);
    const p = preguntas[i];
    $("contenido").innerHTML = `
      <p class="mini" style="color:var(--muted);margin:0 0 6px">Pregunta ${i + 1} de ${preguntas.length}</p>
      <p class="pregunta">${esc(p.p)}</p>
      <div class="opciones">${p.o.map((t, k) => `<button class="opcion" data-k="${k}">${esc(t)}</button>`).join("")}</div>
      <div id="extra"></div>`;
    document.querySelectorAll(".opcion").forEach(b => b.onclick = () => responder(i, Number(b.dataset.k)));
  }

  function responder(i, k) {
    if (estado.respuestas[i] !== undefined) return;
    estado.respuestas[i] = k;
    MC.store.set(clave, estado);
    const p = preguntas[i];
    document.querySelectorAll(".opcion").forEach(b => {
      const bk = Number(b.dataset.k);
      b.disabled = true;
      if (bk === p.correcta) b.classList.add("ok");
      else if (bk === k) b.classList.add("mal");
    });
    pintarProgreso(-1);
    const ultima = i === preguntas.length - 1;
    $("extra").innerHTML = `
      <div class="dato">${k === p.correcta ? "✅ ¡Correcto!" : "❌ Casi..."} 🐱 <b>Dato de Mr. Cat:</b> ${esc(p.dato || "")}</div>
      <div class="fila" style="margin-top:16px"><button class="btn btn-pri" id="sig">${ultima ? "Ver mi resultado" : "Siguiente →"}</button></div>`;
    $("sig").onclick = () => ultima ? mostrarResultado() : mostrarPregunta(i + 1);
  }

  function mostrarResultado() {
    pintarProgreso(-1);
    const aciertos = preguntas.filter((p, i) => estado.respuestas[i] === p.correcta).length;
    const cuadros = preguntas.map((p, i) => estado.respuestas[i] === p.correcta ? "🟩" : "🟥").join("");
    const frases = ["Mr. Cat te recomienda repasar 😿", "¡Vas calentando! 🐾", "Nada mal, aficionado 😼", "¡Muy bien! Sabes de deportes 🔥", "¡Casi perfecto! 😺", "¡PERFECTO! Eres un crack 🏆"];
    const link = MC.urlConMiRef("trivia.html");
    const texto = `🐱 Trivia ${C.marca} #${numero}\n${aciertos}/${preguntas.length} ${cuadros}\n¿Me ganas? ${link}`;
    $("contenido").innerHTML = `
      <div class="resultado">
        <div class="grande">${aciertos}/${preguntas.length}</div>
        <div class="cuadros">${cuadros}</div>
        <p>${frases[Math.round(aciertos / preguntas.length * 5)]}</p>
        <div class="fila">
          <button class="btn btn-wa" id="wa">Retar por WhatsApp</button>
          <button class="btn btn-sec" id="copiar">Copiar resultado</button>
        </div>
        <p style="color:var(--muted);margin-top:18px">Vuelve mañana para una nueva trivia. Mientras, ¿ya llenaste la <a href="quiniela.html">quiniela</a>?</p>
      </div>`;
    $("wa").onclick = () => MC.compartirWhatsApp(texto);
    $("copiar").onclick = async (e) => { try { await navigator.clipboard.writeText(texto); e.target.textContent = "¡Copiado!"; } catch (_) {} };
  }

  const contestadas = estado.respuestas.filter(x => x !== undefined && x !== null).length;
  if (contestadas >= preguntas.length) mostrarResultado();
  else mostrarPregunta(contestadas);
})();
