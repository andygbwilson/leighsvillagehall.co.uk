import {
  DEFAULT_ROOMS,
  colourForRooms,
  hallsLabel,
  type HallRoom,
} from '../lib/bookings';
import { formatStatus } from '../lib/hire-admin';
import type { HireAgreementSummary } from '../lib/hire-agreement';
import { adminFetch, bindAdminLogout } from './admin-session';

const PAGE_SIZE = 20;
type ListKey = 'unconfirmed' | 'confirmed';

function initAdminList() {
  const root = document.querySelector<HTMLElement>('[data-admin-list]');
  const search = document.querySelector<HTMLInputElement>('[data-admin-search]');
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  if (!root) return;

  bindAdminLogout();
  let agreements: HireAgreementSummary[] = [];
  let rooms: HallRoom[] = DEFAULT_ROOMS;
  const page: Record<ListKey, number> = { unconfirmed: 1, confirmed: 1 };

  const render = () => {
    const query = (search?.value ?? '').trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    const matched = agreements
      .filter((item) => {
        if (query) {
          return `${item.bookingNumber} ${item.hirerName} ${item.email} ${item.functionType} ${item.hireDate}`
            .toLowerCase()
            .includes(query);
        }
        return !item.hireDate || item.hireDate >= today;
      })
      .sort((left, right) => `${left.hireDate}${left.timeFrom}`.localeCompare(`${right.hireDate}${right.timeFrom}`));
    renderList(
      'unconfirmed',
      matched.filter((item) => item.status !== 'submitted'),
      query ? 'No unconfirmed agreements match that search.' : 'No unconfirmed hire agreements.',
    );
    renderList(
      'confirmed',
      matched.filter((item) => item.status === 'submitted'),
      query ? 'No confirmed agreements match that search.' : 'No upcoming confirmed hire agreements.',
    );
  };

  const renderList = (key: ListKey, items: HireAgreementSummary[], empty: string) => {
    const rows = root.querySelector<HTMLElement>(`[data-admin-rows="${key}"]`);
    const pager = root.querySelector<HTMLElement>(`[data-pager="${key}"]`);
    const count = root.querySelector<HTMLElement>(`[data-request-count="${key}"]`);
    if (!rows) return;
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    if (page[key] > pages) page[key] = pages;
    const start = (page[key] - 1) * PAGE_SIZE;
    const slice = items.slice(start, start + PAGE_SIZE);
    rows.innerHTML = slice.length
      ? slice.map((item) => agreementRow(item, rooms)).join('')
      : `<tr><td colspan="5">${empty}</td></tr>`;
    if (count) count.textContent = items.length ? `(${items.length})` : '';
    if (pager) {
      pager.hidden = items.length <= PAGE_SIZE;
      const label = pager.querySelector('[data-page-label]');
      const prev = pager.querySelector<HTMLButtonElement>('[data-page-prev]');
      const next = pager.querySelector<HTMLButtonElement>('[data-page-next]');
      if (label) label.textContent = `${start + 1}–${start + slice.length} of ${items.length}`;
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

  void Promise.all([adminFetch('/api/admin/hire-agreements'), adminFetch('/api/admin/rooms')])
    .then(([agreementResult, roomResult]) => {
      agreements = (agreementResult as { agreements?: HireAgreementSummary[] }).agreements ?? [];
      const listed = (roomResult as { rooms?: HallRoom[] }).rooms;
      if (listed?.length) rooms = listed;
      render();
    })
    .catch((caught: Error) => {
      if (error) {
        error.hidden = false;
        error.textContent = caught.message;
      }
    });
}

function agreementRow(item: HireAgreementSummary, rooms: HallRoom[]): string {
  const title = item.functionType || item.hirerName || 'Hire agreement';
  const who = item.hirerName && item.hirerName !== title ? item.hirerName : '';
  const ids = roomsFromAgreement(item);
  const colour = colourForRooms(ids, rooms);
  const extra = [
    who,
    ids.length
      ? hallsLabel(
          { johnWrightHall: item.johnWrightHall === 'yes', brianPoultneyHall: item.brianPoultneyHall === 'yes', rooms: ids },
          rooms,
        )
      : '',
    `Booking ${item.bookingNumber}`,
    item.inviteSentAt ? 'Invite sent' : 'Invite not sent',
  ]
    .filter(Boolean)
    .join(' · ');
  const swatches = ids
    .map((id) => {
      const room = rooms.find((entry) => entry.id === id);
      const fill = room?.colour || colour;
      const name = room?.fullName || id;
      return `<span class="admin-request-swatch" style="background:${escapeHtml(fill)}" title="${escapeHtml(name)}"></span>`;
    })
    .join('');
  const href = `/admin/agreement?booking=${encodeURIComponent(item.bookingNumber)}`;
  return `
    <tr>
      <td class="admin-request-when" style="--request-colour:${escapeHtml(colour)}">${escapeHtml(formatListDate(item.hireDate) || '—')}</td>
      <td class="admin-request-when">${escapeHtml(item.timeFrom && item.timeTo ? `${formatTime(item.timeFrom)}–${formatTime(item.timeTo)}` : '—')}</td>
      <td>
        <span class="admin-request-title">${swatches}${escapeHtml(title)}</span>
        ${extra ? `<div class="admin-muted">${escapeHtml(extra)}</div>` : ''}
      </td>
      <td><span class="admin-status admin-status-${item.status}">${escapeHtml(formatStatus(item.status))}</span></td>
      <td class="admin-request-actions">
        <a class="button button-sm button-primary" href="${href}">Review</a>
      </td>
    </tr>
  `;
}

function roomsFromAgreement(item: HireAgreementSummary): string[] {
  const ids: string[] = [];
  if (item.johnWrightHall === 'yes') ids.push('john');
  if (item.brianPoultneyHall === 'yes') ids.push('brian');
  return ids;
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
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initAdminList();
