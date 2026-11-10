import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalize, gradeWritten, levenshtein } from '../js/lib/grade.js';
import {
  parseDelimited,
  detectTermSep,
  parseJSON,
  parseCSV,
  parseFile,
  decodePayload,
  isQuizletUrl,
  toText,
} from '../js/lib/importer.js';
import { encodeShare, decodeShare } from '../js/lib/share.js';
import { collect, bookmarkletHref } from '../js/lib/bookmarklet.js';

test('normalize strips case, accents, punctuation and bracketed notes', () => {
  assert.equal(normalize('  Brasília! '), 'brasilia');
  assert.equal(normalize('to run (verb)'), 'to run');
  assert.equal(normalize('to run (verb)', true), 'to run verb');
});

test('gradeWritten accepts equivalent answers', () => {
  assert.equal(gradeWritten('tokyo', 'Tokyo').correct, true);
  assert.equal(gradeWritten('Brasilia', 'Brasília').correct, true);
  assert.equal(gradeWritten('to run', 'to run (verb)').correct, true);
  assert.equal(gradeWritten('big', 'big / large').correct, true);
  assert.equal(gradeWritten('large', 'big; large').correct, true);
  assert.equal(gradeWritten('happy', 'happy, glad').correct, true);
});

test('gradeWritten rejects wrong and empty answers, flags near misses', () => {
  assert.deepEqual(gradeWritten('', 'Tokyo'), { correct: false, close: false });
  assert.equal(gradeWritten('Kyoto', 'Tokyo').correct, false);
  assert.deepEqual(gradeWritten('Welington', 'Wellington'), { correct: false, close: true });
  // A list of full phrases is not split on commas.
  assert.equal(gradeWritten('the cell', 'the cell, which is the basic unit of all life').correct, false);
});

test('levenshtein', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('parseDelimited handles tab/newline export text', () => {
  const cards = parseDelimited('hola\thello\r\ngracias\tthank you\n\nsolo\n', '\t', '\n');
  assert.deepEqual(cards, [
    { term: 'hola', def: 'hello' },
    { term: 'gracias', def: 'thank you' },
    { term: 'solo', def: '' },
  ]);
});

test('parseDelimited supports custom separators and multi-line definitions', () => {
  const cards = parseDelimited('a::line one\nline two;;b::two', '::', ';;');
  assert.deepEqual(cards, [
    { term: 'a', def: 'line one\nline two' },
    { term: 'b', def: 'two' },
  ]);
  // Only the first separator splits, so definitions may contain it.
  assert.deepEqual(parseDelimited('H2O - water - a liquid', ' - ', '\n'), [
    { term: 'H2O', def: 'water - a liquid' },
  ]);
});

test('detectTermSep', () => {
  assert.equal(detectTermSep('a\tb\nc\td'), '\t');
  assert.equal(detectTermSep('cat - gato\ndog - perro'), ' - ');
  assert.equal(detectTermSep('cat,gato\ndog,perro'), ',');
  assert.equal(detectTermSep('just words'), '\t');
});

test('parseJSON accepts several shapes', () => {
  assert.deepEqual(parseJSON('[{"term":"a","definition":"b"}]').cards, [{ term: 'a', def: 'b' }]);
  assert.deepEqual(parseJSON('[["a","b"]]').cards, [{ term: 'a', def: 'b' }]);
  const full = parseJSON('{"title":"T","cards":[{"front":"a","back":"b"},{"word":"","def":""}]}');
  assert.equal(full.title, 'T');
  assert.deepEqual(full.cards, [{ term: 'a', def: 'b' }]);
});

test('parseCSV handles quotes, headers and embedded newlines', () => {
  const cards = parseCSV('Term,Definition\n"a, b","say ""hi"""\nc,"two\nlines"\n');
  assert.deepEqual(cards, [
    { term: 'a, b', def: 'say "hi"' },
    { term: 'c', def: 'two\nlines' },
  ]);
});

test('parseFile picks a parser from the file name', () => {
  assert.equal(parseFile('verbs.csv', 'ir,to go').cards[0].def, 'to go');
  assert.equal(parseFile('verbs.txt', 'ir\tto go').title, 'verbs');
  assert.equal(parseFile('set.json', '{"title":"S","cards":[["a","b"]]}').title, 'S');
});

test('decodePayload validates the bookmarklet payload', () => {
  const data = decodePayload(JSON.stringify({ t: 'Set', u: 'https://quizlet.com/1/x', c: [['a', 'b'], ['', '']] }));
  assert.equal(data.title, 'Set');
  assert.equal(data.source, 'https://quizlet.com/1/x');
  assert.deepEqual(data.cards, [{ term: 'a', def: 'b' }]);
  assert.equal(decodePayload('{"c":[],"u":"javascript:alert(1)"}').source, '');
  assert.throws(() => decodePayload('{"t":"x"}'));
});

test('isQuizletUrl', () => {
  assert.equal(isQuizletUrl('https://quizlet.com/123/some-set-flash-cards/'), true);
  assert.equal(isQuizletUrl('https://www.quizlet.com/gb/123/x'), true);
  assert.equal(isQuizletUrl('https://notquizlet.com/123'), false);
  assert.equal(isQuizletUrl('https://quizlet.com.evil.example/1'), false);
  assert.equal(isQuizletUrl('quizlet'), false);
});

test('toText round-trips through parseDelimited', () => {
  const cards = [{ term: 'a', def: 'b\nc' }, { term: 'd', def: 'e' }];
  assert.deepEqual(parseDelimited(toText(cards), '\t', '\n'), [
    { term: 'a', def: 'b c' },
    { term: 'd', def: 'e' },
  ]);
});

test('share links round-trip, including non-Latin text', async () => {
  const set = {
    title: 'Ünïcode ✓',
    description: 'd',
    cards: [{ term: '日本', def: 'Japan' }, { term: 'café', def: 'coffee "shop"' }],
  };
  const payload = await encodeShare(set);
  assert.match(payload, /^[zj][A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeShare(payload), set);
  await assert.rejects(decodeShare('x123'));
});

// A minimal stand-in for a page, enough for collect().
function fakeDoc({ scripts = [], rows = [], title = 'My set Flashcards | Quizlet' }) {
  const el = (text) => ({ textContent: text, innerText: text });
  return {
    title,
    location: { href: 'https://quizlet.com/1/my-set' },
    querySelector: () => null,
    querySelectorAll(sel) {
      if (sel.startsWith('script')) return scripts.map((s) => ({ textContent: s }));
      if (sel.includes('SetPageTerms-term')) {
        return rows.map(([t, d]) => ({ querySelectorAll: () => [el(t), el(d)] }));
      }
      return [];
    },
  };
}

test('collect reads card data embedded in the page, even inside a JSON string', () => {
  const inner = JSON.stringify({
    studiableItems: [
      { cardSides: [
        { label: 'word', media: [{ plainText: 'hola' }] },
        { label: 'definition', media: [{ plainText: 'hello' }] },
      ] },
      { cardSides: [
        { label: 'definition', media: [{ plainText: 'thank you' }] },
        { label: 'word', media: [{ plainText: 'gracias' }] },
      ] },
    ],
  });
  const doc = fakeDoc({ scripts: [JSON.stringify({ props: { pageProps: { state: inner } } })] });
  const out = collect(doc);
  assert.deepEqual(out.cards, [['hola', 'hello'], ['gracias', 'thank you']]);
  assert.equal(out.title, 'My set');
  assert.equal(out.url, 'https://quizlet.com/1/my-set');
});

test('collect falls back to visible rows and removes duplicates', () => {
  const doc = fakeDoc({ scripts: ['not json'], rows: [['a', 'b'], ['a', 'b'], ['c', 'd']] });
  assert.deepEqual(collect(doc).cards, [['a', 'b'], ['c', 'd']]);
  assert.deepEqual(collect(fakeDoc({})).cards, []);
});

test('bookmarkletHref is a self-contained javascript: URL', () => {
  const href = bookmarkletHref('https://example.test/app/');
  assert.ok(href.startsWith('javascript:'));
  const code = decodeURIComponent(href.slice('javascript:'.length));
  assert.ok(code.includes('https://example.test/app/'));
  // It must parse on its own, with nothing imported.
  assert.doesNotThrow(() => new Function(code));
});
