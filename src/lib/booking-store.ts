import type { AdminAccount, AdminRole, AdminSession } from './admin-auth';
import { isAdminRole } from './admin-auth';
import {
  DEFAULT_ROOMS,
  DEFAULT_TEMPLATES,
  addYears,
  defaultSettings,
  emptyBooking,
  findConflict,
  recurrenceDates,
  roomsOf,
  type BookingRequestInput,
  type BookingSettings,
  type BookingSource,
  type BookingStatus,
  type EmailTemplate,
  type HallBooking,
  type HallRoom,
} from './bookings';
import type { ImportRow } from './hbo-import';
import { rowToBooking } from './hbo-import';
import { ACCESS_COOLDOWN_MS } from './hirer-access';
import { hashPassword } from './password';

export type BookingSystemState = {
  nextId: number;
  settings: BookingSettings;
  rooms: HallRoom[];
  admins: AdminAccount[];
  templates: EmailTemplate[];
  events: HallBooking[];
  accessSentAt: Record<string, string>;
};

export type BookingStore = {
  getState(): Promise<BookingSystemState>;
  getSettings(): Promise<BookingSettings>;
  saveSettings(settings: Partial<BookingSettings>): Promise<BookingSettings>;
  listRooms(): Promise<HallRoom[]>;
  saveRooms(rooms: HallRoom[]): Promise<HallRoom[]>;
  importEvents(rows: ImportRow[]): Promise<{ created: number; updated: number; skipped: Array<{ title: string; reason: string }> }>;
  duplicateEvent(id: number, year: number): Promise<HallBooking>;
  copyYear(fromYear: number, toYear: number): Promise<{ created: number; skipped: number }>;
  listAdmins(): Promise<Omit<AdminAccount, 'passwordHash'>[]>;
  getAdminByEmail(email: string): Promise<AdminAccount | null>;
  getAdminById(id: number): Promise<AdminAccount | null>;
  createAdmin(input: { email: string; name: string; password: string; role: AdminRole }): Promise<Omit<AdminAccount, 'passwordHash'>>;
  deleteAdmin(id: number): Promise<void>;
  getTemplate(slug: string): Promise<EmailTemplate>;
  listTemplates(): Promise<EmailTemplate[]>;
  saveTemplate(slug: string, input: { subject: string; body: string }): Promise<EmailTemplate>;
  createEvent(input: BookingRequestInput, options: { source: BookingSource; status?: BookingStatus; expand?: boolean }): Promise<HallBooking>;
  updateEvent(id: number, patch: Partial<HallBooking>): Promise<HallBooking>;
  getEvent(id: number): Promise<HallBooking | null>;
  listEvents(): Promise<HallBooking[]>;
  listEventsByEmail(email: string): Promise<HallBooking[]>;
  claimAccessEmail(email: string): Promise<{ bookings: HallBooking[]; send: boolean }>;
  eventsInRange(from: string, to: string): Promise<HallBooking[]>;
  confirmRecurring(id: number, until?: string): Promise<HallBooking>;
};

function emptyState(): BookingSystemState {
  const now = new Date().toISOString();
  return {
    nextId: 1,
    settings: defaultSettings(),
    rooms: DEFAULT_ROOMS.map((room) => ({ ...room })),
    admins: [],
    templates: DEFAULT_TEMPLATES.map((template) => ({ ...template, updatedAt: now })),
    events: [],
    accessSentAt: {},
  };
}

function publicAdmin(account: AdminAccount): Omit<AdminAccount, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...rest } = account;
  return rest;
}

export function createBookingStore(io: {
  load(): Promise<BookingSystemState | null>;
  save(state: BookingSystemState): Promise<void>;
}): BookingStore {
  const mutate = async <T>(fn: (state: BookingSystemState) => T | Promise<T>): Promise<T> => {
    const loaded = await io.load();
    const state = loaded ? normaliseState(loaded) : emptyState();
    const result = await fn(state);
    await io.save(state);
    return result;
  };

  return {
    async getState() {
      const loaded = await io.load();
      return loaded ? normaliseState(loaded) : emptyState();
    },

    async getSettings() {
      const state = await this.getState();
      return state.settings;
    },

    saveSettings(settings) {
      return mutate((state) => {
        const next = { ...state.settings, ...settings };
        if (next.publicBookUntil > next.adminBookUntil) {
          next.adminBookUntil = next.publicBookUntil;
        }
        state.settings = next;
        return state.settings;
      });
    },

    async listRooms() {
      const state = await this.getState();
      return [...state.rooms].sort((a, b) => a.sort - b.sort);
    },

    saveRooms(rooms) {
      return mutate((state) => {
        if (!rooms.length) throw new Error('Keep at least one room.');
        state.rooms = rooms.map((room, index) => ({
          id: room.id.trim() || `room-${index + 1}`,
          shortName: room.shortName.trim() || room.fullName.trim() || `Room ${index + 1}`,
          fullName: room.fullName.trim() || room.shortName.trim() || `Room ${index + 1}`,
          colour: room.colour.trim() || '#6b7280',
          public: Boolean(room.public),
          sort: index + 1,
        }));
        return state.rooms;
      });
    },

    importEvents(rows) {
      return mutate((state) => {
        let created = 0;
        let updated = 0;
        const skipped: Array<{ title: string; reason: string }> = [];
        for (const row of rows) {
          const title = row.functionType || row.hirerName || 'Booking';
          if (!row.rooms.length) {
            skipped.push({ title, reason: 'No room could be matched.' });
            continue;
          }
          const existing = row.id ? state.events.find((event) => event.id === row.id) : undefined;
          if (existing) {
            const next = rowToBooking(row, existing.id);
            existing.status = next.status;
            existing.hirerName = next.hirerName;
            existing.organisation = next.organisation;
            existing.email = next.email;
            existing.telephone = next.telephone;
            existing.addressLine1 = next.addressLine1;
            existing.hireDate = next.hireDate;
            existing.timeFrom = next.timeFrom;
            existing.timeTo = next.timeTo;
            existing.functionType = next.functionType;
            existing.eventDescription = next.eventDescription;
            existing.calendarPrivacy = next.calendarPrivacy;
            existing.numberAttending = next.numberAttending;
            existing.notes = next.notes;
            existing.rooms = next.rooms;
            existing.johnWrightHall = next.johnWrightHall;
            existing.brianPoultneyHall = next.brianPoultneyHall;
            existing.updatedAt = new Date().toISOString();
            updated += 1;
            continue;
          }
          const id = row.id && !state.events.some((event) => event.id === row.id) ? row.id : state.nextId;
          const booking = rowToBooking(row, id);
          const conflict = findConflict(booking, state.events, 0);
          if (conflict) {
            skipped.push({ title, reason: `Overlaps booking ${conflict.id} (${conflict.hirerName || conflict.functionType}).` });
            continue;
          }
          state.events.push(booking);
          state.nextId = Math.max(state.nextId, id + 1);
          created += 1;
        }
        return { created, updated, skipped };
      });
    },

    duplicateEvent(id, year) {
      return mutate((state) => {
        const booking = state.events.find((event) => event.id === id);
        if (!booking) throw new Error('That booking was not found.');
        const currentYear = Number(booking.hireDate.slice(0, 4));
        const shift = year - currentYear;
        if (!shift) throw new Error('Choose a different year.');
        const copy = emptyBooking({
          ...booking,
          id: state.nextId,
          hireDate: addYears(booking.hireDate, shift),
          recurrenceUntil: booking.recurrenceUntil ? addYears(booking.recurrenceUntil, shift) : '',
          seriesId: null,
          isOccurrence: false,
          status: booking.status === 'requested' ? 'held' : booking.status,
          source: 'admin',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        const conflict = findConflict(copy, state.events, state.settings.gapMinutes || 0);
        if (conflict) throw new Error(`That time overlaps booking ${conflict.id} (${conflict.hirerName}).`);
        state.nextId += 1;
        state.events.push(copy);
        if (copy.isRecurring && copy.recurrence) {
          expandSeries(state, copy, copy.recurrenceUntil || state.settings.adminBookUntil);
        }
        return copy;
      });
    },

    copyYear(fromYear, toYear) {
      return mutate((state) => {
        const shift = toYear - fromYear;
        if (!shift) throw new Error('Choose a different year.');
        const start = `${fromYear}-01-01`;
        const end = `${fromYear}-12-31`;
        const sources = state.events.filter(
          (event) => !event.isOccurrence && event.hireDate >= start && event.hireDate <= end && event.status !== 'declined' && event.status !== 'cancelled',
        );
        let created = 0;
        let skipped = 0;
        for (const booking of sources) {
          const copy = emptyBooking({
            ...booking,
            id: state.nextId,
            hireDate: addYears(booking.hireDate, shift),
            recurrenceUntil: booking.recurrenceUntil ? addYears(booking.recurrenceUntil, shift) : '',
            seriesId: null,
            isOccurrence: false,
            source: 'admin',
            status: booking.status === 'agreed' || booking.status === 'invite_sent' ? 'held' : booking.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          if (findConflict(copy, state.events, state.settings.gapMinutes || 0)) {
            skipped += 1;
            continue;
          }
          state.nextId += 1;
          state.events.push(copy);
          created += 1;
          if (copy.isRecurring && copy.recurrence) {
            expandSeries(state, copy, copy.recurrenceUntil || `${toYear}-12-31`);
          }
        }
        return { created, skipped };
      });
    },

    async listAdmins() {
      const state = await this.getState();
      return state.admins.map(publicAdmin);
    },

    async getAdminByEmail(email) {
      const state = await this.getState();
      return state.admins.find((admin) => admin.email.toLowerCase() === email.trim().toLowerCase()) ?? null;
    },

    async getAdminById(id) {
      const state = await this.getState();
      return state.admins.find((admin) => admin.id === id) ?? null;
    },

    createAdmin(input) {
      return mutate(async (state) => {
        const email = input.email.trim().toLowerCase();
        if (!email) throw new Error('Enter an email address.');
        if (!input.name.trim()) throw new Error('Enter a name.');
        if (input.password.trim().length < 8) throw new Error('Use a password of at least 8 characters.');
        if (!isAdminRole(input.role)) throw new Error('Choose a valid role.');
        if (state.admins.some((admin) => admin.email === email)) {
          throw new Error('That email already has an admin account.');
        }
        const account: AdminAccount = {
          id: nextAdminId(state),
          email,
          name: input.name.trim(),
          role: input.role,
          passwordHash: await hashPassword(input.password),
          createdAt: new Date().toISOString(),
        };
        state.admins.push(account);
        return publicAdmin(account);
      });
    },

    deleteAdmin(id) {
      return mutate((state) => {
        if (state.admins.length < 2) throw new Error('Keep at least one admin account.');
        const next = state.admins.filter((admin) => admin.id !== id);
        if (next.length === state.admins.length) throw new Error('That admin account was not found.');
        state.admins = next;
      });
    },

    async getTemplate(slug) {
      const state = await this.getState();
      const template = state.templates.find((item) => item.slug === slug);
      if (!template) throw new Error('That email template was not found.');
      return template;
    },

    async listTemplates() {
      const state = await this.getState();
      return state.templates;
    },

    saveTemplate(slug, input) {
      return mutate((state) => {
        const template = state.templates.find((item) => item.slug === slug);
        if (!template) throw new Error('That email template was not found.');
        if (!input.subject.trim()) throw new Error('Enter an email subject.');
        if (!input.body.trim()) throw new Error('Enter the email text.');
        template.subject = input.subject.trim();
        template.body = input.body.trim();
        template.updatedAt = new Date().toISOString();
        return template;
      });
    },

    createEvent(input, options) {
      return mutate((state) => {
        const now = new Date().toISOString();
        const booking = emptyBooking({
          id: state.nextId,
          source: options.source,
          status: options.status ?? (options.source === 'admin' ? 'held' : 'requested'),
          hirerName: input.hirerName.trim(),
          organisation: input.organisation?.trim() ?? '',
          email: input.email.trim(),
          telephone: input.telephone.trim(),
          addressLine1: input.addressLine1?.trim() ?? '',
          addressLine2: input.addressLine2?.trim() ?? '',
          town: input.town?.trim() ?? '',
          county: input.county?.trim() ?? '',
          postcode: input.postcode?.trim() ?? '',
          hireDate: input.hireDate,
          timeFrom: input.timeFrom,
          timeTo: input.timeTo,
          functionType: input.functionType?.trim() ?? '',
          eventDescription: input.eventDescription?.trim() ?? '',
          calendarPrivacy: input.calendarPrivacy === 'private' ? 'private' : 'show',
          numberAttending: input.numberAttending?.trim() ?? '',
          rooms: roomsOf({ ...input, rooms: input.rooms ?? [] }),
          johnWrightHall: roomsOf({ ...input, rooms: input.rooms ?? [] }).includes('john'),
          brianPoultneyHall: roomsOf({ ...input, rooms: input.rooms ?? [] }).includes('brian'),
          notes: input.notes?.trim() ?? '',
          isRecurring: Boolean(input.isRecurring),
          recurrence: input.isRecurring ? input.recurrence ?? '' : '',
          recurrenceUntil: input.recurrenceUntil?.trim() ?? '',
          createdAt: now,
          updatedAt: now,
        });
        const conflict = findConflict(booking, state.events, options.source === 'website' ? state.settings.gapMinutes || 0 : 0);
        if (conflict) {
          throw new Error(`That time overlaps booking ${conflict.id} (${conflict.hirerName}).`);
        }
        state.nextId += 1;
        state.events.push(booking);
        if (options.expand && booking.isRecurring && booking.recurrence) {
          expandSeries(state, booking, booking.recurrenceUntil || state.settings.adminBookUntil);
        }
        return booking;
      });
    },

    updateEvent(id, patch) {
      return mutate((state) => {
        const booking = state.events.find((event) => event.id === id);
        if (!booking) throw new Error('That booking was not found.');
        Object.assign(booking, patch, { updatedAt: new Date().toISOString() });
        return booking;
      });
    },

    async getEvent(id) {
      const state = await this.getState();
      return state.events.find((event) => event.id === id) ?? null;
    },

    async listEvents() {
      const state = await this.getState();
      return [...state.events].sort((a, b) => {
        const date = (b.hireDate || '').localeCompare(a.hireDate || '');
        if (date) return date;
        return (a.timeFrom || '').localeCompare(b.timeFrom || '');
      });
    },

    async eventsInRange(from, to) {
      const state = await this.getState();
      return state.events.filter((event) => event.hireDate >= from && event.hireDate <= to);
    },

    async listEventsByEmail(email) {
      const normalised = email.trim().toLowerCase();
      const state = await this.getState();
      return state.events
        .filter((event) => event.email.trim().toLowerCase() === normalised)
        .sort((a, b) => {
          const date = (a.hireDate || '').localeCompare(b.hireDate || '');
          if (date) return date;
          return (a.timeFrom || '').localeCompare(b.timeFrom || '');
        });
    },

    async claimAccessEmail(email) {
      const bookings = await this.listEventsByEmail(email);
      if (!bookings.length) return { bookings, send: false };
      const normalised = email.trim().toLowerCase();
      return mutate((state) => {
        const last = state.accessSentAt[normalised];
        if (last && Date.now() - Date.parse(last) < ACCESS_COOLDOWN_MS) {
          return { bookings, send: false };
        }
        state.accessSentAt[normalised] = new Date().toISOString();
        return { bookings, send: true };
      });
    },

    confirmRecurring(id, until) {
      return mutate((state) => {
        const booking = state.events.find((event) => event.id === id);
        if (!booking) throw new Error('That booking was not found.');
        if (!booking.isRecurring) return booking;
        booking.recurringConfirmed = true;
        booking.updatedAt = new Date().toISOString();
        expandSeries(state, booking, until || booking.recurrenceUntil || state.settings.adminBookUntil);
        return booking;
      });
    },
  };
}

function expandSeries(state: BookingSystemState, booking: HallBooking, until: string) {
  if (!booking.recurrence) return;
  const dates = recurrenceDates(booking.hireDate, booking.recurrence, until);
  for (const hireDate of dates) {
    const occurrence = emptyBooking({
      ...booking,
      id: state.nextId,
      hireDate,
      status: booking.status === 'requested' ? 'held' : booking.status,
      seriesId: booking.id,
      isOccurrence: true,
      recurringConfirmed: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (findConflict(occurrence, state.events, state.settings.gapMinutes || 0)) continue;
    state.nextId += 1;
    state.events.push(occurrence);
  }
}

function nextAdminId(state: BookingSystemState): number {
  return state.admins.reduce((max, admin) => Math.max(max, admin.id), 0) + 1;
}

function normaliseState(raw: BookingSystemState): BookingSystemState {
  const defaults = emptyState();
  return {
    nextId: Number(raw.nextId) || 1,
    settings: { ...defaults.settings, ...raw.settings },
    rooms: mergeRooms(raw.rooms),
    admins: Array.isArray(raw.admins) ? raw.admins : [],
    templates: mergeTemplates(raw.templates),
    events: Array.isArray(raw.events) ? raw.events : [],
    accessSentAt: isStringRecord(raw.accessSentAt) ? raw.accessSentAt : {},
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeRooms(existing: HallRoom[] | undefined): HallRoom[] {
  if (Array.isArray(existing) && existing.length) {
    return existing.map((room, index) => ({
      id: room.id,
      shortName: room.shortName,
      fullName: room.fullName,
      colour: room.colour,
      public: room.public !== false,
      sort: Number(room.sort) || index + 1,
    }));
  }
  return DEFAULT_ROOMS.map((room) => ({ ...room }));
}

function mergeTemplates(existing: EmailTemplate[] | undefined): EmailTemplate[] {
  const now = new Date().toISOString();
  const bySlug = new Map((existing ?? []).map((template) => [template.slug, template]));
  return DEFAULT_TEMPLATES.map((template) => bySlug.get(template.slug) ?? { ...template, updatedAt: now });
}

export function sessionFromAccount(account: AdminAccount): AdminSession {
  return { id: account.id, email: account.email, name: account.name, role: account.role };
}
