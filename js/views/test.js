import { store } from '../store.js';
import { gradeWritten } from '../lib/grade.js';
import { esc, icon, shuffle, modeBar, notEnough, confirmDialog, plural } from '../ui.js';

const TYPES = [
  ['tf', 'True / false'],
  ['mc', 'Multiple choice'],
  ['matching', 'Matching'],
  ['written', 'Written'],
];
const MATCH_MAX = 8;

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Build the list of questions. Each one is worth a point (matching: a point per pair). */
export function buildTest(cards, opts) {
  const promptOf = (c) => (opts.answerWith === 'def' ? c.term : c.def);
  const answerOf = (c) => (opts.answerWith === 'def' ? c.def : c.term);
  const pool = shuffle(cards).slice(0, Math.max(1, Math.min(opts.count, cards.length)));
  let types = TYPES.map(([k]) => k).filter((k) => opts.types[k]);
  if (!types.length) types = ['mc'];

  // Deal cards out to question types as evenly as possible.
  const dealt = Object.fromEntries(types.map((t) => [t, []]));
  pool.forEach((c, i) => dealt[types[i % types.length]].push(c));

  // Matching needs at least two pairs and reads badly beyond eight; move the rest elsewhere.
  if (dealt.matching) {
    const others = types.filter((t) => t !== 'matching');
    const spill =
      dealt.matching.length < 2 ? dealt.matching.splice(0) : dealt.matching.splice(MATCH_MAX);
    if (others.length) spill.forEach((c, i) => dealt[others[i % others.length]].push(c));
    else if (spill.length) (dealt.written ||= []).push(...spill);
  }

  const distractors = (card, n) => {
    const out = [];
    for (const other of shuffle(cards)) {
      const text = answerOf(other);
      if (same(text, answerOf(card)) || out.some((o) => same(o, text))) continue;
      out.push(text);
      if (out.length === n) break;
    }
    return out;
  };

  const questions = [];
  for (const c of dealt.tf || []) {
    const wrong = distractors(c, 1)[0];
    const truth = !wrong || Math.random() < 0.5;
    questions.push({ type: 'tf', card: c, prompt: promptOf(c), shown: truth ? answerOf(c) : wrong, truth, answer: answerOf(c), response: null });
  }
  for (const c of dealt.mc || []) {
    const options = shuffle([answerOf(c), ...distractors(c, 3)]);
    questions.push({ type: 'mc', card: c, prompt: promptOf(c), options, answer: answerOf(c), response: null });
  }
  if (dealt.matching?.length) {
    const items = dealt.matching;
    questions.push({
      type: 'matching',
      items: items.map((c) => ({ card: c, prompt: promptOf(c), answer: answerOf(c), response: '' })),
      choices: shuffle(items.map((c) => answerOf(c))),
    });
  }
  for (const c of dealt.written || []) {
    questions.push({ type: 'written', card: c, prompt: promptOf(c), answer: answerOf(c), response: '' });
  }
  return questions;
}

export function gradeTest(questions) {
  let right = 0;
  let total = 0;
  for (const q of questions) {
    if (q.type === 'matching') {
      for (const item of q.items) {
        item.correct = !!item.response && same(item.response, item.answer);
        total++;
        if (item.correct) right++;
      }
      continue;
    }
    if (q.type === 'tf') q.correct = q.response !== null && q.response === q.truth;
    else if (q.type === 'mc') q.correct = q.response !== null && q.response === q.answer;
    else q.correct = gradeWritten(q.response, q.answer).correct;
    total++;
    if (q.correct) right++;
  }
  return { right, total, pct: total ? Math.round((right / total) * 100) : 0 };
}

export function test(root, { set }) {
  const cards = set.cards.filter((c) => c.term.trim() && c.def.trim());
  if (cards.length < 2) return notEnough(root, set, 'test');

  const saved = store.pref('test', {});
  const opts = {
    count: Math.min(saved.count || 20, cards.length),
    answerWith: saved.answerWith || 'def',
    types: { tf: true, mc: true, matching: true, written: true, ...(saved.types || {}) },
  };
  let phase = 'setup'; // setup | taking | results
  let questions = [];
  let result = null;
  let startedAt = 0;
  let elapsed = 0;

  const answerLabel = () => (opts.answerWith === 'def' ? 'definition' : 'term');
  const promptLabel = () => (opts.answerWith === 'def' ? 'Term' : 'Definition');

  function setupHtml() {
    return `
      <section class="page narrow">
        <div class="setup-card">
          <h1>Set up your test</h1>
          <p class="muted">${esc(set.title)}</p>
          <label class="setup-row">
            <span><b>Questions</b><small>Up to ${cards.length}</small></span>
            <input class="input num" type="number" id="count" min="1" max="${cards.length}" value="${opts.count}" inputmode="numeric" />
          </label>
          <label class="setup-row">
            <span><b>Answer with</b></span>
            <select class="input select" id="answer-with">
              <option value="def" ${opts.answerWith === 'def' ? 'selected' : ''}>Definition</option>
              <option value="term" ${opts.answerWith === 'term' ? 'selected' : ''}>Term</option>
            </select>
          </label>
          <hr />
          ${TYPES.map(
            ([key, label]) => `
            <label class="setup-row">
              <span><b>${label}</b></span>
              <input type="checkbox" class="switch" data-type="${key}" ${opts.types[key] ? 'checked' : ''} />
            </label>`,
          ).join('')}
          <button class="btn primary big full" data-action="start">Start test</button>
        </div>
      </section>`;
  }

  function questionHtml(q, n, graded) {
    const mark = (ok) =>
      graded ? `<span class="mark ${ok ? 'good' : 'bad'}">${icon(ok ? 'check' : 'x')} ${ok ? 'Correct' : 'Incorrect'}</span>` : '';
    const dis = graded ? 'disabled' : '';

    if (q.type === 'matching') {
      const last = n + q.items.length - 1;
      return `
        <article class="q-card ${graded ? 'graded' : ''}">
          <div class="q-top"><span class="face-label">Matching</span><span class="q-num">${n}–${last} of ${result?.total ?? totalPoints()}</span></div>
          <p class="q-instr">Pick the ${answerLabel()} that goes with each ${promptLabel().toLowerCase()}</p>
          <div class="match-rows">
            ${q.items
              .map(
                (item, i) => `
              <div class="match-row ${graded ? (item.correct ? 'right' : 'wrong') : ''}">
                <div class="match-prompt">${esc(item.prompt)}</div>
                <div>
                  <select class="input select" data-q="${questions.indexOf(q)}" data-item="${i}" aria-label="Answer for ${esc(item.prompt)}" ${dis}>
                    <option value="">Choose…</option>
                    ${q.choices.map((c) => `<option ${item.response === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                  </select>
                  ${graded && !item.correct ? `<div class="fix">${icon('check')} ${esc(item.answer)}</div>` : ''}
                </div>
              </div>`,
              )
              .join('')}
          </div>
        </article>`;
    }

    const qi = questions.indexOf(q);
    const head = `<div class="q-top"><span class="face-label">${promptLabel()}</span><span class="q-num">${n} of ${result?.total ?? totalPoints()}</span></div>`;
    let body = '';

    if (q.type === 'tf') {
      body = `
        <div class="tf-pair"><div class="q-prompt size-md">${esc(q.prompt)}</div><div class="tf-shown">${esc(q.shown)}</div></div>
        <p class="q-instr">Is this the right ${answerLabel()}?</p>
        <div class="options two">
          ${[true, false]
            .map((v) => {
              let cls = q.response === v ? 'picked' : '';
              if (graded) cls = v === q.truth ? 'right' : q.response === v ? 'wrong' : 'dim';
              return `<button type="button" class="option ${cls}" data-q="${qi}" data-tf="${v}" ${dis}><span class="option-text">${v ? 'True' : 'False'}</span></button>`;
            })
            .join('')}
        </div>
        ${graded && !q.truth ? `<div class="fix">${icon('check')} Correct ${answerLabel()}: ${esc(q.answer)}</div>` : ''}`;
    } else if (q.type === 'mc') {
      body = `
        <div class="q-prompt size-md">${esc(q.prompt)}</div>
        <p class="q-instr">Choose the matching ${answerLabel()}</p>
        <div class="options">
          ${q.options
            .map((opt, i) => {
              let cls = q.response === opt ? 'picked' : '';
              if (graded) cls = opt === q.answer ? 'right' : q.response === opt ? 'wrong' : 'dim';
              return `<button type="button" class="option ${cls}" data-q="${qi}" data-opt="${i}" ${dis}><span class="option-text">${esc(opt)}</span></button>`;
            })
            .join('')}
        </div>`;
    } else {
      body = `
        <div class="q-prompt size-md">${esc(q.prompt)}</div>
        <label class="q-instr" for="w${qi}">Type the ${answerLabel()}</label>
        <input class="input big ${graded ? (q.correct ? 'right' : 'wrong') : ''}" id="w${qi}" data-q="${qi}" data-written value="${esc(q.response)}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Your answer" ${dis} />
        ${graded && !q.correct ? `<div class="fix">${icon('check')} ${esc(q.answer)}</div>` : ''}`;
    }
    return `<article class="q-card ${graded ? 'graded' : ''}" id="q${qi}">${head}${body}${graded ? mark(q.correct) : ''}</article>`;
  }

  const totalPoints = () => questions.reduce((n, q) => n + (q.type === 'matching' ? q.items.length : 1), 0);

  function unanswered() {
    let n = 0;
    for (const q of questions) {
      if (q.type === 'matching') n += q.items.filter((i) => !i.response).length;
      else if (q.type === 'written') n += q.response.trim() ? 0 : 1;
      else n += q.response === null ? 1 : 0;
    }
    return n;
  }

  function paperHtml(graded) {
    let n = 1;
    return questions
      .map((q) => {
        const html = questionHtml(q, n, graded);
        n += q.type === 'matching' ? q.items.length : 1;
        return html;
      })
      .join('');
  }

  function takingHtml() {
    return `
      <section class="page narrow test-paper">
        <div class="paper-head"><h1>${esc(set.title)}</h1><p class="muted">${plural(totalPoints(), 'question')}</p></div>
        ${paperHtml(false)}
        <div class="paper-foot">
          <p class="muted" id="left"></p>
          <button class="btn primary big" data-action="submit">Submit test</button>
        </div>
      </section>`;
  }

  function resultsHtml() {
    const secs = Math.round(elapsed / 1000);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const verdict =
      result.pct === 100 ? 'A perfect score.' : result.pct >= 80 ? 'Strong result.' : result.pct >= 50 ? 'Getting there.' : 'Worth another pass.';
    return `
      <section class="page narrow test-paper">
        <div class="results">
          <div class="ring" style="--pct:${result.pct}"><span>${result.pct}%</span></div>
          <div>
            <h1>${verdict}</h1>
            <div class="tally">
              <div class="chip mastered"><b>${result.right}</b> Correct</div>
              <div class="chip learning"><b>${result.total - result.right}</b> Incorrect</div>
              <div class="chip fresh">${icon('clock')} ${time}</div>
            </div>
            <div class="done-actions left">
              <button class="btn primary" data-action="again">${icon('reset')} New test</button>
              <a class="btn outline" href="#/set/${set.id}/learn">${icon('learn')} Practise in Learn</a>
              <a class="btn outline" href="#/set/${set.id}">Back to the set</a>
            </div>
          </div>
        </div>
        <h2 class="review-title">Your answers</h2>
        ${paperHtml(true)}
      </section>`;
  }

  function render() {
    root.innerHTML = `${modeBar(set, 'test')}${phase === 'setup' ? setupHtml() : phase === 'taking' ? takingHtml() : resultsHtml()}`;
    if (phase === 'taking') paintLeft();
    window.scrollTo(0, 0);
  }

  function paintLeft() {
    const el = root.querySelector('#left');
    if (!el) return;
    const n = unanswered();
    el.textContent = n ? `${plural(n, 'question')} left to answer` : 'All questions answered';
  }

  function readSetup() {
    const count = parseInt(root.querySelector('#count').value, 10);
    opts.count = Math.max(1, Math.min(cards.length, Number.isFinite(count) ? count : cards.length));
    opts.answerWith = root.querySelector('#answer-with').value;
    root.querySelectorAll('[data-type]').forEach((cb) => (opts.types[cb.dataset.type] = cb.checked));
  }

  async function submit() {
    const n = unanswered();
    if (
      n &&
      !(await confirmDialog({
        title: 'Submit with blanks?',
        message: `You have ${plural(n, 'unanswered question')}. They will be marked incorrect.`,
        confirmLabel: 'Submit anyway',
      }))
    ) {
      return;
    }
    elapsed = Date.now() - startedAt;
    result = gradeTest(questions);
    for (const q of questions) {
      if (q.type === 'matching') q.items.forEach((i) => store.record(set.id, i.card.id, i.correct));
      else store.record(set.id, q.card.id, q.correct);
    }
    phase = 'results';
    render();
  }

  function onClick(e) {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'start') {
      readSetup();
      if (!Object.values(opts.types).some(Boolean)) {
        opts.types.mc = true;
      }
      store.setPref('test', opts);
      questions = buildTest(cards, opts);
      result = null;
      startedAt = Date.now();
      phase = 'taking';
      return render();
    }
    if (action === 'submit') return submit();
    if (action === 'again') {
      phase = 'setup';
      return render();
    }
    if (phase !== 'taking') return;
    const btn = e.target.closest('.option');
    if (!btn) return;
    const q = questions[Number(btn.dataset.q)];
    if (!q) return;
    if (btn.dataset.tf !== undefined) q.response = btn.dataset.tf === 'true';
    else q.response = q.options[Number(btn.dataset.opt)];
    btn.parentElement.querySelectorAll('.option').forEach((b) => b.classList.toggle('picked', b === btn));
    paintLeft();
  }

  function onInput(e) {
    if (phase !== 'taking') return;
    const q = questions[Number(e.target.dataset.q)];
    if (!q) return;
    if (e.target.dataset.item !== undefined) q.items[Number(e.target.dataset.item)].response = e.target.value;
    else if (e.target.dataset.written !== undefined) q.response = e.target.value;
    paintLeft();
  }

  function onKeydown(e) {
    // Enter in a written answer jumps to the next question instead of doing nothing.
    if (e.key !== 'Enter' || e.target.dataset?.written === undefined) return;
    e.preventDefault();
    const fields = [...root.querySelectorAll('.q-card input, .q-card select, .q-card .option, [data-action="submit"]')];
    const card = e.target.closest('.q-card');
    fields.find((f) => f.closest('.q-card') !== card && fields.indexOf(f) > fields.indexOf(e.target))?.focus();
  }

  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('keydown', onKeydown);
  render();

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('change', onInput);
    root.removeEventListener('keydown', onKeydown);
  };
}
