type TurnstileApi = {
  render(el: HTMLElement, options: { sitekey: string; theme?: string }): string;
  reset(id?: string): void;
  getResponse(id?: string): string;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export async function setupTurnstile(form: HTMLFormElement, siteKey: string): Promise<string> {
  const host = form.querySelector<HTMLElement>('[data-turnstile]');
  if (!host) throw new Error('The spam check could not be loaded.');
  await loadTurnstile();
  if (!window.turnstile) throw new Error('The spam check could not be loaded.');
  return window.turnstile.render(host, { sitekey: siteKey, theme: 'light' });
}

export function turnstileResponse(widgetId: string | null): string {
  if (widgetId && window.turnstile) return window.turnstile.getResponse(widgetId) || '';
  return '';
}

export function resetTurnstile(widgetId: string | null) {
  if (widgetId) window.turnstile?.reset(widgetId);
}

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('The spam check could not be loaded.')), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.dataset.turnstileScript = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('The spam check could not be loaded.')), { once: true });
    document.head.appendChild(script);
  });
}
