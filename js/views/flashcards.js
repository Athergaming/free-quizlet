import { store } from '../store.js';
import { esc, icon, shuffle, speak, canSpeak, sizeClass, isTyping, modeBar, plural } from '../ui.js';

export function flashcards(root, { set }) {
  const all = set.cards.filter((c) => c.term.trim() || c.def.trim());
  if (!all.length) {
    root.innerHTML = `${modeBar(set, 'flashcards')}
      <section class="page narrow center-msg">
        <h1>No cards to flip yet</h1>
        <p><a class="btn primary" href="#/set/${set.id}/edit">${icon('edit')} Add cards</a></p>
      </section>`;
    return;
  }

  const prefs = { shuffle: false, front: 'term', track: false, starred: false, ...store.pref('flashcards', {}) };
  let order = [];
  let idx = 0;
  let flipped = false;
  let known = [];
  let learning = [];
  let history = []; // [{id, knew}] so tracked answers can be undone
  let enter = '';

  function start(onlyIds) {
    let cards = all;
    if (onlyIds) cards = all.filter((c) => onlyIds.includes(c.id));
    else if (prefs.starred && all.some((c) => c.starred)) cards = all.filter((c) => c.starred);
    order = prefs.shuffle ? shuffle(cards) : cards;
    idx = 0;
    flipped = false;
    known = [];
    learning = [];
    history = [];
    enter = '';
    render();
  }

  const sides = (c) =>
    prefs.front === 'term'
      ? [['Term', c.term], ['Definition', c.def]]
      : [['Definition', c.def], ['Term', c.term]];

  function optionsMenu() {
    const starredCount = all.filter((c) => c.starred).length;
    return `
      <details class="menu">
        <summary class="btn outline small" aria-label="Options">${icon('options')} <span>Options</span></summary>
        <div class="menu-list wide">
          <label class="menu-check"><input type="checkbox" data-pref="track" ${prefs.track ? 'checked' : ''} /> <span><b>Track progress</b><small>Sort cards into “know” and “still learning”</small></span></label>
          <label class="menu-check"><input type="checkbox" data-pref="shuffle" ${prefs.shuffle ? 'checked' : ''} /> <span><b>Shuffle</b><small>Mix up the order</small></span></label>
          <label class="menu-check"><input type="checkbox" data-pref="starred" ${prefs.starred ? 'checked' : ''} ${starredCount ? '' : 'disabled'} /> <span><b>Starred only</b><small>${starredCount ? plural(starredCount, 'starred term') : 'Star some terms first'}</small></span></label>
          <label class="menu-select"><span><b>Front of card</b></span>
            <select class="input select" data-pref="front">
              <option value="term" ${prefs.front === 'term' ? 'selected' : ''}>Term</option>
              <option value="def" ${prefs.front === 'def' ? 'selected' : ''}>Definition</option>
            </select>
          </label>
          <button data-action="restart">${icon('reset')} Restart</button>
        </div>
      </details>`;
  }

  function faceHtml(side, [label, text], card) {
    return `
      <div class="face ${side}">
        <div class="face-top">
          <span class="face-label">${label}</span>
          <span class="face-tools">
            ${canSpeak ? `<button class="icon-btn" data-action="speak" data-text="${esc(text)}" aria-label="Read aloud">${icon('sound')}</button>` : ''}
            <button class="icon-btn star ${card.starred ? 'on' : ''}" data-action="star" aria-pressed="${card.starred}" aria-label="Star this card">${icon('star')}</button>
          </span>
        </div>
        <div class="face-text ${sizeClass(text)}">${esc(text) || '<span class="muted">(blank)</span>'}</div>
      </div>`;
  }

  function doneHtml() {
    if (!prefs.track) {
      return `
        <div class="done">
          <div class="done-badge">${icon('check')}</div>
          <h1>That's the whole deck</h1>
          <p class="muted">You went through ${plural(order.length, 'card')}.</p>
          <div class="done-actions">
            <button class="btn primary big" data-action="restart">${icon('reset')} Go again</button>
            <a class="btn outline big" href="#/set/${set.id}/learn">${icon('learn')} Try Learn</a>
          </div>
        </div>`;
    }
    const total = known.length + learning.length;
    const pct = total ? Math.round((known.length / total) * 100) : 0;
    return `
      <div class="done">
        <div class="ring" style="--pct:${pct}"><span>${pct}%</span></div>
        <h1>${learning.length ? 'Nice work. Keep going on the tricky ones.' : 'You knew every card.'}</h1>
        <div class="tally">
          <div class="chip mastered"><b>${known.length}</b> Know</div>
          <div class="chip learning"><b>${learning.length}</b> Still learning</div>
        </div>
        <div class="done-actions">
          ${learning.length ? `<button class="btn primary big" data-action="review">${icon('cards')} Review the ${plural(learning.length, 'card')} you're still learning</button>` : ''}
          <button class="btn ${learning.length ? 'outline' : 'primary'} big" data-action="restart">${icon('reset')} Restart flashcards</button>
          <a class="btn outline big" href="#/set/${set.id}/test">${icon('test')} Take a test</a>
        </div>
      </div>`;
  }

  function render() {
    const finished = idx >= order.length;
    const card = order[idx];
    const pct = Math.round((Math.min(idx, order.length) / order.length) * 100);
    root.innerHTML = `
      ${modeBar(set, 'flashcards', optionsMenu())}
      <div class="mode-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <section class="stage">
        ${
          finished
            ? doneHtml()
            : `
          ${
            prefs.track
              ? `<div class="track-counts">
                   <span class="count learning"><b>${learning.length}</b> Still learning</span>
                   <span class="count mastered">Know <b>${known.length}</b></span>
                 </div>`
              : ''
          }
          <div class="flip big ${enter}" data-action="flip" role="button" tabindex="0"
               aria-label="Flashcard ${idx + 1} of ${order.length}. Press space to flip.">
            <div class="flip-inner">
              ${faceHtml('front', sides(card)[0], card)}
              ${faceHtml('back', sides(card)[1], card)}
            </div>
          </div>
          <div class="deck-nav">
            ${
              prefs.track
                ? `<button class="round-btn bad" data-action="dont" aria-label="Still learning">${icon('x')}</button>
                   <span class="deck-count">${idx + 1} / ${order.length}</span>
                   <button class="round-btn good" data-action="know" aria-label="Know it">${icon('check')}</button>`
                : `<button class="round-btn" data-action="prev" aria-label="Previous card" ${idx === 0 ? 'disabled' : ''}>${icon('left')}</button>
                   <span class="deck-count">${idx + 1} / ${order.length}</span>
                   <button class="round-btn" data-action="next" aria-label="Next card">${icon('right')}</button>`
            }
          </div>
          <div class="deck-extra">
            ${prefs.track ? `<button class="btn ghost small" data-action="undo" ${history.length ? '' : 'disabled'}>${icon('undo')} Undo</button>` : ''}
            <span class="hint"><kbd>Space</kbd> flip · ${prefs.track ? '<kbd>←</kbd> still learning · <kbd>→</kbd> know it' : '<kbd>←</kbd> <kbd>→</kbd> move'}</span>
          </div>`
        }
      </section>`;
    enter = '';
  }

  function flip() {
    flipped = !flipped;
    root.querySelector('.flip')?.classList.toggle('is-flipped', flipped);
  }

  function go(delta) {
    const next = idx + delta;
    if (next < 0 || idx >= order.length) return;
    idx = next;
    flipped = false;
    enter = delta > 0 ? 'enter-right' : 'enter-left';
    render();
  }

  function answer(knew) {
    if (idx >= order.length) return;
    const card = order[idx];
    (knew ? known : learning).push(card.id);
    history.push({ id: card.id, knew });
    store.record(set.id, card.id, knew);
    go(1);
  }

  function undo() {
    const last = history.pop();
    if (!last) return;
    const list = last.knew ? known : learning;
    list.splice(list.lastIndexOf(last.id), 1);
    idx = Math.max(0, idx - 1);
    flipped = false;
    enter = 'enter-left';
    render();
  }

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    switch (el.dataset.action) {
      case 'flip':
        return flip();
      case 'prev':
        return go(-1);
      case 'next':
        return go(1);
      case 'know':
        return answer(true);
      case 'dont':
        return answer(false);
      case 'undo':
        return undo();
      case 'restart':
        return start();
      case 'review':
        return start([...learning]);
      case 'speak':
        return speak(el.dataset.text);
      case 'star': {
        const on = store.toggleStar(set.id, order[idx].id);
        root.querySelectorAll('.face .star').forEach((b) => {
          b.classList.toggle('on', on);
          b.setAttribute('aria-pressed', on);
        });
      }
    }
  }

  function onChange(e) {
    const key = e.target.dataset?.pref;
    if (!key) return;
    prefs[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    store.setPref('flashcards', prefs);
    start();
  }

  function onKey(e) {
    if (document.querySelector('dialog[open]')) return;
    const onCard = e.target.classList?.contains('flip');
    if (isTyping(e) && !onCard) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      flip();
    } else if (e.key === 'ArrowRight') prefs.track ? answer(true) : go(1);
    else if (e.key === 'ArrowLeft') prefs.track ? answer(false) : go(-1);
    else if (e.key.toLowerCase() === 's' && idx < order.length) root.querySelector('.face.front .star')?.click();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  start();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('change', onChange);
    document.removeEventListener('keydown', onKey);
  };
}
