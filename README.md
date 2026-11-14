# Don Gato 😎

Página de comunidad deportiva para acompañar la cuenta de TikTok de Don Gato. Usa la misma mascota, colores (negro y amarillo), letra (TikTok Sans), frases y preguntas que los videos del proyecto `claudetrivia`:

- **Trivia diaria** (`trivia.html`): 5 preguntas al día, iguales para todos. El resultado se comparte por WhatsApp con cuadritos 🟩🟥 y un enlace personal.
- **Quiniela gratis** (`quiniela.html`): el aficionado elige L/E/V y su quiniela llega a tu WhatsApp. Incluye tabla general.
- **Inicio** (`index.html`): enlaces a TikTok y al canal de WhatsApp, sección de registro a la plataforma de afiliado (con aviso +18) y enlace personal para invitar amigos.

Es una página estática: no necesita servidor ni base de datos.

## Qué editar

| Archivo | Para qué |
|---|---|
| `js/config.js` | Nombre de marca, TikTok, canal de WhatsApp, tu número, enlace de afiliado. **Empieza aquí.** |
| `data/quiniela.js` | Partidos de la jornada, fecha de cierre, premio y tabla general. Cámbialo cada semana. |
| `data/preguntas.js` y `data/frases.js` | Se generan solos desde el proyecto de TikTok (ver abajo). No los edites a mano. |

## Flujo semanal sugerido

1. Lunes: actualiza `data/quiniela.js` con la nueva jornada y súbelo.
2. Publica en TikTok: “¿Quién gana? Llena la quiniela gratis, link en mi perfil”.
3. Las quinielas te llegan por WhatsApp; al terminar la jornada cuenta aciertos y actualiza `TABLA`.
4. Publica la tabla en TikTok y en el canal: eso trae a más participantes.
5. Cuando agregues trivias nuevas al proyecto de TikTok, actualiza la página (ver abajo).

## Traer las trivias y frases del proyecto de TikTok

Las preguntas de la trivia y las frases de Don Gato salen de `claudetrivia` (carpeta `trivias/` y `personalidad.py`).
Se importan los formatos `trivia`, `pregunta_del_dia`, `verdadero_falso` y `quien_tiene_mas`.

```bash
pip install pyyaml
python3 tools/importar_trivias.py ../claudetrivia
```

Las imágenes de `img/` y la fuente de `fonts/` (licencia OFL) también vienen de ese proyecto.

## Publicarla gratis

- **GitHub Pages:** en el repositorio, ve a *Settings → Pages* y elige la rama. Quedará en `https://TU_USUARIO.github.io/wallet/`.
- **Netlify o Vercel:** conecta el repositorio; no hace falta configurar compilación.

Pon ese enlace en la biografía de TikTok.

## Antes de activar el registro

- Confirma por escrito que tu programa de afiliados **permite dar compensación por registro** (muchos lo prohíben).
- Si es una casa de apuestas, debe tener **permiso de SEGOB** para operar en México.
- Mantén el aviso +18 y la regla de una cuenta por persona.
