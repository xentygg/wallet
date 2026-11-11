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
  /** Comercio detectado en el aviso del banco (si vino por correo). */
  merchant?: string;
  /** De dónde salió el movimiento. Si falta, es manual. */
  source?: 'manual' | 'email';
};

/** Movimiento recibido por correo que el usuario todavía no ha revisado. */
export type PendingItem = {
  id: string;
  /** Fecha y hora ISO (UTC) del correo. */
  receivedAt: string;
  from: string;
  subject: string;
  /** Centavos, o null si no se pudo leer el importe. */
  amount: number | null;
  merchant: string | null;
  cardLast4: string | null;
  kind: TransactionKind;
  parser: string;
};
