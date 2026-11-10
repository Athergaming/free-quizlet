import { store, uid } from '../store.js';
import { parseDelimited, detectTermSep } from '../lib/importer.js';
import { esc, icon, toast, modal, confirmDialog, plural } from '../ui.js';

function rowHtml(card, n) {
  return `
    <li class="edit-row" data-id="${card.id}" data-starred="${card.starred ? 1 : ''}">
      <div class="edit-row-head">
        <span class="edit-num">${n}</span>
        <button type="button" class="icon-btn" data-action="remove" aria-label="Delete card ${n}">${icon('trash')}</button>
      </div>
      <div class="edit-fields">
        <label class="field">
          <textarea class="term" rows="1" placeholder="Enter term">${esc(card.term)}</textarea>
          <span>Term</span>
        </label>
        <label class="field">
          <textarea class="def" rows="1" placeholder="Enter definition">${esc(card.def)}</textarea>
          <span>Definition</span>
        </label>
      </div>
    </li>`;
}

const blankCard = () => ({ id: uid(), term: '', def: '', starred: false });

export function editView(root, { set }) {
  const editing = !!set;
  const backHref = editing ? `#/set/${set.id}` : '#/';
  const cards = editing && set.cards.length ? set.cards : [blankCard(), blankCard(), blankCard()];
  let dirty = false;

  root.innerHTML = `
    <section class="page narrow edit-page">
      <div class="edit-bar">
        <h1>${editing ? 'Edit set' : 'Create a new set'}</h1>
        <div class="edit-bar-actions">
          <button type="button" class="btn ghost" data-action="cancel">Cancel</button>
          <button type="button" class="btn primary" data-action="save">${editing ? 'Save changes' : 'Create set'}</button>
        </div>
      </div>

      <label class="field big">
        <input type="text" id="title" maxlength="200" placeholder="e.g. Biology, chapter 4: cell structure" value="${esc(set?.title || '')}" />
        <span>Title</span>
      </label>
      <label class="field">
        <textarea id="description" rows="1" maxlength="1000" placeholder="Add a description (optional)">${esc(set?.description || '')}</textarea>
        <span>Description</span>
      </label>

      <div class="edit-tools">
        <button type="button" class="btn outline small" data-action="bulk">${icon('paste')} Paste many cards</button>
        <button type="button" class="btn outline small" data-action="swap">${icon('swap')} Swap terms and definitions</button>
        <span class="muted small" id="card-count"></span>
      </div>

      <ol class="edit-rows" id="rows">${cards.map((c, i) => rowHtml(c, i + 1)).join('')}</ol>
      <button type="button" class="add-row" data-action="add">${icon('plus')} Add card</button>

      <div class="edit-foot">
        <button type="button" class="btn primary big" data-action="save">${editing ? 'Save changes' : 'Create set'}</button>
      </div>
    </section>`;

  const rows = root.querySelector('#rows');
  const titleInput = root.querySelector('#title');

  const grow = (ta) => {
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  };
  const growAll = () => root.querySelectorAll('textarea').forEach(grow);

  function renumber() {
    let filled = 0;
    rows.querySelectorAll('.edit-row').forEach((li, i) => {
      li.querySelector('.edit-num').textContent = i + 1;
      li.querySelector('[data-action="remove"]').setAttribute('aria-label', `Delete card ${i + 1}`);
      if (li.querySelector('.term').value.trim() || li.querySelector('.def').value.trim()) filled++;
    });
    root.querySelector('#card-count').textContent = plural(filled, 'card');
  }

  function addRow(card = blankCard(), focus = true) {
    rows.insertAdjacentHTML('beforeend', rowHtml(card, rows.children.length + 1));
    const li = rows.lastElementChild;
    li.querySelectorAll('textarea').forEach(grow);
    if (focus) li.querySelector('.term').focus();
    renumber();
    return li;
  }

  function readCards() {
    return [...rows.querySelectorAll('.edit-row')]
      .map((li) => ({
        id: li.dataset.id,
        term: li.querySelector('.term').value.trim(),
        def: li.querySelector('.def').value.trim(),
        starred: !!li.dataset.starred,
      }))
      .filter((c) => c.term || c.def);
  }

  function save() {
    const title = titleInput.value.trim();
    const list = readCards();
    if (!title) {
      toast('Give your set a title first.', 'bad');
      titleInput.focus();
      return;
    }
    if (!list.length) {
      toast('Add at least one card.', 'bad');
      rows.querySelector('.term')?.focus();
      return;
    }
    const saved = store.saveSet({
      id: set?.id,
      title,
      description: root.querySelector('#description').value,
      cards: list,
    });
    dirty = false;
    toast(editing ? 'Changes saved' : 'Set created');
    location.hash = `#/set/${saved.id}`;
  }

  async function bulk() {
    const added = await modal({
      title: 'Paste many cards',
      wide: true,
      body: `
        <p class="muted">One card per line, with the term and definition separated by a tab, a dash or a comma. Text copied from a spreadsheet or from another flashcard site's export works as is.</p>
        <textarea class="input paste-area" id="bulk-text" rows="9" placeholder="hola&#9;hello&#10;gracias&#9;thank you"></textarea>
        <p class="muted small" id="bulk-count">Nothing to add yet.</p>`,
      actions: [
        { label: 'Cancel', kind: 'ghost', value: '' },
        { label: 'Add cards', kind: 'primary', value: 'add' },
      ],
      onOpen(dialog) {
        const ta = dialog.querySelector('#bulk-text');
        ta.addEventListener('input', () => {
          const n = parseDelimited(ta.value, detectTermSep(ta.value), '\n').length;
          dialog.querySelector('#bulk-count').textContent = n ? `${plural(n, 'card')} found.` : 'Nothing to add yet.';
        });
        ta.focus();
      },
      result(dialog, value) {
        if (value !== 'add') return null;
        const text = dialog.querySelector('#bulk-text').value;
        return parseDelimited(text, detectTermSep(text), '\n');
      },
    });
    if (!Array.isArray(added) || !added.length) return;
    // Drop untouched blank rows so pasted cards start at the top of an empty set.
    for (const li of [...rows.querySelectorAll('.edit-row')]) {
      if (!li.querySelector('.term').value.trim() && !li.querySelector('.def').value.trim()) li.remove();
    }
    for (const c of added) addRow({ ...blankCard(), ...c }, false);
    dirty = true;
    toast(`${plural(added.length, 'card')} added`);
  }

  async function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'add') {
      addRow();
      dirty = true;
    } else if (action === 'remove') {
      el.closest('.edit-row').remove();
      if (!rows.children.length) addRow(blankCard(), false);
      dirty = true;
      renumber();
    } else if (action === 'swap') {
      rows.querySelectorAll('.edit-row').forEach((li) => {
        const t = li.querySelector('.term');
        const d = li.querySelector('.def');
        [t.value, d.value] = [d.value, t.value];
      });
      dirty = true;
      growAll();
    } else if (action === 'bulk') bulk();
    else if (action === 'save') save();
    else if (action === 'cancel') {
      if (
        dirty &&
        !(await confirmDialog({
          title: 'Discard your changes?',
          message: 'You have unsaved edits to this set.',
          confirmLabel: 'Discard',
          danger: true,
        }))
      ) {
        return;
      }
      dirty = false;
      location.hash = backHref;
    }
  }

  function onInput(e) {
    dirty = true;
    if (e.target.tagName === 'TEXTAREA') grow(e.target);
    if (e.target.closest('.edit-row')) renumber();
  }

  function onKeydown(e) {
    // Tab out of the last definition adds a new card, so you never have to reach for the mouse.
    if (e.key === 'Tab' && !e.shiftKey && e.target.classList?.contains('def')) {
      if (e.target.closest('.edit-row') === rows.lastElementChild) {
        e.preventDefault();
        addRow();
        dirty = true;
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  }

  const onUnload = (e) => {
    if (dirty) e.preventDefault();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeydown);
  window.addEventListener('beforeunload', onUnload);

  growAll();
  renumber();
  if (!editing) titleInput.focus();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeydown);
    window.removeEventListener('beforeunload', onUnload);
  };
}
