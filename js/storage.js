// storage.js – Persistenz via localStorage + Seed-Daten beim Erststart

const KEY = 'sparziele.v1';

const SEED = [
  { name: 'Notgroschen',            icon: '🛟', target: 5000,  current: 3200, rate: 200, dueDate: null },
  { name: 'Sommerurlaub Kroatien',  icon: '🏖️', target: 1500,  current: 400,  rate: 150, dueDate: null },
  { name: 'ETF Einmalanlage',       icon: '📈', target: 10000, current: 6500, rate: 300, dueDate: null },
];

const DEFAULT_SORT = 'fortschritt';

function makeId() {
  return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function seedGoals() {
  const now = Date.now();
  return SEED.map((g, i) => ({
    id: makeId(),
    ...g,
    createdAt: now + i, // stabile Reihenfolge bei gleichem Zeitstempel
  }));
}

/** Liest den State. Beim allerersten Aufruf werden Seed-Daten angelegt und gespeichert. */
export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // localStorage nicht verfügbar (z. B. privater Modus) – mit Seed im Speicher weiterarbeiten
    return { goals: seedGoals(), sort: DEFAULT_SORT };
  }

  if (!raw) {
    const fresh = { goals: seedGoals(), sort: DEFAULT_SORT };
    saveState(fresh);
    return fresh;
  }

  try {
    const data = JSON.parse(raw);
    return {
      goals: Array.isArray(data.goals) ? data.goals.map(normalizeGoal) : [],
      sort: ['fortschritt', 'datum', 'betrag'].includes(data.sort) ? data.sort : DEFAULT_SORT,
    };
  } catch {
    const fresh = { goals: seedGoals(), sort: DEFAULT_SORT };
    saveState(fresh);
    return fresh;
  }
}

function normalizeGoal(g) {
  return {
    id: g.id || makeId(),
    name: String(g.name ?? '').slice(0, 60),
    icon: g.icon || '🎯',
    target: Number(g.target) || 0,
    current: Number(g.current) || 0,
    rate: Number(g.rate) || 0,
    dueDate: g.dueDate || null,
    createdAt: g.createdAt || Date.now(),
  };
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* Schreiben nicht möglich – stiller Fallback, App bleibt im Speicher nutzbar */
  }
}

export { makeId, KEY };
