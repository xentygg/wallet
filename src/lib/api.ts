import type { PendingItem } from './types';

/** URL del servidor de correo. Se define en `.env` con EXPO_PUBLIC_API_URL. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export type Connection = { token: string; address: string };

export type ForwardingConfirmation = { code: string | null; link: string | null; receivedAt: string };

export type InboxResponse = {
  address: string;
  forwardingConfirmation: ForwardingConfirmation | null;
  items: PendingItem[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  if (!API_URL) throw new ApiError('El servidor no está configurado (EXPO_PUBLIC_API_URL).', 0);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new ApiError(`Error del servidor (${response.status})`, response.status);
  return (await response.json()) as T;
}

export const api = {
  register: () => request<Connection>('/v1/register', { method: 'POST' }),
  inbox: (token: string) => request<InboxResponse>('/v1/inbox', {}, token),
  ack: (token: string, ids: string[]) =>
    request<{ ok: true }>('/v1/inbox/ack', { method: 'POST', body: JSON.stringify({ ids }) }, token),
  dismissConfirmation: (token: string) =>
    request<{ ok: true }>('/v1/forwarding-confirmation/dismiss', { method: 'POST' }, token),
};
