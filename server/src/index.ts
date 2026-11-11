import PostalMime from 'postal-mime';

import { htmlToText, parseForwardingConfirmation, parsePurchase } from './parse';

export interface Env {
  DB: D1Database;
  /** Dominio que recibe los correos, p. ej. "tuapp.mx". */
  MAIL_DOMAIN: string;
}

/** Tamaño máximo de correo que se procesa. Los avisos bancarios pesan mucho menos. */
const MAX_EMAIL_BYTES = 2 * 1024 * 1024;
/** Límite de pendientes por usuario, para que nadie llene la base enviando correos. */
const MAX_PENDING_PER_USER = 500;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

function randomString(length: number, alphabet: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

async function sha256(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

type UserRow = { id: string; address: string; forwarding_confirmation: string | null };

async function authenticate(request: Request, env: Env): Promise<UserRow | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token) return null;
  return env.DB.prepare('SELECT id, address, forwarding_confirmation FROM users WHERE token_hash = ?')
    .bind(await sha256(token))
    .first<UserRow>();
}

async function register(env: Env): Promise<Response> {
  const token = randomString(40, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
  // Solo minúsculas y dígitos, sin caracteres confusos (0/o, 1/l).
  const local = randomString(10, 'abcdefghijkmnpqrstuvwxyz23456789');
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO users (id, address, token_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, local, await sha256(token), new Date().toISOString())
    .run();
  return json({ token, address: `${local}@${env.MAIL_DOMAIN}` }, 201);
}

type PendingRow = {
  id: string;
  received_at: string;
  from_addr: string;
  subject: string;
  amount: number | null;
  merchant: string | null;
  card_last4: string | null;
  kind: 'expense' | 'income';
  parser: string;
};

async function inbox(user: UserRow, env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT id, received_at, from_addr, subject, amount, merchant, card_last4, kind, parser
     FROM pending WHERE user_id = ? ORDER BY received_at DESC LIMIT 200`,
  )
    .bind(user.id)
    .all<PendingRow>();
  return json({
    address: `${user.address}@${env.MAIL_DOMAIN}`,
    forwardingConfirmation: user.forwarding_confirmation ? JSON.parse(user.forwarding_confirmation) : null,
    items: results.map((r) => ({
      id: r.id,
      receivedAt: r.received_at,
      from: r.from_addr,
      subject: r.subject,
      amount: r.amount,
      merchant: r.merchant,
      cardLast4: r.card_last4,
      kind: r.kind,
      parser: r.parser,
    })),
  });
}

async function ack(request: Request, user: UserRow, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x): x is string => typeof x === 'string') : [];
  if (ids.length === 0 || ids.length > 200) return json({ error: 'ids inválidos' }, 400);
  const placeholders = ids.map(() => '?').join(',');
  await env.DB.prepare(`DELETE FROM pending WHERE user_id = ? AND id IN (${placeholders})`)
    .bind(user.id, ...ids)
    .run();
  return json({ ok: true });
}

async function handleFetch(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  const { pathname } = new URL(request.url);

  if (request.method === 'POST' && pathname === '/v1/register') return register(env);

  const user = await authenticate(request, env);
  if (pathname.startsWith('/v1/') && !user) return json({ error: 'no autorizado' }, 401);
  if (!user) return json({ error: 'no encontrado' }, 404);

  if (request.method === 'GET' && pathname === '/v1/inbox') return inbox(user, env);
  if (request.method === 'POST' && pathname === '/v1/inbox/ack') return ack(request, user, env);
  if (request.method === 'POST' && pathname === '/v1/forwarding-confirmation/dismiss') {
    await env.DB.prepare('UPDATE users SET forwarding_confirmation = NULL WHERE id = ?').bind(user.id).run();
    return json({ ok: true });
  }
  return json({ error: 'no encontrado' }, 404);
}

async function handleEmail(message: ForwardableEmailMessage, env: Env): Promise<void> {
  // Se usa el destinatario del sobre: en un correo reenviado, el encabezado "To"
  // suele seguir siendo la dirección original del usuario.
  const local = message.to.split('@')[0].toLowerCase();
  const user = await env.DB.prepare('SELECT id FROM users WHERE address = ?').bind(local).first<{ id: string }>();
  if (!user) {
    message.setReject('Dirección desconocida');
    return;
  }
  if (message.rawSize > MAX_EMAIL_BYTES) {
    message.setReject('Correo demasiado grande');
    return;
  }

  const raw = await new Response(message.raw).arrayBuffer();
  const email = await PostalMime.parse(raw);
  const text = email.text?.trim() || htmlToText(email.html ?? '');
  const input = {
    from: email.from?.address ?? message.from,
    subject: (email.subject ?? '').slice(0, 200),
    text,
  };

  const confirmation = parseForwardingConfirmation(input);
  if (confirmation) {
    await env.DB.prepare('UPDATE users SET forwarding_confirmation = ? WHERE id = ?')
      .bind(JSON.stringify({ ...confirmation, receivedAt: new Date().toISOString() }), user.id)
      .run();
    return;
  }

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM pending WHERE user_id = ?')
    .bind(user.id)
    .first<{ n: number }>();
  if ((count?.n ?? 0) >= MAX_PENDING_PER_USER) return;

  const parsed = parsePurchase(input);
  const messageId = email.messageId ?? (await sha256(raw));
  const receivedAt = email.date && !Number.isNaN(Date.parse(email.date)) ? new Date(email.date) : new Date();

  // INSERT OR IGNORE + UNIQUE(user_id, message_id): el mismo correo dos veces se guarda una sola vez.
  await env.DB.prepare(
    `INSERT OR IGNORE INTO pending
       (id, user_id, message_id, received_at, from_addr, subject, amount, merchant, card_last4, kind, parser, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      messageId,
      receivedAt.toISOString(),
      input.from,
      input.subject,
      parsed.amount,
      parsed.merchant,
      parsed.cardLast4,
      parsed.kind,
      parsed.parser,
      new Date().toISOString(),
    )
    .run();
}

export default {
  fetch: (request, env) => handleFetch(request, env),
  email: (message, env) => handleEmail(message, env),
} satisfies ExportedHandler<Env>;
