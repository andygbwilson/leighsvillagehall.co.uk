import type { HireAgreementPayload } from './hire-agreement';
import type { AdminAccount, AdminRole } from './admin-auth';

export type BookingStatus = 'requested' | 'held' | 'invite_sent' | 'agreed' | 'declined' | 'cancelled';
export const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Each week' },
  { value: 'weekdays', label: 'On weekdays' },
  { value: 'fortnightly', label: 'Every other week' },
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
] as const;

export type RecurrenceValue = (typeof RECURRENCE_OPTIONS)[number]['value'];
export type Recurrence = '' | RecurrenceValue;

const RECURRENCE_VALUES = RECURRENCE_OPTIONS.map((option) => option.value) as RecurrenceValue[];
const MAX_RECURRENCE_DATES = 750;
export type BookingSource = 'website' | 'admin' | 'hbo';
export type CalendarPrivacy = 'show' | 'private';
export type RoomId = string;

export type HallRoom = {
  id: RoomId;
  shortName: string;
  fullName: string;
  colour: string;
  public: boolean;
  sort: number;
};

export type HallBooking = {
  id: number;
  status: BookingStatus;
  source: BookingSource;
  hirerName: string;
  organisation: string;
  email: string;
  telephone: string;
  addressLine1: string;
  addressLine2: string;
  town: string;
  county: string;
  postcode: string;
  hireDate: string;
  timeFrom: string;
  timeTo: string;
  functionType: string;
  eventDescription: string;
  calendarPrivacy: CalendarPrivacy;
  numberAttending: string;
  rooms: RoomId[];
  johnWrightHall: boolean;
  brianPoultneyHall: boolean;
  notes: string;
  isRecurring: boolean;
  recurrence: Recurrence;
  recurrenceUntil: string;
  recurringConfirmed: boolean;
  seriesId: number | null;
  isOccurrence: boolean;
  createdAt: string;
  updatedAt: string;
};

export type BookingSettings = {
  publicBookUntil: string;
  adminBookUntil: string;
  openFrom: string;
  openTo: string;
  noticeDays: number;
  gapMinutes: number;
  minDurationMinutes: number;
  highlightProvisional: boolean;
};

export type EmailTemplate = {
  slug: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
};

export type PublicCalendarEvent = {
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string;
  rooms: RoomId[];
  colour: string;
  status: 'provisional' | 'booked';
  organisation?: string;
  description?: string;
  privateEvent?: boolean;
};

export type AdminCalendarEvent = PublicCalendarEvent & {
  id: number;
  hirerName: string;
  email: string;
  telephone: string;
  organisation: string;
  notes: string;
  eventDescription: string;
  calendarPrivacy: CalendarPrivacy;
  bookingStatus: BookingStatus;
  isRecurring: boolean;
};

export type BookingRequestInput = {
  hirerName: string;
  organisation?: string;
  email: string;
  telephone: string;
  addressLine1?: string;
  addressLine2?: string;
  town?: string;
  county?: string;
  postcode?: string;
  hireDate: string;
  timeFrom: string;
  timeTo: string;
  functionType?: string;
  eventDescription?: string;
  calendarPrivacy?: CalendarPrivacy;
  numberAttending?: string;
  rooms?: RoomId[];
  johnWrightHall?: boolean;
  brianPoultneyHall?: boolean;
  notes?: string;
  isRecurring?: boolean;
  recurrence?: Recurrence;
  recurrenceUntil?: string;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL.test(value.trim());
}

export function parseCalendarPrivacy(value: unknown): CalendarPrivacy {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'private' || raw === 'private event' || raw === 'hidden') return 'private';
  return 'show';
}

export function isPrivateCalendar(booking: { calendarPrivacy?: CalendarPrivacy }): boolean {
  return booking.calendarPrivacy === 'private';
}

export function publicCalendarTitle(booking: Pick<HallBooking, 'functionType' | 'organisation' | 'calendarPrivacy'>): string {
  if (isPrivateCalendar(booking)) return 'Private Event';
  return (booking.functionType || '').trim() || (booking.organisation || '').trim() || 'Booking';
}

export const MULTI_ROOM_COLOUR = '#6b7280';

export const DEFAULT_ROOMS: HallRoom[] = [
  { id: 'john', shortName: 'Main', fullName: 'John Wright Hall (large)', colour: '#5fb0d3', public: true, sort: 1 },
  { id: 'brian', shortName: 'Small', fullName: 'Brian Poultney Hall (small)', colour: '#69ff74', public: true, sort: 2 },
  { id: 'wc', shortName: 'Changing', fullName: 'WC External Access Only', colour: '#e74c3c', public: true, sort: 3 },
  { id: 'carpark', shortName: 'CarParkV', fullName: 'Car Park Food Stalls only', colour: '#f4b6c8', public: true, sort: 4 },
];

export function defaultSettings(now = new Date()): BookingSettings {
  const year = now.getFullYear();
  return {
    publicBookUntil: `${year}-12-31`,
    adminBookUntil: `${year + 1}-12-31`,
    openFrom: '08:00',
    openTo: '23:30',
    noticeDays: 2,
    gapMinutes: 45,
    minDurationMinutes: 60,
    highlightProvisional: true,
  };
}

export function emptyBooking(partial: Partial<HallBooking> & Pick<HallBooking, 'id' | 'hireDate' | 'timeFrom' | 'timeTo' | 'hirerName' | 'email'>): HallBooking {
  const now = new Date().toISOString();
  return {
    status: 'requested',
    source: 'website',
    organisation: '',
    telephone: '',
    addressLine1: '',
    addressLine2: '',
    town: '',
    county: '',
    postcode: '',
    functionType: '',
    eventDescription: '',
    calendarPrivacy: 'show',
    numberAttending: '',
    rooms: [],
    johnWrightHall: false,
    brianPoultneyHall: false,
    notes: '',
    isRecurring: false,
    recurrence: '',
    recurrenceUntil: '',
    recurringConfirmed: false,
    seriesId: null,
    isOccurrence: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function parseBookingRequest(input: unknown, source: BookingSource): BookingRequestInput {
  if (!input || typeof input !== 'object') throw new Error('The booking details were missing.');
  const body = input as Record<string, unknown>;
  const str = (key: string) => (typeof body[key] === 'string' ? body[key].trim() : '');
  const bool = (key: string) => body[key] === true || body[key] === 'true' || body[key] === 'yes' || body[key] === 'on';
  const recurrenceRaw = str('recurrence');
  const recurrence: Recurrence = isRecurrence(recurrenceRaw) ? recurrenceRaw : '';
  const isRecurring = bool('isRecurring') || bool('recurring');
  return {
    hirerName: str('hirerName'),
    organisation: str('organisation'),
    email: str('email'),
    telephone: str('telephone'),
    addressLine1: str('addressLine1'),
    addressLine2: str('addressLine2'),
    town: str('town'),
    county: str('county'),
    postcode: str('postcode'),
    hireDate: str('hireDate'),
    timeFrom: str('timeFrom'),
    timeTo: str('timeTo'),
    functionType: str('functionType'),
    eventDescription: str('eventDescription'),
    calendarPrivacy: parseCalendarPrivacy(body.calendarPrivacy),
    numberAttending: str('numberAttending'),
    rooms: roomsFromInput(body),
    johnWrightHall: bool('johnWrightHall') || roomsFromInput(body).includes('john'),
    brianPoultneyHall: bool('brianPoultneyHall') || roomsFromInput(body).includes('brian'),
    notes: str('notes'),
    isRecurring,
    recurrence: isRecurring ? recurrence : '',
    recurrenceUntil: str('recurrenceUntil'),
  };
}

export function validateBookingRequest(
  input: BookingRequestInput,
  settings: BookingSettings,
  options: { asAdmin?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const need = (value: string | undefined, message: string) => {
    if (!value?.trim()) errors.push(message);
  };
  const rooms = roomsOf(input);
  if (!options.asAdmin) {
    need(input.hirerName, 'Enter your name.');
    need(input.email, 'Enter an email address.');
    if (input.email && !EMAIL.test(input.email)) errors.push('Enter a valid email address.');
    need(input.telephone, 'Enter a telephone number.');
    need(input.addressLine1, 'Enter your address.');
    need(input.postcode, 'Enter a postcode.');
    need(input.eventDescription, 'Enter an event description.');
  }
  need(input.hireDate, 'Choose a date.');
  if (input.hireDate && !DATE.test(input.hireDate)) errors.push('Enter a valid date.');
  need(input.timeFrom, 'Enter a start time, including setting up.');
  need(input.timeTo, 'Enter a finish time, including clearing away.');
  if (input.timeFrom && !TIME.test(input.timeFrom)) errors.push('Enter a valid start time.');
  if (input.timeTo && !TIME.test(input.timeTo)) errors.push('Enter a valid finish time.');
  if (input.timeFrom && input.timeTo && input.timeFrom >= input.timeTo) {
    errors.push('The finish time must be after the start time.');
  }
  if (!rooms.length) errors.push('Choose at least one hall or space.');
  if (!options.asAdmin && input.calendarPrivacy !== 'show' && input.calendarPrivacy !== 'private') {
    errors.push('Choose whether the event should appear on the public calendar.');
  }
  if (!options.asAdmin) {
    need(input.functionType, 'Enter an event title.');
  }
  if (input.isRecurring && !isRecurrence(input.recurrence)) {
    errors.push('Choose how often the booking should repeat.');
  }
  const limit = options.asAdmin ? settings.adminBookUntil : settings.publicBookUntil;
  if (input.hireDate && limit && input.hireDate > limit) {
    errors.push(
      options.asAdmin
        ? `Bookings can only be placed up to ${formatDay(limit)}.`
        : `Online bookings are currently open up to ${formatDay(limit)}.`,
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  if (input.hireDate && input.hireDate < today && !options.asAdmin) {
    errors.push('Choose a date in the future.');
  }
  if (!options.asAdmin && input.hireDate && settings.noticeDays > 0) {
    const earliest = addDays(today, settings.noticeDays);
    if (input.hireDate < earliest) {
      errors.push(`Bookings need at least ${settings.noticeDays} days’ notice.`);
    }
  }
  if (!options.asAdmin && input.timeFrom && settings.openFrom && input.timeFrom < settings.openFrom) {
    errors.push(`Bookings can start from ${settings.openFrom}.`);
  }
  if (!options.asAdmin && input.timeTo && settings.openTo && input.timeTo > settings.openTo) {
    errors.push(`Bookings must finish by ${settings.openTo}.`);
  }
  if (!options.asAdmin && input.timeFrom && input.timeTo && settings.minDurationMinutes > 0) {
    if (minutesBetween(input.timeFrom, input.timeTo) < settings.minDurationMinutes) {
      errors.push(`Bookings must be at least ${settings.minDurationMinutes} minutes.`);
    }
  }
  if (input.recurrenceUntil && !DATE.test(input.recurrenceUntil)) {
    errors.push('Enter a valid end date for the recurring booking.');
  }
  if (input.recurrenceUntil && input.hireDate && input.recurrenceUntil < input.hireDate) {
    errors.push('The recurring booking must end after the first date.');
  }
  return errors;
}

export function bookingsOverlap(left: HallBooking, right: HallBooking, gapMinutes = 0): boolean {
  if (left.hireDate !== right.hireDate) return false;
  if (!isActiveStatus(left.status) || !isActiveStatus(right.status)) return false;
  const shared = roomsOf(left).some((room) => roomsOf(right).includes(room));
  if (!shared) return false;
  const leftStart = timeToMinutes(left.timeFrom);
  const leftEnd = timeToMinutes(left.timeTo) + gapMinutes;
  const rightStart = timeToMinutes(right.timeFrom);
  const rightEnd = timeToMinutes(right.timeTo) + gapMinutes;
  return leftStart < rightEnd && leftEnd > rightStart;
}

export function isActiveStatus(status: BookingStatus): boolean {
  return status === 'requested' || status === 'held' || status === 'invite_sent' || status === 'agreed';
}

export function findConflict(
  candidate: HallBooking,
  existing: HallBooking[],
  gapMinutes = 0,
): HallBooking | undefined {
  return existing.find((event) => event.id !== candidate.id && bookingsOverlap(candidate, event, gapMinutes));
}

export function isRecurrence(value: string): value is RecurrenceValue {
  return RECURRENCE_VALUES.includes(value as RecurrenceValue);
}

export function recurrenceLabel(value: string): string {
  return RECURRENCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function recurrenceDates(start: string, recurrence: Recurrence, until: string): string[] {
  if (!DATE.test(start) || !isRecurrence(recurrence) || !DATE.test(until)) return [];
  const dates: string[] = [];
  let current = start;
  while (dates.length < MAX_RECURRENCE_DATES) {
    current = nextRecurrenceDate(current, recurrence);
    if (!current || current > until) break;
    dates.push(current);
  }
  return dates;
}

function nextRecurrenceDate(current: string, recurrence: RecurrenceValue): string {
  if (recurrence === 'daily') return addDays(current, 1);
  if (recurrence === 'weekly') return addDays(current, 7);
  if (recurrence === 'fortnightly') return addDays(current, 14);
  if (recurrence === 'monthly') return addMonths(current, 1);
  return nextWeekday(current);
}

function nextWeekday(value: string): string {
  let next = addDays(value, 1);
  while (next && isWeekend(next)) next = addDays(next, 1);
  return next;
}

function isWeekend(value: string): boolean {
  const day = new Date(`${value}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

export function calendarEvents(
  events: HallBooking[],
  roomList: HallRoom[],
  options: { admin: true },
): AdminCalendarEvent[];
export function calendarEvents(
  events: HallBooking[],
  roomList: HallRoom[],
  options?: { admin?: false },
): PublicCalendarEvent[];
export function calendarEvents(
  events: HallBooking[],
  roomList: HallRoom[] = DEFAULT_ROOMS,
  options: { admin?: boolean } = {},
): PublicCalendarEvent[] | AdminCalendarEvent[] {
  const visible = events.filter((event) => isActiveStatus(event.status));
  const mapped = visible.map((event) => {
    const rooms = roomsOf(event);
    const privateEvent = isPrivateCalendar(event);
    const base: PublicCalendarEvent = {
      date: event.hireDate,
      timeFrom: event.timeFrom,
      timeTo: event.timeTo,
      title: options.admin
        ? event.functionType || event.hirerName || 'Booking'
        : publicCalendarTitle(event),
      rooms,
      colour: colourForRooms(rooms, roomList),
      status: event.status === 'requested' || event.status === 'held' ? 'provisional' : 'booked',
      organisation: options.admin || !privateEvent ? event.organisation : '',
      description: options.admin || !privateEvent ? event.eventDescription || '' : '',
      privateEvent,
    };
    if (options.admin) {
      return {
        ...base,
        id: event.id,
        hirerName: event.hirerName,
        email: event.email,
        telephone: event.telephone,
        organisation: event.organisation,
        notes: event.notes,
        eventDescription: event.eventDescription || '',
        calendarPrivacy: event.calendarPrivacy === 'private' ? 'private' : 'show',
        bookingStatus: event.status,
        isRecurring: event.isRecurring || event.isOccurrence,
      };
    }
    return base;
  });
  return mapped;
}

export function hirePayloadFromBooking(booking: HallBooking): HireAgreementPayload {
  return {
    bookingNumber: String(booking.id),
    hirerName: booking.hirerName,
    organisation: booking.organisation,
    email: booking.email,
    telephone: booking.telephone,
    mobile: booking.telephone,
    addressLine1: booking.addressLine1,
    addressLine2: booking.addressLine2,
    town: booking.town,
    county: booking.county,
    postcode: booking.postcode,
    hireDate: booking.hireDate,
    timeFrom: booking.timeFrom,
    timeTo: booking.timeTo,
    functionType: booking.functionType,
    numberAttending: booking.numberAttending,
    johnWrightHall: roomsOf(booking).includes('john') ? 'yes' : '',
    brianPoultneyHall: roomsOf(booking).includes('brian') ? 'yes' : '',
  };
}

export function bookingStatusLabel(status: BookingStatus): string {
  if (status === 'requested') return 'Requested';
  if (status === 'held') return 'Held';
  if (status === 'invite_sent') return 'Invite sent';
  if (status === 'agreed') return 'Agreed';
  if (status === 'declined') return 'Declined';
  return 'Cancelled';
}

export function hallsLabel(
  booking: Pick<HallBooking, 'johnWrightHall' | 'brianPoultneyHall' | 'rooms'>,
  roomList: HallRoom[] = DEFAULT_ROOMS,
): string {
  const ids = roomsOf(booking);
  if (!ids.length) return 'No space selected';
  const names = ids.map((id) => roomList.find((room) => room.id === id)?.fullName ?? id);
  if (names.length === 2 && ids.includes('john') && ids.includes('brian') && ids.length === 2) return 'Both halls';
  return names.join(', ');
}

export function roomsOf(
  booking: { johnWrightHall?: boolean; brianPoultneyHall?: boolean; rooms?: RoomId[] },
): RoomId[] {
  if (booking.rooms?.length) return booking.rooms;
  const rooms: RoomId[] = [];
  if (booking.johnWrightHall) rooms.push('john');
  if (booking.brianPoultneyHall) rooms.push('brian');
  return rooms;
}

export function colourForRooms(roomIds: RoomId[], roomList: HallRoom[] = DEFAULT_ROOMS): string {
  if (roomIds.length !== 1) return MULTI_ROOM_COLOUR;
  return roomList.find((room) => room.id === roomIds[0])?.colour ?? MULTI_ROOM_COLOUR;
}

export function parseFacilities(value: string, roomList: HallRoom[] = DEFAULT_ROOMS): RoomId[] {
  const text = value.toLowerCase();
  if (!text.trim()) return [];
  const matched = roomList.filter((room) => {
    if (text.includes(room.id)) return true;
    if (text.includes(room.shortName.toLowerCase())) return true;
    if (text.includes(room.fullName.toLowerCase())) return true;
    if (room.id === 'john' && /(john\s*wright|large hall|\bmain\b)/.test(text)) return true;
    if (room.id === 'brian' && /(brian|poultney|small hall)/.test(text)) return true;
    if (room.id === 'wc' && /(wc|changing|external access)/.test(text)) return true;
    if (room.id === 'carpark' && /(car\s*park|food stall)/.test(text)) return true;
    return false;
  });
  return [...new Set(matched.map((room) => room.id))];
}

export function addYears(value: string, years: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'updatedAt'>[] = [
  {
    slug: 'booking_request_staff',
    name: 'New booking request (staff)',
    subject: 'New booking request {{bookingNumber}} needs review',
    body: `A new booking request is ready to review.

Booking number: {{bookingNumber}}
Hirer: {{hirerName}}
Email: {{email}}
When: {{when}}
Halls: {{halls}}
Event: {{event}}
Recurring: {{recurring}}

Review the request, add the deposit due, then send the hire agreement invite:
{{adminUrl}}`,
  },
  {
    slug: 'booking_request_hirer',
    name: 'Booking request received (hirer)',
    subject: 'We have received your booking request ({{bookingNumber}})',
    body: `Hello {{hirerName}},

Thank you for requesting to hire Leighs Village Hall.

When: {{when}}
Halls: {{halls}}
Event: {{event}}
Booking number: {{bookingNumber}}
Recurring: {{recurring}}

The booking secretary will review this and email you a hire agreement if the date can be confirmed.

Leighs Village Hall`,
  },
  {
    slug: 'booking_access',
    name: 'Booking access link (hirer)',
    subject: 'Your Leighs Village Hall bookings',
    body: `Hello {{hirerName}},

Use this link to review your past and upcoming bookings at Leighs Village Hall. It works for 24 hours:

{{accessUrl}}

If you did not ask for this, you can ignore this email.

Leighs Village Hall
Charity no. 301317`,
  },
  {
    slug: 'hire_invite',
    name: 'Hire agreement invite',
    subject: 'Complete your hire agreement for Leighs Village Hall (booking {{bookingNumber}})',
    body: `Hello {{hirerName}},

Thank you for your provisional booking of Leighs Village Hall.

When: {{when}}
Halls: {{halls}}
Event: {{event}}
Booking number: {{bookingNumber}}

To confirm the booking, please complete the hire agreement using this link:
{{formUrl}}

We've filled in the details from your request. Please check them, add anything still needed, and submit the form. Facilities in section 6 can be left blank and finished later.

If you have questions, reply to this email or call Stuart Wilson on 01245 364193.

Leighs Village Hall
Charity no. 301317`,
  },
  {
    slug: 'booking_declined',
    name: 'Booking declined',
    subject: 'Your Leighs Village Hall booking request {{bookingNumber}}',
    body: `Hello {{hirerName}},

Thank you for your booking request for Leighs Village Hall.

We are sorry that we cannot confirm this booking for {{when}}. Please reply to this email if you would like to look at another date.

Leighs Village Hall`,
  },
];

export function applyEmailTemplate(
  template: Pick<EmailTemplate, 'subject' | 'body'>,
  vars: Record<string, string>,
): { subject: string; text: string; html: string } {
  const replace = (value: string) =>
    value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => vars[key] ?? '');
  const subject = replace(template.subject).trim();
  const text = replace(template.body).trim();
  const html = text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return { subject, text, html };
}

export function bookingTemplateVars(
  booking: HallBooking,
  extra: Record<string, string> = {},
): Record<string, string> {
  const when = [formatDay(booking.hireDate), formatTimeRange(booking.timeFrom, booking.timeTo)].filter(Boolean).join(', ');
  const recurring = booking.isRecurring
    ? `${recurrenceLabel(booking.recurrence) || 'yes'}${booking.recurrenceUntil ? ` until ${formatDay(booking.recurrenceUntil)}` : ''}`.trim()
    : 'No';
  return {
    bookingNumber: String(booking.id),
    hirerName: booking.hirerName || 'there',
    email: booking.email,
    when,
    halls: hallsLabel(booking),
    event: booking.functionType || 'Not specified',
    recurring,
    ...extra,
  };
}

export function formatDay(value: string): string {
  if (!DATE.test(value)) return value;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatTimeRange(from: string, to: string): string {
  if (!from || !to) return '';
  return `${from} to ${to}`;
}

function roomsFromInput(body: Record<string, unknown>): RoomId[] {
  const raw = body.rooms;
  if (Array.isArray(raw)) return raw.map((value) => String(value)).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map((value) => value.trim()).filter(Boolean);
  const rooms: RoomId[] = [];
  if (body.johnWrightHall === true || body.johnWrightHall === 'true' || body.johnWrightHall === 'yes' || body.johnWrightHall === 'on') {
    rooms.push('john');
  }
  if (body.brianPoultneyHall === true || body.brianPoultneyHall === 'true' || body.brianPoultneyHall === 'yes' || body.brianPoultneyHall === 'on') {
    rooms.push('brian');
  }
  if (body.wc === true || body.wc === 'yes' || body.wcExternalAccess === true) rooms.push('wc');
  if (body.carpark === true || body.carpark === 'yes' || body.carParkFoodStalls === true) rooms.push('carpark');
  return [...new Set(rooms)];
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesBetween(from: string, to: string): number {
  return timeToMinutes(to) - timeToMinutes(from);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string, months: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function publicEventInRange(event: { date: string }, from: string, to: string): boolean {
  return event.date >= from && event.date <= to;
}

export type { AdminAccount, AdminRole };
