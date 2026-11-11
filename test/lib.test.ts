/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatMonth, shiftDay, shiftMonth } from '../src/lib/dates.ts';
import { formatMoney, parseAmount } from '../src/lib/money.ts';
import { expensesByCategory, groupByDay, inMonth, totals } from '../src/lib/summary.ts';
import type { Transaction } from '../src/lib/types.ts';

let seq = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: String(seq++),
  kind: 'expense',
  amount: 1000,
  categoryId: 'food',
  note: '',
  date: '2026-11-10',
  ...over,
});

test('parseAmount acepta punto, coma y miles', () => {
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('12,50'), 1250);
  assert.equal(parseAmount('1.234,50'), 123450);
  assert.equal(parseAmount('1,234.50'), 123450);
  assert.equal(parseAmount('0.07'), 7);
});

test('parseAmount rechaza entradas inválidas', () => {
  for (const bad of ['', 'abc', '0', '-5', '.5', '1e3']) {
    assert.equal(parseAmount(bad), null, bad);
  }
});

test('formatMoney', () => {
  assert.equal(formatMoney(0), '$0.00');
  assert.equal(formatMoney(123456789), '$1,234,567.89');
  assert.equal(formatMoney(-505), '-$5.05');
});

test('totals e inMonth', () => {
  const list = [
    tx({ kind: 'income', amount: 500000, date: '2026-11-01' }),
    tx({ amount: 12050, date: '2026-11-03' }),
    tx({ amount: 9999, date: '2026-10-31' }),
  ];
  assert.deepEqual(totals(inMonth(list, '2026-11')), {
    income: 500000,
    expense: 12050,
    balance: 487950,
  });
});

test('expensesByCategory ordena y calcula proporción', () => {
  const result = expensesByCategory([
    tx({ amount: 1000, categoryId: 'food' }),
    tx({ amount: 3000, categoryId: 'home' }),
    tx({ kind: 'income', amount: 9000, categoryId: 'salary' }),
  ]);
  assert.deepEqual(result, [
    { categoryId: 'home', amount: 3000, share: 0.75 },
    { categoryId: 'food', amount: 1000, share: 0.25 },
  ]);
});

test('groupByDay pone primero lo más reciente', () => {
  const groups = groupByDay([
    tx({ date: '2026-11-01' }),
    tx({ date: '2026-11-09' }),
    tx({ date: '2026-11-01' }),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.date, g.items.length]),
    [
      ['2026-11-09', 1],
      ['2026-11-01', 2],
    ],
  );
});

test('fechas', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  assert.equal(formatMonth('2026-11'), 'Noviembre 2026');
});
