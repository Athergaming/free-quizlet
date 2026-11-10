// Everything is kept in this browser's localStorage. No server, no account.

const KEY = 'flipside.v1';

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function blank() {
  return { sets: {}, progress: {}, best: {}, prefs: {}, seeded: false };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch (e) {
    console.warn('Flipside: could not read saved data', e);
  }
  return blank();
}

let state = load();
let storageOk = true;

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    storageOk = true;
  } catch (e) {
    storageOk = false;
    console.warn('Flipside: could not save', e);
  }
}

const SAMPLE = {
  title: 'Sample: World capitals',
  description: 'A starter set so you can try every study mode. Delete it whenever you like.',
  cards: [
    ['Japan', 'Tokyo'],
    ['Canada', 'Ottawa'],
    ['Australia', 'Canberra'],
    ['Brazil', 'Brasília'],
    ['Egypt', 'Cairo'],
    ['Kenya', 'Nairobi'],
    ['Norway', 'Oslo'],
    ['Peru', 'Lima'],
    ['Thailand', 'Bangkok'],
    ['Türkiye', 'Ankara'],
    ['Morocco', 'Rabat'],
    ['New Zealand', 'Wellington'],
  ],
};

export const store = {
  get storageOk() {
    return storageOk;
  },

  seedIfEmpty() {
    if (state.seeded || Object.keys(state.sets).length) return;
    state.seeded = true;
    this.saveSet({
      title: SAMPLE.title,
      description: SAMPLE.description,
      cards: SAMPLE.cards.map(([term, def]) => ({ term, def })),
    });
  },

  listSets() {
    return Object.values(state.sets).sort(
      (a, b) => Math.max(b.lastStudied || 0, b.updatedAt) - Math.max(a.lastStudied || 0, a.updatedAt),
    );
  },

  getSet(id) {
    return state.sets[id] || null;
  },

  /** Create or update a set. Returns the saved set. */
  saveSet(input) {
    const now = Date.now();
    const prev = input.id ? state.sets[input.id] : null;
    const set = {
      id: prev?.id || uid(),
      title: String(input.title || 'Untitled set').trim() || 'Untitled set',
      description: String(input.description || '').trim(),
      source: input.source ?? prev?.source ?? '',
      createdAt: prev?.createdAt || now,
      updatedAt: now,
      lastStudied: prev?.lastStudied || 0,
      cards: input.cards.map((c) => ({
        id: c.id || uid(),
        term: String(c.term ?? ''),
        def: String(c.def ?? ''),
        starred: !!c.starred,
      })),
    };
    state.sets[set.id] = set;
    const prog = state.progress[set.id];
    if (prog) {
      const alive = new Set(set.cards.map((c) => c.id));
      for (const cardId of Object.keys(prog)) if (!alive.has(cardId)) delete prog[cardId];
    }
    persist();
    return set;
  },

  deleteSet(id) {
    delete state.sets[id];
    delete state.progress[id];
    delete state.best[id];
    persist();
  },

  toggleStar(setId, cardId) {
    const card = state.sets[setId]?.cards.find((c) => c.id === cardId);
    if (!card) return false;
    card.starred = !card.starred;
    persist();
    return card.starred;
  },

  touch(setId) {
    if (!state.sets[setId]) return;
    state.sets[setId].lastStudied = Date.now();
    persist();
  },

  getProgress(setId) {
    return state.progress[setId] || {};
  },

  /** Record an answer. stage: 0 new, 1 familiar, 2 mastered (only Learn passes it). */
  record(setId, cardId, correct, stage) {
    const prog = (state.progress[setId] ||= {});
    const p = (prog[cardId] ||= { s: 0, ok: 0, no: 0 });
    if (correct) p.ok++;
    else p.no++;
    if (stage !== undefined) p.s = stage;
    p.seen = Date.now();
    if (state.sets[setId]) state.sets[setId].lastStudied = p.seen;
    persist();
  },

  resetProgress(setId) {
    delete state.progress[setId];
    persist();
  },

  stats(set) {
    const prog = this.getProgress(set.id);
    const out = { fresh: 0, learning: 0, mastered: 0, total: set.cards.length };
    for (const c of set.cards) {
      const p = prog[c.id];
      if (!p) out.fresh++;
      else if (p.s >= 2) out.mastered++;
      else out.learning++;
    }
    return out;
  },

  bucket(setId, cardId) {
    const p = this.getProgress(setId)[cardId];
    return !p ? 'fresh' : p.s >= 2 ? 'mastered' : 'learning';
  },

  getBest(setId, key) {
    return state.best[setId]?.[key] ?? null;
  },

  setBest(setId, key, value) {
    (state.best[setId] ||= {})[key] = value;
    persist();
  },

  pref(key, fallback) {
    return state.prefs[key] ?? fallback;
  },

  setPref(key, value) {
    state.prefs[key] = value;
    persist();
  },
};
