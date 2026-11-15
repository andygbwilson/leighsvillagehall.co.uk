import {
  ADMIN_FIELD_GROUPS,
  formatAgreementValue,
  formatDisplayDate,
  formatStatus,
} from '../lib/hire-admin';
import { normaliseHireAgreement, type HireAgreementPayload, type HireAgreementRecord } from '../lib/hire-agreement';
import { adminFetch, bindAdminLogout } from './admin-session';

function initAdminDetail() {
  const root = document.querySelector<HTMLElement>('[data-admin-detail]');
  const view = document.querySelector<HTMLElement>('[data-admin-view]');
  const form = document.querySelector<HTMLFormElement>('[data-admin-form]');
  const banner = document.querySelector<HTMLElement>('[data-admin-banner]');
  const editButton = document.querySelector<HTMLButtonElement>('[data-admin-edit]');
  const saveButton = document.querySelector<HTMLButtonElement>('[data-admin-save]');
  const cancelButton = document.querySelector<HTMLButtonElement>('[data-admin-cancel]');
  const inviteButton = document.querySelector<HTMLButtonElement>('[data-admin-invite]');
  const heading = document.querySelector<HTMLElement>('[data-admin-heading]');
  const bookingNumber = root?.dataset.booking || new URLSearchParams(window.location.search).get('booking') || '';
  if (!root || !view || !form || !banner || !editButton || !saveButton || !cancelButton || !inviteButton || !bookingNumber) return;
  if (heading) heading.textContent = `Hire agreement ${bookingNumber}`;
  document.title = `Hire agreement ${bookingNumber} | Leighs Village Hall`;

  bindAdminLogout();
  let record: HireAgreementRecord | null = null;
  let editing = false;

  const showBanner = (message: string, kind: 'error' | 'info' = 'info') => {
    banner.hidden = !message;
    banner.textContent = message;
    banner.classList.toggle('is-error', kind === 'error');
  };

  const syncInviteButton = () => {
    inviteButton.hidden = editing;
    inviteButton.disabled = false;
    inviteButton.textContent = record?.inviteSentAt ? 'Resend invite' : 'Send invite';
  };

  const setMode = (next: boolean) => {
    editing = next;
    view.hidden = next;
    form.hidden = !next;
    editButton.hidden = next;
    saveButton.hidden = !next;
    cancelButton.hidden = !next;
    syncInviteButton();
  };

  const render = () => {
    if (!record) return;
    syncInviteButton();
    view.innerHTML = `
      <p class="admin-meta">
        <span class="admin-status admin-status-${record.status}">${escapeHtml(formatStatus(record.status))}</span>
        ${record.inviteSentAt ? `Invite sent ${escapeHtml(formatDisplayDate(record.inviteSentAt.slice(0, 10)))}.` : 'Invite not sent.'}
        Updated ${escapeHtml(record.updatedAt ? new Date(record.updatedAt).toLocaleString('en-GB') : '—')}.
      </p>
      ${ADMIN_FIELD_GROUPS.map(
        (group) => `
          <section class="card admin-section">
            <h2>${escapeHtml(group.title)}</h2>
            <dl class="admin-dl">
              ${group.fields
                .map(
                  (field) => `
                    <div>
                      <dt>${escapeHtml(field.label)}</dt>
                      <dd>${escapeHtml(formatAgreementValue(field.key, record![field.key]))}</dd>
                    </div>
                  `,
                )
                .join('')}
            </dl>
          </section>
        `,
      ).join('')}
    `;
    form.innerHTML = ADMIN_FIELD_GROUPS.map(
      (group) => `
        <fieldset class="card">
          <legend>${escapeHtml(group.title)}</legend>
          ${group.fields.map((field) => fieldMarkup(field.key, field.label, field.type, record!)).join('')}
        </fieldset>
      `,
    ).join('');
  };

  const readForm = (): HireAgreementPayload => {
    const data = new FormData(form);
    const str = (name: string) => String(data.get(name) ?? '');
    const yesNo = (name: string) => {
      const value = str(name);
      return value === 'yes' || value === 'no' ? value : '';
    };
    const payment = str('paymentMethod');
    const supply = str('alcoholSupply');
    return {
      bookingNumber,
      hirerName: str('hirerName'),
      organisation: str('organisation'),
      position: str('position'),
      addressLine1: str('addressLine1'),
      addressLine2: str('addressLine2'),
      town: str('town'),
      county: str('county'),
      postcode: str('postcode'),
      telephone: str('telephone'),
      mobile: str('mobile'),
      email: str('email'),
      hireDate: str('hireDate'),
      timeFrom: str('timeFrom'),
      timeTo: str('timeTo'),
      functionType: str('functionType'),
      numberAttending: str('numberAttending'),
      johnWrightHall: yesNo('johnWrightHall'),
      brianPoultneyHall: yesNo('brianPoultneyHall'),
      kitchen: yesNo('kitchen'),
      stage: yesNo('stage'),
      inflatable: yesNo('inflatable'),
      largeTables: str('largeTables'),
      standardChairs: str('standardChairs'),
      smallTables: str('smallTables'),
      nurseryTables: str('nurseryTables'),
      nurseryChairs: str('nurseryChairs'),
      crockery: yesNo('crockery'),
      entertainment: str('entertainment'),
      musicPlayed: yesNo('musicPlayed'),
      musicCeaseTime: str('musicCeaseTime'),
      alcoholConsumed: yesNo('alcoholConsumed'),
      alcoholSupply: supply === 'sold' || supply === 'free' ? supply : '',
      tenAcknowledged: data.get('tenAcknowledged') === 'true',
      paymentMethod:
        payment === 'cash' || payment === 'cheque' || payment === 'bank' || payment === 'later' ? payment : '',
      depositDue: str('depositDue'),
      amountPaid: str('amountPaid'),
      balanceDue: str('balanceDue'),
      publicLiabilityRead: data.get('publicLiabilityRead') === 'true',
      healthSafetyAgreed: data.get('healthSafetyAgreed') === 'true',
      conditionsAgreed: data.get('conditionsAgreed') === 'true',
      signedDate: str('signedDate'),
    };
  };

  editButton.addEventListener('click', () => {
    showBanner('');
    setMode(true);
  });
  cancelButton.addEventListener('click', () => {
    showBanner('');
    render();
    setMode(false);
  });
  saveButton.addEventListener('click', () => {
    showBanner('');
    void adminFetch(`/api/admin/hire-agreements/${encodeURIComponent(bookingNumber)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(readForm()),
    })
      .then((result) => {
        record = normaliseHireAgreement((result as { record: HireAgreementRecord }).record);
        render();
        setMode(false);
        showBanner('The hire agreement has been updated.');
      })
      .catch((caught: Error) => showBanner(caught.message, 'error'));
  });
  inviteButton.addEventListener('click', () => {
    if (!record) return;
    const email = record.email.trim();
    const again = Boolean(record.inviteSentAt);
    const prompt = email
      ? `${again ? 'Send the hire agreement email again' : 'Send the hire agreement invite'} to ${email}?`
      : 'Add the hirer’s email address before sending the invite.';
    if (!email || !window.confirm(prompt)) return;
    showBanner('');
    inviteButton.disabled = true;
    inviteButton.textContent = 'Sending…';
    void adminFetch(`/api/admin/hire-agreements/${encodeURIComponent(bookingNumber)}/invite`, {
      method: 'POST',
    })
      .then((result) => {
        const payload = result as { record: HireAgreementRecord; delivered?: boolean };
        record = normaliseHireAgreement(payload.record);
        render();
        showBanner(
          payload.delivered === false
            ? `The invite was marked as sent to ${record.email}. Locally the email is logged, not delivered.`
            : `The hire agreement invite has been sent to ${record.email}.`,
        );
      })
      .catch((caught: Error) => {
        syncInviteButton();
        showBanner(caught.message, 'error');
      });
  });

  void adminFetch(`/api/admin/hire-agreements/${encodeURIComponent(bookingNumber)}`)
    .then((result) => {
      record = normaliseHireAgreement((result as { record: HireAgreementRecord }).record);
      render();
      setMode(false);
    })
    .catch((caught: Error) => showBanner(caught.message, 'error'));
}

function fieldMarkup(
  key: string,
  label: string,
  type: string,
  record: HireAgreementRecord,
): string {
  const value = record[key as keyof HireAgreementRecord];
  if (type === 'yesno') {
    return choice(label, key, [
      ['yes', 'Yes'],
      ['no', 'No'],
    ], String(value ?? ''));
  }
  if (type === 'alcohol') {
    return choice(label, key, [
      ['sold', 'Sold'],
      ['free', 'Free'],
    ], String(value ?? ''));
  }
  if (type === 'payment') {
    return choice(label, key, [
      ['cash', 'Cash'],
      ['cheque', 'Cheque'],
      ['bank', 'Online banking'],
      ['later', 'Arrange with the booking secretary'],
    ], String(value ?? ''));
  }
  if (type === 'checkbox') {
    return `<label class="ha-check"><input type="checkbox" name="${key}" value="true" ${value ? 'checked' : ''} /><span>${escapeHtml(label)}</span></label>`;
  }
  if (type === 'textarea') {
    return `<label class="ha-field"><span>${escapeHtml(label)}</span><textarea name="${key}" rows="3">${escapeHtml(String(value ?? ''))}</textarea></label>`;
  }
  const inputType = type === 'number' ? 'number' : type;
  const extra =
    key === 'postcode'
      ? ' autocomplete="postal-code" maxlength="10" spellcheck="false"'
      : key === 'addressLine1'
        ? ' autocomplete="address-line1"'
        : key === 'addressLine2'
          ? ' autocomplete="address-line2"'
          : key === 'town'
            ? ' autocomplete="address-level2"'
            : key === 'county'
              ? ' autocomplete="address-level1"'
              : key === 'depositDue' || key === 'amountPaid' || key === 'balanceDue'
                ? ' inputmode="decimal"'
                : '';
  const fieldClass = key === 'postcode' ? 'ha-field ha-postcode' : 'ha-field';
  return `<label class="${fieldClass}"><span>${escapeHtml(label)}</span><input name="${key}" type="${inputType}" value="${escapeHtml(String(value ?? ''))}"${extra} /></label>`;
}

function choice(label: string, name: string, options: [string, string][], selected: string): string {
  return `
    <div class="ha-field">
      <span>${escapeHtml(label)}</span>
      <div class="ha-choice">
        ${options
          .map(
            ([value, text]) => `
              <label>
                <input type="radio" name="${name}" value="${value}" ${selected === value ? 'checked' : ''} />
                ${escapeHtml(text)}
              </label>
            `,
          )
          .join('')}
      </div>
    </div>
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initAdminDetail();
