// Turning pasted text, files and bookmarklet payloads into cards. Pure functions, no DOM.

export const MAX_CARDS = 2000;

const TERM_KEYS = ['term', 'word', 'front', 'question', 'q'];
const DEF_KEYS = ['definition', 'def', 'back', 'answer', 'a'];

export function cleanCards(cards) {
  const out = [];
  for (const c of cards || []) {
    const term = String(c?.term ?? '').trim();
    const def = String(c?.def ?? '').trim();
    if (!term && !def) continue;
    out.push({ term, def });
    if (out.length >= MAX_CARDS) break;
  }
  return out;
}

/** Split text into cards using explicit separators. */
export function parseDelimited(text, termSep = '\t', cardSep = '\n') {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!termSep || !cardSep) return [];
  const cards = [];
  for (const chunk of src.split(cardSep)) {
    if (!chunk.trim()) continue;
    const i = chunk.indexOf(termSep);
    cards.push(
      i === -1
        ? { term: chunk, def: '' }
        : { term: chunk.slice(0, i), def: chunk.slice(i + termSep.length) },
    );
  }
  return cleanCards(cards);
}

/** Guess which separator sits between term and definition. */
export function detectTermSep(text) {
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => l.trim());
  if (!lines.length) return '\t';
  for (const sep of ['\t', ' - ', ' – ', ' — ', ' = ', ': ', ',']) {
    const hits = lines.filter((l) => l.includes(sep)).length;
    if (hits >= Math.ceil(lines.length * 0.6)) return sep;
  }
  return '\t';
}

function pick(obj, keys) {
  for (const k of keys) {
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === k && obj[key] != null) return String(obj[key]);
    }
  }
  return '';
}

/** Accepts [{term, definition}], {title, cards|terms: [...]}, or arrays of [term, def] pairs. */
export function parseJSON(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.cards || data.terms || data.items || [];
  if (!Array.isArray(list)) throw new Error('No cards found in that JSON.');
  const cards = list.map((item) => {
    if (Array.isArray(item)) return { term: item[0], def: item[1] };
    if (item && typeof item === 'object') {
      return { term: pick(item, TERM_KEYS), def: pick(item, DEF_KEYS) };
    }
    return { term: item, def: '' };
  });
  return {
    title: Array.isArray(data) ? '' : String(data.title || data.name || ''),
    description: Array.isArray(data) ? '' : String(data.description || ''),
    cards: cleanCards(cards),
  };
}

/** Small CSV reader: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCSVRows(text, delimiter = ',') {
  const src = String(text ?? '').replace(/\r\n?/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim()));
}

export function parseCSV(text) {
  const firstLine = String(text ?? '').split(/\r?\n/, 1)[0] || '';
  const delimiter = ['\t', ';', ','].find((d) => firstLine.includes(d)) || ',';
  const rows = parseCSVRows(text, delimiter);
  const header = (rows[0] || []).map((f) => f.trim().toLowerCase());
  const hasHeader =
    TERM_KEYS.includes(header[0]) || DEF_KEYS.includes(header[1]) || header[0] === 'terms';
  return cleanCards((hasHeader ? rows.slice(1) : rows).map((r) => ({ term: r[0], def: r[1] })));
}

/** Parse an uploaded file by extension, falling back to sniffing the content. */
export function parseFile(name, text) {
  const ext = String(name || '').toLowerCase().split('.').pop();
  const title = String(name || '').replace(/\.[^.]+$/, '');
  const body = String(text ?? '').replace(/^﻿/, '');
  if (ext === 'json' || /^\s*[[{]/.test(body)) {
    const parsed = parseJSON(body);
    return { ...parsed, title: parsed.title || title };
  }
  if (ext === 'csv' || ext === 'tsv') return { title, description: '', cards: parseCSV(body) };
  return { title, description: '', cards: parseDelimited(body, detectTermSep(body), '\n') };
}

/** Payload the bookmarklet puts in the URL: {t: title, u: source url, c: [[term, def], ...]}. */
export function decodePayload(raw) {
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.c)) throw new Error('That import link is missing its cards.');
  return {
    title: String(data.t || 'Imported set').slice(0, 200),
    source: typeof data.u === 'string' && /^https?:\/\//i.test(data.u) ? data.u : '',
    cards: cleanCards(data.c.map((p) => ({ term: p?.[0], def: p?.[1] }))),
  };
}

/** Is this a link to a Quizlet page? */
export function isQuizletUrl(value) {
  try {
    const u = new URL(String(value).trim());
    return /^https?:$/.test(u.protocol) && /(^|\.)quizlet\.com$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Tab/newline text, the same shape Quizlet's own Export produces. */
export function toText(cards) {
  const flat = (s) => String(s ?? '').replace(/[\t\n\r]+/g, ' ');
  return cards.map((c) => `${flat(c.term)}\t${flat(c.def)}`).join('\n');
}
