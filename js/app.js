import { store } from './store.js';
import { icon, esc } from './ui.js';
import { home } from './views/home.js';
import { setView } from './views/set.js';
import { editView } from './views/edit.js';
import { importView, shareView } from './views/import.js';
import { flashcards } from './views/flashcards.js';
import { learn } from './views/learn.js';
import { test } from './views/test.js';
import { match } from './views/match.js';

const main = document.getElementById('main');
const MODE_VIEWS = { flashcards, learn, test, match };

function notFound(root, what = 'page') {
  root.innerHTML = `
    <section class="page narrow center-msg">
      <h1>We couldn't find that ${esc(what)}</h1>
      <p class="muted">Sets are saved in the browser they were made in, so a link to one only works there. To send a set to someone, use its Share button.</p>
      <p><a class="btn primary" href="#/">Go to your sets</a></p>
    </section>`;
}

function withSet(view) {
  return (root, ctx) => {
    const set = store.getSet(ctx.params[0]);
    if (!set) return notFound(root, 'set');
    return view(root, { ...ctx, set });
  };
}

const routes = [
  [/^\/$/, home, 'home'],
  [/^\/new$/, editView, 'new'],
  [/^\/import$/, importView, 'import'],
  [/^\/share\/(.+)$/, shareView, 'import'],
  [/^\/set\/([^/]+)$/, withSet(setView), 'home'],
  [/^\/set\/([^/]+)\/edit$/, withSet(editView), 'home'],
  [
    /^\/set\/([^/]+)\/(flashcards|learn|test|match)$/,
    withSet((root, ctx) => {
      store.touch(ctx.set.id);
      return MODE_VIEWS[ctx.params[1]](root, ctx);
    }),
    'mode',
  ],
];

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const q = raw.indexOf('?');
  const path = q === -1 ? raw : raw.slice(0, q);
  const query = {};
  if (q !== -1) {
    for (const part of raw.slice(q + 1).split('&')) {
      const eq = part.indexOf('=');
      const key = eq === -1 ? part : part.slice(0, eq);
      try {
        query[decodeURIComponent(key)] = eq === -1 ? '' : decodeURIComponent(part.slice(eq + 1));
      } catch {
        query[key] = '';
      }
    }
  }
  return { path: path.replace(/\/+$/, '') || '/', query };
}

let cleanup = null;

function render() {
  const { path, query } = parseHash();
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  main.innerHTML = '';
  window.scrollTo(0, 0);

  let section = '';
  let matched = false;
  for (const [pattern, view, name] of routes) {
    const m = path.match(pattern);
    if (!m) continue;
    matched = true;
    section = name;
    cleanup = view(main, { params: m.slice(1), query }) || null;
    break;
  }
  if (!matched) notFound(main);

  document.body.classList.toggle('in-mode', section === 'mode');
  for (const a of document.querySelectorAll('[data-nav]')) {
    a.classList.toggle('current', a.dataset.nav === section);
  }
}

// Theme: follows the system until the user picks one.
const themeBtn = document.getElementById('theme-toggle');
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
}
function paintThemeBtn() {
  themeBtn.innerHTML = icon(isDark() ? 'sun' : 'moon');
}
themeBtn.addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('flipside.theme', next);
  } catch {}
  paintThemeBtn();
});
paintThemeBtn();

// Close open dropdown menus when clicking elsewhere or pressing Escape.
document.addEventListener('click', (e) => {
  for (const d of document.querySelectorAll('details.menu[open]')) {
    if (!d.contains(e.target) || e.target.closest('.menu-list button, .menu-list a')) d.open = false;
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  for (const d of document.querySelectorAll('details.menu[open]')) d.open = false;
});

// A link to the page you are already on fires no hashchange, so re-render by hand.
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (a && a.getAttribute('href') === location.hash && !a.target) render();
});

store.seedIfEmpty();
window.addEventListener('hashchange', render);
render();
