import { bookingStatusLabel, hallsLabel, type HallBooking } from '../lib/bookings';
import { formatDisplayDate } from '../lib/hire-admin';
import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminBookingDetail() {
  const root = document.querySelector<HTMLElement>('[data-admin-booking]');
  const view = document.querySelector<HTMLElement>('[data-admin-view]');
  const banner = document.querySelector<HTMLElement>('[data-admin-banner]');
  const heading = document.querySelector<HTMLElement>('[data-admin-heading]');
  const invite = document.querySelector<HTMLButtonElement>('[data-admin-invite]');
  const decline = document.querySelector<HTMLButtonElement>('[data-admin-decline]');
  const duplicate = document.querySelector<HTMLButtonElement>('[data-admin-duplicate]');
  const agreement = document.querySelector<HTMLAnchorElement>('[data-admin-agreement]');
  const confirmWrap = document.querySelector<HTMLElement>('[data-recurring-confirm]');
  const confirmBox = document.querySelector<HTMLInputElement>('[data-confirm-recurring]');
  const id = Number(new URLSearchParams(window.location.search).get('id') ?? '');
  if (!root || !view || !banner || !invite || !decline || !id) return;
  bindAdminLogout();
  let booking: HallBooking | null = null;

  const showBanner = (message: string, kind: 'error' | 'info' = 'info') => {
    banner.hidden = !message;
    banner.textContent = message;
    banner.classList.toggle('is-error', kind === 'error');
  };

  const render = () => {
    if (!booking) return;
    if (heading) heading.textContent = `Booking ${booking.id}`;
    if (agreement) agreement.href = `/admin/agreement?booking=${booking.id}`;
    document.title = `Booking ${booking.id} | Leighs Village Hall`;
    if (confirmWrap) confirmWrap.hidden = !(booking.isRecurring && !booking.recurringConfirmed);
    invite.textContent = booking.status === 'invite_sent' ? 'Resend invite' : 'Send invite';
    invite.hidden = booking.status === 'declined' || booking.status === 'cancelled';
    decline.hidden = booking.status !== 'requested';
    view.innerHTML = `
      <p class="admin-meta">
        <span class="admin-status">${escapeHtml(bookingStatusLabel(booking.status))}</span>
        ${booking.isRecurring ? `Recurring ${escapeHtml(booking.recurrence)}${booking.recurringConfirmed ? ' (confirmed)' : ' (needs confirmation)'}.` : ''}
      </p>
      <section class="card admin-section">
        <dl class="admin-dl">
          <div><dt>When</dt><dd>${escapeHtml(formatDisplayDate(booking.hireDate))} ${escapeHtml(booking.timeFrom)}–${escapeHtml(booking.timeTo)}</dd></div>
          <div><dt>Halls</dt><dd>${escapeHtml(hallsLabel(booking))}</dd></div>
          <div><dt>Hirer</dt><dd>${escapeHtml(booking.hirerName)}<br>${escapeHtml(booking.email)}<br>${escapeHtml(booking.telephone)}</dd></div>
          <div><dt>Event</dt><dd>${escapeHtml(booking.functionType || '—')}</dd></div>
          <div><dt>Until</dt><dd>${escapeHtml(booking.recurrenceUntil ? formatDisplayDate(booking.recurrenceUntil) : '—')}</dd></div>
          <div><dt>Notes</dt><dd>${escapeHtml(booking.notes || '—')}</dd></div>
        </dl>
      </section>
    `;
  };

  invite.addEventListener('click', () => {
    showBanner('');
    void adminFetch(`/api/admin/bookings/${id}/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirmRecurring: Boolean(confirmBox?.checked) }),
    })
      .then((result) => {
        booking = (result as { booking: HallBooking }).booking;
        render();
        showBanner('The hire agreement invite has been sent.');
      })
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });

  duplicate?.addEventListener('click', () => {
    if (!booking) return;
    const year = Number(booking.hireDate.slice(0, 4)) + 1;
    showBanner('');
    void adminFetch(`/api/admin/bookings/${id}/duplicate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year }),
    })
      .then((result) => {
        const copy = (result as { booking: HallBooking }).booking;
        showBanner(`Copied to ${copy.hireDate} as booking ${copy.id}.`);
      })
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });

  decline.addEventListener('click', () => {
    if (!window.confirm('Decline this booking request?')) return;
    showBanner('');
    void adminFetch(`/api/admin/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'declined' }),
    })
      .then((result) => {
        booking = (result as { booking: HallBooking }).booking;
        render();
        showBanner('The booking request was declined.');
      })
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });

  void adminFetch(`/api/admin/bookings/${id}`)
    .then((result) => {
      booking = (result as { booking: HallBooking }).booking;
      render();
    })
    .catch((caught: Error) => showBanner(caught.message, 'error'));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (typeof document !== 'undefined') initAdminBookingDetail();
