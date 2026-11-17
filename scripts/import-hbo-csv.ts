import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ROOMS } from '../src/lib/bookings.ts';
import { parseHboCsv } from '../src/lib/hbo-import.ts';
import { createBookingStore } from '../src/lib/booking-store.ts';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: node --experimental-strip-types scripts/import-hbo-csv.ts <file.csv>');
  process.exit(1);
}

const bookingSystemPath = path.join(process.cwd(), '.data', 'booking-system.json');
const store = createBookingStore({
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

const csv = await readFile(csvPath, 'utf8');
const rooms = (await store.listRooms()) ?? DEFAULT_ROOMS;
const rows = parseHboCsv(csv, rooms);
const missingRooms = rows.filter((row) => !row.rooms.length).length;
const privateCount = rows.filter((row) => row.calendarPrivacy === 'private').length;
console.log(
  `Parsed ${rows.length} bookings (${missingRooms} without a hall, ${privateCount} private). Importing…`,
);
const result = await store.importEvents(rows);
console.log(
  `Imported ${result.created} new, updated ${result.updated}, skipped ${result.skipped.length}.`,
);
if (result.skipped.length) {
  console.log('First skipped:', result.skipped.slice(0, 15));
}
