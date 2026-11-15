import { bookingStatusLabel, hallsLabel, type HallBooking } from '../lib/bookings';
import { formatDisplayDate } from '../lib/hire-admin';
import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminBookings() {
  const rows = document.querySelector<HTMLElement>('[data-admin-rows]');
  const search = document.querySelector<HTMLInputElement>('[data-admin-search]');
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  if (!rows) return;
  bindAdminLogout();
  let bookings: HallBooking[] = [];

  const render = () => {
    const query = (search?.value ?? '').trim().toLowerCase();
    const visible = bookings.filter((booking) => {
      if (!query) return true;
      return `${booking.id} ${booking.hirerName} ${booking.email}`.toLowerCase().includes(query);
    });
    rows.innerHTML = visible.length
      ? visible
          .map(
            (booking) => `
              <tr>
                <td><a href="/admin/booking?id=${booking.id}">${escapeHtml(formatDisplayDate(booking.hireDate))}</a></td>
                <td>${escapeHtml(`${booking.timeFrom}–${booking.timeTo}`)}</td>
                <td>${escapeHtml(booking.hirerName)}<div class="admin-muted">${escapeHtml(booking.email)}</div></td>
                <td>${escapeHtml(hallsLabel(booking))}</td>
                <td>${booking.isRecurring ? escapeHtml(booking.recurrence || 'Yes') : 'No'}</td>
                <td><span class="admin-status">${escapeHtml(bookingStatusLabel(booking.status))}</span></td>
              </tr>
            `,
          )
          .join('')
      : '<tr><td colspan="6">No booking requests match that search.</td></tr>';
  };

  search?.addEventListener('input', render);
  void adminFetch('/api/admin/bookings')
    .then((result) => {
      bookings = (result as { bookings: HallBooking[] }).bookings;
      render();
    })
    .catch((caught: Error) => {
      if (error) {
        error.hidden = false;
        error.textContent = caught.message;
      }
    });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (typeof document !== 'undefined') initAdminBookings();
