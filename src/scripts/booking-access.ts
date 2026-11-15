import { resetTurnstile, setupTurnstile, turnstileResponse } from './turnstile-widget';

function initBookingAccess() {
  const form = document.querySelector<HTMLFormElement>('[data-booking-access]');
  const banner = document.querySelector<HTMLElement>('[data-booking-access-banner]');
  const success = document.querySelector<HTMLElement>('[data-booking-access-success]');
  if (!form || !banner || !success) return;

  let widgetId: string | null = null;
  const siteKey = form.dataset.turnstileSitekey ?? '';

  const showBanner = (message: string) => {
    banner.hidden = !message;
    banner.textContent = message;
  };

  if (siteKey) {
    void setupTurnstile(form, siteKey)
      .then((id) => {
        widgetId = id;
      })
      .catch((error: Error) => showBanner(error.message));
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showBanner('');
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const turnstileToken = turnstileResponse(widgetId) || String(data.get('cf-turnstile-response') ?? '');
    if (siteKey && !turnstileToken) {
      showBanner('Please complete the check before continuing.');
      return;
    }
    void fetch('/api/bookings/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, turnstileToken }),
    })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) throw new Error(result.error ?? 'The link could not be sent.');
        form.hidden = true;
        success.hidden = false;
        success.textContent = result.message ?? 'If we have bookings for that address, we have emailed a link.';
      })
      .catch((error: Error) => {
        resetTurnstile(widgetId);
        showBanner(error.message);
      });
  });
}

if (typeof document !== 'undefined') initBookingAccess();
