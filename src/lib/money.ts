/** Convierte texto como "1.234,50", "1234.5" o "12" a centavos. Devuelve null si no es válido. */
export function parseAmount(input: string): number | null {
  // Acepta símbolo y moneda: "$1,234.50", "1234.50 MXN", "MN 89".
  const text = input
    .trim()
    .replace(/^(?:MXN|MN)\s*|\s*(?:MXN|M\.?N\.?)$/i, '')
    .replace(/^\$/, '')
    .replace(/\s/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;

  // El último separador seguido de 1-2 dígitos es el decimal; el resto son miles.
  const match = text.match(/^(.*?)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const whole = match[1].replace(/[.,]/g, '');
  if (!/^\d+$/.test(whole)) return null;
  const decimals = (match[2] ?? '').padEnd(2, '0');

  const cents = Number(whole) * 100 + Number(decimals);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

/** Formatea centavos como "$1,234.50". */
export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = (abs % 100).toString().padStart(2, '0');
  return `${sign}$${whole}.${decimals}`;
}
