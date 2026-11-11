import type { Transaction } from './types';

export type Totals = { income: number; expense: number; balance: number };

export function totals(transactions: Transaction[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of transactions) {
    if (t.kind === 'income') income += t.amount;
    else expense += t.amount;
  }
  return { income, expense, balance: income - expense };
}

export function inMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => t.date.startsWith(`${month}-`));
}

export type CategoryTotal = { categoryId: string; amount: number; share: number };

/** Gastos agrupados por categoría, de mayor a menor. `share` va de 0 a 1. */
export function expensesByCategory(transactions: Transaction[]): CategoryTotal[] {
  const sums = new Map<string, number>();
  let total = 0;
  for (const t of transactions) {
    if (t.kind !== 'expense') continue;
    sums.set(t.categoryId, (sums.get(t.categoryId) ?? 0) + t.amount);
    total += t.amount;
  }
  return [...sums.entries()]
    .map(([categoryId, amount]) => ({ categoryId, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

export type DayGroup = { date: string; items: Transaction[] };

/** Agrupa por día, con los días más recientes primero. */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = groups.get(t.date);
    if (list) list.push(t);
    else groups.set(t.date, [t]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, items]) => ({ date, items }));
}
