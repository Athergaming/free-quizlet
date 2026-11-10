// Small shared UI helpers: escaping, icons, toasts, dialogs, speech.

export const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PATHS = {
  star: '<path d="M12 3.6l2.5 5.3 5.8.8-4.2 4 1 5.7-5.1-2.8-5.1 2.8 1-5.7-4.2-4 5.8-.8z"/>',
  sound: '<path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5"/>',
  share: '<path d="M12 15V4M8 7.5L12 4l4 3.5M5 12v7.5h14V12"/>',
  download: '<path d="M12 4v11M8 11.5l4 3.5 4-3.5M5 19.5h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  left: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
  right: '<path d="M9.5 5.5L16 12l-6.5 6.5"/>',
  back: '<path d="M10 6l-6 6 6 6M4 12h16"/>',
  shuffle: '<path d="M4 7h3.5c3 0 5 10 8.5 10H20M4 17h3.5c1 0 1.9-1 2.7-2.4M13 9.400C13.900 8 14.900 7 16 7h4M17.500 4.500L20 7l-2.500 2.500M17.500 14.500L20 17l-2.500 2.500"/>',
  cards: '<rect x="3.500" y="7" width="13" height="10" rx="2"/><path d="M7.500 7V5.500a1.500 1.500 0 011.500-1.500h10a1.500 1.500 0 011.500 1.500v8a1.500 1.500 0 01-1.500 1.500h-2.500"/>',
  learn: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6" fill="currentColor"/>',
  test: '<rect x="5" y="4" width="14" height="16.500" rx="2"/><path d="M8.500 9.500l1.300 1.300 2.400-2.600M8.500 15l1.300 1.300 2.400-2.600M14.500 10h1.500M14.500 15.500h1.500"/>',
  match: '<rect x="4" y="4" width="7" height="7" rx="1.500"/><rect x="13" y="4" width="7" height="7" rx="1.500"/><rect x="4" y="13" width="7" height="7" rx="1.500"/><rect x="13" y="13" width="7" height="7" rx="1.500"/>',
  more: '<circle cx="5.500" cy="12" r="1.300" fill="currentColor"/><circle cx="12" cy="12" r="1.300" fill="currentColor"/><circle cx="18.500" cy="12" r="1.300" fill="currentColor"/>',
  undo: '<path d="M8.500 5L4.500 9l4 4M4.500 9H14a5.500 5.500 0 010 11H9"/>',
  link: '<path d="M10 14a4 4 0 005.700 0l3-3a4 4 0 00-5.700-5.700l-1 1M14 10a4 4 0 00-5.700 0l-3 3a4 4 0 005.700 5.700l1-1"/>',
  paste: '<rect x="5.500" y="5" width="13" height="15.500" rx="2"/><path d="M9 5V3.500h6V5M9 11h6M9 15h4"/>',
  file: '<path d="M6.500 3.500h7.500l4 4V20.500h-11.500z"/><path d="M14 3.500v4h4"/>',
  sun: '<circle cx="12" cy="12" r="3.800"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.600 5.600l1.400 1.400M17 17l1.400 1.400M5.600 18.400L7 17M17 7l1.400-1.400"/>',
  moon: '<path d="M19.500 14.500A8 8 0 019.500 4.500a8 8 0 1010 10z"/>',
  swap: '<path d="M7 4.500v15M3.500 8L7 4.500 10.500 8M17 19.500v-15M13.500 16l3.500 3.500 3.500-3.500"/>',
  options: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  clock: '<circle cx="12" cy="12.500" r="7.500"/><path d="M12 8.500v4l2.500 2M9.500 3h5"/>',
  reset: '<path d="M5 12a7 7 0 107-7H7.500M10 2.500L7.500 5 10 7.500"/>',
  copy: '<rect x="8.500" y="8.500" width="11" height="11" rx="2"/><path d="M5.500 15.500h-1v-11h11v1"/>',
  bookmark: '<path d="M6.500 4h11v16.500l-5.500-4-5.500 4z"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] || ''}</svg>`;

export function toast(message, kind = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  root.append(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

/**
 * Open a modal dialog. `actions` is a list of {label, kind, value}; resolves with the chosen
 * value, or null when dismissed. `onOpen(dialog)` can wire up the body; `result(dialog, value)`
 * can read the body on close and return something richer than the button value.
 */
export function modal({ title, body = '', actions = [], onOpen, result, wide = false }) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog');
    dialog.className = `modal ${wide ? 'wide' : ''}`;
    dialog.innerHTML = `
      <form method="dialog" class="modal-box">
        <header class="modal-head">
          <h2>${esc(title)}</h2>
          <button class="icon-btn" value="" aria-label="Close">${icon('x')}</button>
        </header>
        <div class="modal-body">${body}</div>
        ${
          actions.length
            ? `<footer class="modal-foot">${actions
                .map(
                  (a) =>
                    `<button class="btn ${a.kind || 'ghost'}" value="${esc(a.value)}">${esc(a.label)}</button>`,
                )
                .join('')}</footer>`
            : ''
        }
      </form>`;
    document.getElementById('modal-root').append(dialog);
    dialog.addEventListener('close', () => {
      const value = dialog.returnValue || null;
      const out = result ? result(dialog, value) : value;
      dialog.remove();
      resolve(out);
    });
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close('');
    });
    dialog.showModal();
    onOpen?.(dialog);
  });
}

export async function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  const value = await modal({
    title,
    body: `<p>${esc(message)}</p>`,
    actions: [
      { label: 'Cancel', kind: 'ghost', value: '' },
      { label: confirmLabel, kind: danger ? 'danger' : 'primary', value: 'yes' },
    ],
  });
  return value === 'yes';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    return ok;
  }
}

export function downloadFile(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text) {
  if (!canSpeak || !text) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(String(text).slice(0, 600)));
}

/** Pick a text size for a card face so long answers still fit. */
export function sizeClass(text) {
  const n = String(text ?? '').length;
  return n <= 28 ? 'size-xl' : n <= 90 ? 'size-lg' : n <= 240 ? 'size-md' : 'size-sm';
}

export function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** True when a key press belongs to a control and should not trigger page shortcuts. */
export function isTyping(e) {
  const t = e.target;
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY)$/.test(t.tagName))
  );
}

const MODES = [
  ['flashcards', 'Flashcards', 'cards'],
  ['learn', 'Learn', 'learn'],
  ['test', 'Test', 'test'],
  ['match', 'Match', 'match'],
];
export { MODES };

/** Top bar shown inside a study mode. `extra` is HTML for mode-specific controls. */
export function modeBar(set, mode, extra = '') {
  return `
    <div class="modebar">
      <nav class="mode-tabs" aria-label="Study modes">
        ${MODES.map(
          ([key, label, ico]) =>
            `<a href="#/set/${set.id}/${key}" class="${key === mode ? 'active' : ''}" ${key === mode ? 'aria-current="page"' : ''}>${icon(ico)}<span>${label}</span></a>`,
        ).join('')}
      </nav>
      <div class="modebar-title" title="${esc(set.title)}">${esc(set.title)}</div>
      <div class="modebar-right">
        ${extra}
        <a class="icon-btn" href="#/set/${set.id}" aria-label="Close and go back to the set">${icon('x')}</a>
      </div>
    </div>`;
}

export function notEnough(root, set, mode, need = 2) {
  root.innerHTML = `
    ${modeBar(set, mode)}
    <section class="page narrow center-msg">
      <h1>This set needs more cards</h1>
      <p class="muted">Add at least ${need} cards that have both a term and a definition to use this mode.</p>
      <p><a class="btn primary" href="#/set/${set.id}/edit">${icon('edit')} Edit set</a></p>
    </section>`;
}
