import PostalMime from 'postal-mime';
import {
  applyBookingPrefill,
  assertCanSendInvite,
  buildHireInvite,
  buildStaffBookingNotice,
  hireAdminAgreementUrl,
  hireAgreementUrl,
  parseHboBookingEmail,
  parseInviteAllowlist,
  senderLooksLikeHbo,
} from '../src/lib/booking-email';
import { ADMIN_HOME, isAdminLoginPath, readAdminSession, safeAdminNext } from '../src/lib/admin-auth';
import { handleBookingApi, type BookingApiContext } from '../src/lib/booking-api';
import { applyEmailTemplate, bookingTemplateVars } from '../src/lib/bookings';
import { createBookingStore } from '../src/lib/booking-store';
import {
  agreementKvMetadata,
  agreementSummary,
  bookingStorageKey,
  isValidBookingNumber,
  mergeAgreement,
  normaliseHireAgreement,
  omitPublicLockedFields,
  parsePayload,
  sortAgreementSummaries,
  validateAgreement,
  type HireAgreementRecord,
  type HireAgreementSummary,
} from '../src/lib/hire-agreement';

export interface Env {
  ASSETS: Fetcher;
  BOOKINGS: KVNamespace;
  EMAIL: {
    send(message: {
      to: string | { email: string; name?: string };
      from: string | { email: string; name?: string };
      replyTo?: string | { email: string; name?: string };
      subject: string;
      text?: string;
      html?: string;
    }): Promise<{ messageId: string }>;
  };
  SITE_ORIGIN: string;
  BOOKINGS_FROM: string;
  BOOKINGS_FROM_NAME: string;
  BOOKINGS_FORWARD_TO: string;
  BOOKING_SENDER_DOMAIN: string;
  HIRE_INVITE_ALLOWLIST: string;
  HIRE_ADMIN_EMAIL?: string;
  HIRE_ADMIN_EXTRA?: string;
  HIRE_ADMIN_PASSWORD: string;
  TURNSTILE_SECRET_KEY?: string;
}

type IncomingEmail = {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array> | ArrayBuffer | string;
  forward(rcptTo: string, headers?: Headers): Promise<unknown>;
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

const BOOKING_SYSTEM_KEY = 'sys:booking-system';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        const bookingResponse = await handleBookingApi(request, url, bookingContext(request, env, url));
        if (bookingResponse) return bookingResponse;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The request could not be completed.';
        return Response.json({ error: message }, { status: 400, headers: jsonHeaders });
      }
    }

    if (url.pathname.startsWith('/api/admin')) {
      try {
        return await handleAdminApi(request, env, url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The request could not be completed.';
        return Response.json({ error: message }, { status: 400, headers: jsonHeaders });
      }
    }

    if (url.pathname === '/api/hire-agreement') {
      try {
        return await handleHireAgreement(request, env, url);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'The hire agreement could not be saved.';
        return Response.json({ error: message }, { status: 400, headers: jsonHeaders });
      }
    }

    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      return Response.redirect(new URL(ADMIN_HOME, url), 302);
    }

    if (isAdminLoginPath(url.pathname)) {
      if (url.pathname.endsWith('/')) {
        const canonical = new URL(url);
        canonical.pathname = '/admin/login';
        return Response.redirect(canonical, 302);
      }
      return env.ASSETS.fetch(request);
    }

    if (url.pathname.startsWith('/admin') && !(await isSignedIn(request, env))) {
      const login = new URL('/admin/login', url);
      login.searchParams.set('next', safeAdminNext(url.pathname));
      return Response.redirect(login, 302);
    }

    return env.ASSETS.fetch(request);
  },

  async email(message: IncomingEmail, env: Env): Promise<void> {
    try {
      await handleBookingEmail(message, env);
    } catch (error) {
      console.error('Failed to process booking email', error);
    }

    if (env.BOOKINGS_FORWARD_TO) {
      await message.forward(env.BOOKINGS_FORWARD_TO);
    }
  },
};

async function handleHireAgreement(request: Request, env: Env, url: URL): Promise<Response> {
  if (!env.BOOKINGS) {
    return Response.json(
      { error: 'Booking storage is not configured.' },
      { status: 503, headers: jsonHeaders },
    );
  }

  if (request.method === 'GET') {
    const bookingNumber = url.searchParams.get('booking') ?? '';
    if (!isValidBookingNumber(bookingNumber)) {
      return Response.json(
        { error: 'Enter the booking number from your confirmation email.' },
        { status: 400, headers: jsonHeaders },
      );
    }
    const record = await env.BOOKINGS.get<HireAgreementRecord>(
      bookingStorageKey(bookingNumber),
      'json',
    );
    return Response.json(
      { found: Boolean(record), record: record ? normaliseHireAgreement(record) : record },
      { headers: jsonHeaders },
    );
  }

  if (request.method === 'POST') {
    const payload = omitPublicLockedFields(parsePayload(await request.json()));
    const existing = await env.BOOKINGS.get<HireAgreementRecord>(
      bookingStorageKey(payload.bookingNumber),
      'json',
    );
    const record = mergeAgreement(existing, payload);
    const errors = validateAgreement(record);
    if (errors.length > 0) {
      return Response.json({ error: errors[0], errors }, { status: 400, headers: jsonHeaders });
    }
    await putAgreement(env, record);
    const bookingId = Number(record.bookingNumber);
    if (Number.isFinite(bookingId)) {
      const store = bookingStore(env);
      const event = await store.getEvent(bookingId);
      if (event) await store.updateEvent(bookingId, { status: 'agreed' });
    }
    return Response.json({ ok: true, record }, { headers: jsonHeaders });
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function handleAdminApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (!(await isSignedIn(request, env))) {
    return Response.json({ error: 'Please sign in.' }, { status: 401, headers: jsonHeaders });
  }

  if (!env.BOOKINGS) {
    return Response.json(
      { error: 'Booking storage is not configured.' },
      { status: 503, headers: jsonHeaders },
    );
  }

  if (url.pathname === '/api/admin/hire-agreements' && request.method === 'GET') {
    return Response.json({ agreements: await listAgreements(env) }, { headers: jsonHeaders });
  }

  const invite = url.pathname.match(/^\/api\/admin\/hire-agreements\/([^/]+)\/invite$/);
  if (invite) {
    const bookingNumber = decodeURIComponent(invite[1] ?? '');
    if (!isValidBookingNumber(bookingNumber)) {
      return Response.json({ error: 'That booking number is not valid.' }, { status: 400, headers: jsonHeaders });
    }
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
    }
    const existing = await env.BOOKINGS.get<HireAgreementRecord>(
      bookingStorageKey(bookingNumber),
      'json',
    );
    if (!existing) {
      return Response.json({ error: 'No hire agreement was found for that booking.' }, { status: 404, headers: jsonHeaders });
    }
    const record = await sendStoredHireInvite(env, existing);
    return Response.json({ ok: true, delivered: true, record }, { headers: jsonHeaders });
  }

  const one = url.pathname.match(/^\/api\/admin\/hire-agreements\/([^/]+)$/);
  if (one) {
    const bookingNumber = decodeURIComponent(one[1] ?? '');
    if (!isValidBookingNumber(bookingNumber)) {
      return Response.json({ error: 'That booking number is not valid.' }, { status: 400, headers: jsonHeaders });
    }
    const key = bookingStorageKey(bookingNumber);

    if (request.method === 'GET') {
      const record = await env.BOOKINGS.get<HireAgreementRecord>(key, 'json');
      if (!record) {
        return Response.json({ error: 'No hire agreement was found for that booking.' }, { status: 404, headers: jsonHeaders });
      }
      return Response.json({ record: normaliseHireAgreement(record) }, { headers: jsonHeaders });
    }

    if (request.method === 'PUT') {
      const existing = await env.BOOKINGS.get<HireAgreementRecord>(key, 'json');
      if (!existing) {
        return Response.json({ error: 'No hire agreement was found for that booking.' }, { status: 404, headers: jsonHeaders });
      }
      const payload = parsePayload({ ...(await request.json()), bookingNumber });
      const record = mergeAgreement(existing, payload, { markSubmitted: false });
      if (record.status === 'submitted') {
        const errors = validateAgreement(record);
        if (errors.length > 0) {
          return Response.json({ error: errors[0], errors }, { status: 400, headers: jsonHeaders });
        }
      }
      await putAgreement(env, record);
      return Response.json({ ok: true, record }, { headers: jsonHeaders });
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: jsonHeaders });
}

async function handleBookingEmail(message: IncomingEmail, env: Env): Promise<void> {
  const parsedMail = await PostalMime.parse(message.raw);
  const text = parsedMail.text?.trim() || htmlToText(parsedMail.html ?? '');
  const booking = parseHboBookingEmail(text);
  if (!booking) {
    console.log('Ignored non-booking email', { from: message.from, to: message.to });
    return;
  }

  const headerFrom = message.headers.get('from') ?? parsedMail.from?.address ?? '';
  const allowedDomain = env.BOOKING_SENDER_DOMAIN || 'hallbookingonline.com';
  if (
    allowedDomain !== '*' &&
    !senderLooksLikeHbo(message.from, allowedDomain) &&
    !senderLooksLikeHbo(headerFrom, allowedDomain)
  ) {
    console.log('Ignored booking-like email from unexpected sender', {
      from: message.from,
      headerFrom,
      bookingNumber: booking.bookingNumber,
    });
    return;
  }

  const existing = await env.BOOKINGS.get<HireAgreementRecord>(
    bookingStorageKey(booking.bookingNumber),
    'json',
  );
  if (existing?.status === 'submitted') {
    console.log('Hire agreement already submitted', { bookingNumber: booking.bookingNumber });
    return;
  }

  const isNew = !existing;
  const record = applyBookingPrefill(existing, booking);
  await putAgreement(env, record);
  console.log('Stored provisional booking for admin review', {
    bookingNumber: booking.bookingNumber,
    email: booking.email || '(missing)',
  });
  if (isNew) {
    try {
      await sendStaffBookingNotice(env, record);
    } catch (error) {
      console.error('Failed to send staff booking notice', {
        bookingNumber: record.bookingNumber,
        error,
      });
    }
  }
}

async function sendStaffBookingNotice(env: Env, record: HireAgreementRecord): Promise<void> {
  const to = env.BOOKINGS_FORWARD_TO?.trim();
  if (!to || !env.EMAIL) return;
  const adminUrl = hireAdminAgreementUrl(env.SITE_ORIGIN, record.bookingNumber);
  const notice = buildStaffBookingNotice(record, adminUrl);
  await env.EMAIL.send({
    from: { email: env.BOOKINGS_FROM, name: env.BOOKINGS_FROM_NAME || 'Leighs Village Hall' },
    to: { email: to },
    replyTo: env.BOOKINGS_FROM,
    subject: notice.subject,
    text: notice.text,
    html: notice.html,
  });
}

async function sendStoredHireInvite(env: Env, existing: HireAgreementRecord): Promise<HireAgreementRecord> {
  const record = normaliseHireAgreement(existing);
  const store = bookingStore(env);
  const bookingId = Number(record.bookingNumber);
  const event = Number.isFinite(bookingId) ? await store.getEvent(bookingId) : null;
  if (event?.isRecurring && !event.recurringConfirmed) {
    throw new Error(
      'Confirm that this recurring booking is possible on the booking request page before sending the hire agreement.',
    );
  }
  const email = assertCanSendInvite(record, parseInviteAllowlist(env.HIRE_INVITE_ALLOWLIST));
  if (!env.EMAIL) {
    throw new Error('Email sending is not configured.');
  }

  const formUrl = hireAgreementUrl(env.SITE_ORIGIN, record.bookingNumber);
  let invite = buildHireInvite(record, formUrl);
  try {
    const template = await store.getTemplate('hire_invite');
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
  await env.EMAIL.send({
    from: { email: env.BOOKINGS_FROM, name: env.BOOKINGS_FROM_NAME || 'Leighs Village Hall' },
    to: { email, name: record.hirerName || undefined },
    replyTo: env.BOOKINGS_FROM,
    subject: invite.subject,
    text: invite.text,
    html: invite.html,
  });

  const next = {
    ...record,
    inviteSentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putAgreement(env, next);
  if (event) await store.updateEvent(bookingId, { status: 'invite_sent' });
  console.log('Sent hire agreement invite', { bookingNumber: record.bookingNumber, to: email });
  return next;
}

async function putAgreement(env: Env, record: HireAgreementRecord): Promise<void> {
  await env.BOOKINGS.put(bookingStorageKey(record.bookingNumber), JSON.stringify(record), {
    metadata: agreementKvMetadata(record),
  });
}

async function listAgreements(env: Env): Promise<HireAgreementSummary[]> {
  const summaries: HireAgreementSummary[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.BOOKINGS.list({ prefix: 'booking:', cursor });
    for (const key of page.keys) {
      const meta = key.metadata as Record<string, string> | null;
      if (meta?.bookingNumber) {
        summaries.push({
          bookingNumber: meta.bookingNumber,
          hirerName: meta.hirerName ?? '',
          email: meta.email ?? '',
          hireDate: meta.hireDate ?? '',
          timeFrom: meta.timeFrom ?? '',
          timeTo: meta.timeTo ?? '',
          functionType: meta.functionType ?? '',
          johnWrightHall: meta.johnWrightHall ?? '',
          brianPoultneyHall: meta.brianPoultneyHall ?? '',
          status: meta.status === 'submitted' ? 'submitted' : 'draft',
          updatedAt: meta.updatedAt ?? '',
          inviteSentAt: meta.inviteSentAt ?? '',
        });
        continue;
      }
      const record = await env.BOOKINGS.get<HireAgreementRecord>(key.name, 'json');
      if (record) summaries.push(agreementSummary(record));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return sortAgreementSummaries(summaries);
}

async function isSignedIn(request: Request, env: Env): Promise<boolean> {
  return Boolean(await readAdminSession(request.headers.get('cookie'), env.HIRE_ADMIN_PASSWORD ?? ''));
}

function bookingStore(env: Env) {
  return createBookingStore({
    async load() {
      return env.BOOKINGS.get(BOOKING_SYSTEM_KEY, 'json');
    },
    async save(state) {
      await env.BOOKINGS.put(BOOKING_SYSTEM_KEY, JSON.stringify(state));
    },
  });
}

function bookingContext(request: Request, env: Env, url: URL): BookingApiContext {
  const store = bookingStore(env);
  return {
    store,
    origin: url.origin,
    siteOrigin: env.SITE_ORIGIN || url.origin,
    adminSecret: env.HIRE_ADMIN_PASSWORD ?? '',
    bootstrapPassword: env.HIRE_ADMIN_PASSWORD ?? '',
    bootstrapAdminEmail: env.HIRE_ADMIN_EMAIL ?? '',
    bootstrapAdminExtras: env.HIRE_ADMIN_EXTRA ?? '',
    bookingsForwardTo: env.BOOKINGS_FORWARD_TO ?? '',
    inviteAllowlist: parseInviteAllowlist(env.HIRE_INVITE_ALLOWLIST),
    secure: url.protocol === 'https:',
    turnstileSecret: env.TURNSTILE_SECRET_KEY ?? '',
    getAgreement: (bookingNumber) => env.BOOKINGS.get<HireAgreementRecord>(bookingStorageKey(bookingNumber), 'json'),
    putAgreement: (record) => putAgreement(env, record),
    assertCanSendInvite: (record) => assertCanSendInvite(record, parseInviteAllowlist(env.HIRE_INVITE_ALLOWLIST)),
    sendHireInvite: async (record) => ({ record: await sendStoredHireInvite(env, record), delivered: true }),
    mailer: env.EMAIL
      ? {
          async send(message) {
            await env.EMAIL.send({
              from: { email: env.BOOKINGS_FROM, name: env.BOOKINGS_FROM_NAME || 'Leighs Village Hall' },
              to: { email: message.to, name: message.name },
              replyTo: env.BOOKINGS_FROM,
              subject: message.subject,
              text: message.text,
              html: message.html,
            });
            return { delivered: true };
          },
        }
      : undefined,
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
