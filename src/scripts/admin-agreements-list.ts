import { formatDisplayDate, formatStatus } from '../lib/hire-admin';
import type { HireAgreementSummary } from '../lib/hire-agreement';
import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminList() {
  const root = document.querySelector<HTMLElement>('[data-admin-list]');
  const rows = document.querySelector<HTMLElement>('[data-admin-rows]');
  const search = document.querySelector<HTMLInputElement>('[data-admin-search]');
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  if (!root || !rows || !search || !error) return;

  bindAdminLogout();
  let agreements: HireAgreementSummary[] = [];

  const render = () => {
    const query = search.value.trim().toLowerCase();
    const visible = agreements.filter((item) => {
      if (!query) return true;
      return [item.bookingNumber, item.hirerName, item.email, item.hireDate].join(' ').toLowerCase().includes(query);
    });
    if (visible.length === 0) {
      rows.innerHTML = `<tr><td colspan="6">${agreements.length ? 'No agreements match that search.' : 'No hire agreements have been stored yet.'}</td></tr>`;
      return;
    }
    rows.innerHTML = visible
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(formatDisplayDate(item.hireDate) || '—')}</td>
            <td>${escapeHtml(item.timeFrom && item.timeTo ? `${item.timeFrom}–${item.timeTo}` : '—')}</td>
            <td>
              <a href="/admin/agreement?booking=${encodeURIComponent(item.bookingNumber)}">${escapeHtml(item.hirerName || 'Unnamed hirer')}</a>
              <div class="admin-muted">${escapeHtml(item.email || '')}</div>
            </td>
            <td><a href="/admin/agreement?booking=${encodeURIComponent(item.bookingNumber)}">${escapeHtml(item.bookingNumber)}</a></td>
            <td><span class="admin-status admin-status-${item.status}">${escapeHtml(formatStatus(item.status))}</span></td>
            <td>${escapeHtml(item.inviteSentAt ? 'Sent' : 'Not sent')}</td>
          </tr>
        `,
      )
      .join('');
  };

  search.addEventListener('input', render);
  void adminFetch('/api/admin/hire-agreements')
    .then((result) => {
      agreements = (result as { agreements?: HireAgreementSummary[] }).agreements ?? [];
      render();
    })
    .catch((caught: Error) => {
      error.hidden = false;
      error.textContent = caught.message;
      rows.innerHTML = '';
    });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initAdminList();
