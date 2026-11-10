// Answer grading for written questions. Pure functions, no DOM.

const fold = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const squash = (s) =>
  s
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Lower-case, strip accents and punctuation. Parenthetical notes are dropped unless keepParens. */
export function normalize(s, keepParens = false) {
  let t = fold(s);
  if (!keepParens) t = t.replace(/\([^)]*\)/g, ' ');
  return squash(t);
}

/** Every normalized form that counts as a right answer. */
export function variants(answer) {
  const out = new Set();
  const add = (s) => {
    for (const keep of [false, true]) {
      const n = normalize(s, keep);
      if (n) out.add(n);
    }
  };
  const text = String(answer ?? '');
  add(text);
  const alts = text.split(/[/;]/);
  if (alts.length > 1) alts.forEach(add);
  const commas = text.split(',');
  if (commas.length > 1 && commas.every((p) => p.trim().split(/\s+/).length <= 3)) {
    commas.forEach(add);
  }
  return out;
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/**
 * @returns {{correct: boolean, close: boolean}} close = wrong, but only a typo away.
 */
export function gradeWritten(input, answer) {
  const typed = normalize(input, true);
  if (!typed) return { correct: false, close: false };
  const ok = variants(answer);
  if (ok.has(typed) || ok.has(normalize(input))) return { correct: true, close: false };
  const target = normalize(answer, true);
  const slack = target.length >= 10 ? 2 : 1;
  const close = target.length >= 5 && levenshtein(typed, target) <= slack;
  return { correct: false, close };
}
