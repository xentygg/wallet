# Don Gato 😎 — quinieladongato.com

Página de comunidad deportiva de Don Gato (TikTok @mrcatstudio):

- **Quiniela diaria con premio** (`/quiniela`): 5 partidos al día. Quien le atine a todos gana el premio del día (normalmente $300). Si hay varios ganadores, se reparte; si no hay, no se acumula. Una quiniela por persona al día.
- **Cuentas y perfil** (`/entrar`, `/perfil`): registro con celular y contraseña. El perfil muestra racha, historial, aciertos, premios, trivia e invitados.
- **Trivia diaria** (`/trivia`): 5 preguntas al día, las mismas para todos, con las frases de Don Gato.
- **Panel del administrador** (`/admin`): publicar la quiniela del día, meter resultados (califica sola), ver ganadores, alertas de posibles trampas, anular, bloquear y marcar premios como pagados.
- **Bases** (`/bases`) y **aviso de privacidad** (`/privacidad`).

## Estructura

| Carpeta | Qué hay |
|---|---|
| `public/` | Las páginas que ve la gente (HTML, CSS, JS, imágenes, fuente). |
| `public/js/config.js` | Nombre, TikTok, WhatsApp, grupo y textos. **Lo que más vas a editar.** |
| `server/` | El servidor (Node 22, sin dependencias externas) y la base de datos SQLite. |
| `deploy/instalar.sh` | Instalador para el servidor de DigitalOcean. |
| `tools/importar_trivias.py` | Copia las trivias y frases del proyecto de TikTok (`claudetrivia`). |

## Instalar o actualizar en el servidor

En la consola del servidor (DigitalOcean → Droplet → **Console**), como root:

```bash
curl -fsSL https://raw.githubusercontent.com/xentygg/wallet/claude/crear-algo-ganar-dinero-njrn13/deploy/instalar.sh | bash
```

La primera vez muestra la **contraseña del panel**: guárdala. Para actualizar la página después de un cambio, corre el mismo comando. La base de datos y la contraseña se conservan.

- La base de datos está en `/var/lib/dongato/dongato.db` y se respalda cada día en `/var/lib/dongato/respaldos/` (se guardan 30 días).
- Ver errores: `journalctl -u dongato -n 50`

## Quiniela automática (API-Football)

Con la clave de API-Football en el servidor, la página trabaja sola:

- A partir de las 17:00 (CDMX) publica la quiniela del día siguiente: 5 partidos, primero Liga MX y luego las demás ligas en orden (`server/ajustes-automatico.js`). Prefiere partidos desde las 11:00 y cierra 10 minutos antes del primero.
- Revisa resultados cada 20 minutos después del cierre y califica sola. Cuenta el marcador a los 90 minutos; los suspendidos o cancelados cuentan como acierto para todos.
- Todo queda anotado en la sección **Automático** del panel, incluidos los ganadores.
- Si un día ya publicaste una quiniela a mano, no la reemplaza.

Guardar la clave (en la consola del servidor; la clave no se ve al pegarla):

```bash
read -s -p "Pega tu clave de API-Football y presiona Enter: " K; echo; sed -i '/^API_FOOTBALL_KEY=/d' /etc/dongato.env; echo "API_FOOTBALL_KEY=$K" >> /etc/dongato.env; systemctl restart dongato; echo "Clave guardada."
```

## Rutina diaria

1. Con la quiniela automática no hace falta publicar nada. Si está apagada: entra a `/admin` y publica la quiniela del día (5 partidos y la hora de cierre, antes del primer partido).
2. Anúnciala en TikTok: "Atínale a los 5 y gánate $300, gratis".
3. Los resultados se meten solos (automático) o a mano en el panel después del cierre. Se califica sola.
4. Si hay ganador: revisa las alertas, pídele su INE por WhatsApp (botón "Avisarle"), paga y marca "Pagado".

## Probar en tu computadora

```bash
ADMIN_PASSWORD=unaclavelarga123 node server/server.js
# abre http://127.0.0.1:3000
```

## Traer trivias nuevas del proyecto de TikTok

```bash
pip install pyyaml
python3 tools/importar_trivias.py ../claudetrivia
```

## Pendientes legales

- Cambiar `responsable` en `public/js/config.js` por el nombre real de quien responde por los datos (aviso de privacidad).
- Consultar con un abogado o contador si el concurso con premios necesita permiso de la SEGOB.
- No mencionar casinos ni apuestas en TikTok: la quiniela es gratis y no exige registrarse en ninguna otra plataforma.
