import { ADMIN_HOME, safeAdminNext } from '../lib/hire-admin';

function initAdminLogin() {
  const form = document.querySelector<HTMLFormElement>('[data-admin-login]');
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  if (!form || !error) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    error.hidden = true;
    const password = String(new FormData(form).get('password') ?? '');
    void fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(result.error ?? 'Sign in failed.');
        const next = new URLSearchParams(window.location.search).get('next') ?? ADMIN_HOME;
        window.location.assign(safeAdminNext(next));
      })
      .catch((caught: Error) => {
        error.hidden = false;
        error.textContent = caught.message;
      });
  });
}

if (typeof document !== 'undefined') initAdminLogin();
