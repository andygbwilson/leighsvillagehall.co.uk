import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import {
  applyBookingPrefill,
  assertCanSendInvite,
  buildHireInvite,
  hireAgreementUrl,
  parseHboBookingEmail,
  parseInviteAllowlist,
} from '../src/lib/booking-email';
import {
  clearAdminCookie,
  createAdminCookie,
  isAdminCookieValid,
  passwordsMatch,
  summariesFromRecords,
} from '../src/lib/hire-admin';
import {
  bookingStorageKey,
  isValidBookingNumber,
  mergeAgreement,
  normaliseHireAgreement,
  parsePayload,
  sortAgreementSummaries,
  validateAgreement,
  type HireAgreementRecord,
} from '../src/lib/hire-agreement';

const storePath = path.join(process.cwd(), '.data', 'hire-agreements.json');
const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

type Store = Record<string, HireAgreementRecord>;

async function readStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(storePath, 'utf8')) as Store;
  } catch {
    return {};
  }
}

async function writeStore(store: Store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

function adminPassword(): string {
  return process.env.HIRE_ADMIN_PASSWORD || 'lvh-admin-dev';
}

export async function loadHireAgreement(bookingNumber: string): Promise<HireAgreementRecord | null> {
  const store = await readStore();
  const record = store[bookingStorageKey(bookingNumber)] ?? null;
  return record ? normaliseHireAgreement(record) : null;
}

export async function saveHireAgreement(body: unknown): Promise<HireAgreementRecord> {
  const payload = parsePayload(body);
  const store = await readStore();
  const key = bookingStorageKey(payload.bookingNumber);
  const record = mergeAgreement(store[key] ?? null, payload);
  const errors = validateAgreement(record);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  store[key] = record;
  await writeStore(store);
  return record;
}

export async function ingestHboBookingEmail(text: string): Promise<HireAgreementRecord> {
  const booking = parseHboBookingEmail(text);
  if (!booking) {
    throw new Error('That email is not a Hall Booking Online provisional booking.');
  }
  const store = await readStore();
  const key = bookingStorageKey(booking.bookingNumber);
  const record = applyBookingPrefill(store[key] ?? null, booking);
  store[key] = record;
  await writeStore(store);
  return record;
}

export async function sendHireInvite(
  bookingNumber: string,
  origin: string,
): Promise<{ record: HireAgreementRecord; delivered: boolean }> {
  const store = await readStore();
  const key = bookingStorageKey(bookingNumber);
  const existing = store[key];
  if (!existing) {
    throw new Error('No hire agreement was found for that booking.');
  }

  const record = normaliseHireAgreement(existing);
  const email = assertCanSendInvite(record, parseInviteAllowlist(process.env.HIRE_INVITE_ALLOWLIST));
  const formUrl = hireAgreementUrl(origin, record.bookingNumber);
  const invite = buildHireInvite(record, formUrl);
  console.log('Hire agreement invite (not delivered in local dev)', {
    to: email,
    subject: invite.subject,
    formUrl,
    text: invite.text,
  });

  const next = {
    ...record,
    inviteSentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store[key] = next;
  await writeStore(store);
  return { record: next, delivered: false };
}

export async function handleAdminDevApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/admin')) return false;

  const send = (status: number, body: unknown, extra: Record<string, string> = {}) => {
    res.statusCode = status;
    for (const [name, value] of Object.entries({ ...jsonHeaders, ...extra })) {
      res.setHeader(name, value);
    }
    res.end(JSON.stringify(body));
  };

  try {
    if (url.pathname === '/api/admin/login' && req.method === 'POST') {
      const body = await readJson(req) as { password?: string };
      if (!passwordsMatch(String(body.password ?? ''), adminPassword())) {
        send(401, { error: 'That password is not correct.' });
        return true;
      }
      send(200, { ok: true }, { 'set-cookie': await createAdminCookie(adminPassword(), false) });
      return true;
    }

    if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
      send(200, { ok: true }, { 'set-cookie': clearAdminCookie(false) });
      return true;
    }

    if (!(await isAdminCookieValid(req.headers.cookie, adminPassword()))) {
      send(401, { error: 'Please sign in.' });
      return true;
    }

    if (url.pathname === '/api/admin/hire-agreements' && req.method === 'GET') {
      const store = await readStore();
      send(200, { agreements: sortAgreementSummaries(summariesFromRecords(Object.values(store))) });
      return true;
    }

    const invite = url.pathname.match(/^\/api\/admin\/hire-agreements\/([^/]+)\/invite$/);
    if (invite) {
      if (req.method !== 'POST') {
        send(405, { error: 'Method not allowed.' });
        return true;
      }
      const bookingNumber = decodeURIComponent(invite[1] ?? '');
      if (!isValidBookingNumber(bookingNumber)) {
        send(400, { error: 'That booking number is not valid.' });
        return true;
      }
      const origin = req.headers.host ? `http://${req.headers.host}` : 'http://localhost:4321';
      const result = await sendHireInvite(bookingNumber, origin);
      send(200, { ok: true, ...result });
      return true;
    }

    const one = url.pathname.match(/^\/api\/admin\/hire-agreements\/([^/]+)$/);
    if (one) {
      const bookingNumber = decodeURIComponent(one[1] ?? '');
      const store = await readStore();
      const key = bookingStorageKey(bookingNumber);
      const existing = store[key];
      if (!existing) {
        send(404, { error: 'No hire agreement was found for that booking.' });
        return true;
      }

      if (req.method === 'GET') {
        send(200, { record: normaliseHireAgreement(existing) });
        return true;
      }

      if (req.method === 'PUT') {
        const payload = parsePayload({ ...(await readJson(req)), bookingNumber });
        const record = mergeAgreement(existing, payload, { markSubmitted: false });
        if (record.status === 'submitted') {
          const errors = validateAgreement(record);
          if (errors.length > 0) {
            send(400, { error: errors[0], errors });
            return true;
          }
        }
        store[key] = record;
        await writeStore(store);
        send(200, { ok: true, record });
        return true;
      }
    }

    send(405, { error: 'Method not allowed.' });
  } catch (error) {
    send(400, {
      error: error instanceof Error ? error.message : 'The request could not be completed.',
    });
  }
  return true;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
