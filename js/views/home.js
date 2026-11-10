import { store } from '../store.js';
import { esc, icon, plural, timeAgo } from '../ui.js';

function setCard(set) {
  const s = store.stats(set);
  const pct = s.total ? Math.round((s.mastered / s.total) * 100) : 0;
  const studied = set.lastStudied ? `Studied ${timeAgo(set.lastStudied)}` : 'Not studied yet';
  return `
    <a class="set-card" href="#/set/${set.id}">
      <h3>${esc(set.title)}</h3>
      <p class="set-card-count">${plural(s.total, 'term')}</p>
      <div class="meter" role="img" aria-label="${pct}% mastered"><span style="width:${pct}%"></span></div>
      <p class="set-card-meta">${s.mastered ? `${s.mastered} of ${s.total} mastered · ` : ''}${studied}</p>
    </a>`;
}

export function home(root) {
  const sets = store.listSets();

  root.innerHTML = `
    <section class="page">
      <div class="hero ${sets.length > 1 ? 'compact' : ''}">
        <div>
          <h1>Study anything. <br /><em>No account, no paywall.</em></h1>
          <p>Flashcards, Learn, Test and Match on any set of terms. Everything is saved right here in your browser.</p>
          <div class="hero-actions">
            <a class="btn primary big" href="#/new">${icon('plus')} Create a set</a>
            <a class="btn outline big" href="#/import">${icon('link')} Import from a link or text</a>
          </div>
        </div>
        <div class="hero-art" aria-hidden="true">
          <div class="art-card a">photosynthesis</div>
          <div class="art-card b">how plants turn light into food</div>
        </div>
      </div>

      ${
        sets.length
          ? `<div class="section-head">
               <h2>Your sets</h2>
               ${sets.length > 4 ? `<input type="search" class="input search" id="set-search" placeholder="Search your sets" aria-label="Search your sets" />` : ''}
             </div>
             <div class="set-grid" id="set-grid">${sets.map(setCard).join('')}</div>
             <p class="muted empty-note" id="no-match" hidden>No sets match that search.</p>`
          : `<div class="empty-state">
               <h2>No sets yet</h2>
               <p class="muted">Create one by hand, or bring one in from a link, pasted text or a file.</p>
             </div>`
      }
      ${store.storageOk ? '' : `<p class="notice warn">This browser is blocking storage, so sets won't be saved after you close the tab.</p>`}
    </section>`;

  const search = root.querySelector('#set-search');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    const shown = sets.filter(
      (s) =>
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.cards.some((c) => c.term.toLowerCase().includes(q) || c.def.toLowerCase().includes(q)),
    );
    root.querySelector('#set-grid').innerHTML = shown.map(setCard).join('');
    root.querySelector('#no-match').hidden = shown.length > 0;
  });
}
