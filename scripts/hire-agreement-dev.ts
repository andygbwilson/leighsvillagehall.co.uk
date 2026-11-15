import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import {
  applyBookingPrefill,
  assertCanSendInvite,
  buildHireInvite,
  buildStaffBookingNotice,
  hireAdminAgreementUrl,
  hireAgreementUrl,
  parseHboBookingEmail,
  parseInviteAllowlist,
} from '../src/lib/booking-email';
import { handleBookingApi } from '../src/lib/booking-api';
import { DEV_TURNSTILE_SECRET } from '../src/lib/turnstile';
import { applyEmailTemplate, bookingTemplateVars } from '../src/lib/bookings';
import { createBookingStore } from '../src/lib/booking-store';
import { summariesFromRecords } from '../src/lib/hire-admin';
import { readAdminSession } from '../src/lib/admin-auth';
import {
  bookingStorageKey,
  isValidBookingNumber,
  mergeAgreement,
  normaliseHireAgreement,
  omitPublicLockedFields,
  parsePayload,
  sortAgreementSummaries,
  validateAgreement,
  type HireAgreementRecord,
} from '../src/lib/hire-agreement';

const storePath = path.join(process.cwd(), '.data', 'hire-agreements.json');
const bookingSystemPath = path.join(process.cwd(), '.data', 'booking-system.json');
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
  const payload = omitPublicLockedFields(parsePayload(body));
  const store = await readStore();
  const key = bookingStorageKey(payload.bookingNumber);
  const record = mergeAgreement(store[key] ?? null, payload);
  const errors = validateAgreement(record);
  if (errors.length > 0) {
    throw new Error(errors[0]);
  }
  store[key] = record;
  await writeStore(store);
  const bookingId = Number(record.bookingNumber);
  if (Number.isFinite(bookingId)) {
    const bookings = localBookingStore();
    const event = await bookings.getEvent(bookingId);
    if (event) await bookings.updateEvent(bookingId, { status: 'agreed' });
  }
  return record;
}

export async function ingestHboBookingEmail(text: string): Promise<HireAgreementRecord> {
  const booking = parseHboBookingEmail(text);
  if (!booking) {
    throw new Error('That email is not a Hall Booking Online provisional booking.');
  }
  const store = await readStore();
  const key = bookingStorageKey(booking.bookingNumber);
  const isNew = !store[key];
  const record = applyBookingPrefill(store[key] ?? null, booking);
  store[key] = record;
  await writeStore(store);
  if (isNew) {
    const origin = process.env.SITE_ORIGIN || 'http://localhost:4321';
    const to = process.env.BOOKINGS_FORWARD_TO || 'leighsvillagehall@gmail.com';
    const adminUrl = hireAdminAgreementUrl(origin, record.bookingNumber);
    const notice = buildStaffBookingNotice(record, adminUrl);
    console.log('Staff booking notice (not delivered in local dev)', {
      to,
      subject: notice.subject,
      adminUrl,
      text: notice.text,
    });
  }
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
  const bookings = localBookingStore();
  const bookingId = Number(record.bookingNumber);
  const event = Number.isFinite(bookingId) ? await bookings.getEvent(bookingId) : null;
  if (event?.isRecurring && !event.recurringConfirmed) {
    throw new Error(
      'Confirm that this recurring booking is possible on the booking request page before sending the hire agreement.',
    );
  }
  const email = assertCanSendInvite(record, parseInviteAllowlist(process.env.HIRE_INVITE_ALLOWLIST));
  const formUrl = hireAgreementUrl(origin, record.bookingNumber);
  let invite = buildHireInvite(record, formUrl);
  try {
    const template = await bookings.getTemplate('hire_invite');
    invite = applyEmailTemplate(
      template,
      event
        ? bookingTemplateVars(event, { formUrl, adminUrl: '' })
        : {
            bookingNumber: record.bookingNumber,
            hirerName: record.hirerName || 'there',
            email: record.email,
            when: [record.hireDate, record.timeFrom, record.timeTo].filter(Boolean).join(', '),
            halls: '',
            event: record.functionType || 'your event',
            recurring: 'No',
            formUrl,
            adminUrl: '',
          },
    );
  } catch {
    // Keep the built-in invite copy if a template has not been stored yet.
  }
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
  if (event) await bookings.updateEvent(bookingId, { status: 'invite_sent' });
  return { record: next, delivered: false };
}

function localBookingStore() {
  return createBookingStore({
    async load() {
      try {
        return JSON.parse(await readFile(bookingSystemPath, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(state) {
      await mkdir(path.dirname(bookingSystemPath), { recursive: true });
      await writeFile(bookingSystemPath, JSON.stringify(state, null, 2));
    },
  });
}

async function nodeRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const body = hasBody ? JSON.stringify((await readJson(req)) ?? {}) : undefined;
  const headers = new Headers();
  if (req.headers.cookie) headers.set('cookie', req.headers.cookie);
  headers.set('content-type', 'application/json');
  return new Request(url.toString(), { method: req.method, headers, body });
}

function writeResponse(res: ServerResponse, response: Response, body: string) {
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(body);
}

export async function handleDevBookingApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (url.pathname.startsWith('/api/admin/hire-agreements')) return false;
  if (!url.pathname.startsWith('/api/admin') && !url.pathname.startsWith('/api/bookings')) return false;
  const request = await nodeRequest(req, url);
  const origin = req.headers.host ? `http://${req.headers.host}` : 'http://localhost:4321';
  const bookings = localBookingStore();
  let response: Response | null;
  try {
    response = await handleBookingApi(request, url, {
    store: bookings,
    origin,
    siteOrigin: origin,
    adminSecret: adminPassword(),
    bootstrapPassword: adminPassword(),
    bootstrapAdminEmail: process.env.HIRE_ADMIN_EMAIL || 'leighsvillagehall@gmail.com',
    bootstrapAdminExtras: process.env.HIRE_ADMIN_EXTRA || 'andygbwilson@gmail.com',
    bookingsForwardTo: process.env.BOOKINGS_FORWARD_TO || 'leighsvillagehall@gmail.com',
    inviteAllowlist: parseInviteAllowlist(process.env.HIRE_INVITE_ALLOWLIST),
    secure: false,
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY || DEV_TURNSTILE_SECRET,
    getAgreement: (bookingNumber) => loadHireAgreement(bookingNumber),
    putAgreement: async (record) => {
      const store = await readStore();
      store[bookingStorageKey(record.bookingNumber)] = record;
      await writeStore(store);
    },
    assertCanSendInvite: (record) => assertCanSendInvite(record, parseInviteAllowlist(process.env.HIRE_INVITE_ALLOWLIST)),
    sendHireInvite: (record) => sendHireInvite(record.bookingNumber, origin),
    mailer: {
      async send(message) {
        console.log('Booking email (not delivered in local dev)', message);
        return { delivered: false };
      },
    },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The request could not be completed.';
    res.statusCode = 400;
    res.setHeader('content-type', jsonHeaders['content-type']);
    res.setHeader('cache-control', jsonHeaders['cache-control']);
    res.end(JSON.stringify({ error: message }));
    return true;
  }
  if (!response) return false;
  writeResponse(res, response, await response.text());
  return true;
}

export async function handleAdminDevApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
): Promise<boolean> {
  if (!url.pathname.startsWith('/api/admin')) return false;
  if (await handleDevBookingApi(req, res, url)) return true;

  const send = (status: number, body: unknown, extra: Record<string, string> = {}) => {
    res.statusCode = status;
    for (const [name, value] of Object.entries({ ...jsonHeaders, ...extra })) {
      res.setHeader(name, value);
    }
    res.end(JSON.stringify(body));
  };

  try {
    if (!(await readAdminSession(req.headers.cookie, adminPassword()))) {
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
        const body = await readJson(req);
        const payload = parsePayload({
          ...(body && typeof body === 'object' ? body : {}),
          bookingNumber,
        });
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
