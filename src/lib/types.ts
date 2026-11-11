export type TransactionKind = 'expense' | 'income';

export type Transaction = {
  id: string;
  kind: TransactionKind;
  /** Importe en centavos, siempre positivo. */
  amount: number;
  categoryId: string;
  note: string;
  /** Fecha local en formato YYYY-MM-DD. */
  date: string;
};
