import { store } from '../store.js';
import { gradeWritten } from '../lib/grade.js';
import { esc, icon, shuffle, isTyping, modeBar, notEnough, plural, sizeClass } from '../ui.js';

const ROUND_SIZE = 7;
const PRAISE = ['Correct.', 'Nice.', "That's it.", 'Got it.', 'Right.'];

/**
 * Learn: short rounds. Each card is first asked as multiple choice, then as a written
 * answer; two right answers master it. A miss brings the card back later in the round.
 */
export function learn(root, { set }) {
  const cards = set.cards.filter((c) => c.term.trim() && c.def.trim());
  if (cards.length < 2) return notEnough(root, set, 'learn');

  const prefs = { answerWith: 'def', mc: true, written: true, ...store.pref('learn', {}) };
  const byId = new Map(cards.map((c) => [c.id, c]));

  let phase = 'question'; // question | feedback | round | done
  let queue = [];
  let roundIds = [];
  let roundNo = 0;
  let current = null;
  let timer = null;

  const stageOf = (id) => store.getProgress(set.id)[id]?.s || 0;
  const promptOf = (c) => (prefs.answerWith === 'def' ? c.term : c.def);
  const answerOf = (c) => (prefs.answerWith === 'def' ? c.def : c.term);
  const promptLabel = () => (prefs.answerWith === 'def' ? 'Term' : 'Definition');
  const answerLabel = () => (prefs.answerWith === 'def' ? 'definition' : 'term');

  function overall() {
    const points = cards.reduce((n, c) => n + Math.min(2, stageOf(c.id)), 0);
    return Math.round((points / (cards.length * 2)) * 100);
  }

  function nextRound() {
    const pending = cards.filter((c) => stageOf(c.id) < 2);
    if (!pending.length) {
      phase = 'done';
      return render();
    }
    roundNo++;
    roundIds = pending.slice(0, ROUND_SIZE).map((c) => c.id);
    queue = shuffle(roundIds);
    ask();
  }

  function questionType(card) {
    if (prefs.mc && prefs.written) return stageOf(card.id) === 0 ? 'mc' : 'written';
    return prefs.written ? 'written' : 'mc';
  }

  function buildOptions(card) {
    const right = answerOf(card);
    const seen = new Set([right.trim().toLowerCase()]);
    const wrong = [];
    for (const other of shuffle(cards)) {
      const text = answerOf(other);
      const key = text.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      wrong.push(text);
      if (wrong.length === 3) break;
    }
    return shuffle([right, ...wrong]);
  }

  function ask() {
    clearTimeout(timer);
    if (!queue.length) {
      phase = 'round';
      return render();
    }
    const card = byId.get(queue.shift());
    let type = questionType(card);
    const options = type === 'mc' ? buildOptions(card) : null;
    if (options && options.length < 2) type = 'written';
    current = { card, type, options, given: '', correct: null, close: false, committed: false };
    phase = 'question';
    render();
  }

  /** Save the outcome of the current question. Wrong answers come back later this round. */
  function commit() {
    if (!current || current.committed) return;
    current.committed = true;
    const { card, correct } = current;
    const stage = stageOf(card.id);
    store.record(set.id, card.id, correct, correct ? Math.min(2, stage + 1) : stage);
    if (!correct) queue.push(card.id);
  }

  function resolve(correct, given, close = false) {
    current.correct = correct;
    current.given = given;
    current.close = close;
    phase = 'feedback';
    if (correct) {
      commit();
      render();
      timer = setTimeout(ask, 950);
    } else {
      render();
    }
  }

  function proceed() {
    if (phase === 'feedback') {
      commit();
      ask();
    } else if (phase === 'round') nextRound();
  }

  function optionsMenu() {
    return `
      <details class="menu">
        <summary class="btn outline small" aria-label="Options">${icon('options')} <span>Options</span></summary>
        <div class="menu-list wide">
          <label class="menu-select"><span><b>Answer with</b></span>
            <select class="input select" data-pref="answerWith">
              <option value="def" ${prefs.answerWith === 'def' ? 'selected' : ''}>Definition</option>
              <option value="term" ${prefs.answerWith === 'term' ? 'selected' : ''}>Term</option>
            </select>
          </label>
          <label class="menu-check"><input type="checkbox" data-pref="mc" ${prefs.mc ? 'checked' : ''} /> <span><b>Multiple choice</b></span></label>
          <label class="menu-check"><input type="checkbox" data-pref="written" ${prefs.written ? 'checked' : ''} /> <span><b>Written answers</b></span></label>
          <button data-action="reset">${icon('reset')} Start over</button>
        </div>
      </details>`;
  }

  function questionHtml() {
    const { card, type, options, correct, given } = current;
    const answered = phase === 'feedback';
    const right = answerOf(card);
    const prompt = promptOf(card);

    let body = '';
    if (type === 'mc') {
      body = `
        <p class="q-instr">Choose the matching ${answerLabel()}</p>
        <div class="options">
          ${options
            .map((opt, i) => {
              let cls = '';
              if (answered) {
                if (opt === right) cls = 'right';
                else if (opt === given) cls = 'wrong';
                else cls = 'dim';
              }
              return `<button class="option ${cls}" data-action="choose" data-i="${i}" ${answered ? 'disabled' : ''}>
                        <span class="option-key">${i + 1}</span><span class="option-text">${esc(opt)}</span>
                      </button>`;
            })
            .join('')}
        </div>
        ${answered ? '' : `<button class="linklike skip" data-action="skip">Don't know?</button>`}`;
    } else if (!answered) {
      body = `
        <form class="written" data-form="written" autocomplete="off">
          <label class="q-instr" for="answer">Type the ${answerLabel()}</label>
          <div class="written-row">
            <input class="input big" id="answer" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Your answer" />
            <button class="btn primary">Answer</button>
          </div>
          <button type="button" class="linklike skip" data-action="skip">Don't know?</button>
        </form>`;
    } else {
      body = `
        <div class="written-result">
          ${
            correct
              ? `<div class="answer-box right"><small>Your answer</small><div>${esc(given)}</div></div>`
              : `${given ? `<div class="answer-box wrong"><small>You said</small><div>${esc(given)}</div></div>` : ''}
                 <div class="answer-box right"><small>Correct ${answerLabel()}</small><div>${esc(right)}</div></div>`
          }
        </div>`;
    }

    let feedback = '';
    if (answered) {
      feedback = correct
        ? `<div class="feedback good" role="status"><span>${icon('check')} ${PRAISE[Math.floor(Math.random() * PRAISE.length)]}</span></div>`
        : `<div class="feedback bad" role="status">
             <span>${icon('x')} ${given ? (current.close ? 'So close. Check the spelling.' : 'Not quite. This one will come back.') : "No problem. You'll see this one again."}</span>
             <span class="feedback-actions">
               ${type === 'written' && given ? `<button class="btn ghost small" data-action="override">I was right</button>` : ''}
               <button class="btn primary" data-action="continue" id="continue">Continue</button>
             </span>
           </div>`;
    }

    return `
      <div class="q-card">
        <div class="q-top"><span class="face-label">${promptLabel()}</span><span class="pill ${stageOf(card.id) ? 'learning' : 'fresh'}">${stageOf(card.id) ? 'Almost there' : 'New'}</span></div>
        <div class="q-prompt ${sizeClass(prompt)}">${esc(prompt)}</div>
        ${body}
      </div>
      ${feedback}`;
  }

  function roundHtml() {
    const pending = cards.filter((c) => stageOf(c.id) < 2).length;
    const mastered = cards.length - pending;
    return `
      <div class="done">
        <h1>${pending ? 'Round done. Keep it going.' : 'Last round done.'}</h1>
        <p class="muted">${mastered} of ${cards.length} mastered so far.</p>
        <div class="meter tall"><span style="width:${overall()}%"></span></div>
        <ul class="round-list">
          ${roundIds
            .map((id) => {
              const c = byId.get(id);
              const s = stageOf(id);
              return `<li><span class="dot ${s >= 2 ? 'mastered' : 'learning'}"></span><span class="term-side">${esc(c.term)}</span><span class="def-side">${esc(c.def)}</span><span class="pill ${s >= 2 ? 'mastered' : 'learning'}">${s >= 2 ? 'Mastered' : 'Still learning'}</span></li>`;
            })
            .join('')}
        </ul>
        <div class="done-actions"><button class="btn primary big" data-action="continue" id="continue">Continue</button></div>
        <p class="hint">Press <kbd>Enter</kbd> to continue</p>
      </div>`;
  }

  function doneHtml() {
    return `
      <div class="done">
        <div class="done-badge">${icon('check')}</div>
        <h1>You've mastered all ${plural(cards.length, 'term')}</h1>
        <p class="muted">Every card was answered right twice. Check it holds with a test, or start fresh.</p>
        <div class="done-actions">
          <a class="btn primary big" href="#/set/${set.id}/test">${icon('test')} Take a test</a>
          <button class="btn outline big" data-action="reset">${icon('reset')} Learn it again</button>
          <a class="btn outline big" href="#/set/${set.id}">Back to the set</a>
        </div>
      </div>`;
  }

  function render() {
    const pct = overall();
    const mastered = cards.filter((c) => stageOf(c.id) >= 2).length;
    root.innerHTML = `
      ${modeBar(set, 'learn', optionsMenu())}
      <div class="mode-progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <section class="stage">
        ${phase === 'done' ? '' : `<div class="track-counts"><span class="count">Round ${roundNo}</span><span class="count mastered">Mastered <b>${mastered}</b> / ${cards.length}</span></div>`}
        ${phase === 'round' ? roundHtml() : phase === 'done' ? doneHtml() : questionHtml()}
      </section>`;
    if (phase === 'question' && current.type === 'written') root.querySelector('#answer')?.focus();
    else root.querySelector('#continue')?.focus();
  }

  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'choose' && phase === 'question') {
      const opt = current.options[Number(el.dataset.i)];
      resolve(opt === answerOf(current.card), opt);
    } else if (action === 'skip' && phase === 'question') resolve(false, '');
    else if (action === 'continue') proceed();
    else if (action === 'override' && phase === 'feedback') {
      current.correct = true;
      commit();
      ask();
    } else if (action === 'reset') {
      store.resetProgress(set.id);
      roundNo = 0;
      nextRound();
    }
  }

  function onSubmit(e) {
    if (e.target.dataset.form !== 'written') return;
    e.preventDefault();
    if (phase !== 'question') return;
    const given = root.querySelector('#answer').value.trim();
    if (!given) return;
    const g = gradeWritten(given, answerOf(current.card));
    resolve(g.correct, given, g.close);
  }

  function onChange(e) {
    const key = e.target.dataset?.pref;
    if (!key) return;
    prefs[key] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    if (!prefs.mc && !prefs.written) prefs[key === 'mc' ? 'written' : 'mc'] = true;
    store.setPref('learn', prefs);
    // Re-ask the current card under the new settings.
    if (current && !current.committed && phase !== 'round' && phase !== 'done') queue.unshift(current.card.id);
    if (phase === 'round' || phase === 'done') render();
    else ask();
  }

  function onKey(e) {
    if (document.querySelector('dialog[open]') || isTyping(e)) return;
    if (phase === 'question' && current.type === 'mc' && /^[1-4]$/.test(e.key)) {
      root.querySelector(`.option[data-i="${Number(e.key) - 1}"]`)?.click();
    } else if (e.key === 'Enter' && (phase === 'feedback' || phase === 'round')) {
      e.preventDefault();
      if (phase === 'feedback' && current.correct) ask();
      else proceed();
    }
  }

  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  root.addEventListener('change', onChange);
  document.addEventListener('keydown', onKey);
  nextRound();

  return () => {
    clearTimeout(timer);
    root.removeEventListener('click', onClick);
    root.removeEventListener('submit', onSubmit);
    root.removeEventListener('change', onChange);
    document.removeEventListener('keydown', onKey);
  };
}
