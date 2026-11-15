import { ADMIN_COOKIE } from './hire-admin';

export const ADMIN_HOME = '/admin/bookings';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export type AdminRole = 'booking_secretary' | 'accounting' | 'admin';

export type AdminSession = {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
};

export type AdminAccount = AdminSession & {
  passwordHash: string;
  createdAt: string;
};

export function isAdminRole(value: string): value is AdminRole {
  return value === 'booking_secretary' || value === 'accounting' || value === 'admin';
}

export function roleLabel(role: AdminRole): string {
  if (role === 'booking_secretary') return 'Booking secretary';
  if (role === 'accounting') return 'Accounting';
  return 'Admin';
}

export function canManageBookings(role: AdminRole): boolean {
  return role === 'booking_secretary' || role === 'admin';
}

export function canManageAccounts(role: AdminRole): boolean {
  return role === 'admin' || role === 'booking_secretary';
}

export function canEditCharges(role: AdminRole): boolean {
  return role === 'accounting' || role === 'booking_secretary' || role === 'admin';
}

export function isAdminLoginPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, '') === '/admin/login';
}

export function safeAdminNext(path: string): string {
  const pathname = path.split('?')[0]?.split('#')[0] ?? '';
  if (!pathname.startsWith('/admin')) return ADMIN_HOME;
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/admin' || trimmed === '/admin/login') return ADMIN_HOME;
  return trimmed;
}

export async function createAdminCookie(secret: string, session: AdminSession, secure: boolean): Promise<string> {
  const expiry = String(Date.now() + SESSION_MS);
  const body = toBase64Url(JSON.stringify(session));
  const payload = `v2.${expiry}.${body}`;
  const signature = await sign(secret, payload);
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(`${payload}.${signature}`)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearAdminCookie(secure: boolean): string {
  const parts = [`${ADMIN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export async function readAdminSession(
  cookieHeader: string | null | undefined,
  secret: string,
): Promise<AdminSession | null> {
  const token = readCookie(cookieHeader, ADMIN_COOKIE);
  if (!token || !secret) return null;
  const decoded = decodeURIComponent(token);
  const parts = decoded.split('.');
  if (parts[0] !== 'v2' || parts.length < 4) return null;
  const [version, expiry, body, ...signatureParts] = parts;
  const signature = signatureParts.join('.');
  if (!expiry || Number(expiry) < Date.now() || !body) return null;
  const payload = `${version}.${expiry}.${body}`;
  const expected = await sign(secret, payload);
  if (!timingEqual(signature, expected)) return null;
  try {
    const session = JSON.parse(fromBase64Url(body)) as AdminSession;
    if (!session?.id || !isAdminRole(session.role)) return null;
    return session;
  } catch {
    return null;
  }
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function readCookie(header: string | null | undefined, name: string): string {
  if (!header) return '';
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return '';
}

async function sign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingEqual(left: string, right: string): boolean {
  const max = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let index = 0; index < max; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}
