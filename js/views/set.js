import { store } from '../store.js';
import { encodeShare } from '../lib/share.js';
import { toText } from '../lib/importer.js';
import {
  esc,
  icon,
  plural,
  toast,
  modal,
  confirmDialog,
  copyText,
  downloadFile,
  speak,
  canSpeak,
  sizeClass,
  isTyping,
  MODES,
} from '../ui.js';

const MODE_BLURB = {
  flashcards: 'Flip through every card',
  learn: 'Guided rounds until it sticks',
  test: 'A graded practice exam',
  match: 'Race the clock pairing cards',
};

const BUCKET_LABEL = { fresh: 'Not studied', learning: 'Still learning', mastered: 'Mastered' };

function sourceLine(set) {
  if (!set.source) return '';
  try {
    const host = new URL(set.source).hostname.replace(/^www\./, '');
    return ` · imported from <a href="${esc(set.source)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a>`;
  } catch {
    return '';
  }
}

export function setView(root, { set }) {
  let idx = 0;
  let flipped = false;
  let sort = 'original';
  let starredOnly = false;

  const stats = store.stats(set);

  root.innerHTML = `
    <section class="page set-page">
      <a class="crumb" href="#/">${icon('back')} Your sets</a>
      <header class="set-head">
        <div>
          <h1>${esc(set.title)}</h1>
          ${set.description ? `<p class="set-desc">${esc(set.description)}</p>` : ''}
          <p class="muted small">${plural(set.cards.length, 'term')}${sourceLine(set)}</p>
        </div>
        <div class="set-actions">
          <button class="btn outline" data-action="share">${icon('share')} Share</button>
          <a class="btn outline" href="#/set/${set.id}/edit">${icon('edit')} Edit</a>
          <details class="menu">
            <summary class="icon-btn bordered" aria-label="More actions">${icon('more')}</summary>
            <div class="menu-list">
              <button data-action="export-json">${icon('download')} Download as JSON</button>
              <button data-action="copy-text">${icon('copy')} Copy as text</button>
              <button data-action="reset">${icon('reset')} Reset progress</button>
              <button data-action="delete" class="danger">${icon('trash')} Delete set</button>
            </div>
          </details>
        </div>
      </header>

      <nav class="mode-tiles" aria-label="Study modes">
        ${MODES.map(
          ([key, label, ico]) => `
          <a class="mode-tile" href="#/set/${set.id}/${key}">
            <span class="mode-ico">${icon(ico)}</span>
            <span><strong>${label}</strong><small>${MODE_BLURB[key]}</small></span>
          </a>`,
        ).join('')}
      </nav>

      ${
        set.cards.length
          ? `<div class="deck-preview">
               <div id="preview-card"></div>
               <div class="deck-nav">
                 <button class="round-btn" data-action="prev" aria-label="Previous card">${icon('left')}</button>
                 <span class="deck-count" id="preview-count"></span>
                 <button class="round-btn" data-action="next" aria-label="Next card">${icon('right')}</button>
               </div>
             </div>`
          : `<div class="empty-state"><h2>This set is empty</h2><p><a class="btn primary" href="#/set/${set.id}/edit">Add cards</a></p></div>`
      }

      <div class="progress-chips" aria-label="Your progress">
        <div class="chip fresh"><b>${stats.fresh}</b> Not studied</div>
        <div class="chip learning"><b>${stats.learning}</b> Still learning</div>
        <div class="chip mastered"><b>${stats.mastered}</b> Mastered</div>
      </div>

      <div class="section-head">
        <h2>Terms in this set <span class="muted">(${set.cards.length})</span></h2>
        <div class="section-tools">
          <label class="check-pill"><input type="checkbox" id="starred-only" /> ${icon('star')} Starred</label>
          <select class="input select" id="sort" aria-label="Sort terms">
            <option value="original">Original order</option>
            <option value="alpha">Alphabetical</option>
            <option value="status">By progress</option>
          </select>
        </div>
      </div>
      <ul class="term-list" id="term-list"></ul>
    </section>`;

  const previewCard = root.querySelector('#preview-card');
  const previewCount = root.querySelector('#preview-count');
  const termList = root.querySelector('#term-list');

  function paintPreview(dir = '') {
    if (!set.cards.length) return;
    const c = set.cards[idx];
    previewCard.innerHTML = `
      <div class="flip ${flipped ? 'is-flipped' : ''} ${dir}" data-action="flip" role="button" tabindex="0"
           aria-label="Flashcard ${idx + 1} of ${set.cards.length}. Press Enter to flip.">
        <div class="flip-inner">
          <div class="face front"><span class="face-label">Term</span><div class="face-text ${sizeClass(c.term)}">${esc(c.term)}</div></div>
          <div class="face back"><span class="face-label">Definition</span><div class="face-text ${sizeClass(c.def)}">${esc(c.def)}</div></div>
        </div>
      </div>`;
    previewCount.textContent = `${idx + 1} / ${set.cards.length}`;
  }

  function paintTerms() {
    const order = { learning: 0, fresh: 1, mastered: 2 };
    let cards = set.cards.map((c) => ({ ...c, bucket: store.bucket(set.id, c.id) }));
    if (starredOnly) cards = cards.filter((c) => c.starred);
    if (sort === 'alpha') cards.sort((a, b) => a.term.localeCompare(b.term));
    if (sort === 'status') cards.sort((a, b) => order[a.bucket] - order[b.bucket]);
    termList.innerHTML = cards.length
      ? cards
          .map(
            (c) => `
        <li class="term-row" data-id="${c.id}">
          <span class="dot ${c.bucket}" title="${BUCKET_LABEL[c.bucket]}"><span class="sr-only">${BUCKET_LABEL[c.bucket]}</span></span>
          <div class="term-side">${esc(c.term) || '<span class="muted">(no term)</span>'}</div>
          <div class="def-side">${esc(c.def) || '<span class="muted">(no definition)</span>'}</div>
          <div class="row-tools">
            ${canSpeak ? `<button class="icon-btn" data-action="speak" aria-label="Read this term aloud">${icon('sound')}</button>` : ''}
            <button class="icon-btn star ${c.starred ? 'on' : ''}" data-action="star" aria-pressed="${c.starred}" aria-label="Star this term">${icon('star')}</button>
          </div>
        </li>`,
          )
          .join('')
      : `<li class="muted empty-note">${starredOnly ? 'No starred terms yet. Tap a star to mark the ones you want to focus on.' : 'No terms.'}</li>`;
  }

  function move(delta) {
    if (!set.cards.length) return;
    idx = (idx + delta + set.cards.length) % set.cards.length;
    flipped = false;
    paintPreview(delta > 0 ? 'enter-right' : 'enter-left');
  }

  function flip() {
    flipped = !flipped;
    previewCard.querySelector('.flip')?.classList.toggle('is-flipped', flipped);
  }

  async function share() {
    if (!set.cards.length) return toast('Add some cards before sharing.');
    const payload = await encodeShare(set);
    const url = `${location.origin}${location.pathname}#/share/${payload}`;
    await modal({
      title: 'Share this set',
      body: `
        <p>Anyone who opens this link gets their own copy of the set. No account needed, and nothing is uploaded: the cards are packed into the link itself.</p>
        <div class="copy-row">
          <input class="input" id="share-url" readonly value="${esc(url)}" aria-label="Share link" />
          <button type="button" class="btn primary" id="share-copy">${icon('copy')} Copy</button>
        </div>
        ${url.length > 6000 ? `<p class="notice warn">This is a long link (${url.length.toLocaleString()} characters). Some chat apps cut long links short, so for big sets it is safer to send the JSON file from the “More” menu instead.</p>` : ''}`,
      onOpen(dialog) {
        const input = dialog.querySelector('#share-url');
        input.addEventListener('focus', () => input.select());
        dialog.querySelector('#share-copy').addEventListener('click', async () => {
          toast((await copyText(url)) ? 'Link copied' : 'Could not copy. Select the link and copy it by hand.');
        });
      },
    });
  }

  async function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const row = el.closest('.term-row');
    if (action === 'flip') flip();
    else if (action === 'prev') move(-1);
    else if (action === 'next') move(1);
    else if (action === 'share') share();
    else if (action === 'star' && row) {
      const on = store.toggleStar(set.id, row.dataset.id);
      el.classList.toggle('on', on);
      el.setAttribute('aria-pressed', on);
      if (starredOnly) paintTerms();
    } else if (action === 'speak' && row) {
      speak(set.cards.find((c) => c.id === row.dataset.id)?.term);
    } else if (action === 'export-json') {
      const data = {
        title: set.title,
        description: set.description,
        cards: set.cards.map((c) => ({ term: c.term, definition: c.def })),
      };
      const name = set.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'set';
      downloadFile(`${name}.json`, JSON.stringify(data, null, 2));
    } else if (action === 'copy-text') {
      toast((await copyText(toText(set.cards))) ? 'Copied all terms as text' : 'Could not copy');
    } else if (action === 'reset') {
      const ok = await confirmDialog({
        title: 'Reset progress?',
        message: 'This clears what you have learned in this set. The cards themselves stay.',
        confirmLabel: 'Reset progress',
        danger: true,
      });
      if (ok) {
        store.resetProgress(set.id);
        toast('Progress reset');
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    } else if (action === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this set?',
        message: `“${set.title}” and its progress will be removed from this browser. This can't be undone.`,
        confirmLabel: 'Delete set',
        danger: true,
      });
      if (ok) {
        store.deleteSet(set.id);
        toast('Set deleted');
        location.hash = '#/';
      }
    }
  }

  function onKey(e) {
    if (e.target.closest?.('.flip') && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return flip();
    }
    if (isTyping(e) || document.querySelector('dialog[open]')) return;
    if (e.key === 'ArrowLeft') move(-1);
    else if (e.key === 'ArrowRight') move(1);
  }

  root.querySelector('#sort').addEventListener('change', (e) => {
    sort = e.target.value;
    paintTerms();
  });
  root.querySelector('#starred-only').addEventListener('change', (e) => {
    starredOnly = e.target.checked;
    paintTerms();
  });
  root.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);

  paintPreview();
  paintTerms();

  return () => {
    root.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
  };
}
