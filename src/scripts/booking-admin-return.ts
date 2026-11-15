function initAdminReturn() {
  const bar = document.querySelector<HTMLElement>('[data-admin-return]');
  if (!bar) return;
  void fetch('/api/admin/session', { credentials: 'same-origin' }).then((response) => {
    if (response.ok) bar.hidden = false;
  });
}

if (typeof document !== 'undefined') initAdminReturn();
