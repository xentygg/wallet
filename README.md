# Tips Fútbol Live

Pantalla para lives de TikTok: el chat pide partidos y el bot muestra probabilidades calculadas con datos (1X2, más de 1.5/2.5 goles, ambos marcan, marcadores más probables, racha y "cuota justa"). Los regalos pasan el pedido al frente de la cola, con animación.

## Comandos del chat

- `!p real madrid` → próximo partido de ese equipo
- `!p arsenal vs liverpool` → ese cruce, aunque no esté programado
- Manda un regalo después de pedir → tu análisis sale de inmediato

Si nadie pide nada, la pantalla rota sola por los partidos de la jornada.

## Uso

```bash
npm install
```

Probar con chat y regalos simulados:

```bash
npm run demo
```

En vivo (tienes que estar transmitiendo):

```bash
npm start -- @tuusuario
```

Abre `http://localhost:3000` o agrégalo en **OBS / TikTok LIVE Studio** como fuente *Navegador* de **1080×1920**.

Para probar a mano sin estar en vivo: `http://localhost:3000/test?u=pepe&msg=!p barca` y `http://localhost:3000/test?u=pepe&gift=Rosa`.

## Datos reales

Sin configurar nada usa **datos de ejemplo** (resultados inventados, y la pantalla lo indica). Para usar datos reales, crea una clave gratis en [football-data.org](https://www.football-data.org/client/register):

```bash
FOOTBALL_DATA_KEY=tu_clave LEAGUES=PD,PL,CL npm start -- @tuusuario
```

Códigos: `PD` LaLiga, `PL` Premier, `SA` Serie A, `BL1` Bundesliga, `FL1` Ligue 1, `CL` Champions. El plan gratis no incluye Liga MX.

## Cómo se calculan las probabilidades

Con los resultados del último año se calcula para cada equipo su fuerza de ataque y de defensa, como local y como visitante (ajustada hacia el promedio de la liga cuando hay pocos partidos). De ahí salen los goles esperados de cada lado, y con una distribución de Poisson la probabilidad de cada marcador. La **cuota justa** es `1 / probabilidad`: si una casa paga más que eso, el modelo ve valor.

Es un modelo simple: no sabe de lesiones, rotaciones ni motivación. Úsalo como dato, no como garantía.
