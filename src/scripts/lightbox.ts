export type LightboxPhoto = {
  type: 'photo';
  src: string;
  alt: string;
};

export type LightboxVideo = {
  type: 'video';
  youtubeId: string;
  title: string;
};

export type LightboxItem = LightboxPhoto | LightboxVideo;

export function initLightboxes() {
  document.querySelectorAll<HTMLElement>('[data-lightbox]').forEach(setupLightbox);
}

function setupLightbox(root: HTMLElement) {
  if (root.dataset.lightboxReady === 'true') return;
  root.dataset.lightboxReady = 'true';
  const json = root.querySelector('script[type="application/json"]');
  const dialog = root.querySelector<HTMLDialogElement>('dialog');
  const stage = root.querySelector<HTMLElement>('[data-lightbox-stage]');
  const caption = root.querySelector<HTMLElement>('[data-lightbox-caption]');
  const counter = root.querySelector<HTMLElement>('[data-lightbox-counter]');
  const prevButton = root.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-lightbox-next]');

  if (!json?.textContent || !dialog || !stage || !caption || !counter || !prevButton || !nextButton) {
    return;
  }

  const items = JSON.parse(json.textContent) as LightboxItem[];
  if (items.length === 0) return;

  let index = 0;
  let lastTrigger: HTMLElement | null = null;

  const render = () => {
    const item = items[index];
    stage.replaceChildren();

    if (item.type === 'photo') {
      const image = document.createElement('img');
      image.src = item.src;
      image.alt = item.alt;
      stage.append(image);
      caption.textContent = item.alt;
    } else {
      const frame = document.createElement('div');
      frame.className = 'lightbox-video';
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${item.youtubeId}?autoplay=1&rel=0`;
      iframe.title = item.title;
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      frame.append(iframe);
      stage.append(frame);
      caption.textContent = item.title;
    }

    counter.textContent = `${index + 1} / ${items.length}`;
    const many = items.length > 1;
    prevButton.hidden = !many;
    nextButton.hidden = !many;
  };

  const stopMedia = () => {
    stage.replaceChildren();
  };

  const open = (startIndex: number, trigger: HTMLElement) => {
    index = startIndex;
    lastTrigger = trigger;
    render();
    dialog.showModal();
  };

  const close = () => {
    stopMedia();
    dialog.close();
    lastTrigger?.focus();
  };

  const move = (step: number) => {
    index = (index + step + items.length) % items.length;
    render();
  };

  root.addEventListener('click', (event) => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('[data-lightbox-open]');
    if (!trigger || !root.contains(trigger)) return;
    event.preventDefault();
    open(Number(trigger.dataset.lightboxOpen), trigger);
  });

  prevButton.addEventListener('click', () => move(-1));
  nextButton.addEventListener('click', () => move(1));
  root.querySelector('[data-lightbox-close]')?.addEventListener('click', close);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
    }
  });
}

if (typeof document !== 'undefined') {
  initLightboxes();
}
