// calc.js – Berechnungen, Hochrechnung, Sortierung, Formatierung (de-DE)

const eur0 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const monthYear = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });

/** Geldbetrag: ganze Beträge ohne Nachkommastellen, krumme mit zwei. */
export function formatEuro(value) {
  const n = Number(value) || 0;
  return Number.isInteger(n) ? eur0.format(n) : eur2.format(n);
}

/** Datum für <input type="date">. */
export function toInputDate(iso) {
  if (!iso) return '';
  return String(iso).slice(0, 10);
}

function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return d;
}

function formatMonthYear(date) {
  // erster Buchstabe groß (Intl liefert i. d. R. bereits groß, aber sicher ist sicher)
  const s = monthYear.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Berechnet alle abgeleiteten Kennzahlen eines Ziels.
 * Gibt ein angereichertes Objekt für die Darstellung zurück.
 */
export function computeGoal(goal, now = new Date()) {
  const target = Math.max(0, Number(goal.target) || 0);
  const current = Math.max(0, Number(goal.current) || 0);
  const rate = Math.max(0, Number(goal.rate) || 0);

  const percentRaw = target > 0 ? (current / target) * 100 : 0;
  const percent = Math.max(0, Math.min(100, percentRaw));
  const missing = Math.max(0, target - current);
  const isDone = target > 0 && current >= target;

  // Ghost-Segment: wo stehst du nach dem nächsten Sparmonat?
  const nextPercentRaw = target > 0 ? ((current + rate) / target) * 100 : 0;
  const nextPercent = Math.max(0, Math.min(100, nextPercentRaw));

  let months = null;       // ganze Monate bis zum Ziel
  let projectedDate = null;
  let projectionText;

  if (isDone) {
    projectionText = 'Ziel erreicht 🎉';
  } else if (rate > 0) {
    months = Math.ceil(missing / rate);
    projectedDate = addMonths(now, months);
    const when = formatMonthYear(projectedDate);
    const monatWort = months === 1 ? 'Monat' : 'Monaten';
    projectionText = `Erreicht in ${months} ${monatWort} · ${when}`;
  } else {
    projectionText = 'Keine Sparrate – Zeitpunkt offen';
  }

  // Vergleich mit gesetztem Zieldatum
  let dueStatus = null; // { type: 'ok'|'warn', text }
  if (goal.dueDate) {
    const due = new Date(goal.dueDate);
    if (!Number.isNaN(due.getTime())) {
      const dueLabel = formatMonthYear(due);
      if (isDone) {
        dueStatus = { type: 'ok', text: `Zieldatum ${dueLabel}` };
      } else if (projectedDate) {
        const diff = monthsBetween(projectedDate, due); // >0: Prognose vor Zieldatum
        if (diff >= 0) {
          dueStatus = { type: 'ok', text: diff === 0 ? `Pünktlich zum ${dueLabel}` : `${diff} Mon. vor Ziel (${dueLabel})` };
        } else {
          dueStatus = { type: 'warn', text: `${Math.abs(diff)} Mon. nach Ziel (${dueLabel})` };
        }
      } else {
        dueStatus = { type: 'warn', text: `Zieldatum ${dueLabel}` };
      }
    }
  }

  return {
    ...goal,
    target, current, rate,
    percent, percentRounded: Math.round(percent),
    missing, isDone,
    nextPercent, hasGhost: !isDone && rate > 0 && nextPercent > percent + 0.5,
    months, projectedDate, projectionText, dueStatus,
  };
}

function monthsBetween(from, to) {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Gesamtübersicht über alle Ziele. */
export function computeOverview(goals, now = new Date()) {
  const computed = goals.map((g) => computeGoal(g, now));
  const totalTarget = computed.reduce((s, g) => s + g.target, 0);
  const totalCurrent = computed.reduce((s, g) => s + Math.min(g.current, g.target), 0);
  const totalSavedRaw = computed.reduce((s, g) => s + g.current, 0);
  const percent = totalTarget > 0 ? Math.max(0, Math.min(100, (totalCurrent / totalTarget) * 100)) : 0;
  const missing = Math.max(0, totalTarget - totalCurrent);

  // Nächstes erreichbares Ziel: nicht erreicht, mit Sparrate, kleinste Monatszahl
  const reachable = computed
    .filter((g) => !g.isDone && g.months != null)
    .sort((a, b) => a.months - b.months || a.missing - b.missing);
  const next = reachable[0] || null;

  return {
    count: goals.length,
    totalTarget,
    totalSaved: totalSavedRaw,
    percent,
    percentRounded: Math.round(percent),
    missing,
    next: next
      ? { name: next.name, icon: next.icon, when: formatMonthYear(next.projectedDate), months: next.months }
      : null,
    allDone: goals.length > 0 && computed.every((g) => g.isDone),
  };
}

/** Sortiert eine Liste berechneter Ziele nach dem gewählten Kriterium. */
export function sortGoals(computed, sort) {
  const arr = [...computed];
  if (sort === 'datum') {
    // Nach erwartetem Erreichungsdatum (bzw. Zieldatum) aufsteigend; ohne Datum ans Ende
    arr.sort((a, b) => {
      const da = sortDateValue(a);
      const db = sortDateValue(b);
      return da - db;
    });
  } else if (sort === 'betrag') {
    arr.sort((a, b) => b.target - a.target || a.createdAt - b.createdAt);
  } else {
    // fortschritt
    arr.sort((a, b) => b.percent - a.percent || a.missing - b.missing);
  }
  return arr;
}

function sortDateValue(g) {
  const d = g.projectedDate || (g.dueDate ? new Date(g.dueDate) : null);
  if (d && !Number.isNaN(d.getTime())) return d.getTime();
  return Number.POSITIVE_INFINITY; // erreichte Ziele / ohne Prognose ans Ende
}
