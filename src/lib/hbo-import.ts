import {
  emptyBooking,
  parseCalendarPrivacy,
  parseFacilities,
  type BookingStatus,
  type CalendarPrivacy,
  type HallBooking,
  type HallRoom,
} from './bookings';

export type ImportRow = {
  id?: number;
  hirerName: string;
  email: string;
  telephone: string;
  organisation: string;
  hireDate: string;
  timeFrom: string;
  timeTo: string;
  functionType: string;
  eventDescription: string;
  calendarPrivacy: CalendarPrivacy;
  notes: string;
  addressLine1?: string;
  numberAttending?: string;
  rooms: string[];
  status: BookingStatus;
};

type FeedEvent = {
  title?: string;
  start?: string;
  end?: string;
  backgroundColor?: string;
  extendedProps?: {
    facility?: string;
    status?: string;
    notes?: string;
    name?: string;
    phone?: string;
    email?: string;
    organisation?: string;
    address?: string;
    bookingId?: number | string;
    facilityRooms?: Array<{ code?: string; shortName?: string; colour?: string }>;
  };
};

const HBO_ORIGIN = 'https://hallbookingonline.com';
const HBO_VENUE = 'leighsvillagehall';

export function parseHboCsv(text: string, rooms: HallRoom[]): ImportRow[] {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const headers = table[0].map(normaliseHeader);
  const rows: ImportRow[] = [];
  for (const cells of table.slice(1)) {
    const get = (keys: string[]) => valueFor(headers, cells, keys);
    const hireDate = toIsoDate(get(['date', 'startdate', 'eventdate', 'bookingdate', 'fromdate']));
    const timeFrom = toIsoTime(get(['from', 'start', 'starttime', 'timefrom', 'begin']));
    const timeTo = toIsoTime(get(['to', 'finish', 'end', 'endtime', 'timeto']));
    if (!hireDate || !timeFrom || !timeTo) continue;
    const facilities = get(['facilities', 'facility', 'rooms', 'room', 'resource', 'halls']);
    const mapped = parseFacilities(facilities, rooms);
    const extraRooms = roomsFromCodes(
      get(['roomcodes', 'facilitycodes']),
      rooms,
    );
    const functionType = get(['eventtitle', 'event', 'title', 'eventname']) || get(['name']);
    const hirerName = get(['hirer', 'customer', 'contact', 'bookedby', 'hirername']) || get(['name']) || functionType;
    const calendarPrivacy = privacyFrom(get(['privacy', 'publiccalendar', 'calendarprivacy', 'privateevent']), functionType);
    const status = statusFrom(get(['status', 'state', 'approved']));
    const idRaw = get(['id', 'bookingid', 'eventid', 'bookingnumber']);
    const id = Number(idRaw);
    const publicNotes = get(['eventdescription', 'publicdescription']) || get(['notes']);
    const adminNotes = [get(['adminnotes']), get(['additional']), get(['message'])].filter(Boolean).join('\n\n');
    rows.push({
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      hirerName: hirerName || 'Imported booking',
      email: get(['email', 'e-mail', 'mail']),
      telephone: get(['telephone', 'phone', 'mobile', 'tel']),
      organisation: get(['organisation', 'organization', 'club', 'group']),
      addressLine1: get(['address']),
      hireDate,
      timeFrom,
      timeTo,
      functionType,
      eventDescription: publicNotes,
      calendarPrivacy,
      numberAttending: get(['noattending', 'numberattending', 'attending']),
      notes: adminNotes,
      rooms: unique([...(mapped.length ? mapped : extraRooms)]),
      status,
    });
  }
  return rows;
}

export function parseHboFeed(events: FeedEvent[], rooms: HallRoom[]): ImportRow[] {
  const rows: ImportRow[] = [];
  for (const event of events) {
    const start = event.start ?? '';
    const end = event.end ?? '';
    const hireDate = start.slice(0, 10);
    const timeFrom = toIsoTime(start.slice(11, 16));
    const timeTo = toIsoTime(end.slice(11, 16));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate) || !timeFrom || !timeTo) continue;
    const props = event.extendedProps ?? {};
    const fromFacility = parseFacilities(props.facility ?? '', rooms);
    const fromCodes = (props.facilityRooms ?? [])
      .flatMap((room) => roomsFromCodes(room.code ?? room.shortName ?? '', rooms));
    const id = Number(props.bookingId);
    rows.push({
      id: Number.isFinite(id) && id > 0 ? id : undefined,
      hirerName: props.name || event.title || 'Imported booking',
      email: props.email ?? '',
      telephone: props.phone ?? '',
      organisation: props.organisation ?? '',
      hireDate,
      timeFrom,
      timeTo,
      functionType: event.title ?? '',
      eventDescription: props.notes ?? '',
      calendarPrivacy: privacyFrom('', event.title ?? ''),
      notes: '',
      rooms: unique(fromFacility.length ? fromFacility : fromCodes),
      status: statusFrom(props.status ?? ''),
    });
  }
  return rows;
}

export async function fetchHboCalendar(from: string, to: string, rooms: HallRoom[]): Promise<ImportRow[]> {
  const page = await fetch(`${HBO_ORIGIN}/${HBO_VENUE}/calendar.php`);
  const html = await page.text();
  const auth = html.match(/authorisation='\s*\+\s*encodeURIComponent\('([^']+)'\)/)?.[1];
  if (!auth) throw new Error('The Hall Booking Online calendar could not be read. Upload a CSV export instead.');
  const months = monthStarts(from, to);
  const collected: ImportRow[] = [];
  for (const start of months) {
    const end = nextMonth(start);
    const url =
      `${HBO_ORIGIN}/api/internal_use/fullcalendar_feed.php?venue=${HBO_VENUE}` +
      `&authorisation=${encodeURIComponent(auth)}&start=${start}&end=${end}`;
    const response = await fetch(url, { headers: { Referer: `${HBO_ORIGIN}/${HBO_VENUE}/calendar.php` } });
    if (!response.ok) continue;
    const data = (await response.json()) as FeedEvent[];
    collected.push(...parseHboFeed(Array.isArray(data) ? data : [], rooms));
  }
  const seen = new Set<string>();
  return collected.filter((row) => {
    const key = `${row.id ?? ''}|${row.hireDate}|${row.timeFrom}|${row.rooms.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return row.hireDate >= from && row.hireDate <= to;
  });
}

export function rowToBooking(row: ImportRow, id: number): HallBooking {
  return emptyBooking({
    id,
    source: 'hbo',
    status: row.status,
    hirerName: row.hirerName,
    email: row.email,
    telephone: row.telephone,
    organisation: row.organisation,
    hireDate: row.hireDate,
    timeFrom: row.timeFrom,
    timeTo: row.timeTo,
    functionType: row.functionType,
    eventDescription: row.eventDescription,
    calendarPrivacy: row.calendarPrivacy,
    numberAttending: row.numberAttending ?? '',
    addressLine1: row.addressLine1 ?? '',
    notes: row.notes,
    rooms: row.rooms,
    johnWrightHall: row.rooms.includes('john'),
    brianPoultneyHall: row.rooms.includes('brian'),
  });
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',' || char === ';' || char === '\t') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\n') {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function valueFor(headers: string[], cells: string[], keys: string[]): string {
  for (const key of keys) {
    const index = headers.findIndex((header) => header === key || header.endsWith(key) || header.includes(key));
    if (index >= 0 && cells[index]) return cells[index].trim();
  }
  return '';
}

function toIsoDate(value: string): string {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const uk = trimmed.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (uk) {
    const year = uk[3].length === 2 ? `20${uk[3]}` : uk[3];
    return `${year}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}`;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

function toIsoTime(value: string): string {
  const trimmed = value.trim().replace(/\./g, ':');
  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFour) return `${twentyFour[1].padStart(2, '0')}:${twentyFour[2]}`;
  const compact = trimmed.match(/^(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}:${compact[2]}`;
  return '';
}

function privacyFrom(value: string, title: string): CalendarPrivacy {
  if (parseCalendarPrivacy(value) === 'private') return 'private';
  return /^private event$/i.test(title.trim()) ? 'private' : 'show';
}

function statusFrom(value: string): BookingStatus {
  const text = value.toLowerCase();
  if (text.includes('cancel')) return 'cancelled';
  if (text.includes('declin') || text.includes('reject')) return 'declined';
  if (text.includes('provisional') || text.includes('request') || text.includes('pending')) return 'held';
  if (text.includes('approv') || text.includes('confirm') || text.includes('agree')) return 'agreed';
  return 'held';
}

function roomsFromCodes(value: string, rooms: HallRoom[]): string[] {
  const text = value.toLowerCase();
  return rooms.filter((room) => text.includes(room.id) || text.includes(room.shortName.toLowerCase())).map((room) => room.id);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function monthStarts(from: string, to: string): string[] {
  const starts: string[] = [];
  let current = `${from.slice(0, 7)}-01`;
  const last = to.slice(0, 7);
  while (current.slice(0, 7) <= last) {
    starts.push(current);
    current = nextMonth(current);
  }
  return starts;
}

function nextMonth(value: string): string {
  const [year, month] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
