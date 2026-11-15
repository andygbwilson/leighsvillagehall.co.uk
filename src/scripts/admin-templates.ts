import type { EmailTemplate } from '../lib/bookings';
import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminTemplates() {
  const list = document.querySelector<HTMLElement>('[data-admin-template-list]');
  const banner = document.querySelector<HTMLElement>('[data-admin-banner]');
  if (!list || !banner) return;
  bindAdminLogout();

  const showBanner = (message: string, kind: 'error' | 'info' = 'info') => {
    banner.hidden = !message;
    banner.textContent = message;
    banner.classList.toggle('is-error', kind === 'error');
  };

  void adminFetch('/api/admin/templates')
    .then((result) => {
      const templates = (result as { templates: EmailTemplate[] }).templates;
      list.innerHTML = templates
        .map(
          (template) => `
            <form class="card admin-section" data-template-form data-slug="${escapeHtml(template.slug)}">
              <h2>${escapeHtml(template.name)}</h2>
              <label class="ha-field"><span>Subject</span><input name="subject" value="${escapeHtml(template.subject)}" required /></label>
              <label class="ha-field"><span>Email text</span><textarea name="body" rows="10" required>${escapeHtml(template.body)}</textarea></label>
              <div class="actions"><button class="button button-primary" type="submit">Save template</button></div>
            </form>
          `,
        )
        .join('');
      list.querySelectorAll<HTMLFormElement>('[data-template-form]').forEach((form) => {
        form.addEventListener('submit', (event) => {
          event.preventDefault();
          const slug = form.dataset.slug ?? '';
          const data = new FormData(form);
          void adminFetch(`/api/admin/templates/${encodeURIComponent(slug)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ subject: data.get('subject'), body: data.get('body') }),
          })
            .then(() => showBanner('Template saved.'))
            .catch((caught: Error) => showBanner(caught.message, 'error'));
        });
      });
    })
    .catch((caught: Error) => showBanner(caught.message, 'error'));
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initAdminTemplates();
