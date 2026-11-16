// Ajustes de la quiniela automática. Puedes cambiarlos y volver a correr el instalador.
module.exports = {
  activo: true,                 // false = apagar la quiniela automática (el panel sigue funcionando a mano)
  premio: 300,                  // premio diario en pesos
  premioConCancelado: 200,      // premio si se cancela 1 partido (con 2 o más, la quiniela se anula)
  partidos: 5,                  // partidos por quiniela
  minimoPartidos: 3,            // si hay menos que esto, ese día no se arma quiniela
  minutosCierreAntes: 10,       // la quiniela cierra estos minutos antes del primer partido
  horaArmarManana: 17,          // a partir de esta hora (CDMX) se publica la quiniela del día siguiente
  horaMinimaPartido: 11,        // se prefieren partidos que empiecen desde esta hora (CDMX), para que la gente alcance a jugar
  minutosEntreRevisiones: 20,   // cada cuánto se revisan resultados (cuida el límite del plan gratis)

  // Ligas en orden de preferencia (id de API-Football). Primero se llenan con las de arriba.
  ligas: [
    { id: 262, nombre: "Liga MX" },
    { id: 2,   nombre: "UEFA Champions League" },
    { id: 39,  nombre: "Premier League" },
    { id: 140, nombre: "LaLiga" },
    { id: 3,   nombre: "UEFA Europa League" },
    { id: 135, nombre: "Serie A" },
    { id: 78,  nombre: "Bundesliga" },
    { id: 61,  nombre: "Ligue 1" },
    { id: 253, nombre: "MLS" },
    { id: 13,  nombre: "Copa Libertadores" },
    { id: 848, nombre: "UEFA Conference League" },
    { id: 71,  nombre: "Brasileirão" },
    { id: 128, nombre: "Liga Profesional Argentina" },
    { id: 94,  nombre: "Primeira Liga (Portugal)" },
    { id: 88,  nombre: "Eredivisie (Países Bajos)" },
  ],
};
