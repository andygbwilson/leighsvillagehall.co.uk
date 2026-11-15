import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminCalendar() {
  bindAdminLogout();
  const error = document.querySelector<HTMLElement>('[data-admin-error]');
  const hold = document.querySelector<HTMLFormElement>('[data-admin-hold]');
  const recurring = document.querySelector<HTMLInputElement>('[data-admin-recurring]');
  const wrap = document.querySelector<HTMLElement>('[data-recurrence-fields]');
  const importer = document.querySelector<HTMLFormElement>('[data-admin-import]');
  const copyYear = document.querySelector<HTMLFormElement>('[data-admin-copy-year]');
  const year = new Date().getFullYear();

  const showError = (message: string) => {
    if (!error) return;
    error.hidden = !message;
    error.textContent = message;
    error.classList.toggle('is-error', Boolean(message));
  };

  const sync = () => {
    if (wrap && recurring) wrap.hidden = !recurring.checked;
  };
  recurring?.addEventListener('change', sync);
  sync();

  if (copyYear) {
    (copyYear.elements.namedItem('fromYear') as HTMLInputElement).value = String(year);
    (copyYear.elements.namedItem('toYear') as HTMLInputElement).value = String(year + 1);
  }

  hold?.addEventListener('submit', (event) => {
    event.preventDefault();
    showError('');
    const data = new FormData(hold);
    void adminFetch('/api/admin/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        hirerName: String(data.get('hirerName') ?? ''),
        email: String(data.get('email') ?? ''),
        telephone: String(data.get('telephone') ?? ''),
        hireDate: String(data.get('hireDate') ?? ''),
        timeFrom: String(data.get('timeFrom') ?? ''),
        timeTo: String(data.get('timeTo') ?? ''),
        rooms: data.getAll('rooms').map(String),
        notes: String(data.get('notes') ?? ''),
        isRecurring: data.get('isRecurring') === 'true',
        recurrence: String(data.get('recurrence') ?? ''),
        recurrenceUntil: String(data.get('recurrenceUntil') ?? ''),
      }),
    })
      .then(() => window.location.reload())
      .catch((caught: Error) => showError(caught.message));
  });

  importer?.addEventListener('submit', (event) => {
    event.preventDefault();
    showError('');
    const data = new FormData(importer);
    const file = (importer.elements.namedItem('file') as HTMLInputElement).files?.[0];
    const send = (csv: string) =>
      adminFetch('/api/admin/bookings/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csv }),
      }).then((result) => {
        const summary = result as { created?: number; updated?: number; skipped?: unknown[] };
        showError(
          `Imported ${summary.created ?? 0} bookings, updated ${summary.updated ?? 0}, skipped ${summary.skipped?.length ?? 0}.`,
        );
        error?.classList.remove('is-error');
        window.setTimeout(() => window.location.reload(), 1200);
      });
    if (file) {
      void file.text().then(send).catch((caught: Error) => showError(caught.message));
      return;
    }
    const csv = String(data.get('csv') ?? '');
    if (!csv.trim()) {
      showError('Choose a CSV file or paste the export first.');
      return;
    }
    void send(csv).catch((caught: Error) => showError(caught.message));
  });

  importer?.querySelector('[data-import-calendar]')?.addEventListener('click', () => {
    showError('');
    const data = new FormData(importer);
    void adminFetch('/api/admin/bookings/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromCalendar: true,
        from: String(data.get('from') ?? `${year}-01-01`),
        to: String(data.get('to') ?? `${year + 1}-12-31`),
      }),
    })
      .then((result) => {
        const summary = result as { created?: number; updated?: number; skipped?: unknown[] };
        showError(
          `Imported ${summary.created ?? 0} bookings from the public calendar, updated ${summary.updated ?? 0}, skipped ${summary.skipped?.length ?? 0}.`,
        );
        error?.classList.remove('is-error');
        window.setTimeout(() => window.location.reload(), 1200);
      })
      .catch((caught: Error) => showError(caught.message));
  });

  copyYear?.addEventListener('submit', (event) => {
    event.preventDefault();
    showError('');
    const data = new FormData(copyYear);
    void adminFetch('/api/admin/bookings/copy-year', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fromYear: Number(data.get('fromYear')),
        toYear: Number(data.get('toYear')),
      }),
    })
      .then((result) => {
        const summary = result as { created?: number; skipped?: number };
        showError(`Copied ${summary.created ?? 0} bookings. ${summary.skipped ?? 0} skipped because of clashes.`);
        error?.classList.remove('is-error');
        window.setTimeout(() => window.location.reload(), 1200);
      })
      .catch((caught: Error) => showError(caught.message));
  });
}

if (typeof document !== 'undefined') initAdminCalendar();
