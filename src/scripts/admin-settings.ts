import { adminFetch, bindAdminLogout } from './admin-session';

type Settings = {
  publicBookUntil: string;
  adminBookUntil: string;
  openFrom: string;
  openTo: string;
  noticeDays: number;
  gapMinutes: number;
  minDurationMinutes: number;
  highlightProvisional: boolean;
};

function initAdminSettings() {
  const form = document.querySelector<HTMLFormElement>('[data-admin-settings]');
  const banner = document.querySelector<HTMLElement>('[data-admin-banner]');
  const yearSelect = form?.elements.namedItem('publicBookUntilYear') as HTMLSelectElement | null;
  if (!form || !banner || !yearSelect) return;
  bindAdminLogout();

  const showBanner = (message: string, kind: 'error' | 'info' = 'info') => {
    banner.hidden = !message;
    banner.textContent = message;
    banner.classList.toggle('is-error', kind === 'error');
  };

  const fillYears = (selectedYear: number) => {
    const now = new Date().getFullYear();
    const years = Array.from({ length: 8 }, (_, index) => now + index);
    if (!years.includes(selectedYear)) years.unshift(selectedYear);
    yearSelect.innerHTML = years
      .map((year) => `<option value="${year}"${year === selectedYear ? ' selected' : ''}>${year} (fixed)</option>`)
      .join('');
  };

  const fill = (settings: Settings) => {
    const publicYear = Number(settings.publicBookUntil.slice(0, 4)) || new Date().getFullYear();
    fillYears(publicYear);
    (form.elements.namedItem('adminBookUntil') as HTMLInputElement).value = settings.adminBookUntil;
    (form.elements.namedItem('openFrom') as HTMLInputElement).value = settings.openFrom;
    (form.elements.namedItem('openTo') as HTMLInputElement).value = settings.openTo;
    (form.elements.namedItem('noticeDays') as HTMLInputElement).value = String(settings.noticeDays);
    (form.elements.namedItem('gapMinutes') as HTMLInputElement).value =
      settings.gapMinutes > 0 ? String(settings.gapMinutes) : '';
    (form.elements.namedItem('minDurationMinutes') as HTMLInputElement).value = String(settings.minDurationMinutes);
    (form.elements.namedItem('highlightProvisional') as HTMLInputElement).checked = settings.highlightProvisional !== false;
  };

  yearSelect.addEventListener('change', () => {
    const admin = form.elements.namedItem('adminBookUntil') as HTMLInputElement;
    const publicUntil = `${yearSelect.value}-12-31`;
    if (!admin.value || admin.value < publicUntil) admin.value = `${Number(yearSelect.value) + 1}-12-31`;
  });

  void adminFetch('/api/admin/settings')
    .then((result) => fill((result as { settings: Settings }).settings))
    .catch((caught: Error) => showBanner(caught.message, 'error'));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showBanner('');
    const data = new FormData(form);
    const publicYear = Number(data.get('publicBookUntilYear'));
    const gapRaw = String(data.get('gapMinutes') ?? '').trim();
    void adminFetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicBookUntil: `${publicYear}-12-31`,
        adminBookUntil: data.get('adminBookUntil'),
        openFrom: data.get('openFrom'),
        openTo: data.get('openTo'),
        noticeDays: Number(data.get('noticeDays')),
        gapMinutes: gapRaw === '' ? 0 : Number(gapRaw),
        minDurationMinutes: Number(data.get('minDurationMinutes')),
        highlightProvisional: data.get('highlightProvisional') === 'yes',
      }),
    })
      .then(() => showBanner('Booking settings saved.'))
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });
}

if (typeof document !== 'undefined') initAdminSettings();
