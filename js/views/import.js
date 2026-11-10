import { store } from '../store.js';
import {
  parseDelimited,
  detectTermSep,
  parseFile,
  decodePayload,
  isQuizletUrl,
  cleanCards,
  MAX_CARDS,
} from '../lib/importer.js';
import { bookmarkletHref } from '../lib/bookmarklet.js';
import { decodeShare } from '../lib/share.js';
import { esc, icon, toast, plural } from '../ui.js';

const appUrl = () => `${location.origin}${location.pathname}`;

/** Review screen shown before anything is saved. */
function preview(root, { title, description = '', cards, source = '', heading, note = '' }) {
  const list = cleanCards(cards);
  const incomplete = list.filter((c) => !c.term || !c.def).length;
  root.innerHTML = `
    <section class="page narrow">
      <a class="crumb" href="#/import">${icon('back')} Import</a>
      <h1>${esc(heading)}</h1>
      ${note ? `<p class="muted">${esc(note)}</p>` : ''}
      ${
        list.length
          ? `<label class="field big">
               <input type="text" id="imp-title" maxlength="200" value="${esc(title)}" placeholder="Name this set" />
               <span>Title</span>
             </label>
             <p class="muted small">${plural(list.length, 'card')} ready${incomplete ? ` · ${incomplete} missing a term or definition` : ''}${list.length >= MAX_CARDS ? ` · capped at ${MAX_CARDS}` : ''}</p>
             <ul class="term-list preview-list">
               ${list
                 .map(
                   (c) => `
                 <li class="term-row">
                   <div class="term-side">${esc(c.term) || '<span class="muted">(no term)</span>'}</div>
                   <div class="def-side">${esc(c.def) || '<span class="muted">(no definition)</span>'}</div>
                 </li>`,
                 )
                 .join('')}
             </ul>
             <div class="edit-foot">
               <a class="btn ghost" href="#/import">Cancel</a>
               <button class="btn primary big" id="imp-save">Save to my sets</button>
             </div>`
          : `<p class="notice warn">No cards came through. Go back and try pasting the set's text instead.</p>
             <p><a class="btn primary" href="#/import">Back to import</a></p>`
      }
    </section>`;

  root.querySelector('#imp-save')?.addEventListener('click', () => {
    const saved = store.saveSet({
      title: root.querySelector('#imp-title').value.trim() || 'Imported set',
      description,
      source,
      cards: list,
    });
    toast(`Saved ${plural(list.length, 'card')}`);
    // replace() so the back button doesn't re-open the import payload.
    location.replace(`#/set/${saved.id}`);
  });
}

export function importView(root, { query }) {
  if (query.data) {
    try {
      const data = decodePayload(query.data);
      return preview(root, { ...data, heading: 'Check your import' });
    } catch (e) {
      root.innerHTML = `
        <section class="page narrow center-msg">
          <h1>That import didn't come through</h1>
          <p class="muted">${esc(e.message || 'The data in the link could not be read.')} Very large sets can be too big for a link. Use the set's export and paste the text instead.</p>
          <p><a class="btn primary" href="#/import">Back to import</a></p>
        </section>`;
      return;
    }
  }

  let tab = 'link';
  let termSep = 'auto';
  let cardSep = '\n';

  root.innerHTML = `
    <section class="page narrow import-page">
      <h1>Import a set</h1>
      <p class="muted">Bring in cards from a Quizlet link, from pasted text, or from a file. Nothing leaves your browser.</p>

      <div class="tabs" role="tablist">
        <button role="tab" data-tab="link" aria-selected="true">${icon('link')} From a link</button>
        <button role="tab" data-tab="paste" aria-selected="false">${icon('paste')} Paste text</button>
        <button role="tab" data-tab="file" aria-selected="false">${icon('file')} From a file</button>
      </div>

      <div class="tab-panel" data-panel="link">
        <form id="link-form" class="copy-row">
          <input class="input" id="link-url" type="url" inputmode="url" placeholder="https://quizlet.com/123456789/your-set-flash-cards/" aria-label="Link to the set" />
          <button class="btn primary">Continue</button>
        </form>
        <p class="muted small">Websites aren't allowed to read each other's pages, so the cards are collected from the set's own page with a one-click bookmark. You set it up once.</p>

        <ol class="steps" id="link-steps" hidden>
          <li>
            <h3>Add the bookmark <span class="muted">(first time only)</span></h3>
            <p>Show your bookmarks bar (<kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>B</kbd>) and drag this button onto it:</p>
            <p><a class="bookmarklet" id="bookmarklet" href="#">${icon('bookmark')} Send to Flipside</a></p>
          </li>
          <li>
            <h3>Open the set</h3>
            <p><a class="btn outline" id="open-set" target="_blank" rel="noopener noreferrer" href="#">${icon('share')} Open the set in a new tab</a></p>
            <p class="muted small">Scroll down once so every card has loaded. Sets that need a login to see in full will only give the cards that are visible to you.</p>
          </li>
          <li>
            <h3>Click “Send to Flipside”</h3>
            <p>While you're on the set's page, click the bookmark. You'll land back here with the cards ready to save.</p>
          </li>
        </ol>

        <details class="help">
          <summary>On a phone, or the bookmark isn't working?</summary>
          <p>Open the set, choose its <strong>Export</strong> option (under the “…” menu), copy the text it gives you, and paste it into the <button type="button" class="linklike" data-goto="paste">Paste text</button> tab. That route works everywhere.</p>
        </details>
      </div>

      <div class="tab-panel" data-panel="paste" hidden>
        <textarea class="input paste-area" id="paste-text" rows="9" placeholder="Paste your cards here. For example:&#10;&#10;hola&#9;hello&#10;gracias&#9;thank you"></textarea>
        <div class="sep-options">
          <fieldset>
            <legend>Between term and definition</legend>
            <label><input type="radio" name="termsep" value="auto" checked /> Auto-detect</label>
            <label><input type="radio" name="termsep" value="tab" /> Tab</label>
            <label><input type="radio" name="termsep" value="comma" /> Comma</label>
            <label><input type="radio" name="termsep" value="dash" /> Dash</label>
            <label><input type="radio" name="termsep" value="custom" /> Custom <input class="input tiny" id="termsep-custom" aria-label="Custom separator between term and definition" /></label>
          </fieldset>
          <fieldset>
            <legend>Between cards</legend>
            <label><input type="radio" name="cardsep" value="newline" checked /> New line</label>
            <label><input type="radio" name="cardsep" value="semicolon" /> Semicolon</label>
            <label><input type="radio" name="cardsep" value="custom" /> Custom <input class="input tiny" id="cardsep-custom" aria-label="Custom separator between cards" /></label>
          </fieldset>
        </div>
        <div class="paste-foot">
          <span class="muted" id="paste-count">Nothing pasted yet.</span>
          <button class="btn primary" id="paste-go" disabled>Review cards</button>
        </div>
      </div>

      <div class="tab-panel" data-panel="file" hidden>
        <label class="dropzone" id="dropzone">
          <input type="file" id="file-input" accept=".json,.csv,.tsv,.txt,text/plain,application/json,text/csv" />
          ${icon('file')}
          <strong>Choose a file, or drop one here</strong>
          <span class="muted">JSON exported from Flipside, or a CSV, TSV or text file with a term and a definition on each line.</span>
        </label>
      </div>
    </section>`;

  const $ = (sel) => root.querySelector(sel);

  function showTab(name) {
    tab = name;
    root.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
    root.querySelectorAll('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
  }

  // Link tab
  $('#bookmarklet').setAttribute('href', bookmarkletHref(appUrl()));
  $('#bookmarklet').addEventListener('click', (e) => {
    e.preventDefault();
    toast('Drag this button to your bookmarks bar, then click it on the set page.');
  });
  $('#link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $('#link-url').value.trim();
    if (!isQuizletUrl(url)) {
      $('#link-steps').hidden = true;
      toast('That does not look like a Quizlet link. For anything else, use Paste text.', 'bad');
      return;
    }
    $('#open-set').href = url;
    $('#link-steps').hidden = false;
    $('#link-steps').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // Paste tab
  const SEPS = { tab: '\t', comma: ',', dash: ' - ', newline: '\n', semicolon: ';' };
  const sepValue = (v) => SEPS[v] ?? v;
  function parsePaste() {
    const text = $('#paste-text').value;
    const t = termSep === 'auto' ? detectTermSep(text) : termSep === 'custom' ? $('#termsep-custom').value : termSep;
    const c = cardSep === 'custom' ? $('#cardsep-custom').value : cardSep;
    return parseDelimited(text, t, c);
  }
  function updatePaste() {
    const cards = parsePaste();
    $('#paste-count').textContent = cards.length ? `${plural(cards.length, 'card')} found.` : 'Nothing pasted yet.';
    $('#paste-go').disabled = !cards.length;
  }
  $('.sep-options').addEventListener('input', (e) => {
    if (e.target.name === 'termsep') termSep = sepValue(e.target.value);
    if (e.target.name === 'cardsep') cardSep = sepValue(e.target.value);
    if (e.target.id === 'termsep-custom') {
      termSep = 'custom';
      root.querySelector('[name="termsep"][value="custom"]').checked = true;
    }
    if (e.target.id === 'cardsep-custom') {
      cardSep = 'custom';
      root.querySelector('[name="cardsep"][value="custom"]').checked = true;
    }
    updatePaste();
  });
  $('#paste-text').addEventListener('input', updatePaste);
  $('#paste-go').addEventListener('click', () => {
    preview(root, { title: '', cards: parsePaste(), heading: 'Check your import' });
  });

  // File tab
  async function readFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast('That file is over 5 MB. Split it up first.', 'bad');
    try {
      const data = parseFile(file.name, await file.text());
      preview(root, { ...data, heading: 'Check your import' });
    } catch (e) {
      toast(`Could not read that file: ${e.message}`, 'bad');
    }
  }
  $('#file-input').addEventListener('change', (e) => readFile(e.target.files[0]));
  const zone = $('#dropzone');
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('over');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('over');
    readFile(e.dataTransfer.files[0]);
  });

  root.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) showTab(b.dataset.tab);
  });
  root.querySelector('[data-goto]').addEventListener('click', (e) => showTab(e.target.dataset.goto));

  if (query.url) {
    $('#link-url').value = query.url;
    $('#link-form').requestSubmit();
  }
}

/** #/share/<payload>: someone sent a whole set packed into a link. */
export function shareView(root, { params }) {
  root.innerHTML = `<section class="page narrow center-msg"><p class="muted">Opening shared set…</p></section>`;
  let alive = true;
  decodeShare(params[0])
    .then((data) => {
      if (!alive) return;
      preview(root, {
        ...data,
        heading: 'Someone shared a set with you',
        note: 'Save it to study it. Your copy is yours: changes you make stay in this browser.',
      });
    })
    .catch((e) => {
      if (!alive) return;
      root.innerHTML = `
        <section class="page narrow center-msg">
          <h1>This share link is broken</h1>
          <p class="muted">${esc(e.message || '')} It may have been cut short when it was sent. Ask for the link again, or for the set as a file.</p>
          <p><a class="btn primary" href="#/">Go to your sets</a></p>
        </section>`;
    });
  return () => {
    alive = false;
  };
}
