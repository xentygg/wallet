/**
 * Extracción de datos de compra a partir del texto de un correo bancario.
 *
 * Por ahora solo hay un parser heurístico genérico. Los parsers por banco se
 * agregarán con correos reales de ejemplo. Si nada coincide, el correo se
 * guarda igual (con importe vacío) para que el usuario lo revise a mano.
 */

export type ParsedPurchase = {
  /** Importe en centavos, o null si no se encontró. */
  amount: number | null;
  merchant: string | null;
  cardLast4: string | null;
  kind: 'expense' | 'income';
  /** Nombre del parser que produjo el resultado. */
  parser: string;
};

export type EmailInput = {
  from: string;
  subject: string;
  text: string;
};

export type Parser = {
  name: string;
  /** Devuelve null si el correo no es de este parser. */
  parse: (email: EmailInput) => ParsedPurchase | null;
};

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü',
};

/** Convierte HTML a texto plano conservando saltos de línea aproximados. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** "1,234.50" -> 123450 (formato mexicano: coma de miles, punto decimal). */
export function toCents(value: string): number | null {
  const clean = value.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, dec = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(dec.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`;
const MONEY_PATTERNS = [
  new RegExp(String.raw`\$\s*${NUMBER}`, 'g'),
  new RegExp(String.raw`\b(?:MXN|MN)\s*\$?\s*${NUMBER}`, 'g'),
  new RegExp(String.raw`${NUMBER}\s*(?:MXN|M\.\s?N\.|pesos)`, 'gi'),
];
const AMOUNT_KEYWORDS = /monto|importe|cargo|compra|total|cantidad|por\s+\$/i;

function findAmount(text: string): number | null {
  const lines = text.split('\n');
  let fallback: number | null = null;
  for (const line of lines) {
    for (const pattern of MONEY_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      if (!match) continue;
      const cents = toCents(match[1]);
      if (cents === null) continue;
      if (AMOUNT_KEYWORDS.test(line)) return cents;
      fallback ??= cents;
    }
  }
  return fallback;
}

const MERCHANT_PATTERNS = [
  /(?:comercio|establecimiento|negocio|lugar de compra)\s*[:\-]\s*([^\n]{2,60})/i,
  /\ben\s+([A-Z0-9][A-Z0-9 *.&'\-]{2,40}?)(?=\s+(?:por|con|el|a las|\$)|[.,\n]|$)/,
];

function findMerchant(text: string): string | null {
  for (const pattern of MERCHANT_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const merchant = match[1].replace(/\s+/g, ' ').trim();
      if (merchant.length >= 2) return merchant;
    }
  }
  return null;
}

function findLast4(text: string): string | null {
  const match = text.match(/(?:terminaci[oó]n|termina(?:da)? en|\*{2,}|x{2,}|•{2,})\s*(\d{4})\b/i);
  return match ? match[1] : null;
}

const INCOME_WORDS = /dep[oó]sito|abono|recibiste|te enviaron|transferencia recibida|reembolso|devoluci[oó]n/i;

/** Parser genérico: busca importes, comercio y terminación con expresiones comunes. */
export const genericParser: Parser = {
  name: 'generico',
  parse: ({ subject, text }) => {
    const all = `${subject}\n${text}`;
    return {
      amount: findAmount(all),
      merchant: findMerchant(text) ?? findMerchant(subject),
      cardLast4: findLast4(all),
      kind: INCOME_WORDS.test(all) ? 'income' : 'expense',
      parser: 'generico',
    };
  },
};

/** Parsers específicos por banco. Se agregan antes del genérico. */
export const PARSERS: Parser[] = [genericParser];

export function parsePurchase(email: EmailInput): ParsedPurchase {
  for (const parser of PARSERS) {
    const result = parser.parse(email);
    if (result) return result;
  }
  return { amount: null, merchant: null, cardLast4: null, kind: 'expense', parser: 'ninguno' };
}

export type ForwardingConfirmation = { code: string | null; link: string | null };

/** Detecta el correo con que Gmail confirma una dirección de reenvío. */
export function parseForwardingConfirmation(email: EmailInput): ForwardingConfirmation | null {
  const from = email.from.toLowerCase();
  if (!from.includes('forwarding-noreply@google.com')) return null;
  const code = email.subject.match(/#(\d{6,12})/)?.[1] ?? email.text.match(/\b(\d{9})\b/)?.[1] ?? null;
  const link = email.text.match(/https:\/\/mail(?:-settings)?\.google\.com\/[^\s"'<>]+/)?.[0] ?? null;
  return { code, link };
}
