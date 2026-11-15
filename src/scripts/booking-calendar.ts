type Room = { id: string; shortName: string; fullName: string; colour: string; public: boolean };
type CalendarEvent = {
  id?: number;
  date: string;
  timeFrom: string;
  timeTo: string;
  title: string;
  rooms: string[];
  colour: string;
  status: 'provisional' | 'booked';
  hirerName?: string;
  email?: string;
  telephone?: string;
  organisation?: string;
  notes?: string;
  bookingStatus?: string;
};

type ViewMode = 'month' | 'week' | 'day' | 'list';

function initCalendars() {
  document.querySelectorAll<HTMLElement>('[data-booking-calendar]').forEach(initCalendar);
}

function initCalendar(root: HTMLElement) {
  const isAdmin = root.dataset.admin === 'true';
  const title = root.querySelector<HTMLElement>('[data-cal-title]');
  const stage = root.querySelector<HTMLElement>('[data-cal-stage]');
  const note = root.querySelector<HTMLElement>('[data-cal-note]');
  const prev = root.querySelector<HTMLButtonElement>('[data-cal-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-cal-next]');
  const todayBtn = root.querySelector<HTMLButtonElement>('[data-cal-today]');
  const monthSelect = root.querySelector<HTMLSelectElement>('[data-cal-month]');
  const yearSelect = root.querySelector<HTMLSelectElement>('[data-cal-year]');
  const roomSelect = root.querySelector<HTMLSelectElement>('[data-cal-room]');
  const legend = root.querySelector<HTMLElement>('[data-cal-legend]');
  const overview = root.querySelector<HTMLDialogElement>('[data-cal-overview]');
  const overviewHead = root.querySelector<HTMLElement>('[data-cal-overview-head]');
  const overviewTitle = root.querySelector<HTMLElement>('[data-cal-overview-title]');
  const overviewBody = root.querySelector<HTMLElement>('[data-cal-overview-body]');
  const overviewOpen = root.querySelector<HTMLAnchorElement>('[data-cal-overview-open]');
  if (!title || !stage || !prev || !next || !monthSelect || !yearSelect || !roomSelect) return;

  let cursor = startOfMonth(new Date());
  let view: ViewMode = 'month';
  let roomFilter = '';
  let publicUntil = '';
  let adminUntil = '';
  let highlightProvisional = true;
  let rooms: Room[] = [];
  let events: CalendarEvent[] = [];
  let openFrom = '08:00';
  let openTo = '23:30';

  const rangeForView = () => {
    if (view === 'week') return { from: isoDate(startOfWeek(cursor)), to: isoDate(endOfWeek(cursor)) };
    if (view === 'day') return { from: isoDate(cursor), to: isoDate(cursor) };
    return { from: isoDate(startOfMonth(cursor)), to: isoDate(endOfMonth(cursor)) };
  };

  const fillSelectors = () => {
    const year = cursor.getFullYear();
    const maxYear = Number((isAdmin ? adminUntil : publicUntil).slice(0, 4) || year + 1);
    yearSelect.innerHTML = Array.from({ length: Math.max(1, maxYear - year + 3) }, (_, index) => year - 1 + index)
      .filter((value) => value >= year - 1)
      .map((value) => `<option value="${value}"${value === cursor.getFullYear() ? ' selected' : ''}>${value}</option>`)
      .join('');
    monthSelect.innerHTML = Array.from({ length: 12 }, (_, index) => {
      const label = new Date(2000, index, 1).toLocaleDateString('en-GB', { month: 'long' });
      return `<option value="${index}"${index === cursor.getMonth() ? ' selected' : ''}>${label}</option>`;
    }).join('');
  };

  const fillRooms = () => {
    const current = roomSelect.value;
    roomSelect.innerHTML = [
      '<option value="">All rooms</option>',
      ...rooms.map((room) => `<option value="${escapeHtml(room.id)}">${escapeHtml(room.fullName)}</option>`),
      '<option value="__multi__">Multiple facilities</option>',
    ].join('');
    roomSelect.value = current;
    if (legend) {
      legend.innerHTML = [
        ...rooms.map(
          (room) =>
            `<li><span class="cal-swatch" style="background:${escapeHtml(room.colour)}"></span>${escapeHtml(room.fullName)}</li>`,
        ),
        `<li><span class="cal-swatch is-multi"></span>Multiple facilities</li>`,
      ].join('');
    }
    document.querySelectorAll<HTMLElement>('[data-room-choices]').forEach((target) => {
      const visible = isAdmin ? rooms : rooms.filter((room) => room.public);
      target.innerHTML = visible
        .map(
          (room) =>
            `<label><input type="checkbox" name="rooms" value="${escapeHtml(room.id)}" /> ${escapeHtml(room.fullName)}</label>`,
        )
        .join('');
    });
  };

  const visibleEvents = () =>
    events.filter((event) => {
      if (!roomFilter) return true;
      if (roomFilter === '__multi__') return event.rooms.length > 1;
      return event.rooms.includes(roomFilter);
    });

  const load = async () => {
    const { from, to } = rangeForView();
    const path = isAdmin
      ? `/api/admin/calendar?from=${from}&to=${to}`
      : `/api/bookings/calendar?from=${from}&to=${to}`;
    const response = await fetch(path, { credentials: 'same-origin' });
    const result = (await response.json()) as {
      events?: CalendarEvent[];
      rooms?: Room[];
      settings?: {
        publicBookUntil?: string;
        adminBookUntil?: string;
        highlightProvisional?: boolean;
        openFrom?: string;
        openTo?: string;
      };
      error?: string;
    };
    if (!response.ok) throw new Error(result.error ?? 'The calendar could not be loaded.');
    events = result.events ?? [];
    rooms = result.rooms ?? rooms;
    publicUntil = result.settings?.publicBookUntil ?? publicUntil;
    adminUntil = result.settings?.adminBookUntil ?? adminUntil;
    highlightProvisional = result.settings?.highlightProvisional !== false;
    openFrom = result.settings?.openFrom || openFrom;
    openTo = result.settings?.openTo || openTo;
    fillSelectors();
    fillRooms();
    title.textContent = viewTitle(cursor, view);
    root.querySelectorAll('[data-cal-view-btn]').forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-cal-view-btn') === view);
    });
    if (note) {
      note.textContent = isAdmin
        ? `Admin calendar is open until ${formatDay(adminUntil)}. Public requests close ${formatDay(publicUntil)}.`
        : publicUntil
          ? `Online requests are open until ${formatDay(publicUntil)}.`
          : '';
    }
    render();
  };

  const render = () => {
    const items = visibleEvents();
    if (view === 'list') stage.innerHTML = renderList(items, isAdmin);
    else if (view === 'week') stage.innerHTML = renderWeek(cursor, items, isAdmin, openFrom, openTo, highlightProvisional);
    else if (view === 'day') stage.innerHTML = renderDay(cursor, items, isAdmin, openFrom, openTo, highlightProvisional);
    else stage.innerHTML = renderMonth(cursor, items, isAdmin, highlightProvisional);
  };

  const shift = (amount: number) => {
    if (view === 'week') cursor = addDaysDate(startOfWeek(cursor), amount * 7);
    else if (view === 'day') cursor = addDaysDate(cursor, amount);
    else cursor = addMonths(cursor, amount);
  };

  prev.addEventListener('click', () => {
    shift(-1);
    void load().catch((error: Error) => {
      stage.textContent = error.message;
    });
  });
  next.addEventListener('click', () => {
    shift(1);
    void load().catch((error: Error) => {
      stage.textContent = error.message;
    });
  });
  todayBtn?.addEventListener('click', () => {
    cursor = view === 'month' ? startOfMonth(new Date()) : new Date();
    void load().catch((error: Error) => {
      stage.textContent = error.message;
    });
  });
  monthSelect.addEventListener('change', () => {
    cursor = new Date(cursor.getFullYear(), Number(monthSelect.value), 1);
    void load();
  });
  yearSelect.addEventListener('change', () => {
    cursor = new Date(Number(yearSelect.value), cursor.getMonth(), 1);
    void load();
  });
  roomSelect.addEventListener('change', () => {
    roomFilter = roomSelect.value;
    render();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-cal-view-btn]').forEach((button) => {
    button.addEventListener('click', () => {
      view = (button.dataset.calViewBtn as ViewMode) || 'month';
      void load();
    });
  });
  const openOverview = (event: CalendarEvent, detailsLoaded = false) => {
    if (!overview || !overviewBody || !overviewTitle) return;
    const colour = event.rooms.length > 1 ? '#6b7280' : event.colour;
    if (overviewHead) {
      overviewHead.style.background = colour;
      overviewHead.style.color = contrastText(colour);
    }
    overviewTitle.textContent = event.title || 'Booking';
    const status = isAdmin && event.bookingStatus ? statusLabel(event.bookingStatus) : event.status === 'provisional' ? 'Provisional' : 'Approved';
    overviewBody.innerHTML = `
      <dl class="cal-overview-dl">
        <div><dt>Date:</dt><dd>${escapeHtml(formatDayLong(event.date))}</dd></div>
        <div><dt>Time:</dt><dd>${escapeHtml(event.timeFrom)} – ${escapeHtml(event.timeTo)}</dd></div>
        <div><dt>Facilities:</dt><dd>${escapeHtml(facilitiesLabel(event, rooms))}</dd></div>
        <div><dt>Status:</dt><dd>${escapeHtml(status)}</dd></div>
        <div><dt>Additional information:</dt><dd>${escapeHtml(event.title || '—')}</dd></div>
      </dl>
      ${
        isAdmin
          ? `<div class="cal-overview-admin">
              <p>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 11V8a4 4 0 1 1 8 0v3M7 11h10v10H7z" fill="none" stroke="currentColor" stroke-width="2"/></svg>
                Hirer details — visible to you as admin only
              </p>
              <dl class="cal-overview-dl">
                ${event.organisation ? `<div><dt>Organisation:</dt><dd>${escapeHtml(event.organisation)}</dd></div>` : ''}
                <div><dt>Name:</dt><dd>${escapeHtml(event.hirerName || '—')}</dd></div>
                <div><dt>Email:</dt><dd>${event.email ? `<a href="mailto:${escapeHtml(event.email)}">${escapeHtml(event.email)}</a>` : '—'}</dd></div>
                ${event.telephone ? `<div><dt>Telephone:</dt><dd>${escapeHtml(event.telephone)}</dd></div>` : ''}
                ${event.notes ? `<div><dt>Notes:</dt><dd>${escapeHtml(event.notes)}</dd></div>` : ''}
              </dl>
            </div>`
          : ''
      }
    `;
    if (overviewOpen) {
      const show = Boolean(isAdmin && event.id);
      overviewOpen.hidden = !show;
      overviewOpen.href = show ? `/admin/booking?id=${event.id}` : '/admin/bookings';
    }
    overview.showModal();
    if (isAdmin && event.id && !detailsLoaded) {
      const bookingId = event.id;
      void fetch(`/api/admin/bookings/${bookingId}`, { credentials: 'same-origin' })
        .then(async (response) => {
          const result = (await response.json()) as {
            booking?: {
              hirerName?: string;
              email?: string;
              telephone?: string;
              organisation?: string;
              notes?: string;
              status?: string;
            };
          };
          if (!overview.open || !result.booking) return;
          openOverview(
            {
              ...event,
              hirerName: result.booking.hirerName || event.hirerName,
              email: result.booking.email,
              telephone: result.booking.telephone,
              organisation: result.booking.organisation,
              notes: result.booking.notes,
              bookingStatus: result.booking.status || event.bookingStatus,
            },
            true,
          );
        })
        .catch(() => undefined);
    }
  };

  const openFromTarget = (target: HTMLElement | null) => {
    const key = target?.closest<HTMLElement>('[data-cal-event]')?.dataset.calEvent;
    const item = key ? findEvent(events, key) : undefined;
    if (item) openOverview(item);
    return Boolean(item);
  };

  stage.addEventListener('click', (event) => {
    if (openFromTarget(event.target as HTMLElement)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-cal-date]');
    if (!target?.dataset.calDate) return;
    const form = document.querySelector<HTMLFormElement>(isAdmin ? '[data-admin-hold]' : '[data-booking-form]');
    const field = form?.querySelector<HTMLInputElement>('[name="hireDate"]');
    if (field) field.value = target.dataset.calDate;
  });
  stage.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (openFromTarget(event.target as HTMLElement)) event.preventDefault();
  });
  overview?.addEventListener('click', (event) => {
    if (event.target === overview) overview.close();
  });

  void load().catch((error: Error) => {
    stage.textContent = error.message;
  });
}

function renderMonth(month: Date, events: CalendarEvent[], admin: boolean, highlight: boolean): string {
  const first = startOfMonth(month);
  const startWeekday = (first.getDay() + 6) % 7;
  const days = endOfMonth(month).getDate();
  const byDate = groupByDate(events);
  let html = '<div class="cal-grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `<div class="cal-dow">${day}</div>`).join('');
  for (let index = 0; index < startWeekday; index += 1) html += '<div class="cal-day is-empty"></div>';
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const key = isoDate(date);
    html += `<div class="cal-day${byDate.get(key)?.length ? ' has-events' : ''}" data-cal-date="${key}"><strong>${day}</strong>${(byDate.get(key) ?? []).map((event) => eventChip(event, admin, highlight)).join('')}</div>`;
  }
  return `${html}</div>`;
}

function renderWeek(date: Date, events: CalendarEvent[], admin: boolean, openFrom: string, openTo: string, highlight: boolean): string {
  const start = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, index) => addDaysDate(start, index));
  const hours = hourRange(openFrom, openTo);
  return `<div class="cal-week">${weekHeader(days)}${hours
    .map((hour) => {
      const label = `${String(hour).padStart(2, '0')}:00`;
      return `<div class="cal-week-hour"><span>${label}</span>${days
        .map((day) => {
          const key = isoDate(day);
          const items = events.filter((event) => event.date === key && Number(event.timeFrom.slice(0, 2)) === hour);
          return `<div class="cal-week-cell" data-cal-date="${key}">${items.map((event) => eventChip(event, admin, highlight)).join('')}</div>`;
        })
        .join('')}</div>`;
    })
    .join('')}</div>`;
}

function renderDay(date: Date, events: CalendarEvent[], admin: boolean, openFrom: string, openTo: string, highlight: boolean): string {
  const key = isoDate(date);
  const hours = hourRange(openFrom, openTo);
  return `<div class="cal-dayview">${hours
    .map((hour) => {
      const items = events.filter((event) => event.date === key && Number(event.timeFrom.slice(0, 2)) === hour);
      return `<div class="cal-dayview-row"><span>${String(hour).padStart(2, '0')}:00</span><div data-cal-date="${key}">${items.map((event) => eventChip(event, admin, highlight)).join('')}</div></div>`;
    })
    .join('')}</div>`;
}

function renderList(events: CalendarEvent[], admin: boolean): string {
  if (!events.length) return '<p class="ha-note">No bookings in this period.</p>';
  const rows = [...events]
    .sort((a, b) => `${a.date}${a.timeFrom}`.localeCompare(`${b.date}${b.timeFrom}`))
    .map((event) => {
      const who = admin ? escapeHtml(event.hirerName || '') : '';
      return `<tr class="cal-list-row" tabindex="0" data-cal-event="${escapeHtml(eventKey(event))}">
        <td>${escapeHtml(formatDay(event.date))}</td>
        <td>${escapeHtml(event.timeFrom)}–${escapeHtml(event.timeTo)}</td>
        <td>${escapeHtml(event.title)}</td>
        <td>${who}</td>
      </tr>`;
    })
    .join('');
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Time</th><th>Event</th><th>${admin ? 'Hirer' : ''}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function eventChip(event: CalendarEvent, admin: boolean, highlight: boolean): string {
  const who = admin && event.hirerName ? ` · ${escapeHtml(event.hirerName)}` : '';
  const inner = `<span class="cal-event-time">${escapeHtml(event.timeFrom)}–${escapeHtml(event.timeTo)}</span><span class="cal-event-title">${escapeHtml(event.title)}${who}</span>`;
  const cls = `cal-event${event.status === 'provisional' && highlight ? ' is-provisional' : ''}${event.rooms.length > 1 ? ' is-multi' : ''}`;
  return `<button class="${cls}" type="button" data-cal-event="${escapeHtml(eventKey(event))}" style="${chipStyle(event, highlight)}">${inner}</button>`;
}

function eventKey(event: CalendarEvent): string {
  return `${event.id ?? ''}|${event.date}|${event.timeFrom}|${event.timeTo}|${event.rooms.join(',')}|${event.title}`;
}

function findEvent(events: CalendarEvent[], key: string): CalendarEvent | undefined {
  return events.find((event) => eventKey(event) === key);
}

function facilitiesLabel(event: CalendarEvent, rooms: Room[]): string {
  if (!event.rooms.length) return '—';
  if (event.rooms.length === 2 && event.rooms.includes('john') && event.rooms.includes('brian')) return 'Both halls';
  return event.rooms.map((id) => rooms.find((room) => room.id === id)?.fullName ?? id).join(', ');
}

function statusLabel(status: string): string {
  if (status === 'requested') return 'Requested';
  if (status === 'held') return 'Held';
  if (status === 'invite_sent') return 'Invite sent';
  if (status === 'agreed') return 'Approved';
  if (status === 'declined') return 'Declined';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'provisional') return 'Provisional';
  if (status === 'booked') return 'Approved';
  return status;
}

function chipStyle(event: CalendarEvent, highlight: boolean): string {
  const colour = event.rooms.length > 1 ? '#6b7280' : event.colour;
  const dashed = event.status === 'provisional' && highlight ? 'box-shadow:inset 0 0 0 2px rgb(17 17 17 / 55%);' : '';
  return `background:${colour};color:${contrastText(colour)};${dashed}`;
}

function contrastText(colour: string): string {
  const hex = colour.replace('#', '');
  if (hex.length !== 6) return '#111';
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111' : '#fff';
}

function weekHeader(days: Date[]): string {
  return `<div class="cal-week-hour cal-week-head"><span></span>${days
    .map((day) => `<div>${day.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}</div>`)
    .join('')}</div>`;
}

function groupByDate(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }
  return byDate;
}

function hourRange(from: string, to: string): number[] {
  const start = Number((from || '08:00').slice(0, 2));
  const end = Number((to || '23:30').slice(0, 2));
  return Array.from({ length: Math.max(1, end - start + 1) }, (_, index) => start + index);
}

function viewTitle(date: Date, view: ViewMode): string {
  if (view === 'day') return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'week') {
    const start = startOfWeek(date);
    const end = endOfWeek(date);
    return `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfWeek(date: Date): Date {
  const day = (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day);
}

function endOfWeek(date: Date): Date {
  return addDaysDate(startOfWeek(date), 6);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function addDaysDate(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDayLong(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (typeof document !== 'undefined') initCalendars();
