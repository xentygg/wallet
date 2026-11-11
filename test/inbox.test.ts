/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { findPossibleDuplicate, learnRule, localDateFromIso, normalizeMerchant, suggestCategory } from '../src/lib/inbox.ts';
import { parseAmount } from '../src/lib/money.ts';
import type { Transaction } from '../src/lib/types.ts';

test('parseAmount acepta símbolo y moneda', () => {
  assert.equal(parseAmount('$1,234.50'), 123450);
  assert.equal(parseAmount('1,234.50 MXN'), 123450);
  assert.equal(parseAmount('MXN 89'), 8900);
  assert.equal(parseAmount('$ 45'), 4500);
  assert.equal(parseAmount('$'), null);
});

test('normalizeMerchant unifica variantes', () => {
  assert.equal(normalizeMerchant('OXXO Suc. 1234  Centro'), 'oxxo suc centro');
  assert.equal(normalizeMerchant('Café Ñandú'), 'cafe nandu');
});

test('suggestCategory recuerda la categoría por comercio', () => {
  let rules = learnRule({}, 'OXXO 123', 'food');
  assert.equal(suggestCategory('oxxo 456', 'expense', rules), 'food');
  assert.equal(suggestCategory('Otro comercio', 'expense', rules), 'food'); // primera categoría de gasto
  rules = learnRule(rules, 'Uber', 'transport');
  assert.equal(suggestCategory('UBER', 'expense', rules), 'transport');
  // Una regla de gasto no aplica a un ingreso.
  assert.equal(suggestCategory('UBER', 'income', rules), 'salary');
});

test('localDateFromIso usa la fecha local del teléfono', () => {
  const iso = new Date(2026, 10, 10, 22, 30).toISOString();
  assert.equal(localDateFromIso(iso), '2026-11-10');
});

test('findPossibleDuplicate', () => {
  const existing: Transaction = {
    id: '1',
    kind: 'expense',
    amount: 4500,
    categoryId: 'food',
    note: '',
    date: '2026-11-10',
    merchant: 'OXXO Centro',
  };
  const receivedAt = new Date(2026, 10, 10, 9, 0).toISOString();
  const item = { amount: 4500, kind: 'expense' as const, merchant: 'OXXO CENTRO', receivedAt };
  assert.equal(findPossibleDuplicate(item, [existing]), existing);
  assert.equal(findPossibleDuplicate({ ...item, merchant: 'Otro' }, [existing]), undefined);
  assert.equal(findPossibleDuplicate({ ...item, amount: 4600 }, [existing]), undefined);
  // Un movimiento manual sin comercio también cuenta como posible duplicado.
  assert.equal(findPossibleDuplicate(item, [{ ...existing, merchant: undefined }])?.id, '1');
  assert.equal(findPossibleDuplicate({ ...item, amount: null }, [existing]), undefined);
});
