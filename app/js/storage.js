// storage.js – Persistenz via localStorage + Seed-Daten beim Erststart

const KEY = 'sparziele.v1';

const DEFAULT_COLOR = '#2563eb';

// dueInMonths: wird beim Seeden in ein konkretes Datum umgerechnet (Kroatien bewusst
// knapp – bei 150 €/Monat zeigt die Ampel „Knapp dran“). „Erstes Auto“ ist bereits erreicht.
const SEED = [
  { name: 'Notgroschen',            icon: '🛟', color: '#0d9488', target: 5000,  current: 3200, rate: 200, dueDate: null },
  { name: 'Sommerurlaub Kroatien',  icon: '🏖️', color: '#ea580c', target: 1500,  current: 400,  rate: 150, dueInMonths: 6 },
  { name: 'ETF Einmalanlage',       icon: '📈', color: '#2563eb', target: 10000, current: 6500, rate: 300, dueDate: null },
  { name: 'Erstes Auto',            icon: '🚗', color: '#7c3aed', target: 8000,  current: 8000, rate: 0,   dueDate: null },
];

const DEFAULT_SORT = 'fortschritt';

function makeId() {
  return 'g_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function toIsoDate(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function seedGoals() {
  const now = new Date();
  return SEED.map(({ dueInMonths, ...g }, i) => ({
    id: makeId(),
    ...g,
    dueDate: dueInMonths
      ? toIsoDate(new Date(now.getFullYear(), now.getMonth() + dueInMonths, now.getDate()))
      : g.dueDate ?? null,
    createdAt: Date.now() + i, // stabile Reihenfolge bei gleichem Zeitstempel
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
    // Bestehende Daten ohne Farbe (ältere App-Version) bekommen das Standard-Blau
    color: typeof g.color === 'string' && /^#[0-9a-f]{6}$/i.test(g.color) ? g.color.toLowerCase() : DEFAULT_COLOR,
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
