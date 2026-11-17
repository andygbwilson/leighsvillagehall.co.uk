export function initPrivacyHelp(root: ParentNode = document) {
  const buttons = root.querySelectorAll<HTMLButtonElement>('[data-privacy-help]');
  buttons.forEach((button) => {
    const dialog =
      button.closest('form')?.querySelector<HTMLDialogElement>('[data-privacy-dialog]') ||
      root.querySelector<HTMLDialogElement>('[data-privacy-dialog]');
    if (!dialog) return;
    button.addEventListener('click', () => dialog.showModal());
    dialog.querySelectorAll<HTMLButtonElement>('[data-privacy-close]').forEach((close) => {
      close.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}
