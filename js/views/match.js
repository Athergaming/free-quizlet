import { store } from '../store.js';
import { esc, icon, shuffle, modeBar, notEnough, sizeClass } from '../ui.js';

const PAIRS = 6;
const PENALTY_MS = 1000;

const fmt = (ms) => `${(ms / 1000).toFixed(1)}s`;

export function match(root, { set }) {
  const cards = set.cards.filter((c) => c.term.trim() && c.def.trim());
  if (cards.length < 2) return notEnough(root, set, 'match');

  let phase = 'intro'; // intro | playing | done
  let tiles = [];
  let picked = null;
  let startedAt = 0;
  let penalty = 0;
  let finalMs = 0;
  let wasBest = false;
  let ticker = null;
  let busy = false;

  const elapsed = () => Date.now() - startedAt + penalty;

  function begin() {
    const chosen = shuffle(cards).slice(0, PAIRS);
    tiles = shuffle(
      chosen.flatMap((c) => [
        { key: `${c.id}:t`, pair: c.id, text: c.term, gone: false },
        { key: `${c.id}:d`, pair: c.id, text: c.def, gone: false },
      ]),
    );
    picked = null;
    penalty = 0;
    busy = false;
    startedAt = Date.now();
    phase = 'playing';
    render();
    clearInterval(ticker);
    ticker = setInterval(() => {
      const el = root.querySelector('#clock');
      if (el) el.textContent = fmt(elapsed());
    }, 100);
  }

  function finish() {
    clearInterval(ticker);
    finalMs = elapsed();
    const best = store.getBest(set.id, 'match');
    wasBest = best === null || finalMs < best;
    if (wasBest) store.setBest(set.id, 'match', finalMs);
    store.touch(set.id);
    phase = 'done';
    render();
  }

  function render() {
    const best = store.getBest(set.id, 'match');
    let body = '';
    if (phase === 'intro') {
      body = `
        <div class="done">
          <div class="done-badge">${icon('match')}</div>
          <h1>Ready to play?</h1>
          <p class="muted">Pair every term with its definition as fast as you can. A wrong pair costs you a second.</p>
          ${best !== null ? `<p class="best">Your best: <b>${fmt(best)}</b></p>` : ''}
          <div class="done-actions"><button class="btn primary big" data-action="start" id="go">Start game</button></div>
        </div>`;
    } else if (phase === 'playing') {
      body = `
        <div class="match-head">
          <span class="clock">${icon('clock')} <b id="clock">0.0s</b></span>
          ${best !== null ? `<span class="muted">Best ${fmt(best)}</span>` : ''}
        </div>
        <div class="match-grid" role="group" aria-label="Match the pairs">
          ${tiles
            .map(
              (t, i) =>
                `<button class="tile ${sizeClass(t.text)} ${t.gone ? 'gone' : ''}" data-i="${i}" ${t.gone ? 'disabled aria-hidden="true"' : ''}>${esc(t.text)}</button>`,
            )
            .join('')}
        </div>`;
    } else {
      body = `
        <div class="done">
          <div class="done-badge">${icon('clock')}</div>
          <h1>${fmt(finalMs)}</h1>
          <p class="muted">${wasBest ? 'A new personal best on this set.' : `Your best is ${fmt(best)}. Go again to beat it.`}</p>
          <div class="done-actions">
            <button class="btn primary big" data-action="start" id="go">${icon('reset')} Play again</button>
            <a class="btn outline big" href="#/set/${set.id}">Back to the set</a>
          </div>
        </div>`;
    }
    root.innerHTML = `${modeBar(set, 'match')}<section class="stage wide">${body}</section>`;
    root.querySelector('#go')?.focus();
  }

  function pick(i) {
    if (busy || phase !== 'playing') return;
    const tile = tiles[i];
    if (!tile || tile.gone) return;
    const el = root.querySelector(`.tile[data-i="${i}"]`);

    if (picked === i) {
      picked = null;
      el.classList.remove('picked');
      return;
    }
    if (picked === null) {
      picked = i;
      el.classList.add('picked');
      return;
    }

    const firstEl = root.querySelector(`.tile[data-i="${picked}"]`);
    const first = tiles[picked];
    picked = null;
    busy = true;
    if (first.pair === tile.pair) {
      first.gone = tile.gone = true;
      for (const t of [firstEl, el]) {
        t.classList.remove('picked');
        t.classList.add('matched');
      }
      setTimeout(() => {
        for (const t of [firstEl, el]) {
          t.classList.add('gone');
          t.disabled = true;
        }
        busy = false;
        if (tiles.every((t) => t.gone)) finish();
      }, 260);
    } else {
      penalty += PENALTY_MS;
      for (const t of [firstEl, el]) {
        t.classList.remove('picked');
        t.classList.add('miss');
      }
      setTimeout(() => {
        for (const t of [firstEl, el]) t.classList.remove('miss');
        busy = false;
      }, 420);
    }
  }

  function onClick(e) {
    if (e.target.closest('[data-action="start"]')) return begin();
    const tile = e.target.closest('.tile');
    if (tile) pick(Number(tile.dataset.i));
  }

  root.addEventListener('click', onClick);
  render();

  return () => {
    clearInterval(ticker);
    root.removeEventListener('click', onClick);
  };
}
