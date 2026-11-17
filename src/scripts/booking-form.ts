import { initPrivacyHelp } from './calendar-privacy';
import { resetTurnstile, setupTurnstile, turnstileResponse } from './turnstile-widget';

function initBookingForm() {
  const form = document.querySelector<HTMLFormElement>('[data-booking-form]');
  const banner = document.querySelector<HTMLElement>('[data-booking-banner]');
  const success = document.querySelector<HTMLElement>('[data-booking-success]');
  const successCopy = document.querySelector<HTMLElement>('[data-booking-success-copy]');
  const recurring = document.querySelector<HTMLInputElement>('[name="isRecurring"]');
  const recurrenceWrap = document.querySelector<HTMLElement>('[data-recurrence-fields]');
  if (!form || !banner || !success || !successCopy) return;

  let widgetId: string | null = null;
  const siteKey = form.dataset.turnstileSitekey ?? '';

  const showBanner = (message: string) => {
    banner.hidden = !message;
    banner.textContent = message;
  };

  const syncRecurring = () => {
    if (!recurring || !recurrenceWrap) return;
    recurrenceWrap.hidden = !recurring.checked;
    recurrenceWrap.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select').forEach((field) => {
      field.required = recurring.checked && field.name === 'recurrence';
    });
  };

  recurring?.addEventListener('change', syncRecurring);
  syncRecurring();
  initPrivacyHelp(form);
  if (siteKey) void setupTurnstile(form, siteKey).then((id) => {
    widgetId = id;
  }).catch((error: Error) => showBanner(error.message));

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    showBanner('');
    const data = new FormData(form);
    const payload = {
      hirerName: String(data.get('hirerName') ?? ''),
      organisation: String(data.get('organisation') ?? ''),
      email: String(data.get('email') ?? ''),
      telephone: String(data.get('telephone') ?? ''),
      addressLine1: String(data.get('addressLine1') ?? ''),
      town: String(data.get('town') ?? ''),
      postcode: String(data.get('postcode') ?? ''),
      hireDate: String(data.get('hireDate') ?? ''),
      timeFrom: String(data.get('timeFrom') ?? ''),
      timeTo: String(data.get('timeTo') ?? ''),
      functionType: String(data.get('functionType') ?? ''),
      eventDescription: String(data.get('eventDescription') ?? ''),
      calendarPrivacy: String(data.get('calendarPrivacy') ?? 'show'),
      numberAttending: String(data.get('numberAttending') ?? ''),
      rooms: data.getAll('rooms').map(String),
      johnWrightHall: data.getAll('rooms').includes('john'),
      brianPoultneyHall: data.getAll('rooms').includes('brian'),
      notes: String(data.get('notes') ?? ''),
      isRecurring: data.get('isRecurring') === 'true',
      recurrence: String(data.get('recurrence') ?? ''),
      recurrenceUntil: String(data.get('recurrenceUntil') ?? ''),
      turnstileToken: turnstileResponse(widgetId) || String(data.get('cf-turnstile-response') ?? ''),
    };
    if (siteKey && !payload.turnstileToken) {
      showBanner('Please complete the check before sending your enquiry.');
      return;
    }
    void fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const result = (await response.json()) as { error?: string; booking?: { id: number } };
        if (!response.ok) throw new Error(result.error ?? 'The enquiry could not be sent.');
        form.hidden = true;
        success.hidden = false;
        successCopy.textContent = `Your enquiry has been sent. Booking number ${result.booking?.id}. The booking secretary will email you if the date can be confirmed.`;
      })
      .catch((error: Error) => {
        resetTurnstile(widgetId);
        showBanner(error.message);
      });
  });
}

if (typeof document !== 'undefined') initBookingForm();
