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

  // Dificultad: se descartan partidos "regalados". Si el favorito paga menos que esto, el partido es muy fácil.
  // (Los momios solo se usan aquí, por dentro; nunca se muestran en la página ni en los videos.)
  momioMinimo: 1.45,
  maxConsultasMomios: 15,       // cuántos partidos revisar por día (cada uno gasta 1 consulta del plan)

  // Ligas en orden de preferencia. Primero se llenan con las de arriba.
  // Cada una se reconoce por su número de API-Football ("id") o por su nombre ("buscar", expresión regular),
  // por si el número cambia. "soloEquipos" = solo partidos donde juegue alguno de esos equipos.
  ligas: [
    { id: 262, nombre: "Liga MX" },
    { id: 10,  nombre: "Amistosos de México", buscar: "^Friendlies$", soloEquipos: ["Mexico"] },
    { id: 536, nombre: "CONCACAF Nations League", buscar: "^CONCACAF Nations League" },
    { id: 2,   nombre: "UEFA Champions League" },
    { id: 39,  nombre: "Premier League" },
    { id: 140, nombre: "LaLiga" },
    { id: 3,   nombre: "UEFA Europa League" },
    { id: 135, nombre: "Serie A" },
    { id: 78,  nombre: "Bundesliga" },
    { id: 61,  nombre: "Ligue 1" },
    { id: 253, nombre: "MLS" },
    // Selecciones (llenan las fechas FIFA, cuando las ligas paran)
    { id: 5,   nombre: "UEFA Nations League", buscar: "^UEFA Nations League$" },
    {          nombre: "Eliminatorias mundialistas", buscar: "^World Cup - Qualification" },
    {          nombre: "Copa Oro", buscar: "^CONCACAF Gold Cup" },
    {          nombre: "Copa América", buscar: "^Copa America$" },
    { id: 10,  nombre: "Amistosos de selecciones grandes", buscar: "^Friendlies$",
      soloEquipos: ["Argentina", "Brazil", "Spain", "France", "England", "Germany", "Portugal", "Italy", "Netherlands",
                    "USA", "Uruguay", "Colombia", "Belgium", "Croatia", "Japan", "Canada"] },
    // Más ligas de clubes
    { id: 13,  nombre: "Copa Libertadores" },
    { id: 848, nombre: "UEFA Conference League" },
    { id: 71,  nombre: "Brasileirão" },
    { id: 128, nombre: "Liga Profesional Argentina" },
    { id: 94,  nombre: "Primeira Liga (Portugal)" },
    { id: 88,  nombre: "Eredivisie (Países Bajos)" },
  ],

  // Nombres de selecciones en español (API-Football los da en inglés)
  selecciones: {
    Mexico: "México", USA: "Estados Unidos", Canada: "Canadá", Spain: "España", France: "Francia", England: "Inglaterra",
    Germany: "Alemania", Brazil: "Brasil", Italy: "Italia", Netherlands: "Países Bajos", Belgium: "Bélgica",
    Croatia: "Croacia", Japan: "Japón", Switzerland: "Suiza", Denmark: "Dinamarca", Sweden: "Suecia", Norway: "Noruega",
    Poland: "Polonia", Scotland: "Escocia", Wales: "Gales", "Czech Republic": "República Checa", Turkey: "Turquía",
    Greece: "Grecia", Austria: "Austria", Hungary: "Hungría", Serbia: "Serbia", Ukraine: "Ucrania", Ireland: "Irlanda",
    "Northern Ireland": "Irlanda del Norte", Iceland: "Islandia", Romania: "Rumania", Morocco: "Marruecos", Egypt: "Egipto",
    "South Korea": "Corea del Sur", "Saudi Arabia": "Arabia Saudita", "Costa Rica": "Costa Rica", Panama: "Panamá",
    Jamaica: "Jamaica", Honduras: "Honduras", "El Salvador": "El Salvador", Guatemala: "Guatemala", Haiti: "Haití",
    "Trinidad and Tobago": "Trinidad y Tobago", Peru: "Perú", Chile: "Chile", Ecuador: "Ecuador", Paraguay: "Paraguay",
    Venezuela: "Venezuela", Bolivia: "Bolivia", Australia: "Australia", "New Zealand": "Nueva Zelanda",
  },
};
