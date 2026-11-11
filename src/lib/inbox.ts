import { categoriesFor } from './categories.ts';
import { toDateKey } from './dates.ts';
import type { PendingItem, Transaction, TransactionKind } from './types';

/** Recuerda qué categoría eligió el usuario para cada comercio. */
export type MerchantRules = Record<string, string>;

/** "OXXO SUC. 1234 Centro" -> "oxxo suc centro". Así coinciden variantes del mismo comercio. */
export function normalizeMerchant(merchant: string): string {
  return merchant
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fecha local (del teléfono) a partir del instante del correo. */
export function localDateFromIso(iso: string): string {
  return toDateKey(new Date(iso));
}

export function suggestCategory(
  merchant: string | null,
  kind: TransactionKind,
  rules: MerchantRules,
): string {
  const options = categoriesFor(kind);
  if (merchant) {
    const remembered = rules[normalizeMerchant(merchant)];
    if (remembered && options.some((c) => c.id === remembered)) return remembered;
  }
  return options[0].id;
}

export function learnRule(rules: MerchantRules, merchant: string | undefined, categoryId: string): MerchantRules {
  if (!merchant) return rules;
  const key = normalizeMerchant(merchant);
  if (!key || rules[key] === categoryId) return rules;
  return { ...rules, [key]: categoryId };
}

/**
 * Busca un movimiento ya registrado que probablemente sea el mismo pago:
 * mismo tipo, mismo importe, mismo día y (si ambos tienen comercio) mismo comercio.
 */
export function findPossibleDuplicate(
  item: Pick<PendingItem, 'amount' | 'kind' | 'merchant' | 'receivedAt'>,
  transactions: Transaction[],
): Transaction | undefined {
  if (item.amount === null) return undefined;
  const date = localDateFromIso(item.receivedAt);
  const merchant = item.merchant ? normalizeMerchant(item.merchant) : null;
  return transactions.find(
    (t) =>
      t.kind === item.kind &&
      t.amount === item.amount &&
      t.date === date &&
      (!merchant || !t.merchant || normalizeMerchant(t.merchant) === merchant),
  );
}
