// Banco de preguntas para la Trivia Diaria.
// Cada día se eligen 5 automáticamente. Agrega todas las que quieras con el mismo formato.
// "correcta" es el índice de la opción correcta (0 = primera opción).
window.PREGUNTAS = [
  { p: "¿Qué país ganó el primer Mundial de fútbol, en 1930?", o: ["Brasil", "Uruguay", "Argentina", "Italia"], correcta: 1, dato: "Uruguay fue anfitrión y campeón, venciendo 4-2 a Argentina en la final." },
  { p: "¿Qué estadio fue sede de las finales de los Mundiales de 1970 y 1986?", o: ["Estadio Jalisco", "Estadio Azteca", "Estadio Universitario", "Estadio Cuauhtémoc"], correcta: 1, dato: "El Azteca es el único estadio con dos finales mundialistas... ¡miau!" },
  { p: "¿Quién es el máximo goleador histórico de la Selección Mexicana?", o: ["Jared Borgetti", "Hugo Sánchez", "Javier 'Chicharito' Hernández", "Cuauhtémoc Blanco"], correcta: 2, dato: "Chicharito superó a Borgetti y llegó a 52 goles con el Tri." },
  { p: "¿En qué Juegos Olímpicos ganó México la medalla de oro en fútbol varonil?", o: ["Atenas 2004", "Pekín 2008", "Londres 2012", "Río 2016"], correcta: 2, dato: "México venció 2-1 a Brasil en la final en Wembley." },
  { p: "¿En qué año México fue campeón del Mundial Sub-17 por primera vez?", o: ["1999", "2005", "2011", "2013"], correcta: 1, dato: "Fue en Perú 2005, con figuras como Carlos Vela y Giovani dos Santos." },
  { p: "¿En qué club europeo brilló Hugo Sánchez ganando varios trofeos de goleo (Pichichi)?", o: ["Barcelona", "Atlético de Madrid", "Real Madrid", "Valencia"], correcta: 2, dato: "Hugo es famoso por sus goles de chilena y su voltereta para festejar." },
  { p: "¿Qué equipo de la Liga MX es conocido como 'Los Tuzos'?", o: ["Pachuca", "Santos", "Toluca", "Necaxa"], correcta: 0, dato: "El apodo viene de un roedor típico de Hidalgo y de los mineros de la región." },
  { p: "¿A qué equipo le dicen 'La Máquina'?", o: ["Pumas", "Cruz Azul", "Monterrey", "Atlas"], correcta: 1, dato: "El apodo nació en los años 70 por su juego arrollador." },
  { p: "¿Con qué equipo de la MLB nació la 'Fernandomanía' de Fernando Valenzuela?", o: ["Yankees", "Padres", "Dodgers", "Astros"], correcta: 2, dato: "En 1981 ganó el Novato del Año y el Cy Young en la misma temporada." },
  { p: "¿En qué deporte es leyenda Julio César Chávez?", o: ["Lucha libre", "Boxeo", "Atletismo", "Béisbol"], correcta: 1, dato: "'El César del Boxeo' estuvo cerca de 90 peleas invicto." },
  { p: "¿Cuántos puntos vale un touchdown en la NFL (sin contar el punto extra)?", o: ["3", "5", "6", "7"], correcta: 2, dato: "Después del TD se intenta el punto extra (1) o la conversión de dos puntos." },
  { p: "¿Qué equipo ganó el Super Bowl LIX en febrero de 2025?", o: ["Kansas City Chiefs", "Philadelphia Eagles", "San Francisco 49ers", "Buffalo Bills"], correcta: 1, dato: "Los Eagles vencieron 40-22 a los Chiefs en Nueva Orleans." },
  { p: "¿Para qué escudería de F1 corrió Sergio 'Checo' Pérez de 2021 a 2024?", o: ["Ferrari", "Mercedes", "Red Bull Racing", "McLaren"], correcta: 2, dato: "Con Red Bull, Checo ganó carreras como el GP de Mónaco 2022." },
  { p: "¿Cuántos minutos dura un partido de la NBA (tiempo reglamentario)?", o: ["40", "44", "48", "60"], correcta: 2, dato: "Son 4 cuartos de 12 minutos. En la FIBA son cuartos de 10." },
  { p: "¿En qué deporte fue número 1 del mundo Lorena Ochoa?", o: ["Tenis", "Golf", "Natación", "Clavados"], correcta: 1, dato: "Fue número 1 del ranking mundial femenino de golf durante 158 semanas seguidas." },
  { p: "¿En qué prueba fue campeona mundial Ana Gabriela Guevara?", o: ["100 metros", "400 metros", "Maratón", "Salto de longitud"], correcta: 1, dato: "Ganó el oro en 400 m en el Mundial de París 2003." },
  { p: "¿Cuántos Mundiales ha albergado México, contando el de 2026?", o: ["1", "2", "3", "4"], correcta: 2, dato: "1970, 1986 y 2026. ¡Ningún país lo había hecho tres veces!" },
  { p: "¿En qué club europeo jugó Rafael Márquez y ganó la Champions League?", o: ["Barcelona", "Mónaco", "Real Madrid", "Milan"], correcta: 0, dato: "Rafa ganó dos Champions con el Barça (2006 y 2009)." },
  { p: "¿Cuántos jugadores por equipo hay en la cancha en un partido de fútbol?", o: ["9", "10", "11", "12"], correcta: 2, dato: "Si un equipo queda con menos de 7, el partido se suspende." },
  { p: "¿Qué boxeador mexicano es conocido como 'Canelo'?", o: ["Saúl Álvarez", "Juan Manuel Márquez", "Érik Morales", "Marco Antonio Barrera"], correcta: 0, dato: "Le dicen así por su cabello pelirrojo... ¡como un gato naranja! 🐱" },
  { p: "¿Cuántas bases hay en un campo de béisbol, contando el home?", o: ["3", "4", "5", "6"], correcta: 1, dato: "Primera, segunda, tercera y el home plate." },
  { p: "¿Cuántos sets necesita ganar un tenista en un Grand Slam varonil?", o: ["2", "3", "4", "5"], correcta: 1, dato: "Se juega al mejor de 5 sets; en la rama femenil al mejor de 3." }
];
