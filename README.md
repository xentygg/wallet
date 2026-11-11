# Wallet

App móvil de finanzas personales hecha con [Expo](https://expo.dev) (React Native + TypeScript).

## Funciones

- Registrar **gastos** e **ingresos** con importe, categoría, fecha y nota.
- **Balance mensual** (ingresos, gastos y saldo) con navegación entre meses.
- Lista de movimientos agrupada por día; toca uno para editarlo o eliminarlo.
- **Resumen** de gastos por categoría con porcentajes.
- **Movimientos automáticos por correo:** reenvías a la app los avisos de compra de tu banco y aparecen en
  **Por revisar**, con la categoría sugerida según el comercio (aprende de lo que eliges) y aviso de posibles
  duplicados. Solo confirmas con un toque.
- Los movimientos se guardan en el dispositivo (AsyncStorage). El servidor solo guarda temporalmente los
  pendientes de revisar.

## Empezar

Requisitos: Node.js 20 o superior y la app **Expo Go** en tu teléfono (o un emulador).

```bash
npm install
```

```bash
npm start
```

Para los movimientos automáticos, copia `.env.example` a `.env` y apunta `EXPO_PUBLIC_API_URL` al
servidor de correo (ver [`server/README.md`](server/README.md)). Sin eso, la app funciona igual con
registro manual.

Escanea el código QR con Expo Go (Android) o con la cámara (iOS). También puedes pulsar `a` para abrir en Android, `i` para iOS o `w` para el navegador.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` | Inicia el servidor de desarrollo |
| `npm run android` / `npm run ios` / `npm run web` | Abre la app en esa plataforma |
| `npm test` | Pruebas unitarias de la lógica (`test/`) |
| `npm run typecheck` | Comprobación de tipos con TypeScript |

## Estructura

```
src/
  app/                 Pantallas (Expo Router: cada archivo es una ruta)
    (tabs)/index.tsx   Inicio: balance y movimientos del mes
    (tabs)/inbox.tsx   Por revisar: movimientos recibidos por correo
    (tabs)/stats.tsx   Resumen de gastos por categoría
    transaction.tsx    Crear / editar / revisar movimiento (modal)
    setup.tsx          Conectar el correo e instrucciones de reenvío
  components/          Componentes reutilizables
  lib/                 Lógica pura: dinero, fechas, categorías, cálculos
  store/               Estado y persistencia de los movimientos
test/                  Pruebas de la lógica en src/lib
server/                Servidor de correo (Cloudflare Worker), ver server/README.md
```

Los importes se guardan en **centavos** (enteros) para evitar errores de redondeo.

## Próximos pasos sugeridos

- Parsers por banco (BBVA, Banorte, Santander…) a partir de correos reales.
- Presupuestos por categoría con alertas.
- Varias cuentas (efectivo, banco, tarjeta).
- Categorías personalizadas y elección de moneda.
- Exportar a CSV y copia de seguridad.
- Gráficas de evolución mensual.
