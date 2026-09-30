/* Jour après jour : tâches du jour et suivi d'habitudes.
 *
 * Les données sont gardées dans le navigateur (localStorage). Quand la page
 * est ouverte comme Artifact sur claude.ai, elles sont aussi enregistrées
 * dans le compte de la personne, pour les retrouver sur tous ses appareils.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'jour-apres-jour:v1';
  const HISTORY_DAYS = 400;
  const IDEAS = [
    '💧 Boire 1,5 L d’eau',
    '🏃 Bouger 20 minutes',
    '📖 Lire 10 pages',
    '🧘 Respirer 5 minutes',
    '🛏️ Coucher avant 23 h',
    '🧹 Ranger 10 minutes',
  ];

  const ICONS = {
    x: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8.6 1.2c.3 2.1-.6 3.3-1.6 4.4C6 6.7 5 7.8 5 9.6c0 .9.3 1.7.9 2.3-.1-1.4.6-2.4 1.5-3.2.2 1.2 1 1.8 1.6 2.5.4.5.6 1 .5 1.7.9-.5 1.5-1.4 1.5-2.6 0-1-.4-1.8-.8-2.5 1 .3 1.8 1.2 2 2.4.6-2.9-.7-5.6-3.6-9Z"/><path fill="currentColor" d="M3.6 9.8C3.6 12.6 5.6 15 8 15s4.4-2.4 4.4-5.2c0 2.3-1.9 3.9-4.4 3.9S3.6 12.1 3.6 9.8Z" opacity=".55"/></svg>',
  };

  // ---------- Dates (toujours en heure locale) ----------

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
  const fromKey = (k) => {
    const [y, m, d] = k.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const shiftKey = (k, n) => {
    const d = fromKey(k);
    d.setDate(d.getDate() + n);
    return dayKey(d);
  };
  // Math.round absorbe les jours de 23 h ou 25 h des changements d'heure.
  const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);

  function isoWeek(k) {
    const d = fromKey(k);
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
    return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  }

  const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' });
  const fmtNarrow = new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' });
  const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
  const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

  function carryLabel(created, today) {
    const n = daysBetween(created, today);
    if (n === 1) return 'depuis hier';
    if (n < 7) return 'depuis ' + fmtWeekday.format(fromKey(created));
    return 'depuis le ' + fmtShort.format(fromKey(created));
  }

  // ---------- Données ----------

  const uid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);

  const emptyState = () => ({ version: 1, updatedAt: 0, tasks: [], habits: [] });
  const hasContent = (s) => s.tasks.length > 0 || s.habits.length > 0;

  // Remet d'aplomb des données lues depuis le stockage (anciennes ou abîmées).
  function normalize(raw) {
    const s = emptyState();
    if (!raw || typeof raw !== 'object') return s;
    const today = dayKey();
    s.updatedAt = Number(raw.updatedAt) || 0;
    if (Array.isArray(raw.tasks)) {
      s.tasks = raw.tasks
        .filter((t) => t && typeof t.text === 'string')
        .map((t) => ({
          id: String(t.id || uid()),
          text: t.text,
          done: !!t.done,
          created: isKey(t.created) ? t.created : today,
          doneOn: t.done ? (isKey(t.doneOn) ? t.doneOn : today) : null,
        }));
    }
    if (Array.isArray(raw.habits)) {
      s.habits = raw.habits
        .filter((h) => h && typeof h.name === 'string')
        .map((h) => {
          const log = {};
          if (h.log && typeof h.log === 'object') {
            for (const [k, v] of Object.entries(h.log)) if (isKey(k) && v) log[k] = 1;
          }
          return { id: String(h.id || uid()), name: h.name, created: isKey(h.created) ? h.created : today, log };
        });
    }
    return s;
  }

  // Oublie les tâches faites les jours précédents et l'historique trop ancien.
  function prune(s) {
    const today = dayKey();
    const oldest = shiftKey(today, -HISTORY_DAYS);
    s.tasks = s.tasks.filter((t) => !t.done || t.doneOn === today);
    for (const h of s.habits) {
      for (const k of Object.keys(h.log)) if (k < oldest) delete h.log[k];
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* stockage indisponible : on repart de zéro */ }
    return emptyState();
  }

  function saveLocal(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* ignoré */ }
  }

  // Série en cours : jours cochés d'affilée jusqu'à aujourd'hui, ou jusqu'à
  // hier si aujourd'hui n'est pas encore coché (la série n'est pas perdue).
  function currentStreak(log, today) {
    let k = log[today] ? today : shiftKey(today, -1);
    let n = 0;
    while (log[k]) { n++; k = shiftKey(k, -1); }
    return n;
  }

  function bestStreak(log) {
    let best = 0;
    let run = 0;
    let prev = null;
    for (const k of Object.keys(log).sort()) {
      run = prev && daysBetween(prev, k) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    return best;
  }

  let state = loadLocal();

  function commit() {
    state.updatedAt = Math.max(Date.now(), state.updatedAt + 1);
    prune(state);
    saveLocal(state);
    render();
    pushRemote();
  }

  // ---------- Actions ----------

  function addTask(text) {
    text = text.trim();
    if (!text) return false;
    state.tasks.push({ id: uid(), text, done: false, created: dayKey(), doneOn: null });
    commit();
    return true;
  }

  function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    t.doneOn = t.done ? dayKey() : null;
    commit();
  }

  function removeTask(id) {
    const index = state.tasks.findIndex((x) => x.id === id);
    if (index < 0) return;
    const [item] = state.tasks.splice(index, 1);
    commit();
    offerUndo('Tâche supprimée', () => state.tasks.splice(Math.min(index, state.tasks.length), 0, item));
  }

  function addHabit(name) {
    name = name.trim();
    if (!name) return false;
    state.habits.push({ id: uid(), name, created: dayKey(), log: {} });
    commit();
    return true;
  }

  function toggleHabitDay(id, k) {
    const h = state.habits.find((x) => x.id === id);
    if (!h) return;
    if (h.log[k]) delete h.log[k];
    else h.log[k] = 1;
    commit();
  }

  function removeHabit(id) {
    const index = state.habits.findIndex((x) => x.id === id);
    if (index < 0) return;
    const [item] = state.habits.splice(index, 1);
    commit();
    offerUndo('Habitude supprimée', () => state.habits.splice(Math.min(index, state.habits.length), 0, item));
  }

  // ---------- Affichage ----------

  const $ = (sel) => document.querySelector(sel);

  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    return node;
  }

  function iconButton(icon, label, id) {
    const b = el('button', { type: 'button', class: 'icon-btn', 'aria-label': label, title: label, id });
    b.innerHTML = ICONS[icon];
    return b;
  }

  function render() {
    const today = dayKey();
    const focusedId = document.activeElement && document.activeElement.id;

    $('#week').textContent = `Semaine ${isoWeek(today)}`;
    $('#date').textContent = capitalize(fmtLong.format(fromKey(today)));

    const tasks = renderTasks(today);
    const habits = renderHabits(today);
    renderSummary(tasks, habits);

    // Les listes sont reconstruites : on rend le focus clavier à l'élément équivalent.
    if (focusedId && document.activeElement && document.activeElement.id !== focusedId) {
      const again = document.getElementById(focusedId);
      if (again) again.focus({ preventScroll: true });
    }
  }

  function renderTasks(today) {
    const visible = state.tasks.filter((t) => !t.done || t.doneOn === today);
    const ordered = [...visible.filter((t) => !t.done), ...visible.filter((t) => t.done)];

    $('#task-list').replaceChildren(...ordered.map((t) => {
      const li = el('li', { class: t.done ? 'task is-done' : 'task' });
      const check = el('input', { type: 'checkbox', class: 'check', id: `task-${t.id}` });
      check.checked = t.done;
      check.addEventListener('change', () => toggleTask(t.id));
      li.append(check, el('label', { class: 'task-text', for: `task-${t.id}` }, t.text));
      li.append(!t.done && t.created < today ? el('span', { class: 'carry' }, carryLabel(t.created, today)) : el('span'));
      const del = iconButton('x', `Supprimer « ${t.text} »`, `del-task-${t.id}`);
      del.addEventListener('click', () => removeTask(t.id));
      li.append(del);
      return li;
    }));

    $('#task-empty').hidden = ordered.length > 0;
    return { done: ordered.filter((t) => t.done).length, total: ordered.length };
  }

  function renderHabits(today) {
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(shiftKey(today, -i));

    $('#habit-list').replaceChildren(...state.habits.map((h) => {
      const li = el('li', { class: 'habit' });

      const streak = currentStreak(h.log, today);
      const head = el('div', { class: 'habit-head' });
      const pill = el('span', {
        class: streak ? 'streak' : 'streak is-zero',
        title: `Série en cours : ${plural(streak, 'jour', 'jours')} d’affilée`,
      });
      pill.innerHTML = ICONS.flame;
      pill.append(`${streak} j`);
      const del = iconButton('x', `Supprimer « ${h.name} »`, `del-habit-${h.id}`);
      del.addEventListener('click', () => removeHabit(h.id));
      head.append(el('span', { class: 'habit-name' }, h.name), pill, del);

      const week = el('div', { class: 'week', role: 'group', 'aria-label': `${h.name} : 7 derniers jours` });
      for (const k of days) {
        const done = !!h.log[k];
        const d = fromKey(k);
        const cls = ['day'];
        if (k === today) cls.push('is-today');
        if (done) cls.push('is-done');
        const b = el('button', {
          type: 'button',
          class: cls.join(' '),
          id: `day-${h.id}-${k}`,
          'aria-pressed': String(done),
          'aria-label': `${fmtLong.format(d)}${k === today ? ' (aujourd’hui)' : ''}`,
        });
        b.append(el('span', { class: 'day-letter' }, fmtNarrow.format(d)), el('span', { class: 'day-num' }, String(d.getDate())));
        b.addEventListener('click', () => toggleHabitDay(h.id, k));
        week.append(b);
      }

      const lastWeek = days.filter((k) => h.log[k]).length;
      const meta = el('p', { class: 'habit-meta' }, `${lastWeek}/7 derniers jours · record ${bestStreak(h.log)} j`);

      li.append(head, week, meta);
      return li;
    }));

    $('#habit-empty').hidden = state.habits.length > 0;
    return { done: state.habits.filter((h) => h.log[today]).length, total: state.habits.length };
  }

  function setMeter(name, done, total) {
    $(`#${name}-count`).textContent = `${done}/${total}`;
    $(`#${name}-bar`).style.width = total ? `${Math.round((done / total) * 100)}%` : '0%';
  }

  function renderSummary(tasks, habits) {
    setMeter('tasks', tasks.done, tasks.total);
    setMeter('habits', habits.done, habits.total);

    const left = [];
    if (tasks.total > tasks.done) left.push(plural(tasks.total - tasks.done, 'tâche', 'tâches'));
    if (habits.total > habits.done) left.push(plural(habits.total - habits.done, 'habitude', 'habitudes'));

    let note;
    if (!tasks.total && !habits.total) note = 'Ajoutez une tâche ou une habitude pour commencer la journée.';
    else if (!left.length) note = 'Tout est fait pour aujourd’hui. Bravo !';
    else note = `Encore ${left.join(' et ')} aujourd’hui.`;
    $('#summary-note').textContent = note;
  }

  function renderIdeas() {
    $('#habit-ideas').replaceChildren(...IDEAS.map((idea) => {
      const b = el('button', { type: 'button', class: 'chip' }, `+ ${idea}`);
      b.addEventListener('click', () => addHabit(idea));
      return b;
    }));
  }

  // ---------- Annuler une suppression ----------

  let undoAction = null;
  let toastTimer = null;

  function offerUndo(message, restore) {
    undoAction = restore;
    $('#toast-text').textContent = message;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    $('#toast').hidden = true;
    undoAction = null;
  }

  // ---------- Synchronisation avec le compte (Artifact claude.ai) ----------

  const sync = { mode: 'local', ref: null, timer: null, queue: Promise.resolve(), retried: false };

  const SYNC_TEXT = {
    local: 'Enregistré sur cet appareil',
    account: 'Enregistré dans votre compte, sur tous vos appareils',
    error: 'Synchronisation interrompue : vos changements restent sur cet appareil',
  };

  function renderSync() {
    const node = $('#sync-status');
    node.dataset.mode = sync.mode;
    node.textContent = SYNC_TEXT[sync.mode];
  }

  function pushRemote() {
    if (!sync.ref) return;
    clearTimeout(sync.timer);
    // Regroupe les clics rapprochés en une seule écriture.
    sync.timer = setTimeout(() => {
      const ref = sync.ref;
      const body = JSON.parse(JSON.stringify(state));
      sync.queue = sync.queue
        .then(() => ref.set(body))
        .then(() => {
          sync.retried = false;
          if (sync.mode !== 'account') { sync.mode = 'account'; renderSync(); }
        })
        .catch((err) => {
          if (err && err.code === 'unavailable' && !sync.retried) {
            sync.retried = true;
            setTimeout(pushRemote, 1500 + Math.random() * 1500);
            return;
          }
          sync.ref = null;
          sync.mode = 'error';
          renderSync();
        });
    }, 400);
  }

  async function connectAccount() {
    const claude = window.claude;
    if (!claude || typeof claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!db || !user) return;
      const id = await user.id();
      if (!id) return;

      const ref = db.doc(`data/users/${id}/jour-apres-jour`);
      const snap = await ref.get();
      sync.ref = ref;
      sync.mode = 'account';

      if (snap.exists) {
        const remote = normalize(snap.data());
        if (remote.updatedAt >= state.updatedAt) {
          state = remote;
          saveLocal(state);
          render();
        } else {
          pushRemote();
        }
      } else if (hasContent(state)) {
        pushRemote();
      }
      renderSync();

      // Les changements faits sur un autre appareil arrivent ici.
      ref.onSnapshot((s) => {
        if (!s.exists || s.metadata.hasPendingWrites) return;
        const remote = normalize(s.data());
        if (remote.updatedAt > state.updatedAt) {
          state = remote;
          saveLocal(state);
          render();
        }
      }, () => { /* abonnement perdu : les écritures continuent de fonctionner */ });
    } catch (e) {
      sync.ref = null;
      sync.mode = 'local';
      renderSync();
    }
  }

  // ---------- Démarrage ----------

  $('#task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#task-input');
    if (addTask(input.value)) input.value = '';
    input.focus();
  });

  $('#habit-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#habit-input');
    if (addHabit(input.value)) input.value = '';
    input.focus();
  });

  $('#toast-undo').addEventListener('click', () => {
    if (undoAction) {
      undoAction();
      commit();
    }
    hideToast();
  });

  // Passage à minuit (ou retour sur la page le lendemain) : on redessine.
  let shownDay = dayKey();
  const refreshIfNewDay = () => {
    if (dayKey() !== shownDay) {
      shownDay = dayKey();
      render();
    }
  };
  setInterval(refreshIfNewDay, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshIfNewDay();
  });

  renderIdeas();
  render();
  renderSync();
  connectAccount();
})();
