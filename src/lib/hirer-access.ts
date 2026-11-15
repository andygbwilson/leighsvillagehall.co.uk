import { readCookie } from './admin-auth';
import {
  bookingStatusLabel,
  formatDay,
  formatTimeRange,
  hallsLabel,
  type HallBooking,
  type HallRoom,
} from './bookings';
import { hireAgreementUrl } from './booking-email';

export const HIRER_COOKIE = 'lvh_hirer';
export const ACCESS_LINK_MS = 24 * 60 * 60 * 1000;
export const HIRER_SESSION_MS = 12 * 60 * 60 * 1000;
export const ACCESS_COOLDOWN_MS = 10 * 60 * 1000;
export const ACCESS_REPLY =
  'If we have bookings for that address, we have emailed a link. It works for 24 hours. Check your spam folder if it does not arrive.';

export type HirerBookingView = {
  id: number;
  hireDate: string;
  dayLabel: string;
  timeFrom: string;
  timeTo: string;
  when: string;
  halls: string;
  event: string;
  status: HallBooking['status'];
  statusLabel: string;
  isOccurrence: boolean;
  isRecurring: boolean;
  agreementUrl: string | null;
};

export function hirerAccessUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/bookings/mine?token=${encodeURIComponent(token)}`;
}

export async function createHirerLink(secret: string, email: string): Promise<string> {
  return signHirerPayload(secret, email.trim().toLowerCase(), Date.now() + ACCESS_LINK_MS);
}

export async function readHirerLink(secret: string, token: string): Promise<string | null> {
  return readHirerPayload(secret, token);
}

export async function createHirerCookie(secret: string, email: string, secure: boolean): Promise<string> {
  const token = await signHirerPayload(secret, email.trim().toLowerCase(), Date.now() + HIRER_SESSION_MS);
  const parts = [
    `${HIRER_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(HIRER_SESSION_MS / 1000)}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearHirerCookie(secure: boolean): string {
  const parts = [`${HIRER_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export async function readHirerSession(cookieHeader: string | null | undefined, secret: string): Promise<string | null> {
  const token = readCookie(cookieHeader, HIRER_COOKIE);
  if (!token) return null;
  return readHirerPayload(secret, decodeURIComponent(token));
}

export function splitHirerBookings(
  bookings: HallBooking[],
  rooms: HallRoom[],
  origin: string,
): { upcoming: HirerBookingView[]; past: HirerBookingView[] } {
  const today = londonToday();
  const upcoming: HirerBookingView[] = [];
  const past: HirerBookingView[] = [];
  for (const booking of bookings) {
    const view = toHirerBookingView(booking, rooms, origin);
    if (booking.hireDate >= today) upcoming.push(view);
    else past.push(view);
  }
  past.reverse();
  return { upcoming, past };
}

export function hirerDisplayName(bookings: HallBooking[]): string {
  for (let index = bookings.length - 1; index >= 0; index -= 1) {
    const name = bookings[index]?.hirerName.trim();
    if (name) return name;
  }
  return '';
}

function toHirerBookingView(booking: HallBooking, rooms: HallRoom[], origin: string): HirerBookingView {
  const canOpenAgreement =
    !booking.isOccurrence && (booking.status === 'invite_sent' || booking.status === 'agreed');
  return {
    id: booking.id,
    hireDate: booking.hireDate,
    dayLabel: formatDay(booking.hireDate),
    timeFrom: booking.timeFrom,
    timeTo: booking.timeTo,
    when: [formatDay(booking.hireDate), formatTimeRange(booking.timeFrom, booking.timeTo)].filter(Boolean).join(', '),
    halls: hallsLabel(booking, rooms),
    event: booking.functionType || 'Not specified',
    status: booking.status,
    statusLabel: bookingStatusLabel(booking.status),
    isOccurrence: booking.isOccurrence,
    isRecurring: booking.isRecurring,
    agreementUrl: canOpenAgreement ? hireAgreementUrl(origin, String(booking.id)) : null,
  };
}

function londonToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

async function signHirerPayload(secret: string, email: string, expiry: number): Promise<string> {
  const body = toBase64Url(email);
  const payload = `v1.${expiry}.${body}`;
  const signature = await sign(secret, payload);
  return `${payload}.${signature}`;
}

async function readHirerPayload(secret: string, token: string): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts[0] !== 'v1' || parts.length < 4) return null;
  const [version, expiry, body, ...signatureParts] = parts;
  const signature = signatureParts.join('.');
  if (!expiry || Number(expiry) < Date.now() || !body) return null;
  const payload = `${version}.${expiry}.${body}`;
  const expected = await sign(secret, payload);
  if (!timingEqual(signature, expected)) return null;
  try {
    const email = fromBase64Url(body).trim().toLowerCase();
    return email.includes('@') ? email : null;
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
