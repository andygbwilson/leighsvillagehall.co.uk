import { safeAdminNext } from '../lib/admin-auth';

export function bindAdminLogout() {
  document.querySelectorAll('[data-admin-logout]').forEach((button) => {
    button.addEventListener('click', () => {
      void fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }).finally(() => {
        window.location.assign('/admin/login');
      });
    });
  });
}

export async function adminFetch(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  const result = (await response.json()) as { error?: string };
  if (response.status === 401) {
    const login = new URL('/admin/login', window.location.origin);
    login.searchParams.set('next', safeAdminNext(window.location.pathname));
    window.location.assign(login.href);
    throw new Error('Please sign in.');
  }
  if (!response.ok) throw new Error(result.error ?? 'The request could not be completed.');
  return result;
}
