# Servidor de correo (wallet-correo)

Cloudflare Worker que recibe los avisos de compra que los usuarios reenvían desde su correo, extrae
importe, comercio, fecha y terminación de tarjeta, y los guarda como **pendientes** hasta que la app
los descarga y el usuario los confirma.

- No guarda el cuerpo del correo: solo los campos extraídos, el remitente y el asunto.
- El pendiente se borra en cuanto la app lo confirma o lo descarta.
- Las claves de acceso se guardan solo como hash SHA-256.
- Un mismo correo recibido dos veces (mismo `Message-ID`) se guarda una sola vez.

## Cómo funciona

```
Banco → correo del usuario → filtro de reenvío → abc123@tudominio.mx
  → Cloudflare Email Routing (catch-all) → este Worker → D1 (pendientes)
  → la app consulta /v1/inbox → el usuario confirma → /v1/inbox/ack lo borra
```

### API

| Método y ruta | Descripción |
| --- | --- |
| `POST /v1/register` | Crea un usuario. Devuelve `{ token, address }`. |
| `GET /v1/inbox` | Pendientes, dirección y código de confirmación de Gmail (si llegó). Requiere `Authorization: Bearer <token>`. |
| `POST /v1/inbox/ack` | `{ ids: [...] }` borra esos pendientes. |
| `POST /v1/forwarding-confirmation/dismiss` | Oculta el código de confirmación de Gmail. |

### Lectura de correos

`src/parse.ts` tiene un parser **genérico** (busca `$1,234.50`, «Comercio:», «terminación 1234»…).
Los parsers específicos por banco se agregan a `PARSERS` con correos reales de ejemplo. Si un correo
no se reconoce, igual aparece en la app con el importe vacío para completarlo a mano.

## Desarrollo local

```bash
npm install
```

```bash
npm run db:migrate:local
```

```bash
npm run dev
```

En otra terminal, la prueba de humo (registra un usuario, envía correos sintéticos y revisa la bandeja):

```bash
bash scripts/smoke.sh
```

Otras comprobaciones:

```bash
npm test
```

```bash
npm run typecheck
```

Para que la app use el servidor local, crea `.env` en la raíz del proyecto con
`EXPO_PUBLIC_API_URL=http://<ip-de-tu-computadora>:8787` (en el teléfono, `127.0.0.1` es el propio
teléfono) y arranca el servidor con `npx wrangler dev --ip 0.0.0.0`.

## Publicar en Cloudflare

Necesitas una cuenta de Cloudflare (gratis) y un dominio administrado en Cloudflare.

1. Inicia sesión:
   ```bash
   npx wrangler login
   ```
2. Crea la base de datos y copia el `database_id` que muestra en `wrangler.jsonc`:
   ```bash
   npx wrangler d1 create wallet-correo
   ```
3. En `wrangler.jsonc`, cambia `MAIL_DOMAIN` por tu dominio.
4. Aplica las migraciones y publica:
   ```bash
   npm run db:migrate
   ```
   ```bash
   npm run deploy
   ```
5. En el panel de Cloudflare → tu dominio → **Email** → **Email Routing**: actívalo, y en
   **Routing rules** activa **Catch-all** con la acción **Send to a Worker** → `wallet-correo`.
6. En la raíz de la app, pon la URL del Worker en `.env`:
   `EXPO_PUBLIC_API_URL=https://wallet-correo.<tu-subdominio>.workers.dev`.

Después, configura el reenvío desde tu correo (la app muestra los pasos) y reenvía un aviso real.

## Pendiente / limitaciones conocidas

- Sin parsers por banco todavía: faltan correos reales de ejemplo.
- `POST /v1/register` no tiene límite de peticiones; conviene añadir uno (p. ej. reglas de Cloudflare) antes de abrirlo al público.
- Los pendientes que nadie confirma no caducan; falta una tarea programada que borre los antiguos.
- Si el usuario pierde el teléfono, pierde la clave y debe crear una dirección nueva.
- No se ha probado todavía con correo real: solo con correos sintéticos en el entorno local.
