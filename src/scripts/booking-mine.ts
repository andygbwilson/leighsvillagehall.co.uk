import type { HirerBookingView } from '../lib/hirer-access';

type HirerBookingsResponse = {
  email?: string;
  hirerName?: string;
  upcoming?: HirerBookingView[];
  past?: HirerBookingView[];
  error?: string;
};

function initBookingMine() {
  const root = document.querySelector<HTMLElement>('[data-hirer-bookings]');
  const intro = document.querySelector<HTMLElement>('[data-hirer-intro]');
  const logout = document.querySelector<HTMLButtonElement>('[data-hirer-logout]');
  if (!root || !intro || !logout) return;
  const banner = root.querySelector<HTMLElement>('[data-hirer-banner]');
  const upcoming = root.querySelector<HTMLElement>('[data-hirer-upcoming]');
  const past = root.querySelector<HTMLElement>('[data-hirer-past]');
  const newLink = document.querySelector<HTMLAnchorElement>('[data-hirer-new-link]');
  if (!banner || !upcoming || !past) return;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  const url = token ? `/api/bookings/mine?token=${encodeURIComponent(token)}` : '/api/bookings/mine';

  void fetch(url, { credentials: 'same-origin' })
    .then(async (response) => {
      const result = (await response.json()) as HirerBookingsResponse;
      if (!response.ok) throw new Error(result.error ?? 'This link has expired.');
      if (token) {
        const clean = new URL(window.location.href);
        clean.searchParams.delete('token');
        window.history.replaceState({}, '', clean.pathname + clean.search);
      }
      const who = result.hirerName ? `${result.hirerName} · ${result.email}` : result.email;
      intro.textContent = who ? `Bookings for ${who}.` : 'Your bookings.';
      upcoming.innerHTML = renderGroup('Upcoming', result.upcoming ?? [], 'No upcoming bookings.');
      past.innerHTML = renderGroup('Past', result.past ?? [], 'No past bookings.');
      logout.hidden = false;
    })
    .catch(() => {
      intro.textContent = 'This link has expired or is missing.';
      banner.hidden = false;
      banner.textContent = 'Use the email from your booking to request a new 24-hour link.';
      if (newLink) newLink.hidden = false;
    });

  logout.addEventListener('click', () => {
    void fetch('/api/bookings/mine/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
      window.location.href = '/bookings/access';
    });
  });
}

function renderGroup(title: string, bookings: HirerBookingView[], empty: string): string {
  if (!bookings.length) {
    return `<section class="hirer-group"><h2>${escapeHtml(title)}</h2><p class="ha-note">${escapeHtml(empty)}</p></section>`;
  }
  return `<section class="hirer-group"><h2>${escapeHtml(title)}</h2><div class="hirer-list">${bookings.map(renderBooking).join('')}</div></section>`;
}

function renderBooking(booking: HirerBookingView): string {
  const agreement = booking.agreementUrl
    ? `<p><a class="button button-secondary" href="${escapeHtml(booking.agreementUrl)}">Open hire agreement</a></p>`
    : '';
  const recurring = booking.isRecurring || booking.isOccurrence ? '<p class="ha-note">Part of a recurring booking.</p>' : '';
  return `<article class="card hirer-booking">
    <header>
      <h3>${escapeHtml(booking.dayLabel)}</h3>
      <span class="hirer-status">${escapeHtml(booking.statusLabel)}</span>
    </header>
    <p>${escapeHtml(booking.timeFrom)} to ${escapeHtml(booking.timeTo)} · ${escapeHtml(booking.halls)}</p>
    <p>${escapeHtml(booking.event)}</p>
    <p>Booking number ${escapeHtml(String(booking.id))}</p>
    ${recurring}
    ${agreement}
  </article>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initBookingMine();
