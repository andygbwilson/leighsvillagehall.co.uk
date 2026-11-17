import {
  canManageAccounts,
  canManageBookings,
  clearAdminCookie,
  createAdminCookie,
  isAdminRole,
  readAdminSession,
  type AdminRole,
  type AdminSession,
} from './admin-auth';
import {
  applyEmailTemplate,
  bookingStatusLabel,
  bookingTemplateVars,
  calendarEvents,
  hirePayloadFromBooking,
  isValidEmail,
  parseBookingRequest,
  validateBookingRequest,
  type HallBooking,
} from './bookings';
import { sessionFromAccount, type BookingStore } from './booking-store';
import { hireAdminAgreementUrl, hireAgreementUrl, parseInviteAllowlist } from './booking-email';
import {
  ACCESS_REPLY,
  clearHirerCookie,
  createHirerCookie,
  createHirerLink,
  hirerAccessUrl,
  hirerDisplayName,
  readHirerLink,
  readHirerSession,
  splitHirerBookings,
} from './hirer-access';
import { fetchHboCalendar, parseHboCsv } from './hbo-import';
import type { BookingSettings } from './bookings';
import { emptyHireAgreement, mergeAgreement, type HireAgreementRecord } from './hire-agreement';
import { verifyPassword } from './password';
import { clientIp, turnstileTokenFromBody, verifyTurnstile } from './turnstile';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

export type Mailer = {
  send(message: {
    to: string;
    name?: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ delivered: boolean }>;
};

export type BookingApiContext = {
  store: BookingStore;
  origin: string;
  siteOrigin: string;
  adminSecret: string;
  bootstrapPassword: string;
  bootstrapAdminEmail: string;
  bootstrapAdminExtras: string;
  mailer?: Mailer;
  bookingsForwardTo: string;
  putAgreement(record: HireAgreementRecord): Promise<void>;
  getAgreement(bookingNumber: string): Promise<HireAgreementRecord | null>;
  inviteAllowlist: string[];
  assertCanSendInvite(record: HireAgreementRecord): string;
  sendHireInvite(record: HireAgreementRecord): Promise<{ record: HireAgreementRecord; delivered: boolean }>;
  secure: boolean;
  turnstileSecret: string;
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...jsonHeaders, ...extra } });
}

export async function handleBookingApi(request: Request, url: URL, ctx: BookingApiContext): Promise<Response | null> {
  if (url.pathname === '/api/bookings' && request.method === 'POST') {
    return createPublicBooking(await request.json(), ctx, request);
  }
  if (url.pathname === '/api/bookings/calendar' && request.method === 'GET') {
    return publicCalendar(url, ctx);
  }
  if (url.pathname === '/api/bookings/access' && request.method === 'POST') {
    return requestHirerAccess(await request.json(), ctx, request);
  }
  if (url.pathname === '/api/bookings/mine' && request.method === 'GET') {
    return listHirerBookings(request, url, ctx);
  }
  if (url.pathname === '/api/bookings/mine/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearHirerCookie(ctx.secure) });
  }

  if (!url.pathname.startsWith('/api/admin')) return null;

  if (url.pathname === '/api/admin/login' && request.method === 'POST') {
    return login(await request.json(), ctx);
  }
  if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': clearAdminCookie(ctx.secure) });
  }

  const session = await readAdminSession(request.headers.get('cookie'), ctx.adminSecret);
  if (!session) return json({ error: 'Please sign in.' }, 401);

  if (url.pathname === '/api/admin/session' && request.method === 'GET') {
    return json({ session });
  }
  if (url.pathname === '/api/admin/settings' && request.method === 'GET') {
    return json({ settings: await ctx.store.getSettings(), session });
  }
  if (url.pathname === '/api/admin/settings' && request.method === 'PUT') {
    requireBookings(session);
    const body = (await request.json()) as Partial<BookingSettings>;
    return json({ settings: await ctx.store.saveSettings(normaliseSettings(body)) });
  }
  if (url.pathname === '/api/admin/rooms' && request.method === 'GET') {
    return json({ rooms: await ctx.store.listRooms(), session });
  }
  if (url.pathname === '/api/admin/rooms' && request.method === 'PUT') {
    requireBookings(session);
    const body = (await request.json()) as { rooms?: import('./bookings').HallRoom[] };
    return json({ rooms: await ctx.store.saveRooms(body.rooms ?? []) });
  }
  if (url.pathname === '/api/admin/bookings/import' && request.method === 'POST') {
    requireBookings(session);
    return importBookings(await request.json(), ctx);
  }
  if (url.pathname === '/api/admin/bookings/copy-year' && request.method === 'POST') {
    requireBookings(session);
    const body = (await request.json()) as { fromYear?: number; toYear?: number };
    return json({ ok: true, ...(await ctx.store.copyYear(Number(body.fromYear), Number(body.toYear))) });
  }
  if (url.pathname === '/api/admin/calendar' && request.method === 'GET') {
    return adminCalendar(url, ctx);
  }
  if (url.pathname === '/api/admin/bookings' && request.method === 'GET') {
    const state = await ctx.store.getState();
    const bookings = state.events.filter((event) => !event.isOccurrence);
    const rooms = [...state.rooms].sort((a, b) => a.sort - b.sort);
    return json({ bookings, rooms, session });
  }
  if (url.pathname === '/api/admin/bookings' && request.method === 'POST') {
    requireBookings(session);
    return createAdminBooking(await request.json(), ctx);
  }

  const one = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)$/);
  if (one) {
    const id = Number(decodeURIComponent(one[1] ?? ''));
    const booking = await ctx.store.getEvent(id);
    if (!booking) return json({ error: 'That booking was not found.' }, 404);
    if (request.method === 'GET') return json({ booking, session });
    if (request.method === 'PATCH') {
      requireBookings(session);
      const body = (await request.json()) as { status?: HallBooking['status']; notes?: string };
      const next = await ctx.store.updateEvent(id, {
        ...(body.status ? { status: body.status } : {}),
        ...(typeof body.notes === 'string' ? { notes: body.notes } : {}),
      });
      if (body.status === 'declined') {
        await sendTemplate(ctx, 'booking_declined', next, { adminUrl: '', formUrl: '' });
      }
      return json({ booking: next });
    }
  }

  const invite = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/invite$/);
  if (invite && request.method === 'POST') {
    requireBookings(session);
    const id = Number(decodeURIComponent(invite[1] ?? ''));
    const body = (await request.json().catch(() => ({}))) as { confirmRecurring?: boolean };
    return sendInviteForBooking(id, Boolean(body.confirmRecurring), ctx);
  }
  const duplicate = url.pathname.match(/^\/api\/admin\/bookings\/([^/]+)\/duplicate$/);
  if (duplicate && request.method === 'POST') {
    requireBookings(session);
    const id = Number(decodeURIComponent(duplicate[1] ?? ''));
    const body = (await request.json()) as { year?: number };
    const year = Number(body.year);
    if (!year) return json({ error: 'Choose a year to copy into.' }, 400);
    return json({ booking: await ctx.store.duplicateEvent(id, year) });
  }

  if (url.pathname === '/api/admin/templates' && request.method === 'GET') {
    return json({ templates: await ctx.store.listTemplates() });
  }
  const template = url.pathname.match(/^\/api\/admin\/templates\/([^/]+)$/);
  if (template && request.method === 'PUT') {
    requireBookings(session);
    const slug = decodeURIComponent(template[1] ?? '');
    const body = (await request.json()) as { subject?: string; body?: string };
    return json({ template: await ctx.store.saveTemplate(slug, { subject: body.subject ?? '', body: body.body ?? '' }) });
  }

  if (url.pathname === '/api/admin/accounts' && request.method === 'GET') {
    requireAccounts(session);
    return json({ accounts: await ctx.store.listAdmins(), session });
  }
  if (url.pathname === '/api/admin/accounts' && request.method === 'POST') {
    requireAccounts(session);
    const body = (await request.json()) as { email?: string; name?: string; password?: string; role?: string };
    const role = body.role ?? '';
    if (!isAdminRole(role)) return json({ error: 'Choose a valid role.' }, 400);
    const account = await ctx.store.createAdmin({
      email: body.email ?? '',
      name: body.name ?? '',
      password: body.password ?? '',
      role,
    });
    return json({ account });
  }
  const accountRoute = url.pathname.match(/^\/api\/admin\/accounts\/([^/]+)$/);
  if (accountRoute && request.method === 'DELETE') {
    requireAccounts(session);
    const id = Number(decodeURIComponent(accountRoute[1] ?? ''));
    if (id === session.id) return json({ error: 'You cannot delete the account you are signed in with.' }, 400);
    await ctx.store.deleteAdmin(id);
    return json({ ok: true });
  }

  return null;
}

async function login(body: unknown, ctx: BookingApiContext): Promise<Response> {
  const data = (body ?? {}) as { email?: string; password?: string };
  const email = String(data.email ?? '').trim().toLowerCase();
  const password = String(data.password ?? '');
  if (!email || !password) return json({ error: 'Enter your email and password.' }, 400);

  let account = await ctx.store.getAdminByEmail(email);
  if (!account && password === ctx.bootstrapPassword) {
    const seeded = bootstrapAccount(email, ctx);
    if (seeded) {
      account = {
        ...(await ctx.store.createAdmin({
          email,
          name: seeded.name,
          password,
          role: seeded.role,
        })),
        passwordHash: '',
      } as never;
      account = await ctx.store.getAdminByEmail(email);
    }
  }
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return json({ error: 'That email or password is not correct.' }, 401);
  }
  const session = sessionFromAccount(account);
  return json(
    { ok: true, session },
    200,
    { 'set-cookie': await createAdminCookie(ctx.adminSecret, session, ctx.secure) },
  );
}

async function createPublicBooking(body: unknown, ctx: BookingApiContext, request: Request): Promise<Response> {
  const challenge = await verifyTurnstile({
    token: turnstileTokenFromBody(body),
    secret: ctx.turnstileSecret,
    ip: clientIp(request),
  });
  if (challenge) return json({ error: challenge }, 400);
  const input = parseBookingRequest(body, 'website');
  const settings = await ctx.store.getSettings();
  const errors = validateBookingRequest(input, settings);
  if (errors.length) return json({ error: errors[0], errors }, 400);
  const booking = await ctx.store.createEvent(input, { source: 'website', status: 'requested' });
  await ensureAgreement(ctx, booking);
  const adminUrl = `${ctx.siteOrigin}/admin/booking?id=${booking.id}`;
  await sendTemplate(ctx, 'booking_request_staff', booking, { adminUrl, formUrl: '' }, ctx.bookingsForwardTo);
  await sendTemplate(ctx, 'booking_request_hirer', booking, { adminUrl: '', formUrl: '' }, booking.email, booking.hirerName);
  return json({ ok: true, booking: { id: booking.id, hireDate: booking.hireDate } });
}

async function createAdminBooking(body: unknown, ctx: BookingApiContext): Promise<Response> {
  const input = parseBookingRequest(body, 'admin');
  const settings = await ctx.store.getSettings();
  const errors = validateBookingRequest(input, settings, { asAdmin: true });
  if (errors.length) return json({ error: errors[0], errors }, 400);
  const booking = await ctx.store.createEvent(input, {
    source: 'admin',
    status: 'held',
    expand: Boolean(input.isRecurring),
  });
  await ensureAgreement(ctx, booking);
  return json({ ok: true, booking });
}

async function requestHirerAccess(body: unknown, ctx: BookingApiContext, request: Request): Promise<Response> {
  const challenge = await verifyTurnstile({
    token: turnstileTokenFromBody(body),
    secret: ctx.turnstileSecret,
    ip: clientIp(request),
  });
  if (challenge) return json({ error: challenge }, 400);
  const email = String((body as { email?: unknown })?.email ?? '')
    .trim()
    .toLowerCase();
  if (!email || !isValidEmail(email)) return json({ error: 'Enter the email address used on the booking.' }, 400);
  const { bookings, send } = await ctx.store.claimAccessEmail(email);
  if (send) {
    const token = await createHirerLink(ctx.adminSecret, email);
    const accessUrl = hirerAccessUrl(ctx.siteOrigin, token);
    const latest = bookings[bookings.length - 1] ?? bookings[0];
    if (latest) {
      await sendTemplate(ctx, 'booking_access', latest, { adminUrl: '', formUrl: '', accessUrl }, email, hirerDisplayName(bookings));
    }
  }
  return json({ ok: true, message: ACCESS_REPLY });
}

async function listHirerBookings(request: Request, url: URL, ctx: BookingApiContext): Promise<Response> {
  const token = url.searchParams.get('token') ?? '';
  const email = token
    ? await readHirerLink(ctx.adminSecret, token)
    : await readHirerSession(request.headers.get('cookie'), ctx.adminSecret);
  if (!email) {
    return json({ error: 'This link has expired.' }, 401);
  }
  const bookings = await ctx.store.listEventsByEmail(email);
  const rooms = await ctx.store.listRooms();
  const extra = token ? { 'set-cookie': await createHirerCookie(ctx.adminSecret, email, ctx.secure) } : {};
  return json(
    {
      email,
      hirerName: hirerDisplayName(bookings),
      ...splitHirerBookings(bookings, rooms, ctx.siteOrigin),
    },
    200,
    extra,
  );
}

async function publicCalendar(url: URL, ctx: BookingApiContext): Promise<Response> {
  const settings = await ctx.store.getSettings();
  const from = url.searchParams.get('from') || monthStart(new Date());
  const requestedTo = url.searchParams.get('to') || monthEnd(new Date());
  const to = requestedTo > settings.publicBookUntil ? settings.publicBookUntil : requestedTo;
  const events = await ctx.store.eventsInRange(from, to);
  const rooms = (await ctx.store.listRooms()).filter((room) => room.public);
  return json({
    settings: { ...settings, publicBookUntil: settings.publicBookUntil },
    rooms,
    events: calendarEvents(events, rooms),
  });
}

async function adminCalendar(url: URL, ctx: BookingApiContext): Promise<Response> {
  const settings = await ctx.store.getSettings();
  const from = url.searchParams.get('from') || monthStart(new Date());
  const to = url.searchParams.get('to') || monthEnd(new Date());
  const events = await ctx.store.eventsInRange(from, to);
  const rooms = await ctx.store.listRooms();
  return json({ settings, rooms, events: calendarEvents(events, rooms, { admin: true }) });
}

async function sendInviteForBooking(id: number, confirmRecurring: boolean, ctx: BookingApiContext): Promise<Response> {
  let booking = await ctx.store.getEvent(id);
  if (!booking) return json({ error: 'That booking was not found.' }, 404);
  if (booking.isRecurring && !booking.recurringConfirmed && !confirmRecurring) {
    return json({ error: 'Confirm that this recurring booking is possible before sending the hire agreement.' }, 400);
  }
  const existing = (await ctx.getAgreement(String(booking.id))) ?? emptyHireAgreement(String(booking.id));
  const merged = mergeAgreement(existing, hirePayloadFromBooking(booking), { markSubmitted: false });
  ctx.assertCanSendInvite(merged);
  if (booking.isRecurring && confirmRecurring && !booking.recurringConfirmed) {
    booking = await ctx.store.confirmRecurring(id);
  }
  const result = await ctx.sendHireInvite(merged);
  const next = await ctx.store.updateEvent(id, { status: 'invite_sent' });
  return json({ ok: true, booking: next, record: result.record, delivered: result.delivered });
}

async function ensureAgreement(ctx: BookingApiContext, booking: HallBooking): Promise<void> {
  const existing = await ctx.getAgreement(String(booking.id));
  const record = mergeAgreement(existing, hirePayloadFromBooking(booking), { markSubmitted: false });
  await ctx.putAgreement(record);
}

async function sendTemplate(
  ctx: BookingApiContext,
  slug: string,
  booking: HallBooking,
  extra: Record<string, string>,
  to?: string,
  name?: string,
): Promise<void> {
  if (!ctx.mailer || !to) return;
  const template = await ctx.store.getTemplate(slug);
  const message = applyEmailTemplate(template, bookingTemplateVars(booking, extra));
  try {
    await ctx.mailer.send({ to, name, ...message });
  } catch (error) {
    console.error('Failed to send booking email', { slug, to, error });
  }
}

function bootstrapAccount(email: string, ctx: BookingApiContext): { name: string; role: AdminRole } | null {
  const secretary = ctx.bootstrapAdminEmail.trim().toLowerCase();
  if (secretary && email === secretary) return { name: 'Booking secretary', role: 'booking_secretary' };
  if (parseInviteAllowlist(ctx.bootstrapAdminExtras).includes(email)) {
    return { name: extraAdminName(email), role: 'admin' };
  }
  return null;
}

function extraAdminName(email: string): string {
  if (email === 'andygbwilson@gmail.com') return 'Andy Wilson';
  return 'Admin';
}

function requireBookings(session: AdminSession) {
  if (!canManageBookings(session.role)) throw new Error('This account cannot change bookings.');
}

function requireAccounts(session: AdminSession) {
  if (!canManageAccounts(session.role)) throw new Error('This account cannot manage admin users.');
}

async function importBookings(body: unknown, ctx: BookingApiContext): Promise<Response> {
  const data = (body ?? {}) as { csv?: string; fromCalendar?: boolean; from?: string; to?: string };
  const rooms = await ctx.store.listRooms();
  const rows = data.csv?.trim()
    ? parseHboCsv(data.csv, rooms)
    : data.fromCalendar
      ? await fetchHboCalendar(data.from || `${new Date().getFullYear()}-01-01`, data.to || `${new Date().getFullYear() + 1}-12-31`, rooms)
      : [];
  if (!rows.length) return json({ error: 'No bookings were found to import. Use CSV (Full) from Hall Booking Online, or import the public calendar.' }, 400);
  const result = await ctx.store.importEvents(rows);
  return json({ ok: true, ...result });
}

function normaliseSettings(body: Partial<BookingSettings>): Partial<BookingSettings> {
  const next: Partial<BookingSettings> = {};
  if (body.publicBookUntil) next.publicBookUntil = body.publicBookUntil;
  if (body.adminBookUntil) next.adminBookUntil = body.adminBookUntil;
  if (body.openFrom) next.openFrom = body.openFrom.slice(0, 5);
  if (body.openTo) next.openTo = body.openTo.slice(0, 5);
  if (body.noticeDays != null && Number.isFinite(Number(body.noticeDays))) next.noticeDays = Number(body.noticeDays);
  if (body.gapMinutes != null && Number.isFinite(Number(body.gapMinutes))) next.gapMinutes = Number(body.gapMinutes);
  if (body.minDurationMinutes != null && Number.isFinite(Number(body.minDurationMinutes))) {
    next.minDurationMinutes = Number(body.minDurationMinutes);
  }
  if (typeof body.highlightProvisional === 'boolean') next.highlightProvisional = body.highlightProvisional;
  return next;
}

function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthEnd(date: Date): string {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
}

export { bookingStatusLabel, hireAgreementUrl, hireAdminAgreementUrl };
