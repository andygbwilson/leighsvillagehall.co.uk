import { roleLabel, type AdminRole } from '../lib/admin-auth';
import { adminFetch, bindAdminLogout } from './admin-session';

type Account = { id: number; email: string; name: string; role: AdminRole };

function initAdminAccounts() {
  const rows = document.querySelector<HTMLElement>('[data-admin-rows]');
  const form = document.querySelector<HTMLFormElement>('[data-admin-account-form]');
  const banner = document.querySelector<HTMLElement>('[data-admin-banner]');
  if (!rows || !form || !banner) return;
  bindAdminLogout();

  const showBanner = (message: string, kind: 'error' | 'info' = 'info') => {
    banner.hidden = !message;
    banner.textContent = message;
    banner.classList.toggle('is-error', kind === 'error');
  };

  const load = () =>
    adminFetch('/api/admin/accounts').then((result) => {
      const accounts = (result as { accounts: Account[] }).accounts;
      rows.innerHTML = accounts
        .map(
          (account) => `
            <tr>
              <td>${escapeHtml(account.name)}</td>
              <td>${escapeHtml(account.email)}</td>
              <td>${escapeHtml(roleLabel(account.role))}</td>
              <td><button class="button button-secondary" type="button" data-delete="${account.id}">Remove</button></td>
            </tr>
          `,
        )
        .join('');
      rows.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach((button) => {
        button.addEventListener('click', () => {
          if (!window.confirm('Remove this admin account?')) return;
          void adminFetch(`/api/admin/accounts/${button.dataset.delete}`, { method: 'DELETE' })
            .then(() => load())
            .catch((caught: Error) => showBanner(caught.message, 'error'));
        });
      });
    });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showBanner('');
    const data = new FormData(form);
    void adminFetch('/api/admin/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: data.get('name'),
        email: data.get('email'),
        password: data.get('password'),
        role: data.get('role'),
      }),
    })
      .then(() => {
        form.reset();
        showBanner('Account added.');
        return load();
      })
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });

  void load().catch((caught: Error) => showBanner(caught.message, 'error'));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

if (typeof document !== 'undefined') initAdminAccounts();
