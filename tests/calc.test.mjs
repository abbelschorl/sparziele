// Unit-Tests für die Rechen-Logik (app/js/calc.js).
// Ausführen:  npm test   (bzw.  node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeGoal, computeOverview, sortGoals, formatEuro, toInputDate,
  computeDue, computeWhatIf,
} from '../app/js/calc.js';

// Fixer Bezugszeitpunkt für deterministische Hochrechnungen: 30. Juni 2026
const NOW = new Date(2026, 5, 30);

// Whitespace normalisieren (Intl nutzt teils schmale/geschützte Leerzeichen)
const norm = (s) => s.replace(/\s/g, ' ');

test('computeGoal: laufendes Ziel – Prozent, fehlender Betrag, Hochrechnung', () => {
  const g = computeGoal({ target: 5000, current: 3200, rate: 200 }, NOW);
  assert.equal(g.percentRounded, 64);
  assert.equal(g.missing, 1800);
  assert.equal(g.isDone, false);
  assert.equal(g.months, 9);              // 1800 / 200 = 9
  assert.equal(g.projectedDate.getFullYear(), 2027);
  assert.equal(g.projectedDate.getMonth(), 2); // März
  assert.match(g.projectionText, /9 Monaten/);
});

test('computeGoal: rundet Monate auf (kein halber Monat)', () => {
  const g = computeGoal({ target: 1500, current: 400, rate: 150 }, NOW);
  assert.equal(g.months, 8);              // 1100 / 150 = 7,33 -> 8
  assert.equal(g.percentRounded, 27);
});

test('computeGoal: erreichtes Ziel', () => {
  const g = computeGoal({ target: 1000, current: 1000, rate: 50 }, NOW);
  assert.equal(g.isDone, true);
  assert.equal(g.missing, 0);
  assert.equal(g.months, null);
  assert.match(g.projectionText, /erreicht/i);
});

test('computeGoal: übersparen wird bei 100 % gedeckelt', () => {
  const g = computeGoal({ target: 1000, current: 1500, rate: 50 }, NOW);
  assert.equal(g.isDone, true);
  assert.equal(g.percent, 100);
  assert.equal(g.missing, 0);
});

test('computeGoal: ohne Sparrate keine Zeitprognose', () => {
  const g = computeGoal({ target: 1000, current: 200, rate: 0 }, NOW);
  assert.equal(g.months, null);
  assert.equal(g.projectedDate, null);
  assert.match(g.projectionText, /keine sparrate/i);
});

test('computeGoal: Ghost-Segment zeigt den nächsten Sparmonat', () => {
  const g = computeGoal({ target: 1000, current: 500, rate: 100 }, NOW);
  assert.equal(g.hasGhost, true);
  assert.equal(Math.round(g.nextPercent), 60); // (500+100)/1000
});

test('computeOverview: Summen, Gesamtprozent und nächstes erreichbares Ziel', () => {
  const goals = [
    { id: 'a', name: 'Notgroschen', icon: '🛟', target: 5000, current: 3200, rate: 200, createdAt: 1 },
    { id: 'b', name: 'Kroatien', icon: '🏖️', target: 1500, current: 400, rate: 150, createdAt: 2 },
    { id: 'c', name: 'ETF', icon: '📈', target: 10000, current: 6500, rate: 300, createdAt: 3 },
  ];
  const o = computeOverview(goals, NOW);
  assert.equal(o.totalSaved, 10100);
  assert.equal(o.totalTarget, 16500);
  assert.equal(o.percentRounded, 61);
  assert.equal(o.count, 3);
  assert.equal(o.next.name, 'Kroatien'); // kleinste Monatszahl (8)
  assert.equal(o.allDone, false);
});

test('computeOverview: leere Liste ist unkritisch', () => {
  const o = computeOverview([], NOW);
  assert.equal(o.totalSaved, 0);
  assert.equal(o.percentRounded, 0);
  assert.equal(o.next, null);
});

test('sortGoals: Fortschritt absteigend', () => {
  const computed = [
    computeGoal({ id: 'a', name: 'A', target: 100, current: 20, rate: 10, createdAt: 1 }, NOW),
    computeGoal({ id: 'b', name: 'B', target: 100, current: 80, rate: 10, createdAt: 2 }, NOW),
  ];
  const sorted = sortGoals(computed, 'fortschritt');
  assert.equal(sorted[0].name, 'B');
});

test('sortGoals: Betrag absteigend', () => {
  const computed = [
    computeGoal({ id: 'a', name: 'Klein', target: 100, current: 0, rate: 10, createdAt: 1 }, NOW),
    computeGoal({ id: 'b', name: 'Groß', target: 9000, current: 0, rate: 10, createdAt: 2 }, NOW),
  ];
  const sorted = sortGoals(computed, 'betrag');
  assert.equal(sorted[0].name, 'Groß');
});

test('formatEuro: de-DE, ganze Beträge ohne, krumme mit zwei Nachkommastellen', () => {
  assert.match(norm(formatEuro(5000)), /5\.000\s*€/);
  assert.match(norm(formatEuro(1234.5)), /1\.234,50\s*€/);
});

test('toInputDate: schneidet ISO-Zeit ab', () => {
  assert.equal(toInputDate('2027-03-01T00:00:00.000Z'), '2027-03-01');
  assert.equal(toInputDate(null), '');
});

/* ---- Zieldatum-Ampel (computeDue) ---- */

test('computeDue: benötigte Rate = fehlender Betrag / verbleibende Monate (aufgerundet)', () => {
  // Kroatien-Szenario: 1.100 € fehlen, 6 Monate -> 184 €/Monat nötig
  const d = computeDue({ target: 1500, current: 400, rate: 150, dueDate: '2026-12-30' }, NOW);
  assert.equal(d.remainingMonths, 6);
  assert.equal(d.requiredRate, 184);
  assert.equal(d.status, 'warn');          // 150/184 ≈ 82 % -> gelb („Knapp dran“)
  assert.match(d.text, /Knapp dran/);
});

test('computeDue: grün, wenn die aktuelle Rate reicht', () => {
  const d = computeDue({ target: 1500, current: 400, rate: 200, dueDate: '2026-12-30' }, NOW);
  assert.equal(d.status, 'good');
  assert.match(d.text, /Auf Kurs/);
});

test('computeDue: rot bei deutlich zu niedriger oder fehlender Rate', () => {
  assert.equal(computeDue({ target: 1500, current: 400, rate: 50, dueDate: '2026-12-30' }, NOW).status, 'late');
  assert.equal(computeDue({ target: 1500, current: 400, rate: 0, dueDate: '2026-12-30' }, NOW).status, 'late');
});

test('computeDue: überschrittenes Zieldatum', () => {
  const d = computeDue({ target: 1500, current: 400, rate: 150, dueDate: '2026-01-15' }, NOW);
  assert.equal(d.status, 'late');
  assert.match(d.text, /überschritten/i);
});

test('computeDue: Zieldatum im laufenden Monat -> mindestens 1 Monat Rechenbasis', () => {
  const d = computeDue({ target: 1000, current: 400, rate: 600, dueDate: '2026-06-30' }, NOW);
  assert.equal(d.remainingMonths, 1);
  assert.equal(d.requiredRate, 600);
  assert.equal(d.status, 'good');
});

test('computeDue: erreichtes Ziel ist grün, ohne/ungültiges Datum null', () => {
  const d = computeDue({ target: 1000, current: 1000, rate: 0, dueDate: '2026-12-01' }, NOW);
  assert.equal(d.status, 'good');
  assert.match(d.text, /Zieldatum/);
  assert.equal(computeDue({ target: 1000, current: 0, rate: 10 }, NOW), null);
  assert.equal(computeDue({ target: 1000, current: 0, rate: 10, dueDate: 'quatsch' }, NOW), null);
});

test('computeGoal: liefert due-Objekt mit, wenn Zieldatum gesetzt', () => {
  const g = computeGoal({ target: 1500, current: 400, rate: 150, dueDate: '2026-12-30' }, NOW);
  assert.equal(g.due.status, 'warn');
  assert.equal(computeGoal({ target: 1500, current: 400, rate: 150 }, NOW).due, null);
});

/* ---- „Was wäre wenn?“ (computeWhatIf) ---- */

test('computeWhatIf: Hochrechnung für Test-Sparrate', () => {
  const wi = computeWhatIf({ target: 1000, current: 500 }, 100, NOW);
  assert.equal(wi.months, 5);
  assert.equal(wi.rate, 100);
  assert.equal(wi.when, 'November 2026');
  assert.match(norm(wi.text), /Bei 100 €\/Monat/);
  assert.match(wi.text, /5 Monaten/);
});

test('computeWhatIf: Singular bei einem Monat', () => {
  const wi = computeWhatIf({ target: 1000, current: 950 }, 100, NOW);
  assert.equal(wi.months, 1);
  assert.match(norm(wi.text), /in 1 Monat ·/);
});

test('computeWhatIf: null bei Rate 0 oder bereits erreichtem Ziel', () => {
  assert.equal(computeWhatIf({ target: 1000, current: 500 }, 0, NOW), null);
  assert.equal(computeWhatIf({ target: 1000, current: 1000 }, 100, NOW), null);
});
