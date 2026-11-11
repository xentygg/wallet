/// <reference types="node" />
// Los correos de estas pruebas son SINTÉTICOS (inventados). Cuando haya
// correos reales de cada banco, se agregarán como pruebas de sus parsers.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { htmlToText, parseForwardingConfirmation, parsePurchase, toCents } from '../src/parse.ts';

test('toCents', () => {
  assert.equal(toCents('1,234.50'), 123450);
  assert.equal(toCents('89'), 8900);
  assert.equal(toCents('0.5'), 50);
  assert.equal(toCents('0'), null);
  assert.equal(toCents('abc'), null);
});

test('htmlToText quita etiquetas y decodifica entidades', () => {
  const text = htmlToText(
    '<html><head><style>p{}</style></head><body><p>Compra&nbsp;en <b>OXXO</b></p><p>Monto: &#36;45.00</p></body></html>',
  );
  assert.equal(text, 'Compra en OXXO\nMonto: $45.00');
});

test('genérico: compra con monto, comercio y terminación', () => {
  const result = parsePurchase({
    from: 'alertas@banco.example',
    subject: 'Notificación de compra',
    text: 'Se realizó una compra con tu tarjeta con terminación 1234.\nComercio: SUPERMERCADO EJEMPLO\nMonto: $1,234.50 MXN',
  });
  assert.deepEqual(result, {
    amount: 123450,
    merchant: 'SUPERMERCADO EJEMPLO',
    cardLast4: '1234',
    kind: 'expense',
    parser: 'generico',
  });
});

test('genérico: comercio después de "en" y monto en el asunto', () => {
  const result = parsePurchase({
    from: 'avisos@banco.example',
    subject: 'Compra por $89.90',
    text: 'Usaste tu tarjeta ****9876 en GASOLINERA CENTRO el 10/11/2026.',
  });
  assert.equal(result.amount, 8990);
  assert.equal(result.merchant, 'GASOLINERA CENTRO');
  assert.equal(result.cardLast4, '9876');
});

test('genérico: prefiere la línea con palabra clave de monto', () => {
  const result = parsePurchase({
    from: 'x@banco.example',
    subject: 'Aviso',
    text: 'Saldo disponible $10,000.00\nImporte del cargo: $250.00',
  });
  assert.equal(result.amount, 25000);
});

test('genérico: detecta ingresos', () => {
  const result = parsePurchase({
    from: 'x@banco.example',
    subject: 'Recibiste una transferencia',
    text: 'Te enviaron $500.00 a tu cuenta.',
  });
  assert.equal(result.kind, 'income');
  assert.equal(result.amount, 50000);
});

test('sin datos reconocibles devuelve importe vacío, no falla', () => {
  const result = parsePurchase({ from: 'x@y.example', subject: 'Hola', text: 'Sin montos aquí.' });
  assert.equal(result.amount, null);
  assert.equal(result.merchant, null);
});

test('confirmación de reenvío de Gmail', () => {
  const confirmation = parseForwardingConfirmation({
    from: 'Gmail Team <forwarding-noreply@google.com>',
    subject: '(#123456789) Confirmación de reenvío de Gmail',
    text: 'Para confirmar visita https://mail-settings.google.com/mail/vf-abc123 y listo.',
  });
  assert.deepEqual(confirmation, {
    code: '123456789',
    link: 'https://mail-settings.google.com/mail/vf-abc123',
  });
  assert.equal(parseForwardingConfirmation({ from: 'otro@x.com', subject: '', text: '' }), null);
});
