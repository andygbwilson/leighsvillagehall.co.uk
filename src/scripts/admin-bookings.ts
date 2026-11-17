import {
  DEFAULT_ROOMS,
  bookingStatusLabel,
  colourForRooms,
  hallsLabel,
  recurrenceLabel,
  roomsOf,
  type HallBooking,
  type HallRoom,
} from '../lib/bookings';
import { adminFetch, bindAdminLogout } from './admin-session';

const PAGE_SIZE = 20;
type ListKey = 'unconfirmed' | 'confirmed';

function initAdminBookings() {
  const root = document.querySelector<HTMLElement>('[data-admin-bookings]');
  const search = document.querySelector<HTMLInputElement>('[data-admin-search]');
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  if (!root) return;
  bindAdminLogout();
  let bookings: HallBooking[] = [];
  let rooms: HallRoom[] = DEFAULT_ROOMS;
  const page: Record<ListKey, number> = { unconfirmed: 1, confirmed: 1 };

  const render = () => {
    const query = (search?.value ?? '').trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const matched = bookings
      .filter((booking) => booking.status !== 'declined' && booking.status !== 'cancelled')
      .filter((booking) => {
        if (query) {
          return `${booking.id} ${booking.hirerName} ${booking.email} ${booking.functionType} ${booking.organisation}`
            .toLowerCase()
            .includes(query);
        }
        return booking.hireDate >= today;
      })
      .sort((left, right) => `${left.hireDate}${left.timeFrom}`.localeCompare(`${right.hireDate}${right.timeFrom}`));
    renderList(
      'unconfirmed',
      matched.filter((booking) => booking.status !== 'agreed'),
      query ? 'No unconfirmed bookings match that search.' : 'No unconfirmed bookings.',
    );
    renderList(
      'confirmed',
      matched.filter((booking) => booking.status === 'agreed'),
      query ? 'No confirmed bookings match that search.' : 'No upcoming confirmed bookings.',
    );
  };

  const renderList = (key: ListKey, items: HallBooking[], empty: string) => {
    const rows = root.querySelector<HTMLElement>(`[data-admin-rows="${key}"]`);
    const pager = root.querySelector<HTMLElement>(`[data-pager="${key}"]`);
    const count = root.querySelector<HTMLElement>(`[data-request-count="${key}"]`);
    if (!rows) return;
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (page[key] > pages) page[key] = pages;
    const start = (page[key] - 1) * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);
    rows.innerHTML = slice.length
      ? slice.map((booking) => requestRow(booking, rooms)).join('')
      : `<tr><td colspan="5">${empty}</td></tr>`;
    if (count) count.textContent = items.length ? `(${items.length})` : '';
    if (pager) {
      pager.hidden = items.length <= PAGE_SIZE;
      const label = pager.querySelector('[data-page-label]');
      const prev = pager.querySelector<HTMLButtonElement>('[data-page-prev]');
      const next = pager.querySelector<HTMLButtonElement>('[data-page-next]');
      if (label) {
        label.textContent = `${start + 1}–${start + slice.length} of ${items.length}`;
      }
      if (prev) prev.disabled = page[key] <= 1;
      if (next) next.disabled = page[key] >= pages;
    }
  };

  search?.addEventListener('input', () => {
    page.unconfirmed = 1;
    page.confirmed = 1;
    render();
  });
  root.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-page-prev], [data-page-next]');
    const pager = target?.closest<HTMLElement>('[data-pager]');
    const key = pager?.dataset.pager as ListKey | undefined;
    if (!target || (key !== 'unconfirmed' && key !== 'confirmed')) return;
    page[key] += target.hasAttribute('data-page-next') ? 1 : -1;
    render();
  });

  void adminFetch('/api/admin/bookings')
    .then((result) => {
      const data = result as { bookings: HallBooking[]; rooms?: HallRoom[] };
      bookings = data.bookings;
      if (data.rooms?.length) rooms = data.rooms;
      render();
    })
    .catch((caught: Error) => {
      if (error) {
        error.hidden = false;
        error.textContent = caught.message;
      }
    });
}

function requestRow(booking: HallBooking, rooms: HallRoom[]): string {
  const title = booking.functionType || booking.organisation || booking.hirerName || 'Booking';
  const who = booking.hirerName && booking.hirerName !== title ? booking.hirerName : '';
  const ids = roomsOf(booking);
  const colour = colourForRooms(ids, rooms);
  const extra = [who, hallsLabel(booking, rooms), booking.isRecurring ? recurrenceLabel(booking.recurrence) || 'Recurring' : '']
    .filter(Boolean)
    .join(' · ');
  const swatches = ids
    .map((id) => {
      const room = rooms.find((item) => item.id === id);
      const fill = room?.colour || colour;
      const name = room?.fullName || id;
      return `<span class="admin-request-swatch" style="background:${escapeHtml(fill)}" title="${escapeHtml(name)}"></span>`;
    })
    .join('');
  return `
    <tr>
      <td class="admin-request-when" style="--request-colour:${escapeHtml(colour)}">${escapeHtml(formatListDate(booking.hireDate))}</td>
      <td class="admin-request-when">${escapeHtml(formatTime(booking.timeFrom))}–${escapeHtml(formatTime(booking.timeTo))}</td>
      <td>
        <span class="admin-request-title">${swatches}${escapeHtml(title)}</span>
        ${extra ? `<div class="admin-muted">${escapeHtml(extra)}</div>` : ''}
      </td>
      <td><span class="admin-status">${escapeHtml(bookingStatusLabel(booking.status))}</span></td>
      <td class="admin-request-actions">
        <a class="button button-sm button-primary" href="/admin/booking?id=${booking.id}">Review</a>
      </td>
    </tr>
  `;
}

function formatListDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatTime(value: string): string {
  return value.slice(0, 5);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (typeof document !== 'undefined') initAdminBookings();
