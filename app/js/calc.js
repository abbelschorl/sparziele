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
    //   hält „Monaten · Juli 2027“ beim Umbruch zusammen
    projectionText = `Erreicht in ${months} ${monatWort} · ${when}`;
  } else {
    projectionText = 'Keine Sparrate – Zeitpunkt offen';
  }

  const due = computeDue(goal, now);

  return {
    ...goal,
    target, current, rate,
    percent, percentRounded: Math.round(percent),
    missing, isDone,
    nextPercent, hasGhost: !isDone && rate > 0 && nextPercent > percent + 0.5,
    months, projectedDate, projectionText, due,
  };
}

/**
 * Zieldatum-Check mit Ampel: reicht die aktuelle Sparrate?
 * Benötigte Rate = fehlender Betrag / verbleibende Monate (aufgerundet, min. 1 Monat).
 * Ampel: grün ab 100 % der nötigen Rate, gelb ab 80 %, sonst rot.
 * Gibt null zurück, wenn kein (gültiges) Zieldatum gesetzt ist.
 */
export function computeDue(goal, now = new Date()) {
  if (!goal.dueDate) return null;
  const due = new Date(goal.dueDate);
  if (Number.isNaN(due.getTime())) return null;

  const target = Math.max(0, Number(goal.target) || 0);
  const current = Math.max(0, Number(goal.current) || 0);
  const rate = Math.max(0, Number(goal.rate) || 0);
  const missing = Math.max(0, target - current);
  const isDone = target > 0 && current >= target;
  const dueLabel = formatMonthYear(due);

  if (isDone) {
    return { status: 'good', text: `Zieldatum ${dueLabel}`, remainingMonths: null, requiredRate: 0, dueLabel };
  }

  // Monate von jetzt bis zum Zieldatum (auf Monatsbasis)
  const diff = monthsBetween(new Date(now.getFullYear(), now.getMonth(), 1),
                             new Date(due.getFullYear(), due.getMonth(), 1));
  if (diff < 0) {
    return { status: 'late', text: `Zieldatum überschritten (${dueLabel})`, remainingMonths: 0, requiredRate: missing, dueLabel };
  }

  const remainingMonths = Math.max(1, diff);
  const requiredRate = Math.ceil(missing / remainingMonths);
  const ratio = requiredRate > 0 ? rate / requiredRate : 1;

  const status = ratio >= 1 ? 'good' : ratio >= 0.8 ? 'warn' : 'late';
  const label = status === 'good' ? 'Auf Kurs' : status === 'warn' ? 'Knapp dran' : 'Zu langsam';
  return { status, text: `${label} · Ziel ${dueLabel}`, remainingMonths, requiredRate, dueLabel };
}

/**
 * „Was wäre wenn“: Hochrechnung für eine testweise geänderte Sparrate.
 * Gibt null zurück, wenn Rate ≤ 0 oder das Ziel bereits erreicht ist.
 */
export function computeWhatIf(goal, rate, now = new Date()) {
  const target = Math.max(0, Number(goal.target) || 0);
  const current = Math.max(0, Number(goal.current) || 0);
  const r = Math.max(0, Number(rate) || 0);
  const missing = Math.max(0, target - current);
  if (missing <= 0 || r <= 0) return null;

  const months = Math.ceil(missing / r);
  const when = formatMonthYear(addMonths(now, months));
  const monatWort = months === 1 ? 'Monat' : 'Monaten';
  return { rate: r, months, when, text: `Bei ${formatEuro(r)}/Monat: erreicht in ${months} ${monatWort} · ${when}` };
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
