/* ============================================================
   TaskFlow — Project Management Tracker
   Vanilla JS · LocalStorage · Chart.js · Lucide Icons
   ============================================================ */
(() => {
'use strict';

/* ---------------------------------------------------------- *
 * 1. Konstanta & utilitas
 * ---------------------------------------------------------- */
const STORAGE_KEY = 'taskflow.pm.v1';
const STATUSES = ['To Do', 'In Progress', 'Done'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PROJECT_STATUSES = ['Active', 'On Hold', 'Completed'];
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const DAYS_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 8);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const pct = (a, b) => (b > 0 ? clamp(Math.round((a / b) * 100), 0, 100) : 0);
const val = x => (typeof x === 'function' ? x() : x);
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* tanggal — selalu memakai zona waktu lokal, format YYYY-MM-DD */
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => fmt(new Date());
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const startOfWeek = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return fmt(d); };
const monthKey = s => s.slice(0, 7);
const weekdayIdx = s => (parse(s).getDay() + 6) % 7;
const fmtDate = s => { if (!s) return '—'; const d = parse(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; };
const fmtShort = s => { const d = parse(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
const fmtLong = s => { const d = parse(s); return `${DAYS[weekdayIdx(s)]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const monthLabel = k => `${MONTHS[+k.slice(5) - 1]} ${k.slice(0, 4)}`;
const daysInMonth = k => new Date(+k.slice(0, 4), +k.slice(5), 0).getDate();
const shiftMonth = (key, n) => {
  let y = +key.slice(0, 4); let m = +key.slice(5) + n - 1;
  y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
  return `${y}-${pad(m + 1)}`;
};
const timeAgo = ts => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'Baru saja';
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.round(h / 24)} hari lalu`;
};

/* ---------------------------------------------------------- *
 * 2. State & LocalStorage
 * ---------------------------------------------------------- */
const defaultSettings = () => ({ theme: 'light', name: 'Pengguna', monthlyTarget: 20, dailyTarget: 5 });
const defaultState = () => ({
  version: 1,
  projects: [], tasks: [], activities: [], dailyNotes: {},
  weeklyGoals: [], monthly: { targets: {}, achievements: [] },
  log: [], settings: defaultSettings(),
});

function normalize(raw) {
  const base = defaultState();
  const s = Object.assign(base, raw || {});
  s.settings = Object.assign(defaultSettings(), (raw && raw.settings) || {});
  s.monthly = Object.assign({ targets: {}, achievements: [] }, (raw && raw.monthly) || {});
  ['projects', 'tasks', 'activities', 'weeklyGoals', 'log'].forEach(k => { if (!Array.isArray(s[k])) s[k] = []; });
  if (!s.dailyNotes || typeof s.dailyNotes !== 'object') s.dailyNotes = {};
  return s;
}

function seed(settings) {
  const t0 = today();
  const off = n => addDays(t0, n);
  const P = (name, desc, color, status, s, e) => ({ id: uid(), name, desc, color, status, start: off(s), end: off(e) });
  const projects = [
    P('Website Redesign', 'Perombakan tampilan dan pengalaman pengguna website perusahaan.', '#3b82f6', 'Active', -30, 25),
    P('Marketing Campaign Q4', 'Kampanye pemasaran akhir tahun lintas kanal.', '#8b5cf6', 'Active', -20, 50),
    P('Mobile App MVP', 'Pengembangan versi awal aplikasi mobile.', '#10b981', 'Active', -45, 40),
    P('Internal Training', 'Program pelatihan internal untuk seluruh tim.', '#f59e0b', 'On Hold', -10, 60),
    P('Office Migration', 'Pindahan kantor dan pendataan ulang inventaris.', '#64748b', 'Completed', -70, -15),
  ];
  const [web, mkt, app, trn, mig] = projects.map(p => p.id);
  const T = (title, projectId, priority, status, due, doneOff, desc = '') => ({
    id: uid(), title, desc, projectId, priority, status,
    due: off(due),
    createdOn: off(Math.min(due, doneOff ?? 0, 0) - 5),
    completedOn: status === 'Done' ? off(doneOff ?? due) : null,
  });
  const tasks = [
    T('Riset kompetitor', web, 'High', 'Done', -6, -7, 'Analisis 5 website pesaing utama.'),
    T('Wireframe halaman utama', web, 'High', 'Done', -4, -4),
    T('Desain UI homepage', web, 'High', 'In Progress', 2, null, 'Hi-fi mockup versi desktop dan mobile.'),
    T('Implementasi front-end', web, 'Medium', 'To Do', 9),
    T('Balas email prioritas', web, 'Low', 'Done', 0, 0),
    T('Susun kalender konten', mkt, 'Medium', 'Done', -2, -3),
    T('Produksi materi iklan', mkt, 'High', 'In Progress', 0, null, 'Banner, video pendek, dan copywriting.'),
    T('Review anggaran kampanye', mkt, 'Urgent', 'To Do', -1, null, 'Perlu persetujuan sebelum iklan tayang.'),
    T('Laporan performa mingguan', mkt, 'Low', 'To Do', 3),
    T('Follow-up klien', mkt, 'Medium', 'Done', -1, -1),
    T('Setup repository & CI', app, 'Medium', 'Done', -10, -10),
    T('Buat API autentikasi', app, 'High', 'In Progress', 1),
    T('Uji coba beta', app, 'Medium', 'To Do', 14),
    T('Rapat evaluasi sprint', app, 'Low', 'Done', 0, 0),
    T('Update dokumentasi', app, 'Low', 'To Do', -3),
    T('Siapkan materi pelatihan', trn, 'Low', 'To Do', 6),
    T('Pindahan inventaris', mig, 'Medium', 'Done', -20, -20),
    T('Audit aset kantor', mig, 'Medium', 'Done', -40, -41),
    T('Serah terima gedung lama', mig, 'High', 'Done', -52, -55),
    T('Survei lokasi kantor baru', mig, 'High', 'Done', -75, -78),
  ];
  const A = (text, d, done, minutes) => ({ id: uid(), date: off(d), text, done, minutes });
  const activities = [
    A('Cek email & prioritas hari ini', 0, true, 15),
    A('Deep work: desain UI homepage', 0, true, 90),
    A('Rapat singkat dengan tim', 0, true, 30),
    A('Review pull request', 0, false, 45),
    A('Olahraga ringan', 0, false, 30),
    A('Menyusun laporan', -1, true, 60),
    A('Diskusi dengan klien', -1, true, 45),
    A('Belajar materi baru', -1, false, 30),
  ];
  const ws = startOfWeek(t0);
  const weeklyGoals = [
    { id: uid(), weekStart: ws, text: 'Selesaikan desain UI homepage', progress: 60 },
    { id: uid(), weekStart: ws, text: 'Kirim laporan kampanye ke manajemen', progress: 30 },
    { id: uid(), weekStart: ws, text: 'Rapi-kan backlog sprint', progress: 100 },
  ];
  const mk = monthKey(t0);
  const monthly = {
    targets: {},
    achievements: [
      { id: uid(), month: mk, text: 'Wireframe disetujui oleh stakeholder' },
      { id: uid(), month: shiftMonth(mk, -1), text: 'Project Office Migration selesai tepat waktu' },
    ],
  };
  const now = Date.now();
  const log = [
    { id: uid(), ts: now - 25 * 60000, text: 'Menyelesaikan tugas “Rapat evaluasi sprint”' },
    { id: uid(), ts: now - 3 * 3600000, text: 'Menambahkan tugas “Buat API autentikasi”' },
    { id: uid(), ts: now - 26 * 3600000, text: 'Menyelesaikan tugas “Follow-up klien”' },
    { id: uid(), ts: now - 50 * 3600000, text: 'Membuat project “Mobile App MVP”' },
  ];
  return normalize({ projects, tasks, activities, weeklyGoals, monthly, log, dailyNotes: {}, settings: settings || defaultSettings() });
}

let state;
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { console.warn('Gagal memuat data:', e); }
  return seed();
}
function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('Gagal menyimpan data:', e); }
}
function addLog(text) {
  state.log.unshift({ id: uid(), ts: Date.now(), text });
  state.log = state.log.slice(0, 60);
}
function commit(msg, type = 'success') {
  save();
  render();
  if (msg) toast(msg, type);
}

/* ---------------------------------------------------------- *
 * 3. State UI (tidak disimpan)
 * ---------------------------------------------------------- */
const ui = {
  taskSearch: '', taskStatus: 'all', taskPriority: 'all', taskProject: 'all', taskSort: 'due',
  dailyDate: today(),
  weekStart: startOfWeek(today()),
  monthKey: monthKey(today()),
  calKey: monthKey(today()),
  calSelected: today(),
  projectDetail: null,
};

/* ---------------------------------------------------------- *
 * 4. Helper data
 * ---------------------------------------------------------- */
const findTask = id => state.tasks.find(t => t.id === id);
const projectById = id => state.projects.find(p => p.id === id);
const isOverdue = t => t.status !== 'Done' && !!t.due && t.due < today();
const monthTarget = k => {
  const v = state.monthly.targets[k];
  return Number.isFinite(+v) && v !== undefined ? +v : (+state.settings.monthlyTarget || 1);
};
const countCompleted = d => state.tasks.filter(t => t.completedOn === d).length;
const countDue = d => state.tasks.filter(t => t.due === d).length;
const completedInMonth = k => state.tasks.filter(t => t.completedOn && monthKey(t.completedOn) === k).length;

function stats() {
  const ts = state.tasks;
  const done = ts.filter(t => t.status === 'Done').length;
  return {
    projects: state.projects.length,
    total: ts.length,
    done,
    prog: ts.filter(t => t.status === 'In Progress').length,
    overdue: ts.filter(isOverdue).length,
    rate: pct(done, ts.length),
  };
}
function projectStats(p) {
  const ts = state.tasks.filter(t => t.projectId === p.id);
  const done = ts.filter(t => t.status === 'Done').length;
  return { total: ts.length, done, overdue: ts.filter(isOverdue).length, pct: pct(done, ts.length) };
}
function dayScore(date) {
  const acts = state.activities.filter(a => a.date === date);
  const actsDone = acts.filter(a => a.done);
  const tasksDone = countCompleted(date);
  const target = Math.max(1, +state.settings.dailyTarget || 1);
  const count = actsDone.length + tasksDone;
  return {
    acts: acts.length, actsDone: actsDone.length, tasksDone, count, target,
    minutes: actsDone.reduce((s, a) => s + (+a.minutes || 0), 0),
    pct: pct(count, target),
  };
}
const prodLabel = p => (p >= 100 ? 'Sangat produktif' : p >= 60 ? 'Produktif' : p >= 30 ? 'Cukup baik' : 'Ayo mulai!');

function applyStatus(t, status) {
  t.status = status;
  t.completedOn = status === 'Done' ? today() : null;
}

/* ---------------------------------------------------------- *
 * 5. Komponen kecil (HTML)
 * ---------------------------------------------------------- */
const prioClass = p => ({ Low: 'p-low', Medium: 'p-medium', High: 'p-high', Urgent: 'p-urgent' }[p] || 'p-low');
const statusClass = s => ({ 'To Do': 's-todo', 'In Progress': 's-progress', 'Done': 's-done' }[s] || 's-todo');
const badge = (text, cls) => `<span class="badge ${cls}">${esc(text)}</span>`;
const emptyState = (icon, text) => `<div class="empty"><i data-lucide="${icon}"></i><div>${text}</div></div>`;
const card = (title, body, actions = '', cls = '') =>
  `<section class="card ${cls}"><div class="card-head"><h3>${title}</h3>${actions}</div>${body}</section>`;
const chartBox = (id, cls = '') => `<div class="chart-box ${cls}"><canvas id="${id}"></canvas></div>`;
const progressBar = (p, color) => `<div class="pbar"><i style="width:${p}%;${color ? `background:${color}` : ''}"></i></div>`;

function projectChip(pid) {
  const p = projectById(pid);
  return p
    ? `<span class="chip"><i class="dot" style="background:${esc(p.color)}"></i>${esc(p.name)}</span>`
    : '<span class="chip">Tanpa project</span>';
}
function dueLabel(t) {
  if (!t.due) return '<span class="due">—</span>';
  if (t.status === 'Done') return `<span class="due">${fmtDate(t.due)}</span>`;
  const d = daysBetween(today(), t.due);
  if (d < 0) return `<span class="due overdue">${fmtShort(t.due)} · telat ${-d} hr</span>`;
  if (d === 0) return '<span class="due today">Hari ini</span>';
  if (d === 1) return '<span class="due soon">Besok</span>';
  if (d <= 3) return `<span class="due soon">${fmtShort(t.due)} · ${d} hr lagi</span>`;
  return `<span class="due">${fmtDate(t.due)}</span>`;
}
const checkBtn = t =>
  `<button class="check ${t.status === 'Done' ? 'checked' : ''}" data-action="toggle-task" data-id="${t.id}" aria-label="Tandai selesai" title="Tandai selesai / belum"><i data-lucide="check"></i></button>`;
const statusSelect = t =>
  `<select class="status-select ${statusClass(t.status)}" data-change="task-status" data-id="${t.id}" aria-label="Status">${STATUSES.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select>`;

function taskItem(t) {
  return `<li class="task-item ${t.status === 'Done' ? 'done' : ''}">
    ${checkBtn(t)}
    <div class="ti-main">
      <div class="ti-title link" data-action="edit-task" data-id="${t.id}" title="Klik untuk edit">${esc(t.title)}</div>
      <div class="ti-meta">${projectChip(t.projectId)}${dueLabel(t)}</div>
    </div>
    ${badge(t.priority, prioClass(t.priority))}
  </li>`;
}
const taskList = (list, emptyText) =>
  list.length ? `<ul class="list">${list.map(taskItem).join('')}</ul>` : emptyState('inbox', emptyText);

const PRIO_ORDER = { Urgent: 0, High: 1, Medium: 2, Low: 3 };
const byPriority = (a, b) => PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority];

/* ---------------------------------------------------------- *
 * 6. Notifikasi (toast)
 * ---------------------------------------------------------- */
function toast(msg, type = 'success') {
  const icon = { success: 'circle-check', info: 'info', error: 'circle-alert', warn: 'triangle-alert' }[type] || 'info';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i data-lucide="${icon}"></i><span>${esc(msg)}</span>`;
  $('#toasts').appendChild(el);
  icons();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, 3200);
}

/* ---------------------------------------------------------- *
 * 7. Modal
 * ---------------------------------------------------------- */
function openModal(title, bodyHtml, onSubmit, opts = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <form id="modalForm" autocomplete="off">
          <div class="modal-head"><h3>${esc(title)}</h3>
            <button type="button" class="icon-btn sm" data-action="close-modal" aria-label="Tutup"><i data-lucide="x"></i></button></div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-foot">
            <button type="button" class="btn" data-action="close-modal">Batal</button>
            <button type="submit" class="btn ${opts.danger ? 'danger' : 'primary'}">${esc(opts.submitLabel || 'Simpan')}</button>
          </div>
        </form>
      </div>
    </div>`;
  icons();
  $('#modalForm').addEventListener('submit', e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    const result = onSubmit(data);
    if (result !== false) closeModal();
  });
  setTimeout(() => { const f = $('#modalRoot input:not([type=radio]), #modalRoot textarea, #modalRoot select'); if (f) f.focus(); }, 40);
}
function closeModal() { $('#modalRoot').innerHTML = ''; }
function confirmBox(messageHtml, onYes, label = 'Hapus') {
  openModal('Konfirmasi', `<p class="confirm-text">${messageHtml}</p>`, () => { onYes(); }, { submitLabel: label, danger: label === 'Hapus' || label === 'Reset' });
}

/* ---------- Modal: Task ---------- */
function taskModal(task, defaults = {}) {
  const t = task || {
    title: '', desc: '',
    projectId: defaults.projectId || (ui.projectDetail || ''),
    priority: 'Medium', status: defaults.status || 'To Do',
    due: defaults.due || today(),
  };
  const body = `
    <label class="field"><span>Judul tugas *</span>
      <input type="text" name="title" required maxlength="140" value="${esc(t.title)}" placeholder="Contoh: Menyusun laporan mingguan"></label>
    <label class="field"><span>Deskripsi</span>
      <textarea name="desc" rows="3" placeholder="Catatan atau detail tugas (opsional)">${esc(t.desc)}</textarea></label>
    <div class="field-row">
      <label class="field"><span>Project</span>
        <select name="projectId"><option value="">— Tanpa project —</option>
        ${state.projects.map(p => `<option value="${p.id}" ${p.id === t.projectId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label class="field"><span>Deadline</span><input type="date" name="due" value="${esc(t.due)}"></label>
    </div>
    <div class="field-row">
      <label class="field"><span>Prioritas</span>
        <select name="priority">${PRIORITIES.map(p => `<option ${p === t.priority ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
      <label class="field"><span>Status</span>
        <select name="status">${STATUSES.map(s => `<option ${s === t.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    </div>`;
  openModal(task ? 'Edit Task' : 'New Task', body, data => {
    const title = (data.title || '').trim();
    if (!title) { toast('Judul tugas wajib diisi', 'error'); return false; }
    if (task) {
      const wasDone = task.status === 'Done';
      Object.assign(task, { title, desc: data.desc.trim(), projectId: data.projectId, priority: data.priority, due: data.due });
      if (data.status !== task.status) applyStatus(task, data.status);
      addLog(`Mengubah tugas “${title}”`);
      commit(data.status === 'Done' && !wasDone ? 'Tugas diselesaikan — kerja bagus!' : 'Tugas berhasil diperbarui', 'info');
    } else {
      const nt = {
        id: uid(), title, desc: data.desc.trim(), projectId: data.projectId, priority: data.priority,
        status: 'To Do', due: data.due, createdOn: today(), completedOn: null,
      };
      if (data.status !== 'To Do') applyStatus(nt, data.status);
      state.tasks.unshift(nt);
      addLog(`Menambahkan tugas “${title}”`);
      commit('Tugas berhasil ditambahkan');
    }
  });
}

/* ---------- Modal: edit teks sederhana ---------- */
function textModal(title, label, value, onSave, extraHtml = '') {
  openModal(title, `<label class="field"><span>${esc(label)}</span><input type="text" name="text" required maxlength="140" value="${esc(value)}"></label>${extraHtml}`, data => {
    const text = (data.text || '').trim();
    if (!text) { toast('Teks tidak boleh kosong', 'error'); return false; }
    onSave(text, data);
  });
}

/* ---------- Modal: Project ---------- */
function projectModal(project) {
  const p = project || { name: '', desc: '', color: COLORS[0], status: 'Active', start: today(), end: addDays(today(), 30) };
  const body = `
    <label class="field"><span>Nama project *</span>
      <input type="text" name="name" required maxlength="80" value="${esc(p.name)}" placeholder="Contoh: Peluncuran Produk Baru"></label>
    <label class="field"><span>Deskripsi</span>
      <textarea name="desc" rows="3" placeholder="Tujuan atau ruang lingkup project">${esc(p.desc)}</textarea></label>
    <div class="field-row">
      <label class="field"><span>Mulai</span><input type="date" name="start" value="${esc(p.start)}"></label>
      <label class="field"><span>Target selesai</span><input type="date" name="end" value="${esc(p.end)}"></label>
    </div>
    <label class="field"><span>Status</span>
      <select name="status">${PROJECT_STATUSES.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <div class="field"><span>Warna</span>
      <div class="swatches">${COLORS.map(c => `<label class="swatch"><input type="radio" name="color" value="${c}" ${c === p.color ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>`;
  openModal(project ? 'Edit Project' : 'New Project', body, data => {
    const name = (data.name || '').trim();
    if (!name) { toast('Nama project wajib diisi', 'error'); return false; }
    if (project) {
      Object.assign(project, { name, desc: data.desc.trim(), start: data.start, end: data.end, status: data.status, color: data.color || p.color });
      addLog(`Mengubah project “${name}”`);
      commit('Project berhasil diperbarui', 'info');
    } else {
      state.projects.push({ id: uid(), name, desc: data.desc.trim(), start: data.start, end: data.end, status: data.status, color: data.color || COLORS[0] });
      addLog(`Membuat project “${name}”`);
      commit('Project berhasil ditambahkan');
    }
  });
}

/* ---------------------------------------------------------- *
 * 8. Charts
 * ---------------------------------------------------------- */
const charts = [];
function destroyCharts() { charts.splice(0).forEach(c => { try { c.destroy(); } catch (e) { /* abaikan */ } }); }
function chartDefaults() {
  if (typeof Chart === 'undefined') return;
  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.color = cssVar('--muted');
  Chart.defaults.borderColor = cssVar('--border');
}
function mkChart(id, config) {
  const el = document.getElementById(id);
  if (!el) return null;
  if (typeof Chart === 'undefined') {
    el.parentElement.innerHTML = '<div class="chart-note">Grafik membutuhkan koneksi internet untuk memuat Chart.js.</div>';
    return null;
  }
  const c = new Chart(el, config);
  charts.push(c);
  return c;
}
function baseOpts(extra = {}) {
  return Object.assign({
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } },
    scales: {
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--border') } },
      x: { grid: { display: false } },
    },
  }, extra);
}
const pieOpts = () => ({
  responsive: true, maintainAspectRatio: false, cutout: '64%',
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } } },
});

/* ---------------------------------------------------------- *
 * 9. Views
 * ---------------------------------------------------------- */

/* ===== 9.1 Dashboard ===== */
function viewDashboard() {
  const s = stats();
  const t0 = today();
  const todays = state.tasks.filter(t => t.due === t0).sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || byPriority(a, b));
  const upcoming = state.tasks.filter(t => t.status !== 'Done' && t.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
  const mk = monthKey(t0);
  const mDone = completedInMonth(mk);
  const mTarget = monthTarget(mk);
  const mPct = pct(mDone, mTarget);
  const sc = dayScore(t0);
  const active = state.projects.filter(p => p.status === 'Active');

  const cards = [
    ['folder-kanban', 'Total Projects', s.projects, 'c-blue', `${active.length} aktif`],
    ['list-checks', 'Total Tasks', s.total, 'c-indigo', 'Semua tugas tercatat'],
    ['circle-check', 'Tasks Completed', s.done, 'c-green', `${s.rate}% dari total`],
    ['loader', 'Tasks In Progress', s.prog, 'c-amber', 'Sedang dikerjakan'],
    ['triangle-alert', 'Overdue Tasks', s.overdue, 'c-red', s.overdue ? 'Perlu segera ditangani' : 'Semua terkendali'],
    ['target', 'Completion Rate', `${s.rate}%`, 'c-teal', `${s.done} dari ${s.total} tugas`],
  ].map(([icon, label, value, cls, foot]) => `
    <div class="card stat">
      <div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${cls}"><i data-lucide="${icon}"></i></span></div>
      <div class="stat-value">${value}</div>
      <div class="stat-foot">${foot}</div>
    </div>`).join('');

  const projSummary = active.length
    ? `<div class="proj-sum">${active.map(p => {
      const ps = projectStats(p);
      return `<a class="ps-item" href="#/projects" data-action="open-project" data-id="${p.id}">
        <div class="mini-row"><span class="ps-name"><i class="dot" style="background:${esc(p.color)}"></i>${esc(p.name)}</span><b>${ps.pct}%</b></div>
        ${progressBar(ps.pct, p.color)}
        <div class="small muted" style="margin-top:4px">${ps.done}/${ps.total} tugas${ps.overdue ? ` · <span style="color:var(--red)">${ps.overdue} overdue</span>` : ''}</div>
      </a>`;
    }).join('')}</div>`
    : emptyState('folder-open', 'Belum ada project aktif.');

  const recent = state.log.length
    ? `<div class="activity">${state.log.slice(0, 7).map(l => `<div class="act-item"><i class="act-dot"></i><div class="act-text">${esc(l.text)}<div class="act-time">${timeAgo(l.ts)}</div></div></div>`).join('')}</div>`
    : emptyState('activity', 'Belum ada aktivitas.');

  return `
    <div class="welcome">
      <div><h2>Halo, ${esc(state.settings.name)} 👋</h2><p>${fmtLong(t0)} — ${s.overdue ? `${s.overdue} tugas melewati deadline.` : 'Tidak ada tugas yang terlambat.'}</p></div>
      <button class="btn primary" data-action="new-task"><i data-lucide="plus"></i>Tambah tugas</button>
    </div>
    <div class="grid-stats">${cards}</div>

    <div class="grid-2">
      ${card('Progres Tugas Mingguan', chartBox('chWeek'), '<span class="sub">Minggu ini</span>')}
      ${card('Penyelesaian Tugas Bulanan', chartBox('chMonth'), '<span class="sub">6 bulan terakhir</span>')}
    </div>

    <div class="grid-3">
      ${card('Pencapaian Target Bulanan', `
        <div class="gauge">
          <div class="ring" style="--p:${mPct}"><span>${mPct}%</span></div>
          <div>
            <h4>${monthLabel(mk)}</h4>
            <div class="gauge-stats"><span><b>${mDone}</b> dari <b>${mTarget}</b> tugas selesai</span><span>Sisa <b>${Math.max(0, mTarget - mDone)}</b> tugas lagi</span></div>
          </div>
        </div>`, '<a class="btn sm" href="#/monthly">Detail</a>')}
      ${card('Indikator Produktivitas Hari Ini', `
        <div class="gauge">
          <div class="ring green" style="--p:${sc.pct}"><span>${sc.pct}%</span></div>
          <div>
            <h4>${prodLabel(sc.pct)}</h4>
            <div class="gauge-stats"><span><b>${sc.tasksDone}</b> tugas selesai</span><span><b>${sc.actsDone}/${sc.acts}</b> aktivitas harian</span><span>Target harian: <b>${sc.target}</b> item</span></div>
          </div>
        </div>`, '<a class="btn sm" href="#/daily">Daily</a>')}
      ${card('Ringkasan Project Aktif', projSummary, '<a class="btn sm" href="#/projects">Semua</a>')}
    </div>

    <div class="grid-3">
      ${card('Tugas Hari Ini', taskList(todays, 'Tidak ada tugas dengan deadline hari ini.'), `<span class="sub">${todays.filter(t => t.status === 'Done').length}/${todays.length} selesai</span>`)}
      ${card('Deadline Terdekat', taskList(upcoming, 'Semua tugas sudah selesai. Mantap!'), '<a class="btn sm" href="#/tasks">Lihat semua</a>')}
      ${card('Aktivitas Terbaru', recent)}
    </div>`;
}
function afterDashboard() {
  const ws = startOfWeek(today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  mkChart('chWeek', {
    type: 'bar',
    data: {
      labels: DAYS_SHORT,
      datasets: [
        { label: 'Selesai', data: days.map(countCompleted), backgroundColor: cssVar('--accent'), borderRadius: 6, maxBarThickness: 26 },
        { label: 'Deadline', data: days.map(countDue), backgroundColor: cssVar('--chart-2'), borderRadius: 6, maxBarThickness: 26 },
      ],
    },
    options: baseOpts(),
  });
  const mk = monthKey(today());
  const keys = Array.from({ length: 6 }, (_, i) => shiftMonth(mk, i - 5));
  mkChart('chMonth', {
    data: {
      labels: keys.map(k => MONTHS_SHORT[+k.slice(5) - 1]),
      datasets: [
        { type: 'bar', label: 'Selesai', data: keys.map(completedInMonth), backgroundColor: cssVar('--accent'), borderRadius: 6, maxBarThickness: 34 },
        { type: 'line', label: 'Target', data: keys.map(monthTarget), borderColor: cssVar('--amber'), borderDash: [6, 4], pointRadius: 0, borderWidth: 2 },
      ],
    },
    options: baseOpts(),
  });
}

/* ===== 9.2 My Tasks ===== */
function filteredTasks() {
  const q = ui.taskSearch.trim().toLowerCase();
  const st = { 'In Progress': 0, 'To Do': 1, 'Done': 2 };
  const sorters = {
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),
    priority: byPriority,
    status: (a, b) => st[a.status] - st[b.status],
    newest: () => 0,
    title: (a, b) => a.title.localeCompare(b.title),
  };
  return state.tasks.filter(t => {
    if (ui.taskStatus === 'overdue') { if (!isOverdue(t)) return false; }
    else if (ui.taskStatus !== 'all' && t.status !== ui.taskStatus) return false;
    if (ui.taskPriority !== 'all' && t.priority !== ui.taskPriority) return false;
    if (ui.taskProject !== 'all' && t.projectId !== ui.taskProject) return false;
    if (q && !`${t.title} ${t.desc || ''}`.toLowerCase().includes(q)) return false;
    return true;
  }).sort(sorters[ui.taskSort] || sorters.due);
}
const filtersActive = () => ui.taskSearch.trim() !== '' || ui.taskStatus !== 'all' || ui.taskPriority !== 'all' || ui.taskProject !== 'all';
function taskTable() {
  const list = filteredTasks();
  if (!list.length) {
    return emptyState('inbox', state.tasks.length ? 'Tidak ada tugas yang cocok dengan filter.' : 'Belum ada tugas. Klik “New Task” untuk memulai.');
  }
  return `<table class="table tasks-table">
    <thead><tr><th style="width:48px"></th><th>Task</th><th>Project</th><th>Priority</th><th>Status</th><th>Deadline</th><th style="width:96px"></th></tr></thead>
    <tbody>${list.map(t => `
      <tr class="${t.status === 'Done' ? 'is-done' : ''}">
        <td>${checkBtn(t)}</td>
        <td><div class="t-title link" data-action="edit-task" data-id="${t.id}" title="Klik untuk edit">${esc(t.title)}</div>${t.desc ? `<div class="t-desc">${esc(t.desc)}</div>` : ''}</td>
        <td>${projectChip(t.projectId)}</td>
        <td>${badge(t.priority, prioClass(t.priority))}</td>
        <td>${statusSelect(t)}</td>
        <td>${dueLabel(t)}</td>
        <td class="row-actions">
          <button class="icon-btn sm" data-action="edit-task" data-id="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="icon-btn sm danger" data-action="delete-task" data-id="${t.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
        </td>
      </tr>`).join('')}</tbody></table>
    <div class="table-foot">Menampilkan ${list.length} dari ${state.tasks.length} tugas</div>`;
}
function viewTasks() {
  const opt = (value, label, current) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`;
  return `
    <div class="toolbar">
      <div class="search-box"><i data-lucide="search"></i>
        <input type="search" id="taskSearch" data-ui="taskSearch" placeholder="Cari tugas…" value="${esc(ui.taskSearch)}"></div>
      <select data-ui="taskStatus" aria-label="Filter status">
        ${opt('all', 'Semua status', ui.taskStatus)}${STATUSES.map(s => opt(s, s, ui.taskStatus)).join('')}${opt('overdue', 'Overdue', ui.taskStatus)}
      </select>
      <select data-ui="taskPriority" aria-label="Filter prioritas">
        ${opt('all', 'Semua prioritas', ui.taskPriority)}${PRIORITIES.map(s => opt(s, s, ui.taskPriority)).join('')}
      </select>
      <select data-ui="taskProject" aria-label="Filter project">
        ${opt('all', 'Semua project', ui.taskProject)}${state.projects.map(p => opt(p.id, p.name, ui.taskProject)).join('')}
      </select>
      <select data-ui="taskSort" aria-label="Urutkan">
        ${opt('due', 'Urut: Deadline', ui.taskSort)}${opt('priority', 'Urut: Prioritas', ui.taskSort)}${opt('status', 'Urut: Status', ui.taskSort)}${opt('newest', 'Urut: Terbaru', ui.taskSort)}${opt('title', 'Urut: Judul A–Z', ui.taskSort)}
      </select>
      ${filtersActive() ? '<button class="btn" data-action="reset-filters"><i data-lucide="filter-x"></i>Reset filter</button>' : ''}
      <span class="spacer"></span>
      ${state.tasks.some(t => t.status === 'Done') ? '<button class="btn" data-action="clear-done"><i data-lucide="eraser"></i>Hapus yang selesai</button>' : ''}
      <button class="btn primary" data-action="new-task"><i data-lucide="plus"></i>New Task</button>
    </div>
    <div class="card flush"><div class="table-wrap" id="taskTableWrap">${taskTable()}</div></div>`;
}

/* ===== 9.3 Daily Tracker ===== */
function viewDaily() {
  const d = ui.dailyDate;
  const sc = dayScore(d);
  const acts = state.activities.filter(a => a.date === d);
  const dayTasks = state.tasks.filter(t => t.due === d || t.completedOn === d);
  const strip = Array.from({ length: 7 }, (_, i) => addDays(d, i - 6)).map(day => {
    const s = dayScore(day);
    return `<button class="bar-col ${day === d ? 'sel' : ''}" data-action="daily-goto" data-date="${day}" title="${fmtLong(day)} — ${s.pct}%">
      <div class="bar" style="height:${Math.max(4, s.pct)}%"></div><span>${DAYS_SHORT[weekdayIdx(day)]}</span></button>`;
  }).join('');

  const actList = acts.length
    ? acts.map(a => `<div class="act-row ${a.done ? 'done' : ''}">
        <button class="check ${a.done ? 'checked' : ''}" data-action="toggle-activity" data-id="${a.id}" aria-label="Tandai selesai"><i data-lucide="check"></i></button>
        <div class="ar-text link" data-action="edit-activity" data-id="${a.id}" title="Klik untuk edit">${esc(a.text)}</div>
        ${a.minutes ? `<span class="ar-min">${a.minutes} mnt</span>` : ''}
        <button class="icon-btn sm danger" data-action="delete-activity" data-id="${a.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
      </div>`).join('')
    : emptyState('sun', 'Belum ada aktivitas untuk hari ini. Tambahkan di atas.');

  return `
    <div class="date-nav">
      <button class="icon-btn" data-action="daily-prev" aria-label="Hari sebelumnya"><i data-lucide="chevron-left"></i></button>
      <input type="date" value="${d}" data-change="daily-date" aria-label="Pilih tanggal">
      <button class="icon-btn" data-action="daily-next" aria-label="Hari berikutnya"><i data-lucide="chevron-right"></i></button>
      <h2>${fmtLong(d)}</h2>
      ${d !== today() ? '<button class="btn sm" data-action="daily-today">Hari ini</button>' : ''}
    </div>
    <div class="mini-stats">
      <div class="mini-stat"><b>${sc.actsDone}/${sc.acts}</b><span>Aktivitas selesai</span></div>
      <div class="mini-stat"><b>${sc.tasksDone}</b><span>Tugas diselesaikan</span></div>
      <div class="mini-stat"><b>${sc.minutes >= 60 ? `${Math.floor(sc.minutes / 60)}j ${sc.minutes % 60}m` : `${sc.minutes}m`}</b><span>Waktu fokus</span></div>
      <div class="mini-stat"><b>${sc.pct}%</b><span>Produktivitas · ${prodLabel(sc.pct)}</span></div>
    </div>
    <div class="grid-21">
      <div class="stack">
        ${card('Aktivitas Harian', `
          <form class="inline-form" data-form="add-activity" style="margin-bottom:12px">
            <input type="text" name="text" required maxlength="140" placeholder="Tambah aktivitas, mis. “Review proposal”">
            <input type="number" name="minutes" min="0" step="5" placeholder="Menit">
            <button class="btn primary" type="submit"><i data-lucide="plus"></i>Tambah</button>
          </form>
          <div style="margin-bottom:6px"><button class="btn sm" data-action="carry-activities"><i data-lucide="copy"></i>Salin yang belum selesai dari hari sebelumnya</button></div>
          ${actList}`)}
        ${card('Tugas pada Tanggal Ini', taskList(dayTasks, 'Tidak ada tugas dengan deadline atau penyelesaian di tanggal ini.'),
    `<button class="btn sm" data-action="new-task" data-due="${d}"><i data-lucide="plus"></i>Tugas</button>`)}
      </div>
      <div class="stack">
        ${card('7 Hari Terakhir', `<div class="bars">${strip}</div>`, '<span class="sub">Skor produktivitas</span>')}
        ${card('Catatan Hari Ini', `<textarea id="dailyNote" class="note-area" placeholder="Refleksi, hambatan, atau hal yang ingin diingat…">${esc(state.dailyNotes[d] || '')}</textarea>`, '<span class="sub">Tersimpan otomatis</span>')}
      </div>
    </div>`;
}
function afterDaily() { /* tidak ada chart */ }

/* ===== 9.4 Weekly Tracker ===== */
function viewWeekly() {
  const ws = ui.weekStart;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const we = days[6];
  const inWeek = state.tasks.filter(t => t.due && t.due >= ws && t.due <= we);
  const doneWeek = state.tasks.filter(t => t.completedOn && t.completedOn >= ws && t.completedOn <= we).length;
  const goals = state.weeklyGoals.filter(g => g.weekStart === ws);
  const goalsDone = goals.filter(g => g.progress >= 100).length;
  const goalAvg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  const board = days.map(d => {
    const ts = state.tasks.filter(t => t.due === d);
    return `<div class="wday ${d === today() ? 'today' : ''}">
      <div class="wday-head"><div><b>${DAYS[weekdayIdx(d)]}</b><br><span>${fmtShort(d)}</span></div>
        <button class="icon-btn sm" data-action="new-task" data-due="${d}" title="Tambah tugas"><i data-lucide="plus"></i></button></div>
      ${ts.length ? ts.map(t => {
        const p = projectById(t.projectId);
        return `<div class="wtask ${t.status === 'Done' ? 'done' : ''}" style="border-left-color:${p ? esc(p.color) : 'var(--border)'}">
          ${checkBtn(t)}<span class="link" style="cursor:pointer" data-action="edit-task" data-id="${t.id}">${esc(t.title)}</span></div>`;
      }).join('') : '<div class="small muted">Kosong</div>'}
    </div>`;
  }).join('');

  const goalList = goals.length
    ? goals.map(g => `<div class="goal">
        <div class="goal-top"><b class="link" data-action="edit-goal" data-id="${g.id}" title="Klik untuk edit">${esc(g.text)}</b>
          <button class="icon-btn sm danger" data-action="delete-goal" data-id="${g.id}" title="Hapus"><i data-lucide="trash-2"></i></button></div>
        <div class="goal-slider"><input type="range" min="0" max="100" step="5" value="${g.progress}" data-change="goal-progress" data-id="${g.id}" aria-label="Progres target"><b>${g.progress}%</b></div>
      </div>`).join('')
    : emptyState('flag', 'Belum ada target untuk minggu ini.');

  return `
    <div class="date-nav">
      <button class="icon-btn" data-action="week-prev" aria-label="Minggu sebelumnya"><i data-lucide="chevron-left"></i></button>
      <button class="icon-btn" data-action="week-next" aria-label="Minggu berikutnya"><i data-lucide="chevron-right"></i></button>
      <h2>${fmtShort(ws)} – ${fmtDate(we)}</h2>
      ${ws !== startOfWeek(today()) ? '<button class="btn sm" data-action="week-today">Minggu ini</button>' : ''}
    </div>
    <div class="mini-stats">
      <div class="mini-stat"><b>${inWeek.length}</b><span>Tugas ber-deadline</span></div>
      <div class="mini-stat"><b>${doneWeek}</b><span>Tugas diselesaikan</span></div>
      <div class="mini-stat"><b>${goalsDone}/${goals.length}</b><span>Target tercapai</span></div>
      <div class="mini-stat"><b>${goalAvg}%</b><span>Rata-rata progres target</span></div>
    </div>
    <div class="grid-2">
      ${card('Target Mingguan', `
        <form class="inline-form" data-form="add-goal" style="margin-bottom:8px">
          <input type="text" name="text" required maxlength="140" placeholder="Tulis target minggu ini…">
          <button class="btn primary" type="submit"><i data-lucide="plus"></i>Tambah</button>
        </form>
        <div style="margin-bottom:6px"><button class="btn sm" data-action="carry-goals"><i data-lucide="copy"></i>Salin target belum tercapai dari minggu lalu</button></div>
        ${goalList}`)}
      ${card('Aktivitas Minggu Ini', chartBox('chWeekly'), '<span class="sub">Deadline vs selesai</span>')}
    </div>
    <div class="card-head"><h3>Papan Mingguan</h3></div>
    <div class="week-board">${board}</div>`;
}
function afterWeekly() {
  const days = Array.from({ length: 7 }, (_, i) => addDays(ui.weekStart, i));
  mkChart('chWeekly', {
    type: 'bar',
    data: {
      labels: DAYS_SHORT,
      datasets: [
        { label: 'Selesai', data: days.map(countCompleted), backgroundColor: cssVar('--accent'), borderRadius: 6, maxBarThickness: 26 },
        { label: 'Deadline', data: days.map(countDue), backgroundColor: cssVar('--chart-2'), borderRadius: 6, maxBarThickness: 26 },
      ],
    },
    options: baseOpts(),
  });
}

/* ===== 9.5 Monthly Tracker ===== */
function viewMonthly() {
  const k = ui.monthKey;
  const completed = state.tasks.filter(t => t.completedOn && monthKey(t.completedOn) === k).sort((a, b) => b.completedOn.localeCompare(a.completedOn));
  const target = monthTarget(k);
  const p = pct(completed.length, target);
  const dueCount = state.tasks.filter(t => t.due && monthKey(t.due) === k).length;
  const ach = state.monthly.achievements.filter(a => a.month === k);
  const perProject = state.projects.map(pr => ({ pr, n: completed.filter(t => t.projectId === pr.id).length })).filter(x => x.n > 0);
  const maxN = Math.max(1, ...perProject.map(x => x.n));

  return `
    <div class="date-nav">
      <button class="icon-btn" data-action="month-prev" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button>
      <button class="icon-btn" data-action="month-next" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button>
      <h2>${monthLabel(k)}</h2>
      ${k !== monthKey(today()) ? '<button class="btn sm" data-action="month-today">Bulan ini</button>' : ''}
    </div>
    <div class="grid-3">
      ${card('Target Bulanan', `
        <div class="target-box">
          <div class="target-big"><b>${completed.length}</b><span class="muted">/ ${target} tugas · ${p}%</span></div>
          ${progressBar(p, p >= 100 ? 'var(--green)' : '')}
          <form class="inline-form" data-form="set-month-target">
            <input type="number" name="target" min="1" max="999" value="${target}" required aria-label="Target tugas selesai">
            <button class="btn" type="submit">Atur target</button>
          </form>
          <div class="small muted">${dueCount} tugas memiliki deadline di bulan ini.</div>
        </div>`)}
      ${card('Pencapaian Bulan Ini', `
        <form class="inline-form" data-form="add-achievement" style="margin-bottom:8px">
          <input type="text" name="text" required maxlength="140" placeholder="Catat pencapaian…">
          <button class="btn primary" type="submit"><i data-lucide="plus"></i></button>
        </form>
        ${ach.length ? ach.map(a => `<div class="trophy"><i data-lucide="trophy"></i><span class="link" data-action="edit-achievement" data-id="${a.id}" title="Klik untuk edit">${esc(a.text)}</span>
          <button class="icon-btn sm danger" data-action="delete-achievement" data-id="${a.id}" title="Hapus"><i data-lucide="trash-2"></i></button></div>`).join('')
        : emptyState('trophy', 'Belum ada pencapaian dicatat.')}`)}
      ${card('Selesai per Project', perProject.length
        ? `<div class="proj-sum">${perProject.map(x => `<div><div class="mini-row"><span class="ps-name"><i class="dot" style="background:${esc(x.pr.color)}"></i>${esc(x.pr.name)}</span><b>${x.n}</b></div>${progressBar(Math.round(x.n / maxN * 100), x.pr.color)}</div>`).join('')}</div>`
        : emptyState('folder-open', 'Belum ada tugas selesai bulan ini.'))}
    </div>
    <div class="grid-21">
      ${card('Progres Harian', chartBox('chMonthly'), `<span class="sub">${monthLabel(k)}</span>`)}
      ${card('Tugas Selesai', taskList(completed.slice(0, 12), 'Belum ada tugas selesai di bulan ini.'), `<span class="sub">${completed.length} tugas</span>`)}
    </div>`;
}
function afterMonthly() {
  const k = ui.monthKey;
  const dim = daysInMonth(k);
  const labels = Array.from({ length: dim }, (_, i) => String(i + 1));
  const daily = labels.map((_, i) => countCompleted(`${k}-${pad(i + 1)}`));
  let run = 0;
  const cum = daily.map(v => (run += v));
  const target = monthTarget(k);
  mkChart('chMonthly', {
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'Selesai per hari', data: daily, backgroundColor: cssVar('--chart-2'), borderRadius: 4, yAxisID: 'y1', maxBarThickness: 18 },
        { type: 'line', label: 'Kumulatif', data: cum, borderColor: cssVar('--accent'), backgroundColor: cssVar('--accent'), tension: .3, pointRadius: 0, borderWidth: 2.5, yAxisID: 'y' },
        { type: 'line', label: 'Target', data: labels.map(() => target), borderColor: cssVar('--amber'), borderDash: [6, 4], pointRadius: 0, borderWidth: 2, yAxisID: 'y' },
      ],
    },
    options: baseOpts({
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--border') } },
        y1: { beginAtZero: true, position: 'right', ticks: { precision: 0 }, grid: { drawOnChartArea: false } },
      },
    }),
  });
}

/* ===== 9.6 Project Management ===== */
const projStatusClass = s => ({ Active: 's-progress', 'On Hold': 'p-high', Completed: 's-done' }[s] || 's-todo');
function projectCard(p) {
  const ps = projectStats(p);
  return `<article class="card project-card" data-action="open-project" data-id="${p.id}" tabindex="0" role="button" aria-label="Buka ${esc(p.name)}">
    <div class="pc-top"><span class="pc-color" style="background:${esc(p.color)}"></span><h3>${esc(p.name)}</h3>
      <div class="pc-actions">
        <button class="icon-btn sm" data-action="edit-project" data-id="${p.id}" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="icon-btn sm danger" data-action="delete-project" data-id="${p.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
      </div></div>
    <p class="pc-desc">${esc(p.desc) || 'Tanpa deskripsi.'}</p>
    <div class="pc-meta">${badge(p.status, projStatusClass(p.status))}<span>${fmtShort(p.start)} → ${fmtDate(p.end)}</span></div>
    <div>
      <div class="mini-row"><span class="muted">${ps.done}/${ps.total} tugas</span><b>${ps.pct}%</b></div>
      ${progressBar(ps.pct, p.color)}
    </div>
    ${ps.overdue ? `<div class="small" style="color:var(--red)">${ps.overdue} tugas overdue</div>` : ''}
  </article>`;
}
function kcard(t) {
  return `<div class="kcard" draggable="true" data-id="${t.id}">
    <div class="kcard-title link" data-action="edit-task" data-id="${t.id}" title="Klik untuk edit">${esc(t.title)}</div>
    ${t.desc ? `<div class="small muted">${esc(t.desc)}</div>` : ''}
    <div class="kcard-foot">${badge(t.priority, prioClass(t.priority))}${dueLabel(t)}</div>
    <div class="kcard-foot">${statusSelect(t)}
      <span class="kcard-actions">
        <button class="icon-btn sm" data-action="edit-task" data-id="${t.id}" title="Edit"><i data-lucide="pencil"></i></button>
        <button class="icon-btn sm danger" data-action="delete-task" data-id="${t.id}" title="Hapus"><i data-lucide="trash-2"></i></button>
      </span></div>
  </div>`;
}
function viewProjects() {
  if (ui.projectDetail) {
    const p = projectById(ui.projectDetail);
    if (p) {
      const ps = projectStats(p);
      return `
        <button class="back-link" data-action="close-project"><i data-lucide="chevron-left"></i>Semua project</button>
        <div class="card proj-head">
          <span class="pc-color" style="background:${esc(p.color)};width:16px;height:16px"></span>
          <div class="grow">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="font-size:18px">${esc(p.name)}</h3>${badge(p.status, projStatusClass(p.status))}</div>
            <p class="muted" style="margin:4px 0 10px">${esc(p.desc) || 'Tanpa deskripsi.'} · ${fmtDate(p.start)} → ${fmtDate(p.end)}</p>
            <div class="mini-row"><span class="muted">${ps.done}/${ps.total} tugas selesai${ps.overdue ? ` · <span style="color:var(--red)">${ps.overdue} overdue</span>` : ''}</span><b>${ps.pct}%</b></div>
            ${progressBar(ps.pct, p.color)}
          </div>
          <div class="btn-row">
            <button class="btn" data-action="edit-project" data-id="${p.id}"><i data-lucide="pencil"></i>Edit</button>
            <button class="btn primary" data-action="new-task" data-project="${p.id}"><i data-lucide="plus"></i>Tugas</button>
          </div>
        </div>
        <div class="kanban">${STATUSES.map(st => {
          const items = state.tasks.filter(t => t.projectId === p.id && t.status === st);
          return `<div class="kcol" data-status="${st}">
            <div class="kcol-head">${badge(st, statusClass(st))}<span class="count">${items.length}</span>
              <button class="icon-btn sm" data-action="new-task" data-project="${p.id}" data-status="${st}" title="Tambah tugas"><i data-lucide="plus"></i></button></div>
            <div class="kcol-body">${items.length ? items.map(kcard).join('') : '<div class="kempty">Seret tugas ke sini</div>'}</div>
          </div>`;
        }).join('')}</div>
        <p class="small muted" style="margin-top:12px">Tip: seret kartu antar kolom untuk mengubah status, atau gunakan menu status di setiap kartu.</p>`;
    }
    ui.projectDetail = null;
  }
  const byStatus = { Active: 0, 'On Hold': 1, Completed: 2 };
  const list = [...state.projects].sort((a, b) => byStatus[a.status] - byStatus[b.status]);
  return `
    <div class="toolbar">
      <span class="muted">${list.length} project · ${list.filter(p => p.status === 'Active').length} aktif</span>
      <span class="spacer"></span>
      <button class="btn primary" data-action="new-project"><i data-lucide="plus"></i>New Project</button>
    </div>
    ${list.length ? `<div class="project-grid">${list.map(projectCard).join('')}</div>` : card('Belum ada project', emptyState('folder-open', 'Buat project pertama Anda untuk mulai mengelompokkan tugas.'))}`;
}

/* ===== 9.7 Calendar ===== */
function viewCalendar() {
  const k = ui.calKey;
  const first = `${k}-01`;
  const lead = weekdayIdx(first);
  const start = addDays(first, -lead);
  const total = Math.ceil((lead + daysInMonth(k)) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => addDays(start, i));
  const sel = ui.calSelected;

  const grid = cells.map(d => {
    const ts = state.tasks.filter(t => t.due === d);
    const cls = ['cal-cell', monthKey(d) !== k ? 'out' : '', d === today() ? 'today' : '', d === sel ? 'sel' : ''].join(' ');
    return `<div class="${cls}" data-action="cal-select" data-date="${d}">
      <span class="num">${parse(d).getDate()}</span>
      ${ts.slice(0, 3).map(t => { const p = projectById(t.projectId); return `<span class="pill ${t.status === 'Done' ? 'done' : ''}" style="border-left-color:${p ? esc(p.color) : 'var(--border)'}" title="${esc(t.title)}">${esc(t.title)}</span>`; }).join('')}
      ${ts.length > 3 ? `<div class="pill-more">+${ts.length - 3} lagi</div>` : ''}
      ${ts.length ? `<div class="cal-dots">${ts.slice(0, 6).map(t => { const p = projectById(t.projectId); return `<i style="background:${p ? esc(p.color) : 'var(--muted)'}"></i>`; }).join('')}</div>` : ''}
    </div>`;
  }).join('');

  const selTasks = state.tasks.filter(t => t.due === sel);
  return `
    <div class="cal-layout">
      <div class="card">
        <div class="cal-head">
          <h2>${monthLabel(k)}</h2>
          ${k !== monthKey(today()) ? '<button class="btn sm" data-action="cal-today">Hari ini</button>' : ''}
          <button class="icon-btn" data-action="cal-prev" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button>
          <button class="icon-btn" data-action="cal-next" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button>
        </div>
        <div class="cal-grid">${DAYS_SHORT.map(d => `<div class="cal-dow">${d}</div>`).join('')}${grid}</div>
      </div>
      ${card(fmtLong(sel), taskList([...selTasks].sort(byPriority), 'Tidak ada tugas di tanggal ini.'),
    `<button class="btn sm primary" data-action="new-task" data-due="${sel}"><i data-lucide="plus"></i>Tugas</button>`)}
    </div>`;
}

/* ===== 9.8 Reports & Analytics ===== */
function reportMetrics() {
  const ts = state.tasks;
  const done = ts.filter(t => t.status === 'Done');
  const withDue = done.filter(t => t.due && t.completedOn);
  const onTime = withDue.filter(t => t.completedOn <= t.due).length;
  const spans = done.filter(t => t.createdOn && t.completedOn).map(t => Math.max(0, daysBetween(t.createdOn, t.completedOn)));
  const since = addDays(today(), -27);
  const last28 = done.filter(t => t.completedOn >= since).length;
  return {
    rate: pct(done.length, ts.length),
    onTime: pct(onTime, withDue.length),
    avgDays: spans.length ? (spans.reduce((a, b) => a + b, 0) / spans.length).toFixed(1) : '0',
    perWeek: (last28 / 4).toFixed(1),
    overdue: ts.filter(isOverdue).length,
  };
}
function viewReports() {
  const m = reportMetrics();
  const kpis = [
    ['target', 'Completion Rate', `${m.rate}%`, 'c-teal', 'Tugas selesai / total'],
    ['clock', 'Tepat Waktu', `${m.onTime}%`, 'c-green', 'Selesai sebelum deadline'],
    ['timer', 'Rata-rata Durasi', `${m.avgDays} hr`, 'c-indigo', 'Dari dibuat sampai selesai'],
    ['zap', 'Throughput', `${m.perWeek}/mgg`, 'c-amber', 'Rata-rata 4 minggu terakhir'],
    ['triangle-alert', 'Overdue', m.overdue, 'c-red', 'Belum selesai & lewat deadline'],
  ].map(([icon, label, value, cls, foot]) => `
    <div class="card stat"><div class="stat-top"><span class="stat-label">${label}</span><span class="stat-icon ${cls}"><i data-lucide="${icon}"></i></span></div>
    <div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></div>`).join('');

  const rows = state.projects.map(p => {
    const ps = projectStats(p);
    return `<tr><td><span class="chip"><i class="dot" style="background:${esc(p.color)}"></i><b style="color:var(--text)">${esc(p.name)}</b></span></td>
      <td>${badge(p.status, projStatusClass(p.status))}</td><td>${ps.total}</td><td>${ps.done}</td>
      <td style="min-width:150px"><div class="mini-row"><span></span><b>${ps.pct}%</b></div>${progressBar(ps.pct, p.color)}</td>
      <td style="${ps.overdue ? 'color:var(--red);font-weight:600' : ''}">${ps.overdue}</td></tr>`;
  }).join('');

  return `
    <div class="toolbar">
      <span class="muted">Analisis berdasarkan seluruh data yang tersimpan</span>
      <span class="spacer"></span>
      <button class="btn" data-action="export-csv"><i data-lucide="download"></i>Ekspor CSV</button>
      <button class="btn" data-action="print"><i data-lucide="printer"></i>Cetak</button>
    </div>
    <div class="grid-stats" style="grid-template-columns:repeat(5,1fr)">${kpis}</div>
    <div class="grid-2">
      ${card('Tren 30 Hari', chartBox('chTrend'), '<span class="sub">Dibuat vs selesai</span>')}
      ${card('Distribusi Status', chartBox('chStatus'))}
    </div>
    <div class="grid-2">
      ${card('Tugas per Prioritas', chartBox('chPriority', 'sm'))}
      ${card('Tugas per Project', chartBox('chProject', 'sm'))}
    </div>
    <div class="card flush">
      <div class="card-head" style="padding:18px 18px 0"><h3>Performa Project</h3></div>
      <div class="table-wrap">${state.projects.length
    ? `<table class="table" style="min-width:640px"><thead><tr><th>Project</th><th>Status</th><th>Total</th><th>Selesai</th><th>Progres</th><th>Overdue</th></tr></thead><tbody>${rows}</tbody></table>`
    : emptyState('folder-open', 'Belum ada project.')}</div>
    </div>`;
}
function afterReports() {
  const ts = state.tasks;
  const days = Array.from({ length: 30 }, (_, i) => addDays(today(), i - 29));
  mkChart('chTrend', {
    type: 'line',
    data: {
      labels: days.map(fmtShort),
      datasets: [
        { label: 'Selesai', data: days.map(countCompleted), borderColor: cssVar('--green'), backgroundColor: cssVar('--green'), tension: .3, borderWidth: 2.5, pointRadius: 0 },
        { label: 'Dibuat', data: days.map(d => ts.filter(t => t.createdOn === d).length), borderColor: cssVar('--accent'), backgroundColor: cssVar('--accent'), tension: .3, borderWidth: 2.5, pointRadius: 0 },
      ],
    },
    options: baseOpts({ interaction: { mode: 'index', intersect: false } }),
  });
  mkChart('chStatus', {
    type: 'doughnut',
    data: {
      labels: STATUSES,
      datasets: [{ data: STATUSES.map(s => ts.filter(t => t.status === s).length), backgroundColor: [cssVar('--muted'), cssVar('--accent'), cssVar('--green')], borderColor: cssVar('--surface'), borderWidth: 3 }],
    },
    options: pieOpts(),
  });
  mkChart('chPriority', {
    type: 'bar',
    data: {
      labels: PRIORITIES,
      datasets: [{ label: 'Tugas', data: PRIORITIES.map(p => ts.filter(t => t.priority === p).length), backgroundColor: [cssVar('--muted'), cssVar('--accent'), cssVar('--amber'), cssVar('--red')], borderRadius: 8, maxBarThickness: 48 }],
    },
    options: baseOpts({ plugins: { legend: { display: false } } }),
  });
  mkChart('chProject', {
    type: 'bar',
    data: {
      labels: state.projects.map(p => p.name),
      datasets: [
        { label: 'Selesai', data: state.projects.map(p => ts.filter(t => t.projectId === p.id && t.status === 'Done').length), backgroundColor: cssVar('--green'), borderRadius: 4 },
        { label: 'Belum selesai', data: state.projects.map(p => ts.filter(t => t.projectId === p.id && t.status !== 'Done').length), backgroundColor: cssVar('--chart-2'), borderRadius: 4 },
      ],
    },
    options: baseOpts({
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { callback(v) { const l = this.getLabelForValue(v); return l.length > 12 ? `${l.slice(0, 11)}…` : l; } } },
        y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, grid: { color: cssVar('--border') } },
      },
    }),
  });
}

/* ===== 9.9 Settings ===== */
function viewSettings() {
  const s = state.settings;
  const size = (new Blob([JSON.stringify(state)]).size / 1024).toFixed(1);
  return `
    <div class="settings-grid">
      ${card('Profil & Preferensi', `
        <form data-form="settings">
          <label class="field"><span>Nama</span><input type="text" name="name" maxlength="40" value="${esc(s.name)}" required></label>
          <label class="field"><span>Tema</span>
            <select name="theme"><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option></select></label>
          <div class="field-row">
            <label class="field"><span>Target bulanan (tugas selesai)</span><input type="number" name="monthlyTarget" min="1" max="999" value="${esc(s.monthlyTarget)}" required></label>
            <label class="field"><span>Target harian (item selesai)</span><input type="number" name="dailyTarget" min="1" max="99" value="${esc(s.dailyTarget)}" required></label>
          </div>
          <button class="btn primary" type="submit"><i data-lucide="check"></i>Simpan pengaturan</button>
        </form>`)}
      <div class="stack">
        ${card('Data & Backup', `
          <div class="callout">Semua data tersimpan di browser ini (LocalStorage). Ekspor secara berkala sebagai cadangan.</div>
          <div class="btn-row">
            <button class="btn" data-action="export-json"><i data-lucide="download"></i>Ekspor JSON</button>
            <button class="btn" data-action="import-json"><i data-lucide="upload"></i>Impor JSON</button>
            <button class="btn" data-action="export-csv"><i data-lucide="file-spreadsheet"></i>Ekspor Tugas (CSV)</button>
          </div>
          <input type="file" id="importFile" accept="application/json,.json" hidden>`)}
        ${card('Informasi Penyimpanan', `
          <div class="kv"><span class="muted">Project</span><b>${state.projects.length}</b></div>
          <div class="kv"><span class="muted">Tugas</span><b>${state.tasks.length}</b></div>
          <div class="kv"><span class="muted">Aktivitas harian</span><b>${state.activities.length}</b></div>
          <div class="kv"><span class="muted">Ukuran data</span><b>${size} KB</b></div>`)}
        ${card('Zona Berbahaya', `
          <p class="muted" style="margin-bottom:12px">Gunakan data contoh untuk mencoba aplikasi, atau kosongkan semua data untuk mulai dari nol.</p>
          <div class="btn-row">
            <button class="btn" data-action="load-sample"><i data-lucide="sparkles"></i>Muat data contoh</button>
            <button class="btn danger" data-action="reset-data"><i data-lucide="trash-2"></i>Hapus semua data</button>
          </div>`)}
      </div>
    </div>`;
}

/* ---------------------------------------------------------- *
 * 10. Router & render
 * ---------------------------------------------------------- */
const VIEWS = {
  dashboard: { title: 'Dashboard', sub: () => `Halo, ${state.settings.name} — ringkasan aktivitas dan progres Anda`, render: viewDashboard, after: afterDashboard },
  tasks: { title: 'My Tasks', sub: 'Kelola semua tugas: tambah, ubah, filter, dan selesaikan', render: viewTasks },
  daily: { title: 'Daily Tracker', sub: 'Aktivitas, catatan, dan skor produktivitas harian', render: viewDaily, after: afterDaily },
  weekly: { title: 'Weekly Tracker', sub: 'Target dan papan kerja mingguan', render: viewWeekly, after: afterWeekly },
  monthly: { title: 'Monthly Tracker', sub: 'Target dan pencapaian bulanan', render: viewMonthly, after: afterMonthly },
  projects: { title: 'Project Management', sub: 'Pantau project dan kelola tugas dengan papan kanban', render: viewProjects },
  calendar: { title: 'Calendar', sub: 'Lihat deadline tugas dalam kalender bulanan', render: viewCalendar },
  reports: { title: 'Reports & Analytics', sub: 'Analisis performa, tren, dan distribusi tugas', render: viewReports, after: afterReports },
  settings: { title: 'Settings', sub: 'Profil, tema, target, dan manajemen data', render: viewSettings },
};
const currentView = () => {
  const v = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
  return VIEWS[v] ? v : 'dashboard';
};
function icons() { if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons(); }
function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.settings.theme === 'dark' ? 'dark' : 'light');
}
let lastView = null;
function render() {
  destroyCharts();
  const view = currentView();
  const def = VIEWS[view];
  const y = window.scrollY || 0;
  let title = val(def.title);
  let sub = val(def.sub);
  const content = $('#content');
  try {
    content.innerHTML = def.render();
  } catch (err) {
    console.error(err);
    content.innerHTML = '<div class="card"><div class="empty">Terjadi kesalahan saat menampilkan halaman ini. Coba muat ulang atau reset data di Settings.</div></div>';
  }
  if (view === 'projects' && ui.projectDetail) {
    const p = projectById(ui.projectDetail);
    if (p) { title = p.name; sub = 'Detail project dan papan kanban'; }
  }
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = sub;
  document.title = `${title} · TaskFlow`;
  $$('#nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  $('#sfName').textContent = state.settings.name;
  const tl = $('#nav a[data-view="tasks"]');
  if (tl) {
    const old = tl.querySelector('.nav-badge'); if (old) old.remove();
    const od = state.tasks.filter(isOverdue).length;
    if (od) { const b = document.createElement('span'); b.className = 'nav-badge'; b.title = `${od} tugas overdue`; b.textContent = od; tl.appendChild(b); }
  }
  $('#avatar').textContent = (state.settings.name.trim()[0] || 'U').toUpperCase();
  $('#themeBtn').innerHTML = `<i data-lucide="${state.settings.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
  chartDefaults();
  try { if (def.after) def.after(); } catch (err) { console.error(err); }
  icons();
  window.scrollTo(0, lastView === view ? y : 0);
  lastView = view;
}

/* ---------------------------------------------------------- *
 * 11. Aksi
 * ---------------------------------------------------------- */
function toggleTask(id) {
  const t = findTask(id);
  if (!t) return;
  if (t.status === 'Done') {
    applyStatus(t, 'To Do');
    addLog(`Membuka kembali tugas “${t.title}”`);
    commit('Tugas dibuka kembali', 'info');
  } else {
    applyStatus(t, 'Done');
    addLog(`Menyelesaikan tugas “${t.title}”`);
    commit('Tugas diselesaikan — kerja bagus!');
  }
}
function setTaskStatus(id, status) {
  const t = findTask(id);
  if (!t || !STATUSES.includes(status) || t.status === status) return;
  applyStatus(t, status);
  addLog(status === 'Done' ? `Menyelesaikan tugas “${t.title}”` : `Mengubah status “${t.title}” menjadi ${status}`);
  commit(status === 'Done' ? 'Tugas diselesaikan — kerja bagus!' : `Status diubah ke ${status}`, status === 'Done' ? 'success' : 'info');
}
function deleteTask(id) {
  const t = findTask(id);
  if (!t) return;
  confirmBox(`Hapus tugas <b>${esc(t.title)}</b>? Tindakan ini tidak dapat dibatalkan.`, () => {
    state.tasks = state.tasks.filter(x => x.id !== id);
    addLog(`Menghapus tugas “${t.title}”`);
    commit('Tugas dihapus', 'warn');
  });
}
function deleteProject(id) {
  const p = projectById(id);
  if (!p) return;
  const n = state.tasks.filter(t => t.projectId === id).length;
  confirmBox(`Hapus project <b>${esc(p.name)}</b>${n ? ` beserta <b>${n}</b> tugas di dalamnya` : ''}? Tindakan ini tidak dapat dibatalkan.`, () => {
    state.projects = state.projects.filter(x => x.id !== id);
    state.tasks = state.tasks.filter(t => t.projectId !== id);
    if (ui.projectDetail === id) ui.projectDetail = null;
    if (ui.taskProject === id) ui.taskProject = 'all';
    addLog(`Menghapus project “${p.name}”`);
    commit('Project dihapus', 'warn');
  });
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(`taskflow-backup-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
  toast('Backup JSON diunduh', 'info');
}
function exportCSV() {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['ID', 'Judul', 'Deskripsi', 'Project', 'Prioritas', 'Status', 'Deadline', 'Dibuat', 'Selesai'];
  const rows = state.tasks.map(t => [t.id, t.title, t.desc, (projectById(t.projectId) || {}).name || '', t.priority, t.status, t.due, t.createdOn, t.completedOn].map(q).join(','));
  download(`taskflow-tugas-${today()}.csv`, '\ufeff' + [head.map(q).join(','), ...rows].join('\r\n'), 'text/csv;charset=utf-8');
  toast('File CSV diunduh', 'info');
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.tasks) || !Array.isArray(data.projects)) throw new Error('format');
      confirmBox('Data saat ini akan diganti dengan data dari file. Lanjutkan?', () => {
        state = normalize(data);
        addLog('Mengimpor data dari file backup');
        applyTheme();
        commit('Data berhasil diimpor');
      }, 'Impor');
    } catch (err) {
      toast('File tidak valid. Gunakan file JSON hasil ekspor aplikasi ini.', 'error');
    }
  };
  reader.readAsText(file);
}

/* ---------------------------------------------------------- *
 * 12. Event handling (delegasi)
 * ---------------------------------------------------------- */
const closeSidebar = () => { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const id = el.dataset.id;
  if (a === 'close-modal' && el.classList.contains('modal-backdrop') && e.target !== el) return;

  switch (a) {
    case 'close-modal': closeModal(); break;
    case 'new-task': taskModal(null, { due: el.dataset.due, projectId: el.dataset.project, status: el.dataset.status }); break;
    case 'edit-task': { const t = findTask(id); if (t) taskModal(t); break; }
    case 'delete-task': deleteTask(id); break;
    case 'toggle-task': toggleTask(id); break;

    case 'new-project': projectModal(null); break;
    case 'edit-project': { const p = projectById(id); if (p) projectModal(p); break; }
    case 'delete-project': deleteProject(id); break;
    case 'open-project': ui.projectDetail = id; if (currentView() === 'projects') render(); break;
    case 'close-project': ui.projectDetail = null; render(); break;

    case 'daily-prev': ui.dailyDate = addDays(ui.dailyDate, -1); render(); break;
    case 'daily-next': ui.dailyDate = addDays(ui.dailyDate, 1); render(); break;
    case 'daily-today': ui.dailyDate = today(); render(); break;
    case 'daily-goto': ui.dailyDate = el.dataset.date; render(); break;
    case 'toggle-activity': {
      const act = state.activities.find(x => x.id === id);
      if (act) { act.done = !act.done; addLog(`${act.done ? 'Menyelesaikan' : 'Membuka kembali'} aktivitas “${act.text}”`); commit(act.done ? 'Aktivitas selesai' : 'Aktivitas dibuka kembali', act.done ? 'success' : 'info'); }
      break;
    }
    case 'edit-activity': {
      const act = state.activities.find(x => x.id === id);
      if (act) textModal('Edit Aktivitas', 'Aktivitas', act.text, (text, data) => {
        act.text = text; act.minutes = Math.max(0, +data.minutes || 0);
        commit('Aktivitas diperbarui', 'info');
      }, `<label class="field"><span>Durasi (menit)</span><input type="number" name="minutes" min="0" step="5" value="${esc(act.minutes || 0)}"></label>`);
      break;
    }
    case 'edit-goal': {
      const g = state.weeklyGoals.find(x => x.id === id);
      if (g) textModal('Edit Target Mingguan', 'Target', g.text, text => { g.text = text; commit('Target diperbarui', 'info'); });
      break;
    }
    case 'edit-achievement': {
      const ac = state.monthly.achievements.find(x => x.id === id);
      if (ac) textModal('Edit Pencapaian', 'Pencapaian', ac.text, text => { ac.text = text; commit('Pencapaian diperbarui', 'info'); });
      break;
    }
    case 'carry-activities': {
      const from = addDays(ui.dailyDate, -1);
      const have = new Set(state.activities.filter(x => x.date === ui.dailyDate).map(x => x.text.toLowerCase()));
      const todo = state.activities.filter(x => x.date === from && !x.done && !have.has(x.text.toLowerCase()));
      if (!todo.length) { toast('Tidak ada aktivitas belum selesai dari hari sebelumnya', 'info'); break; }
      todo.forEach(x => state.activities.push({ id: uid(), date: ui.dailyDate, text: x.text, minutes: x.minutes, done: false }));
      addLog(`Menyalin ${todo.length} aktivitas dari ${fmtShort(from)}`);
      commit(`${todo.length} aktivitas disalin`);
      break;
    }
    case 'carry-goals': {
      const from = addDays(ui.weekStart, -7);
      const have = new Set(state.weeklyGoals.filter(x => x.weekStart === ui.weekStart).map(x => x.text.toLowerCase()));
      const todo = state.weeklyGoals.filter(x => x.weekStart === from && x.progress < 100 && !have.has(x.text.toLowerCase()));
      if (!todo.length) { toast('Tidak ada target yang belum tercapai dari minggu lalu', 'info'); break; }
      todo.forEach(x => state.weeklyGoals.push({ id: uid(), weekStart: ui.weekStart, text: x.text, progress: x.progress }));
      addLog(`Menyalin ${todo.length} target dari minggu lalu`);
      commit(`${todo.length} target disalin`);
      break;
    }
    case 'reset-filters':
      Object.assign(ui, { taskSearch: '', taskStatus: 'all', taskPriority: 'all', taskProject: 'all' });
      render();
      break;
    case 'clear-done': {
      const n = state.tasks.filter(t => t.status === 'Done').length;
      confirmBox(`Hapus <b>${n}</b> tugas yang sudah selesai? Riwayat penyelesaian di grafik dan laporan ikut hilang.`, () => {
        state.tasks = state.tasks.filter(t => t.status !== 'Done');
        addLog(`Menghapus ${n} tugas selesai`);
        commit(`${n} tugas selesai dihapus`, 'warn');
      });
      break;
    }
    case 'delete-activity': state.activities = state.activities.filter(x => x.id !== id); commit('Aktivitas dihapus', 'warn'); break;

    case 'week-prev': ui.weekStart = addDays(ui.weekStart, -7); render(); break;
    case 'week-next': ui.weekStart = addDays(ui.weekStart, 7); render(); break;
    case 'week-today': ui.weekStart = startOfWeek(today()); render(); break;
    case 'delete-goal': state.weeklyGoals = state.weeklyGoals.filter(x => x.id !== id); commit('Target dihapus', 'warn'); break;

    case 'month-prev': ui.monthKey = shiftMonth(ui.monthKey, -1); render(); break;
    case 'month-next': ui.monthKey = shiftMonth(ui.monthKey, 1); render(); break;
    case 'month-today': ui.monthKey = monthKey(today()); render(); break;
    case 'delete-achievement': state.monthly.achievements = state.monthly.achievements.filter(x => x.id !== id); commit('Pencapaian dihapus', 'warn'); break;

    case 'cal-prev': ui.calKey = shiftMonth(ui.calKey, -1); render(); break;
    case 'cal-next': ui.calKey = shiftMonth(ui.calKey, 1); render(); break;
    case 'cal-today': ui.calKey = monthKey(today()); ui.calSelected = today(); render(); break;
    case 'cal-select': ui.calSelected = el.dataset.date; if (monthKey(ui.calSelected) !== ui.calKey) ui.calKey = monthKey(ui.calSelected); render(); break;

    case 'toggle-theme': state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; applyTheme(); save(); render(); break;
    case 'export-json': exportJSON(); break;
    case 'export-csv': exportCSV(); break;
    case 'import-json': { const f = $('#importFile'); if (f) f.click(); break; }
    case 'print': window.print(); break;
    case 'load-sample':
      confirmBox('Data saat ini akan diganti dengan data contoh. Lanjutkan?', () => {
        state = seed(state.settings); ui.projectDetail = null; commit('Data contoh dimuat', 'info');
      }, 'Muat');
      break;
    case 'reset-data':
      confirmBox('Semua project, tugas, dan catatan akan dihapus permanen. Disarankan ekspor backup terlebih dahulu. Lanjutkan?', () => {
        state = normalize({ settings: state.settings }); ui.projectDetail = null; commit('Semua data dihapus', 'warn');
      }, 'Reset');
      break;
    default: break;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeSidebar(); }
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !$('#modalForm')) {
    const tag = (e.target.tagName || '').toLowerCase();
    if (!['input', 'textarea', 'select'].includes(tag) && !e.target.isContentEditable) { e.preventDefault(); taskModal(null, {}); }
  }
  if (e.key === 'Enter') {
    const card = e.target.closest && e.target.closest('.project-card');
    if (card && e.target === card) { ui.projectDetail = card.dataset.id; render(); }
  }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  switch (form.dataset.form) {
    case 'add-activity': {
      const text = (data.text || '').trim();
      if (!text) return;
      state.activities.push({ id: uid(), date: ui.dailyDate, text, minutes: Math.max(0, +data.minutes || 0), done: false });
      addLog(`Menambahkan aktivitas “${text}”`);
      commit('Aktivitas ditambahkan');
      setTimeout(() => { const f = $('form[data-form="add-activity"] input[name="text"]'); if (f) f.focus(); }, 0);
      break;
    }
    case 'add-goal': {
      const text = (data.text || '').trim();
      if (!text) return;
      state.weeklyGoals.push({ id: uid(), weekStart: ui.weekStart, text, progress: 0 });
      addLog(`Menambahkan target mingguan “${text}”`);
      commit('Target mingguan ditambahkan');
      setTimeout(() => { const f = $('form[data-form="add-goal"] input[name="text"]'); if (f) f.focus(); }, 0);
      break;
    }
    case 'add-achievement': {
      const text = (data.text || '').trim();
      if (!text) return;
      state.monthly.achievements.push({ id: uid(), month: ui.monthKey, text });
      addLog(`Mencatat pencapaian “${text}”`);
      commit('Pencapaian dicatat');
      break;
    }
    case 'set-month-target': {
      const n = Math.round(+data.target);
      if (!(n >= 1)) { toast('Target minimal 1 tugas', 'error'); return; }
      state.monthly.targets[ui.monthKey] = n;
      commit(`Target ${monthLabel(ui.monthKey)} diatur ke ${n} tugas`, 'info');
      break;
    }
    case 'settings': {
      const s = state.settings;
      s.name = (data.name || '').trim() || 'Pengguna';
      s.theme = data.theme === 'dark' ? 'dark' : 'light';
      s.monthlyTarget = Math.max(1, Math.round(+data.monthlyTarget) || 1);
      s.dailyTarget = Math.max(1, Math.round(+data.dailyTarget) || 1);
      applyTheme();
      commit('Pengaturan disimpan');
      break;
    }
    default: break;
  }
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.ui === 'taskSearch') {
    ui.taskSearch = el.value;
    const wrap = $('#taskTableWrap');
    if (wrap) { wrap.innerHTML = taskTable(); icons(); }
  } else if (el.id === 'dailyNote') {
    if (el.value.trim()) state.dailyNotes[ui.dailyDate] = el.value; else delete state.dailyNotes[ui.dailyDate];
    save();
  } else if (el.dataset && el.dataset.change === 'goal-progress') {
    const label = el.nextElementSibling;
    if (label) label.textContent = `${el.value}%`;
  }
});

document.addEventListener('change', e => {
  const el = e.target;
  const kind = el.dataset && el.dataset.change;
  if (kind === 'task-status') { setTaskStatus(el.dataset.id, el.value); return; }
  if (kind === 'daily-date') { if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { ui.dailyDate = el.value; render(); } return; }
  if (kind === 'goal-progress') {
    const g = state.weeklyGoals.find(x => x.id === el.dataset.id);
    if (g) {
      const before = g.progress;
      g.progress = clamp(+el.value || 0, 0, 100);
      if (g.progress >= 100 && before < 100) { addLog(`Mencapai target “${g.text}”`); commit('Target mingguan tercapai! 🎉'); }
      else commit('Progres target diperbarui', 'info');
    }
    return;
  }
  if (el.dataset && el.dataset.ui && el.tagName === 'SELECT') { ui[el.dataset.ui] = el.value; render(); return; }
  if (el.id === 'importFile' && el.files && el.files[0]) { importJSON(el.files[0]); el.value = ''; }
});

/* ---------- Drag & drop kanban ---------- */
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.kcard');
  if (!c) return;
  e.dataTransfer.setData('text/plain', c.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  c.classList.add('dragging');
});
document.addEventListener('dragend', () => {
  $$('.kcard.dragging').forEach(x => x.classList.remove('dragging'));
  $$('.kcol.over').forEach(x => x.classList.remove('over'));
});
document.addEventListener('dragover', e => {
  const col = e.target.closest && e.target.closest('.kcol');
  if (!col) return;
  e.preventDefault();
  $$('.kcol.over').forEach(x => { if (x !== col) x.classList.remove('over'); });
  col.classList.add('over');
});
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('.kcol');
  if (!col) return;
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  col.classList.remove('over');
  if (id) setTaskStatus(id, col.dataset.status);
});

/* ---------- Sidebar mobile & tema ---------- */
$('#menuBtn').addEventListener('click', () => {
  $('#sidebar').classList.toggle('open');
  $('#overlay').classList.toggle('show');
});
$('#overlay').addEventListener('click', closeSidebar);
$('#nav').addEventListener('click', e => { if (e.target.closest('a')) closeSidebar(); });
$('#themeBtn').addEventListener('click', () => {
  state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(); save(); render();
});
window.addEventListener('hashchange', () => { if (currentView() !== 'projects') ui.projectDetail = null; render(); });

/* ---------------------------------------------------------- *
 * 13. Start
 * ---------------------------------------------------------- */
state = load();
save();
applyTheme();
render();

/* sinkronisasi antar-tab: perubahan di tab lain langsung terlihat */
window.addEventListener('storage', e => {
  if (e.key === STORAGE_KEY && e.newValue) {
    try { state = normalize(JSON.parse(e.newValue)); applyTheme(); if (!$('#modalForm')) render(); } catch (err) { /* abaikan */ }
  }
});

/* pengingat saat aplikasi dibuka */
setTimeout(() => {
  const t0 = today();
  const od = state.tasks.filter(isOverdue).length;
  const dueToday = state.tasks.filter(t => t.due === t0 && t.status !== 'Done').length;
  if (od || dueToday) {
    toast(`${dueToday ? `${dueToday} tugas jatuh tempo hari ini` : ''}${dueToday && od ? ' · ' : ''}${od ? `${od} tugas terlambat` : ''}`, od ? 'warn' : 'info');
  }
}, 700);
})();
