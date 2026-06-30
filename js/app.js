// app.js – State, Rendering, Events, Modal-Steuerung, Service-Worker-Registrierung
import { loadState, saveState, makeId } from './storage.js';
import { computeGoal, computeOverview, sortGoals, formatEuro, toInputDate } from './calc.js';

const ICONS = ['🎯', '🛟', '🏖️', '📈', '🚗', '🏠', '✈️', '🎓', '🎁', '💍', '📱', '💻', '🛋️', '🐣'];

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------
   State
--------------------------------------------------------------- */
let state = loadState();
let pickedIcon = ICONS[0];
let pendingDeleteId = null;
let undoBuffer = null;    // { goal, index }
let undoTimer = null;
let lastFocused = null;   // Fokus vor Modal-Öffnung

/* ---------------------------------------------------------------
   DOM
--------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const el = {
  overview: $('#overview'),
  overviewSaved: $('#overviewSaved'),
  overviewTarget: $('#overviewTarget'),
  overviewProgress: $('#overviewProgress'),
  overviewProgressFill: $('#overviewProgressFill'),
  overviewPercent: $('#overviewPercent'),
  overviewMissing: $('#overviewMissing'),
  overviewGoalCount: $('#overviewGoalCount'),
  overviewNext: $('#overviewNext'),
  overviewNextName: $('#overviewNextName'),
  overviewNextWhen: $('#overviewNextWhen'),
  overviewNextIcon: $('#overviewNextIcon'),

  toolbar: $('#toolbar'),
  goalList: $('#goalList'),
  emptyState: $('#emptyState'),

  fab: $('#fab'),
  addHeaderBtn: $('#addGoalHeaderBtn'),
  emptyAddBtn: $('#emptyAddBtn'),

  modal: $('#goalModal'),
  modalTitle: $('#modalTitle'),
  form: $('#goalForm'),
  fieldId: $('#fieldId'),
  fieldName: $('#fieldName'),
  fieldTarget: $('#fieldTarget'),
  fieldCurrent: $('#fieldCurrent'),
  fieldRate: $('#fieldRate'),
  fieldDue: $('#fieldDue'),
  iconPicker: $('#iconPicker'),
  saveBtn: $('#saveBtn'),

  confirmModal: $('#confirmModal'),
  confirmText: $('#confirmText'),
  confirmDeleteBtn: $('#confirmDeleteBtn'),

  toast: $('#toast'),
  toastText: $('#toastText'),
  toastAction: $('#toastAction'),

  themeToggle: $('#themeToggle'),
  themeColorMeta: $('#themeColorMeta'),

  depositModal: $('#depositModal'),
  depositTitle: $('#depositTitle'),
  depositStatus: $('#depositStatus'),
  depositForm: $('#depositForm'),
  depositAmount: $('#depositAmount'),
  depositError: $('#depositError'),
  depositChips: $('#depositChips'),
};

let depositGoalId = null;

/* ---------------------------------------------------------------
   Rendering
--------------------------------------------------------------- */
function persist() {
  saveState(state);
}

function render() {
  const hasGoals = state.goals.length > 0;
  el.overview.hidden = !hasGoals;
  el.toolbar.hidden = !hasGoals;
  el.emptyState.hidden = hasGoals;
  el.goalList.hidden = !hasGoals;

  // Sort-Chips spiegeln
  document.querySelectorAll('.chip[data-sort]').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.sort === state.sort));
  });

  if (!hasGoals) {
    el.goalList.innerHTML = '';
    return;
  }

  renderOverview();
  renderList();
}

function renderOverview() {
  const o = computeOverview(state.goals);
  el.overviewSaved.textContent = formatEuro(o.totalSaved);
  el.overviewTarget.textContent = formatEuro(o.totalTarget);
  el.overviewPercent.textContent = `${o.percentRounded} %`;
  el.overviewGoalCount.textContent = `${o.count} ${o.count === 1 ? 'Ziel' : 'Ziele'}`;
  el.overviewMissing.textContent = o.missing > 0
    ? `noch ${formatEuro(o.missing)}`
    : 'alle Ziele erreicht 🎉';

  el.overviewProgress.setAttribute('aria-valuenow', String(o.percentRounded));
  animateBar(el.overviewProgressFill, o.percent);

  if (o.next) {
    el.overviewNext.hidden = false;
    el.overviewNextIcon.textContent = o.next.icon || '🏁';
    el.overviewNextName.textContent = o.next.name;
    el.overviewNextWhen.textContent = `vsl. ${o.next.when}`;
  } else if (o.allDone) {
    el.overviewNext.hidden = false;
    el.overviewNextIcon.textContent = '🎉';
    el.overviewNextName.textContent = 'Alle Ziele erreicht!';
    el.overviewNextWhen.textContent = '';
  } else {
    el.overviewNext.hidden = true;
  }
}

function renderList() {
  const computed = state.goals.map((g) => computeGoal(g));
  const sorted = sortGoals(computed, state.sort);

  el.goalList.innerHTML = '';
  sorted.forEach((g, i) => {
    el.goalList.appendChild(buildCard(g, i));
  });

  // Balken nach dem Einfügen animieren (nächster Frame)
  requestAnimationFrame(() => {
    el.goalList.querySelectorAll('.goal').forEach((card) => {
      const fill = $('.progress__fill', card);
      const ghost = $('.progress__ghost', card);
      const tick = $('.progress__tick', card);
      animateBar(fill, Number(card.dataset.percent));
      if (ghost) {
        ghost.style.width = `${card.dataset.nextPercent}%`;
        if (tick) tick.style.left = `${card.dataset.percent}%`;
      }
    });
  });
}

function buildCard(g, index) {
  const li = document.createElement('li');
  li.className = 'goal' + (g.isDone ? ' is-done' : '');
  li.dataset.id = g.id;
  li.dataset.percent = g.percent.toFixed(2);
  li.dataset.nextPercent = g.nextPercent.toFixed(2);
  if (!prefersReducedMotion) li.style.animationDelay = `${Math.min(index * 50, 300)}ms`;

  const ghostHtml = g.hasGhost
    ? `<div class="progress__ghost"></div><div class="progress__tick"></div>`
    : '';

  const nextHint = g.hasGhost
    ? `<p class="goal__next-hint">
         <span aria-hidden="true">↗</span>
         Nächster Monat: <b>+${escapeHtml(formatEuro(g.rate))}</b>
       </p>`
    : '';

  const dueBadge = g.dueStatus
    ? `<span class="badge badge--${g.dueStatus.type === 'warn' ? 'warn' : 'ok'}">${escapeHtml(g.dueStatus.text)}</span>`
    : '';

  const depositBtn = g.isDone
    ? ''
    : `<button class="goal__deposit" type="button" data-deposit aria-label="Für „${escapeHtml(g.name)}“ einzahlen">
         <span aria-hidden="true">+</span> Einzahlen
       </button>`;

  li.innerHTML = `
    <div class="goal__top">
      <div class="goal__icon" aria-hidden="true">${escapeHtml(g.icon)}</div>
      <div class="goal__head">
        <div class="goal__name">${escapeHtml(g.name)}</div>
        <div class="goal__sub">${g.isDone ? 'Ziel erreicht' : `Sparrate ${escapeHtml(formatEuro(g.rate))} / Monat`}</div>
      </div>
      <div class="goal__actions">
        <button class="icon-btn" type="button" data-edit aria-label="„${escapeHtml(g.name)}“ bearbeiten">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="icon-btn" type="button" data-delete aria-label="„${escapeHtml(g.name)}“ löschen">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
        </button>
      </div>
    </div>

    <div class="goal__amounts">
      <span class="goal__current money">${escapeHtml(formatEuro(g.current))}</span>
      <span class="goal__pct">${g.percentRounded} %</span>
    </div>

    <div class="progress${g.hasGhost ? ' has-ghost' : ''}" role="progressbar"
         aria-label="Fortschritt ${escapeHtml(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${g.percentRounded}">
      ${ghostHtml}
      <div class="progress__fill"></div>
    </div>

    <div class="goal__foot">
      <span class="goal__foot-icon" aria-hidden="true">
        ${g.isDone
          ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'}
      </span>
      <span class="goal__projection">
        <strong>${escapeHtml(g.projectionText)}</strong>
        ${g.isDone ? '' : `<span class="goal__target"> · noch ${escapeHtml(formatEuro(g.missing))} von <b>${escapeHtml(formatEuro(g.target))}</b></span>`}
      </span>
      ${depositBtn}
    </div>
    ${dueBadge ? `<div style="margin-top:8px">${dueBadge}</div>` : ''}
    ${nextHint}
  `;

  return li;
}

function animateBar(fillEl, percent) {
  if (!fillEl) return;
  if (prefersReducedMotion) {
    fillEl.style.width = `${percent}%`;
    return;
  }
  // von 0 starten, dann animiert auf Zielbreite
  fillEl.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    fillEl.style.width = `${percent}%`;
  }));
}

/* ---------------------------------------------------------------
   Modal: Anlegen / Bearbeiten
--------------------------------------------------------------- */
function buildIconPicker() {
  el.iconPicker.innerHTML = '';
  ICONS.forEach((icon) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'icon-opt';
    btn.textContent = icon;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `Symbol ${icon}`);
    btn.setAttribute('aria-checked', String(icon === pickedIcon));
    btn.addEventListener('click', () => {
      pickedIcon = icon;
      el.iconPicker.querySelectorAll('.icon-opt').forEach((b) =>
        b.setAttribute('aria-checked', String(b === btn)));
    });
    el.iconPicker.appendChild(btn);
  });
}

function openModal(goal = null) {
  lastFocused = document.activeElement;
  clearErrors();
  el.form.reset();

  if (goal) {
    el.modalTitle.textContent = 'Ziel bearbeiten';
    el.saveBtn.textContent = 'Änderungen speichern';
    el.fieldId.value = goal.id;
    el.fieldName.value = goal.name;
    el.fieldTarget.value = goal.target;
    el.fieldCurrent.value = goal.current;
    el.fieldRate.value = goal.rate;
    el.fieldDue.value = toInputDate(goal.dueDate);
    pickedIcon = goal.icon || ICONS[0];
  } else {
    el.modalTitle.textContent = 'Neues Ziel';
    el.saveBtn.textContent = 'Speichern';
    el.fieldId.value = '';
    pickedIcon = ICONS[0];
  }

  buildIconPicker();
  el.modal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.fieldName.focus(), 50);
}

function closeModal() {
  el.modal.hidden = true;
  document.body.style.overflow = '';
  restoreFocus();
}

function restoreFocus() {
  if (lastFocused && document.contains(lastFocused)) {
    lastFocused.focus();
  }
  lastFocused = null;
}

/* ---- Validierung ---- */
function clearErrors() {
  el.form.querySelectorAll('.field__error').forEach((p) => (p.textContent = ''));
  el.form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
}

function setError(name, msg) {
  const p = el.form.querySelector(`[data-error-for="${name}"]`);
  if (p) p.textContent = msg;
  const input = el.form.querySelector(`[name="${name}"]`);
  if (input) input.setAttribute('aria-invalid', 'true');
}

function readForm() {
  return {
    id: el.fieldId.value || null,
    name: el.fieldName.value.trim(),
    target: el.fieldTarget.value === '' ? NaN : Number(el.fieldTarget.value),
    current: el.fieldCurrent.value === '' ? 0 : Number(el.fieldCurrent.value),
    rate: el.fieldRate.value === '' ? 0 : Number(el.fieldRate.value),
    dueDate: el.fieldDue.value || null,
  };
}

function validate(data) {
  clearErrors();
  let ok = true;
  let firstBad = null;

  if (!data.name) { setError('name', 'Bitte gib einen Namen ein.'); ok = false; firstBad ??= el.fieldName; }
  if (!Number.isFinite(data.target) || data.target <= 0) {
    setError('target', 'Zielbetrag muss größer als 0 sein.'); ok = false; firstBad ??= el.fieldTarget;
  }
  if (!Number.isFinite(data.current) || data.current < 0) {
    setError('current', 'Bitte einen Betrag ≥ 0 angeben.'); ok = false; firstBad ??= el.fieldCurrent;
  }
  if (!Number.isFinite(data.rate) || data.rate < 0) {
    setError('rate', 'Bitte eine Sparrate ≥ 0 angeben.'); ok = false; firstBad ??= el.fieldRate;
  }
  if (firstBad) firstBad.focus();
  return ok;
}

function submitForm(e) {
  e.preventDefault();
  const data = readForm();
  if (!validate(data)) return;

  if (data.id) {
    const g = state.goals.find((x) => x.id === data.id);
    if (g) Object.assign(g, { name: data.name, icon: pickedIcon, target: data.target, current: data.current, rate: data.rate, dueDate: data.dueDate });
    toast('Ziel aktualisiert');
  } else {
    state.goals.push({
      id: makeId(), name: data.name, icon: pickedIcon,
      target: data.target, current: data.current, rate: data.rate,
      dueDate: data.dueDate, createdAt: Date.now(),
    });
    toast('Ziel angelegt');
  }
  persist();
  closeModal();
  render();
}

/* ---------------------------------------------------------------
   Löschen + Undo
--------------------------------------------------------------- */
function askDelete(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return;
  pendingDeleteId = id;
  lastFocused = document.activeElement;
  el.confirmText.textContent = `„${g.name}“ wird entfernt. Du kannst das direkt danach rückgängig machen.`;
  el.confirmModal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.confirmDeleteBtn.focus(), 50);
}

function closeConfirm() {
  el.confirmModal.hidden = true;
  document.body.style.overflow = '';
  pendingDeleteId = null;
  restoreFocus();
}

function doDelete() {
  const id = pendingDeleteId;
  const index = state.goals.findIndex((x) => x.id === id);
  if (index === -1) { closeConfirm(); return; }
  const [removed] = state.goals.splice(index, 1);
  undoBuffer = { goal: removed, index };
  persist();
  closeConfirm();
  render();
  toast('Ziel gelöscht', { undo: true });
}

function undoDelete() {
  if (!undoBuffer) return;
  const { goal, index } = undoBuffer;
  state.goals.splice(Math.min(index, state.goals.length), 0, goal);
  undoBuffer = null;
  persist();
  render();
  hideToast();
}

/* ---------------------------------------------------------------
   Toast
--------------------------------------------------------------- */
function toast(message, { undo = false } = {}) {
  clearTimeout(undoTimer);
  el.toastText.textContent = message;
  el.toastAction.hidden = !undo;
  el.toast.hidden = false;
  undoTimer = setTimeout(() => {
    hideToast();
    if (undo) undoBuffer = null;
  }, undo ? 6000 : 3000);
}

function hideToast() {
  el.toast.hidden = true;
  clearTimeout(undoTimer);
}

/* ---------------------------------------------------------------
   Theme (Hell / Dunkel)
--------------------------------------------------------------- */
function currentTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el.themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
  if (el.themeColorMeta) {
    el.themeColorMeta.setAttribute('content', theme === 'dark' ? '#0b0f14' : '#16a34a');
  }
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('sparziele.theme', next); } catch { /* ignore */ }
}

/* ---------------------------------------------------------------
   Einzahlungen
--------------------------------------------------------------- */
function openDeposit(id) {
  const g = state.goals.find((x) => x.id === id);
  if (!g) return;
  depositGoalId = id;
  lastFocused = document.activeElement;
  el.depositTitle.textContent = `Einzahlung – ${g.name}`;
  el.depositAmount.value = '';
  el.depositAmount.removeAttribute('aria-invalid');
  el.depositError.textContent = '';
  updateDepositStatus(g, 0);
  buildDepositChips(g);
  el.depositModal.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => el.depositAmount.focus(), 50);
}

function updateDepositStatus(g, amount) {
  const next = g.current + (Number(amount) || 0);
  el.depositStatus.innerHTML =
    `Aktuell <b>${escapeHtml(formatEuro(g.current))}</b> → neu ` +
    `<b>${escapeHtml(formatEuro(next))}</b> von ${escapeHtml(formatEuro(g.target))}`;
}

function buildDepositChips(g) {
  el.depositChips.innerHTML = '';
  const values = [];
  if (g.rate > 0) values.push(g.rate);
  [50, 100].forEach((v) => { if (!values.includes(v)) values.push(v); });

  values.slice(0, 3).forEach((v) => addDepositChip(g, `+${formatEuro(v)}`, v));

  const missing = Math.max(0, g.target - g.current);
  if (missing > 0) addDepositChip(g, `Rest · ${formatEuro(missing)}`, missing);
}

function addDepositChip(g, label, value) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.textContent = label;
  chip.addEventListener('click', () => {
    el.depositAmount.value = String(value);
    el.depositAmount.removeAttribute('aria-invalid');
    el.depositError.textContent = '';
    updateDepositStatus(g, value);
    el.depositAmount.focus();
  });
  el.depositChips.appendChild(chip);
}

function closeDeposit() {
  el.depositModal.hidden = true;
  document.body.style.overflow = '';
  depositGoalId = null;
  restoreFocus();
}

function submitDeposit(e) {
  e.preventDefault();
  const g = state.goals.find((x) => x.id === depositGoalId);
  if (!g) { closeDeposit(); return; }

  const amount = el.depositAmount.value === '' ? NaN : Number(el.depositAmount.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    el.depositError.textContent = 'Bitte einen Betrag größer als 0 eingeben.';
    el.depositAmount.setAttribute('aria-invalid', 'true');
    el.depositAmount.focus();
    return;
  }

  const wasDone = g.current >= g.target;
  g.current = Math.round((g.current + amount) * 100) / 100;
  persist();
  const reached = !wasDone && g.current >= g.target;
  closeDeposit();
  render();
  toast(reached ? `🎉 Ziel „${g.name}“ erreicht!` : `${formatEuro(amount)} eingezahlt`);
}

/* ---------------------------------------------------------------
   Helpers
--------------------------------------------------------------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------
   Events
--------------------------------------------------------------- */
function bind() {
  el.fab.addEventListener('click', () => openModal());
  el.addHeaderBtn.addEventListener('click', () => openModal());
  el.emptyAddBtn.addEventListener('click', () => openModal());

  el.form.addEventListener('submit', submitForm);

  // Sortierung
  document.querySelectorAll('.chip[data-sort]').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.sort = chip.dataset.sort;
      persist();
      render();
    });
  });

  // Karten-Aktionen (Delegation)
  el.goalList.addEventListener('click', (e) => {
    const card = e.target.closest('.goal');
    if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('[data-edit]')) {
      const g = state.goals.find((x) => x.id === id);
      if (g) openModal(g);
    } else if (e.target.closest('[data-delete]')) {
      askDelete(id);
    } else if (e.target.closest('[data-deposit]')) {
      openDeposit(id);
    }
  });

  // Modal schließen
  el.modal.querySelectorAll('[data-close]').forEach((node) =>
    node.addEventListener('click', closeModal));
  el.confirmModal.querySelectorAll('[data-confirm-close]').forEach((node) =>
    node.addEventListener('click', closeConfirm));
  el.confirmDeleteBtn.addEventListener('click', doDelete);

  // Einzahlung
  el.depositForm.addEventListener('submit', submitDeposit);
  el.depositModal.querySelectorAll('[data-deposit-close]').forEach((node) =>
    node.addEventListener('click', closeDeposit));
  el.depositAmount.addEventListener('input', () => {
    el.depositAmount.removeAttribute('aria-invalid');
    el.depositError.textContent = '';
    const g = state.goals.find((x) => x.id === depositGoalId);
    if (g) updateDepositStatus(g, el.depositAmount.value);
  });

  // Theme
  el.themeToggle.addEventListener('click', toggleTheme);
  applyTheme(currentTheme()); // aria-pressed + Meta mit dem früh gesetzten Theme synchronisieren

  el.toastAction.addEventListener('click', undoDelete);

  // Tastatur: Esc schließt, Tab-Fokusfalle im offenen Modal
  document.addEventListener('keydown', onKeydown);
}

function onKeydown(e) {
  const openOverlay = !el.modal.hidden ? el.modal
    : !el.confirmModal.hidden ? el.confirmModal
    : !el.depositModal.hidden ? el.depositModal
    : null;
  if (!openOverlay) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    if (openOverlay === el.modal) closeModal();
    else if (openOverlay === el.confirmModal) closeConfirm();
    else closeDeposit();
    return;
  }
  if (e.key === 'Tab') trapFocus(e, openOverlay.querySelector('.modal__sheet'));
}

function trapFocus(e, container) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const list = Array.from(focusable).filter((n) => !n.hidden && n.offsetParent !== null);
  if (list.length === 0) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

/* ---------------------------------------------------------------
   Service Worker
--------------------------------------------------------------- */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) =>
      console.warn('[Sparziele] Service Worker konnte nicht registriert werden:', err));
  });
}

/* ---------------------------------------------------------------
   Init
--------------------------------------------------------------- */
bind();
render();
registerSW();
