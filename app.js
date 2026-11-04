import { BRAND, defaultStages } from './brand.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(3, '0');
const STORE = 'bv_state_v1';
const STAGES = BRAND.stages;
const stageIdx = (k) => STAGES.findIndex((s) => s.key === k);
const stageOf = (k) => STAGES[stageIdx(k)] || STAGES[0];
const nowIso = () => new Date().toISOString();
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const parseDate = (s) => new Date(s + 'T00:00:00');
const fmtDate = (s) => parseDate(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const uid = () => 'i' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
const clone = (o) => JSON.parse(JSON.stringify(o));
const stable = (o) => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1))) : v));
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

const svg = (inner) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const ICON = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
  sliders: svg('<path d="M4 6h8M18 6h2M4 12h2M12 12h8M4 18h10M20 18h0"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  layers: svg('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  grid: svg('<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'),
  star: svg('<path d="m12 3 2.8 6 6.2.6-4.7 4.2 1.5 6.2L12 16.800 6.200 20l1.500-6.200L3 9.600 9.200 9z"/>'),
  sort: svg('<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>'),
};

/* ---------- state ---------- */
const S = {
  ideas: {}, meta: {}, pendingDeletes: [],
  cfg: { ...BRAND.dataRepo, token: '' },
  ui: { view: 'carousel', q: '', stage: '', category: '', priority: '', sort: 'number', sel: null, openStage: null, cal: todayStr().slice(0, 7) },
  sync: { status: 'local', msg: '' },
};

function normalize(i) {
  const d = defaultStages();
  i.stages = i.stages || {};
  for (const k of Object.keys(d)) i.stages[k] = i.stages[k] || d[k];
  i.assets = i.assets || [];
  i.priority = i.priority || 'medium';
  i.publishDate = i.publishDate || '';
  i.notes = i.notes || '';
  i.archived = !!i.archived;
  i.archivedAt = i.archivedAt || '';
  return i;
}

function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(STORE)); } catch { /* start fresh */ }
  if (raw && raw.ideas) {
    S.ideas = raw.ideas; S.meta = raw.meta || {}; S.pendingDeletes = raw.pendingDeletes || [];
    S.cfg = { ...S.cfg, ...raw.cfg };
    S.ui = { ...S.ui, ...raw.ui, sel: null, openStage: null };
  }
  for (const i of Object.values(S.ideas)) normalize(i);
}
function persist() {
  const { view, q, stage, category, priority, sort, cal, filtersOpen } = S.ui;
  try {
    localStorage.setItem(STORE, JSON.stringify({ ideas: S.ideas, meta: S.meta, pendingDeletes: S.pendingDeletes, cfg: S.cfg, ui: { view, q, stage, category, priority, sort, cal, filtersOpen } }));
  } catch { /* storage full or blocked: app still works in memory */ }
}

/* ---------- derived ---------- */
function progress(i) {
  const idx = stageIdx(i.stage);
  const cl = i.stages[i.stage]?.checklist || [];
  const frac = i.stage === 'published' ? 1 : cl.length ? cl.filter((c) => c.done).length / cl.length : 0;
  return Math.min(1, (idx + frac) / (STAGES.length - 1));
}
const PRI_RANK = { high: 0, medium: 1, low: 2 };
function visible() {
  const { q, stage, category, priority, sort } = S.ui;
  const needle = q.trim().toLowerCase();
  const wantArchived = S.ui.view === 'archive';
  let list = Object.values(S.ideas).filter((i) =>
    !!i.archived === wantArchived && (!stage || i.stage === stage) && (!category || i.category === category) && (!priority || i.priority === priority) &&
    (!needle || (i.title + ' ' + i.keywords + ' ' + i.notes).toLowerCase().includes(needle)));
  const by = {
    number: (a, b) => a.no - b.no,
    priority: (a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority] || a.no - b.no,
    date: (a, b) => (a.publishDate || '9999').localeCompare(b.publishDate || '9999') || a.no - b.no,
    stage: (a, b) => stageIdx(b.stage) - stageIdx(a.stage) || a.no - b.no,
    title: (a, b) => a.title.localeCompare(b.title),
  };
  return list.sort(by[sort] || by.number);
}
function nextUp() {
  return Object.values(S.ideas).filter((i) => i.stage !== 'published' && !i.archived).sort((a, b) =>
    PRI_RANK[a.priority] - PRI_RANK[b.priority] ||
    (a.publishDate || '9999').localeCompare(b.publishDate || '9999') ||
    stageIdx(b.stage) - stageIdx(a.stage) || a.no - b.no).slice(0, 3);
}

/* ---------- mutations ---------- */
function touch(id) {
  const i = S.ideas[id]; if (!i) return;
  i.updatedAt = nowIso();
  const m = S.meta[id] || (S.meta[id] = { sha: null, v: 0, dirty: false });
  m.v++; m.dirty = true;
  persist(); queueSync();
}
function setStage(id, key, label = 'Moved') {
  const i = S.ideas[id]; if (!i || i.stage === key) return;
  const prev = i.stage;
  i.stage = key; touch(id);
  toast(`${label} to ${stageOf(key).long}`, () => { i.stage = prev; touch(id); renderAll(); });
  renderAll();
}
function setArchived(id, flag) {
  const i = S.ideas[id]; if (!i) return;
  const prev = { archived: !!i.archived, archivedAt: i.archivedAt };
  i.archived = flag; i.archivedAt = flag ? nowIso() : '';
  if (S.ui.sel === id) S.ui.sel = null;
  touch(id);
  toast(flag ? 'Idea archived' : 'Idea restored to the pipeline', () => { i.archived = prev.archived; i.archivedAt = prev.archivedAt; touch(id); renderAll(); });
  renderAll();
}
function createIdea(f) {
  const no = Object.values(S.ideas).reduce((m, i) => Math.max(m, i.no), 0) + 1;
  const id = uid();
  S.ideas[id] = normalize({
    id, no, title: f.title, keywords: f.keywords, category: f.category, priority: f.priority, publishDate: f.publishDate,
    stage: 'ideas', notes: '', assets: [], stages: {}, createdAt: nowIso(), updatedAt: nowIso(),
  });
  S.meta[id] = { sha: null, v: 0, dirty: false };
  touch(id);
  return id;
}
function deleteIdea(id) {
  const i = S.ideas[id]; if (!i) return;
  const m = S.meta[id];
  const snapshot = clone(i);
  delete S.ideas[id];
  const entry = m?.sha ? { id, sha: m.sha } : null;
  if (entry) S.pendingDeletes.push(entry);
  delete S.meta[id];
  S.ui.sel = null;
  persist(); queueSync(); renderAll();
  toast('Idea deleted', () => {
    S.ideas[id] = snapshot;
    S.pendingDeletes = S.pendingDeletes.filter((p) => p.id !== id);
    S.meta[id] = { sha: entry?.sha || null, v: 1, dirty: true };
    persist(); queueSync(); renderAll();
  });
}

/* ---------- render: icons-free templates ---------- */
function cardHtml(i, variant = '') {
  const st = stageOf(i.stage);
  const late = i.publishDate && i.publishDate < todayStr() && i.stage !== 'published';
  const next = STAGES[stageIdx(i.stage) + 1];
  const pri = BRAND.priorities.find((p) => p.key === i.priority);
  return `<article class="card p-${i.priority} ${i.archived ? 'arch' : ''} ${variant} ${S.ui.sel === i.id ? 'sel' : ''}" data-action="open" data-id="${i.id}" tabindex="0"><span class="dk" aria-hidden="true"></span>
    <div class="card-top"><span class="num">#${pad(i.no)}</span><span class="pri pri-${i.priority}">${esc(pri?.label || '')}</span></div>
    <h3 class="card-title">${esc(i.title)}</h3>
    <div class="meta">${i.archived ? `<span class="tag">Archived${i.archivedAt ? ' · ' + esc(fmtDate(i.archivedAt.slice(0, 10))) : ''}</span>` : ''}${i.category ? `<span class="tag">${esc(i.category)}</span>` : ''}${i.publishDate ? `<span class="tag ${late ? 'overdue' : ''}">${late ? 'Overdue · ' : ''}${esc(fmtDate(i.publishDate))}</span>` : ''}</div>
    <div class="bar" title="Pipeline progress"><i style="width:${Math.round(progress(i) * 100)}%"></i></div>
    <div class="card-foot">
      <span class="stage-pill"><i class="dot s-${st.key}"></i>${esc(st.label)}</span>
      ${i.archived ? `<button class="btn sm" data-action="restore" data-id="${i.id}">Restore</button>` : next ? `<button class="btn sm" data-action="next" data-id="${i.id}">${esc(next.label)} →</button>` : `<button class="btn sm" data-action="archive" data-id="${i.id}">Archive</button>`}
    </div></article>`;
}

function renderDash() {
  const el = $('#dash');
  if (S.ui.view === 'archive') { el.innerHTML = ''; return; }
  const prevScroll = $('#stages')?.scrollLeft || 0;
  const all = Object.values(S.ideas).filter((i) => !i.archived);
  const squares = STAGES.map((s) => {
    const n = all.filter((i) => i.stage === s.key).length;
    return `<button class="sq ${S.ui.stage === s.key ? 'on' : ''}" data-action="stagefilter" data-key="${s.key}" aria-pressed="${S.ui.stage === s.key}"><b>${n}</b><span><i class="dot s-${s.key}"></i>${esc(s.label)}</span></button>`;
  }).join('');
  const [top, ...rest] = nextUp();
  const hero = top ? `<button class="nx hero" data-action="open" data-id="${top.id}">
      <span class="num">#${pad(top.no)}</span>
      <span class="nt"><b>${esc(top.title)}</b><small>${esc(stageOf(top.stage).label)}${top.publishDate ? ' · ' + esc(fmtDate(top.publishDate)) : ''}</small></span><span class="chev" aria-hidden="true">›</span></button>` : '<span class="empty">Nothing in the pipeline.</span>';
  const more = rest.map((i) => `<button class="nm" data-action="open" data-id="${i.id}"><span class="num">#${pad(i.no)}</span><span class="nmt">${esc(i.title)}</span></button>`).join('');
  el.innerHTML = `<div class="stages-wrap"><button class="nav l" data-action="scrollstages" data-dir="-1" aria-label="Scroll stages left">‹</button>
      <div class="stages" id="stages">${squares}</div>
      <button class="nav r" data-action="scrollstages" data-dir="1" aria-label="Scroll stages right">›</button></div>
    <div class="next"><p class="eyebrow">Next up</p>${hero}${more ? `<div class="next-more">${more}</div>` : ''}</div>`;
  const st = $('#stages');
  st.scrollLeft = prevScroll;
  st.parentElement.classList.toggle('has-overflow', st.scrollWidth > st.clientWidth + 2);
}

const VIEWS = [['carousel', 'Carousel'], ['board', 'Board'], ['list', 'List'], ['calendar', 'Calendar'], ['archive', 'Archive']];
function renderChrome() {
  const archivedN = Object.values(S.ideas).filter((i) => i.archived).length;
  $('#views').innerHTML = VIEWS.map(([k, l]) => `<button class="${S.ui.view === k ? 'on' : ''}" data-action="view" data-key="${k}">${l}${k === 'archive' && archivedN ? ' (' + archivedN + ')' : ''}</button>`).join('');
  const opt = (arr, val, all) => `<option value="">${all}</option>` + arr.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const fo = S.ui.filtersOpen !== false;
  const fsel = (key, cls, icon, label, html) => `<label class="fsel ${cls}"><span class="fi">${icon}</span><select data-filter="${key}" aria-label="${label}">${html}</select></label>`;
  $('#filters').innerHTML = `
    <div class="searchbar"><span class="si">${ICON.search}</span>
      <input type="search" id="f-q" data-filter="q" placeholder="Search ideas" value="${esc(S.ui.q)}" aria-label="Search ideas">
      <button class="fbtn ${fo ? 'on' : ''}" data-action="togglefilters" aria-label="Show or hide filters" aria-expanded="${fo}">${ICON.sliders}</button></div>
    ${fo ? `<div class="fgrid">
      ${fsel('stage', 'a1', ICON.layers, 'Stage', opt(STAGES.map((s) => [s.key, s.long]), S.ui.stage, 'All stages'))}
      ${fsel('category', 'a2', ICON.grid, 'Category', opt(BRAND.categories.map((c) => [c, c]), S.ui.category, 'All categories'))}
      ${fsel('priority', 'a3', ICON.star, 'Priority', opt(BRAND.priorities.map((p) => [p.key, p.label]), S.ui.priority, 'Any priority'))}
      ${fsel('sort', 'a4', ICON.sort, 'Sort', opt([['priority', 'Sort: priority'], ['date', 'Sort: publish date'], ['stage', 'Sort: stage'], ['title', 'Sort: title']], S.ui.sort === 'number' ? '' : S.ui.sort, 'Sort: number'))}
    </div>` : ''}`;
}


function setupHero() {
  const c = $('#carousel'); if (!c) return;
  let raf;
  // Each card gets --h from 0 to 1: how close it is to the lead (left) position. CSS blends light to dark from it.
  const mark = () => {
    const rect = c.getBoundingClientRect();
    const kids = [...c.children];
    const span = (kids[0]?.offsetWidth || 300) + 14;
    for (const el of kids) {
      const d = Math.abs(el.getBoundingClientRect().left - rect.left - 2);
      const t = Math.max(0, 1 - d / span);
      el.style.setProperty('--h', (t * t * (3 - 2 * t)).toFixed(3));
    }
  };
  c.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(mark); }, { passive: true });
  mark();
}

function renderView() {
  const list = visible();
  const el = $('#view');
  const v = S.ui.view;
  if (v === 'carousel') {
    el.innerHTML = list.length
      ? `<div class="carousel-wrap"><button class="nav l" data-action="scroll" data-dir="-1" aria-label="Previous">‹</button>
         <div class="carousel" id="carousel">${list.map((i) => cardHtml(i)).join('')}</div>
         <button class="nav r" data-action="scroll" data-dir="1" aria-label="Next">›</button></div>
         <p class="count">${list.length} of ${Object.keys(S.ideas).length} ideas</p>`
      : emptyHtml();
  } else if (v === 'archive') {
    el.innerHTML = list.length
      ? `<p class="eyebrow">Archived ideas · hidden from the other views</p>
         <div class="carousel-wrap"><button class="nav l" data-action="scroll" data-dir="-1" aria-label="Previous">‹</button>
         <div class="carousel" id="carousel">${list.map((i) => cardHtml(i)).join('')}</div>
         <button class="nav r" data-action="scroll" data-dir="1" aria-label="Next">›</button></div>
         <p class="count">${list.length} archived</p>`
      : `<div class="panel"><h3>Nothing archived</h3><p class="desc">Archive finished or old ideas to keep your pipeline clear. They stay here, searchable, and can be restored any time.</p></div>`;
  } else if (v === 'board') {
    el.innerHTML = `<div class="board">${STAGES.map((s) => {
      const items = list.filter((i) => i.stage === s.key);
      return `<div class="col"><h4><i class="dot s-${s.key}"></i>${esc(s.label)}<small>${items.length}</small></h4>${items.map((i) => cardHtml(i, 'compact')).join('') || '<div class="empty">No ideas here.</div>'}</div>`;
    }).join('')}</div>`;
  } else if (v === 'list') {
    el.innerHTML = list.length ? `<div class="list">${list.map((i) => {
      const st = stageOf(i.stage);
      return `<button class="row p-${i.priority}" data-action="open" data-id="${i.id}">
        <span class="rt">#${pad(i.no)} · ${esc(i.title)}</span>
        <span class="rr"><i class="dot s-${st.key}"></i>${esc(st.label)}</span>
        <span class="rs"><span class="pri pri-${i.priority}">${esc(i.priority)}</span>${i.category ? `<span>${esc(i.category)}</span>` : ''}${i.publishDate ? `<span>${esc(fmtDate(i.publishDate))}</span>` : ''}</span>
        <span class="rs" style="justify-content:flex-end">${Math.round(progress(i) * 100)}%</span></button>`;
    }).join('')}</div>` : emptyHtml();
  } else {
    el.innerHTML = calendarHtml(list);
  }
  setupHero();
}
const emptyHtml = () => Object.keys(S.ideas).length
  ? `<div class="panel"><h3>No ideas match</h3><p class="desc">Clear the filters or add a new idea.</p></div>`
  : `<div class="panel"><h3>Start your pipeline</h3><p class="desc">Add your first idea, or connect your data repo to load your ideas from GitHub.</p>
     <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-action="new">Add idea</button><button class="btn" data-action="settings">Connect GitHub</button></div></div>`;

function calendarHtml(list) {
  const [y, m] = S.ui.cal.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const t = todayStr();
  const cells = [];
  for (let n = 0; n < 42; n++) {
    const d = new Date(start); d.setDate(start.getDate() + n);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const evs = list.filter((i) => i.publishDate === ds);
    cells.push(`<div class="day ${d.getMonth() !== m - 1 ? 'out' : ''} ${ds === t ? 'today' : ''}"><span class="dn">${d.getDate()}</span>${evs.map((i) => `<button class="ev" data-action="open" data-id="${i.id}" title="${esc(i.title)}"><i class="dot s-${i.stage}"></i><span>${esc(i.title)}</span></button>`).join('')}</div>`);
    if (n >= 34 && d.getMonth() !== m - 1 && d.getDay() === 6) break;
  }
  const un = list.filter((i) => !i.publishDate && i.stage !== 'published');
  const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  return `<div class="cal-head"><button class="btn sm" data-action="calnav" data-dir="-1">‹ Prev</button><h3>${esc(label)}</h3><button class="btn sm" data-action="calnav" data-dir="1">Next ›</button></div>
    <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>
    <div class="unsched"><p class="eyebrow">Unscheduled (${un.length})</p><div class="list">${un.map((i) => `<button class="row" data-action="open" data-id="${i.id}"><span class="rt">#${pad(i.no)} · ${esc(i.title)}</span><span class="rr"><i class="dot s-${i.stage}"></i>${esc(stageOf(i.stage).label)}</span></button>`).join('') || '<div class="empty">Every open idea has a date.</div>'}</div></div>`;
}

/* ---------- idea workspace sheet ---------- */
function renderSheet() {
  const el = $('#sheet');
  const i = S.ideas[S.ui.sel];
  const open = !!i;
  $('#scrim').classList.toggle('open', open);
  el.classList.toggle('open', open);
  if (!i) return;
  const top = el.scrollTop;
  const cur = stageIdx(i.stage);
  const viewKey = S.ui.openStage || i.stage;
  const vs = stageOf(viewKey);
  const ws = i.stages[viewKey];
  const done = ws.checklist.filter((c) => c.done).length;
  const opts = (arr, val) => arr.map(([v, l]) => `<option value="${esc(v)}" ${val === v ? 'selected' : ''}>${esc(l)}</option>`).join('');
  el.innerHTML = `
    <div class="sh-head"><div class="t"><span class="num">#${pad(i.no)}</span>${i.archived ? ' <span class="tag">Archived</span>' : ''}<h2>${esc(i.title)}</h2></div>
      <button class="btn icon" data-action="close" aria-label="Close">×</button></div>
    <div class="sh-body">
      <div class="steps" role="tablist">${STAGES.map((s, n) => `<button class="step ${n < cur ? 'done' : ''} ${n === cur ? 'cur' : ''} ${s.key === viewKey ? 'view' : ''}" data-action="viewstage" data-key="${s.key}" role="tab" aria-selected="${s.key === viewKey}">
        <b>${n < cur ? '✓' : n + 1}</b>${esc(s.label)}</button>`).join('')}</div>

      <section class="panel">
        <div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap">
          <h3>${esc(vs.long)}${viewKey === i.stage ? ' · current' : ''}</h3>
          <span class="prog">${done}/${ws.checklist.length} done</span></div>
        <p class="desc">${esc(vs.desc)}</p>
        <div>${ws.checklist.map((c) => `<div class="chk ${c.done ? 'done' : ''}"><input type="checkbox" id="c-${c.id}" data-action="toggle" data-cid="${c.id}" ${c.done ? 'checked' : ''}><label for="c-${c.id}">${esc(c.t)}</label><button class="x" data-action="delitem" data-cid="${c.id}" aria-label="Remove item">×</button></div>`).join('') || '<div class="empty">No checklist items.</div>'}</div>
        <div class="add-row"><input id="new-item" placeholder="Add checklist item" aria-label="New checklist item"><button class="btn" data-action="additem">Add</button></div>
        <div class="field"><label for="stage-notes">${esc(vs.label)} notes</label><textarea id="stage-notes" data-field="stagenotes" placeholder="Workshop this stage: drafts, outline, shot list…">${esc(ws.notes)}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${viewKey !== i.stage ? `<button class="btn" data-action="setstage" data-key="${viewKey}">Make current stage</button>` : ''}
          ${viewKey === i.stage && cur < STAGES.length - 1 ? `<button class="btn primary" data-action="next" data-id="${i.id}">Next stage: ${esc(STAGES[cur + 1].label)} →</button>` : ''}
        </div>
      </section>

      <section class="panel">
        <h3>Links and assets</h3>
        <div>${i.assets.map((a, n) => { const u = safeUrl(a.url); return `<div class="asset"><span class="ty">${esc(a.type)}</span>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.name || u)}</a>` : `<span>${esc(a.name || a.url)}</span>`}<span class="sp"></span><button class="x btn sm ghost" data-action="delasset" data-n="${n}" aria-label="Remove asset">×</button></div>`; }).join('') || '<div class="empty">No links yet.</div>'}</div>
        <div class="add-row"><select id="a-type" aria-label="Asset type">${BRAND.assetTypes.map((t) => `<option>${esc(t)}</option>`).join('')}</select><input id="a-url" type="url" placeholder="https://…" aria-label="Link URL"><button class="btn" data-action="addasset">Add</button></div>
      </section>

      <section class="panel">
        <h3>Details</h3>
        <div class="field"><label for="d-title">Title</label><input id="d-title" data-field="title" value="${esc(i.title)}"></div>
        <div class="field"><label for="d-kw">Keywords</label><input id="d-kw" data-field="keywords" value="${esc(i.keywords)}"></div>
        <div class="grid2">
          <div class="field"><label for="d-cat">Category</label><select id="d-cat" data-field="category"><option value="">None</option>${opts(BRAND.categories.map((c) => [c, c]), i.category)}</select></div>
          <div class="field"><label for="d-pri">Priority</label><select id="d-pri" data-field="priority">${opts(BRAND.priorities.map((p) => [p.key, p.label]), i.priority)}</select></div>
          <div class="field"><label for="d-date">Target publish date</label><input id="d-date" type="date" data-field="publishDate" value="${esc(i.publishDate)}"></div>
          <div class="field"><label for="d-stage">Current stage</label><select id="d-stage" data-field="stage">${opts(STAGES.map((s) => [s.key, s.long]), i.stage)}</select></div>
        </div>
        <div class="field"><label for="d-notes">Production notes</label><textarea id="d-notes" data-field="notes" placeholder="Recipe variables, reminders…">${esc(i.notes)}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${i.archived ? `<button class="btn" data-action="restore" data-id="${i.id}">Restore to pipeline</button>` : `<button class="btn" data-action="archive" data-id="${i.id}">Archive idea</button>`}<button class="btn danger" data-action="delete" data-id="${i.id}">Delete idea</button></div>
      </section>
    </div>`;
  el.scrollTop = top;
}

function renderAll() { renderDash(); renderChrome(); renderView(); renderSheet(); renderSync(); }
const renderMainSoon = debounce(() => { renderDash(); renderView(); }, 250);

/* ---------- toast + modal ---------- */
let toastTimer;
function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-action="undo">Undo</button>' : ''}`;
  t._undo = undo || null;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 3000);
}
function openModal(html) { const m = $('#modal'); m.innerHTML = `<div class="mbox">${html}</div>`; m.classList.add('open'); }
function closeModal() { $('#modal').classList.remove('open'); }

function newIdeaModal() {
  openModal(`<h2>New video idea</h2>
    <div class="field"><label for="n-title">Working title</label><input id="n-title" placeholder="3 quick Bambino milk frothing hacks"></div>
    <div class="field"><label for="n-kw">Keywords (comma separated)</label><input id="n-kw" placeholder="milk steaming, Bambino"></div>
    <div class="grid2">
      <div class="field"><label for="n-cat">Category</label><select id="n-cat"><option value="">None</option>${BRAND.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="n-pri">Priority</label><select id="n-pri">${BRAND.priorities.map((p) => `<option value="${p.key}" ${p.key === 'medium' ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label for="n-date">Target publish date (optional)</label><input id="n-date" type="date"></div>
    <p id="n-err" class="err"></p>
    <div class="btns"><button class="btn ghost" data-action="closemodal">Cancel</button><button class="btn primary" data-action="createidea">Create idea</button></div>`);
  setTimeout(() => $('#n-title')?.focus(), 50);
}

function settingsModal() {
  const c = S.cfg;
  openModal(`<h2>Sync and data</h2>
    <p>Changes save on this device first, then sync to your private GitHub data repo. Paste a fine-grained token (Contents: read and write, this one repo). It stays on this device.</p>
    <div class="grid2">
      <div class="field"><label for="s-owner">Owner</label><input id="s-owner" value="${esc(c.owner)}" autocapitalize="off"></div>
      <div class="field"><label for="s-repo">Data repo</label><input id="s-repo" value="${esc(c.repo)}" autocapitalize="off"></div>
    </div>
    <div class="field"><label for="s-branch">Branch</label><input id="s-branch" value="${esc(c.branch)}" autocapitalize="off"></div>
    <div class="field"><label for="s-token">Access token</label><input id="s-token" type="password" autocomplete="off" placeholder="${c.token ? 'Saved on this device (leave blank to keep)' : 'github_pat_…'}"></div>
    <p id="s-msg" class="err"></p>
    <div class="btns">
      <button class="btn" data-action="export">Export backup</button>
      <label class="btn" style="cursor:pointer">Import old backup<input type="file" id="s-import" accept=".json" hidden></label>
      ${c.token ? '<button class="btn danger" data-action="disconnect">Disconnect</button>' : ''}
    </div>
    <div class="btns"><button class="btn ghost" data-action="closemodal">Close</button><button class="btn primary" data-action="saveconn">Save and sync</button></div>`);
}

/* ---------- events ---------- */
const A = {
  open: (el) => { S.ui.sel = el.dataset.id; S.ui.openStage = null; renderAll(); },
  close: () => { S.ui.sel = null; renderAll(); },
  next: (el) => { const i = S.ideas[el.dataset.id]; const n = STAGES[stageIdx(i.stage) + 1]; if (n) { S.ui.openStage = n.key; setStage(i.id, n.key); } },
  setstage: (el) => { S.ui.openStage = el.dataset.key; setStage(S.ui.sel, el.dataset.key); },
  viewstage: (el) => { S.ui.openStage = el.dataset.key; renderSheet(); },
  view: (el) => { S.ui.view = el.dataset.key; persist(); renderAll(); },
  stagefilter: (el) => { S.ui.stage = S.ui.stage === el.dataset.key ? '' : el.dataset.key; persist(); renderAll(); },
  togglefilters: () => { S.ui.filtersOpen = S.ui.filtersOpen === false; persist(); renderChrome(); },
  scrollstages: (el) => { $('#stages')?.scrollBy({ left: Number(el.dataset.dir) * 200, behavior: 'smooth' }); },
  scroll: (el) => { const c = $('#carousel'); c?.scrollBy({ left: Number(el.dataset.dir) * 350 }); },
  calnav: (el) => { const [y, m] = S.ui.cal.split('-').map(Number); const d = new Date(y, m - 1 + Number(el.dataset.dir), 1); S.ui.cal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; persist(); renderView(); },
  archive: (el) => setArchived(el.dataset.id, true),
  restore: (el) => setArchived(el.dataset.id, false),
  new: newIdeaModal,
  settings: settingsModal,
  closemodal: closeModal,
  sync: () => { if (!S.cfg.token) settingsModal(); else sync(true); },
  undo: () => { const t = $('#toast'); const fn = t._undo; t.classList.remove('show'); t._undo = null; fn?.(); },
  toggle: (el) => { const c = S.ideas[S.ui.sel].stages[S.ui.openStage || S.ideas[S.ui.sel].stage].checklist.find((x) => x.id === el.dataset.cid); if (c) { c.done = el.checked; touch(S.ui.sel); renderAll(); } },
  delitem: (el) => { const ws = S.ideas[S.ui.sel].stages[S.ui.openStage || S.ideas[S.ui.sel].stage]; ws.checklist = ws.checklist.filter((x) => x.id !== el.dataset.cid); touch(S.ui.sel); renderAll(); },
  additem: () => addItem(),
  addasset: () => {
    const url = $('#a-url').value.trim();
    if (!safeUrl(url)) { toast('Enter a valid http(s) link'); return; }
    S.ideas[S.ui.sel].assets.push({ type: $('#a-type').value, name: '', url });
    touch(S.ui.sel); renderAll();
  },
  delasset: (el) => { S.ideas[S.ui.sel].assets.splice(Number(el.dataset.n), 1); touch(S.ui.sel); renderAll(); },
  delete: (el) => {
    const i = S.ideas[el.dataset.id];
    openModal(`<h2>Delete idea?</h2><p>“${esc(i.title)}” will be removed from all your devices. You can undo right after.</p>
      <div class="btns"><button class="btn ghost" data-action="closemodal">Cancel</button><button class="btn danger" data-action="confirmdelete" data-id="${i.id}">Delete</button></div>`);
  },
  confirmdelete: (el) => { closeModal(); deleteIdea(el.dataset.id); },
  createidea: () => {
    const title = $('#n-title').value.trim();
    if (!title) { $('#n-err').textContent = 'Enter a working title.'; return; }
    const id = createIdea({ title, keywords: $('#n-kw').value.trim(), category: $('#n-cat').value, priority: $('#n-pri').value, publishDate: $('#n-date').value });
    closeModal(); S.ui.sel = id; S.ui.openStage = null; renderAll(); toast('Idea added');
  },
  saveconn: async () => {
    const msg = $('#s-msg');
    const cfg = { owner: $('#s-owner').value.trim(), repo: $('#s-repo').value.trim(), branch: $('#s-branch').value.trim() || 'main' };
    const tok = $('#s-token').value.trim();
    S.cfg = { ...S.cfg, ...cfg, token: tok || S.cfg.token };
    if (!S.cfg.token) { msg.textContent = 'Paste an access token to sync.'; return; }
    persist(); msg.textContent = 'Connecting…';
    const ok = await sync(true);
    if (ok) closeModal(); else msg.textContent = S.sync.msg || 'Could not sync.';
  },
  disconnect: () => { S.cfg.token = ''; S.sync = { status: 'local', msg: '' }; persist(); closeModal(); renderSync(); toast('Disconnected. Data stays on this device.'); },
  export: () => {
    const blob = new Blob([JSON.stringify(Object.values(S.ideas), null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `brevista-ideas-${todayStr()}.json` });
    document.body.appendChild(a); a.click(); a.remove();
  },
};

function addItem() {
  const inp = $('#new-item'); const t = inp.value.trim(); if (!t) return;
  const i = S.ideas[S.ui.sel];
  i.stages[S.ui.openStage || i.stage].checklist.push({ id: uid(), t, done: false });
  touch(i.id); renderAll(); setTimeout(() => $('#new-item')?.focus(), 0);
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // handled on change
  e.stopPropagation();
  A[el.dataset.action]?.(el, e);
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.matches('input[type=checkbox][data-action="toggle"]')) return A.toggle(el);
  if (el.id === 's-import') return importBackup(el.files[0]);
  if (el.dataset.filter) { S.ui[el.dataset.filter] = el.value || (el.dataset.filter === 'sort' ? 'number' : ''); persist(); renderAll(); return; }
  if (el.dataset.field) fieldChange(el);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.filter === 'q') { S.ui.q = el.value; persist(); renderView(); return; }
  if (el.dataset.field && (el.tagName === 'TEXTAREA' || el.type === 'text')) fieldChange(el, true);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if ($('#modal').classList.contains('open')) closeModal(); else if (S.ui.sel) A.close(); }
  if (e.key === 'Enter' && e.target.id === 'new-item') { e.preventDefault(); addItem(); }
  if (e.key === 'Enter' && e.target.matches?.('.card[data-action="open"]')) A.open(e.target);
});

function fieldChange(el, typing = false) {
  const i = S.ideas[S.ui.sel]; if (!i) return;
  const f = el.dataset.field;
  if (f === 'stagenotes') i.stages[S.ui.openStage || i.stage].notes = el.value;
  else if (f === 'stage') { setStage(i.id, el.value); S.ui.openStage = null; renderSheet(); return; }
  else if (f === 'title') { if (!el.value.trim()) return; i[f] = el.value; $('#sheet h2').textContent = el.value; }
  else i[f] = el.value;
  touch(i.id);
  if (typing) renderMainSoon(); else renderAll();
}

function importBackup(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const arr = JSON.parse(r.result);
      if (!Array.isArray(arr)) throw new Error('not a list');
      let n = 0;
      for (const o of arr) {
        if (!o || !o.title) continue;
        const id = String(o.id).length && /^\d+$/.test(String(o.id)) ? pad(o.id) : o.id || uid();
        const ex = S.ideas[id] || (S.ideas[id] = normalize({ id, no: Number(o.no ?? o.id) || Object.keys(S.ideas).length + 1, title: o.title, keywords: '', category: '', priority: 'medium', stage: 'ideas', createdAt: nowIso() }));
        ex.title = o.title; ex.keywords = o.keywords ?? ex.keywords; ex.notes = o.notes ?? ex.notes;
        if (stageIdx(o.status) >= 0) ex.stage = o.status; else if (stageIdx(o.stage) >= 0) ex.stage = o.stage;
        for (const [k, t] of [['linkScript', 'Script'], ['linkSlideDeck', 'Slides / teleprompter'], ['linkSuggestions', 'Thumbnail / hooks']]) {
          if (o[k] && !ex.assets.some((a) => a.url === o[k])) ex.assets.push({ type: t, name: '', url: o[k] });
        }
        if (Array.isArray(o.assets)) ex.assets = o.assets;
        touch(id); n++;
      }
      closeModal(); renderAll(); toast(`Imported ${n} ideas`);
    } catch { $('#s-msg').textContent = 'That file is not a valid backup.'; }
  };
  r.readAsText(file);
}

/* ---------- GitHub sync ---------- */
const base = () => `/repos/${encodeURIComponent(S.cfg.owner)}/${encodeURIComponent(S.cfg.repo)}`;
const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
async function gh(path, { method = 'GET', body, raw = false } = {}) {
  return fetch('https://api.github.com' + path, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${S.cfg.token}`, Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}
const filePath = (id) => `ideas/${encodeURIComponent(id)}.json`;
const q = () => `?ref=${encodeURIComponent(S.cfg.branch)}`;
const body = (i) => JSON.stringify(i, null, 2) + '\n';

let syncing = false, again = false;
const queueSync = debounce(() => sync(), 1500);

async function sync(manual = false) {
  if (!S.cfg.token) { setSync('local'); return false; }
  if (!navigator.onLine) { setSync('offline'); return false; }
  if (syncing) { again = true; return false; }
  syncing = true; setSync('syncing');
  try {
    // 1. deletions made on this device
    for (const p of [...S.pendingDeletes]) {
      const r = await gh(`${base()}/contents/${filePath(p.id)}`, { method: 'DELETE', body: { message: `Delete idea ${p.id}`, sha: p.sha, branch: S.cfg.branch } });
      if (r.ok || r.status === 404 || r.status === 409 || r.status === 422) S.pendingDeletes = S.pendingDeletes.filter((x) => x.id !== p.id);
      else throw await httpError(r);
    }
    // 2. what is on GitHub
    const lr = await gh(`${base()}/contents/ideas${q()}`);
    let remote = [];
    if (lr.status === 404) {
      const rr = await gh(`${base()}`);
      if (!rr.ok) throw await httpError(rr);
    } else if (!lr.ok) throw await httpError(lr);
    else remote = (await lr.json()).filter((f) => f.type === 'file' && f.name.endsWith('.json'));
    const remoteIds = new Set(remote.map((f) => decodeURIComponent(f.name.slice(0, -5))));

    // 3. pull changed files, resolving conflicts by newest edit
    const pulls = remote.filter((f) => {
      const id = decodeURIComponent(f.name.slice(0, -5));
      return S.meta[id]?.sha !== f.sha;
    });
    await Promise.all(pulls.map(async (f) => {
      const id = decodeURIComponent(f.name.slice(0, -5));
      const r = await gh(`${base()}/contents/${filePath(id)}${q()}`, { raw: true });
      if (!r.ok) throw await httpError(r);
      const text = await r.text();
      let ri; try { ri = normalize(JSON.parse(text)); } catch { return; }
      const m = S.meta[id], li = S.ideas[id];
      if (m?.dirty && li) {
        if (stable(li) === stable(ri)) { m.dirty = false; m.sha = f.sha; }
        else if ((li.updatedAt || '') >= (ri.updatedAt || '')) m.sha = f.sha; // keep ours, push over theirs
        else { S.ideas[id] = ri; S.meta[id] = { sha: f.sha, v: m.v, dirty: false }; }
      } else { S.ideas[id] = ri; S.meta[id] = { sha: f.sha, v: m?.v || 0, dirty: false }; }
    }));
    // 4. removed on another device
    for (const id of Object.keys(S.ideas)) {
      const m = S.meta[id];
      if (m?.sha && !m.dirty && !remoteIds.has(id)) { delete S.ideas[id]; delete S.meta[id]; if (S.ui.sel === id) S.ui.sel = null; }
    }
    // 5. push local edits
    for (const [id, m] of Object.entries(S.meta)) {
      if (!m.dirty || !S.ideas[id]) continue;
      await pushOne(id);
    }
    persist(); setSync('synced');
    if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) renderAll(); else { renderDash(); renderView(); }
    return true;
  } catch (err) {
    S.sync.msg = err.message || 'Sync failed';
    setSync(navigator.onLine ? 'error' : 'offline');
    if (manual) toast(S.sync.msg);
    return false;
  } finally {
    syncing = false;
    if (again) { again = false; queueSync(); }
  }
}

async function pushOne(id, retry = true) {
  const i = S.ideas[id], m = S.meta[id];
  const v = m.v;
  const r = await gh(`${base()}/contents/${filePath(id)}`, {
    method: 'PUT',
    body: { message: `Update #${pad(i.no)}: ${i.title}`.slice(0, 120), content: b64(body(i)), branch: S.cfg.branch, ...(m.sha ? { sha: m.sha } : {}) },
  });
  if (r.ok) { const j = await r.json(); m.sha = j.content.sha; if (m.v === v) m.dirty = false; return; }
  if ((r.status === 409 || r.status === 422) && retry) {
    const g = await gh(`${base()}/contents/${filePath(id)}${q()}`);
    if (g.status === 404) { m.sha = null; return pushOne(id, false); }
    if (g.ok) {
      const meta = await g.json();
      const rr = await gh(`${base()}/contents/${filePath(id)}${q()}`, { raw: true });
      let ri; try { ri = normalize(JSON.parse(await rr.text())); } catch { ri = null; }
      if (ri && (ri.updatedAt || '') > (i.updatedAt || '')) { S.ideas[id] = ri; S.meta[id] = { sha: meta.sha, v: m.v, dirty: false }; return; }
      m.sha = meta.sha; return pushOne(id, false);
    }
  }
  throw await httpError(r);
}
async function httpError(r) {
  let detail = ''; try { detail = (await r.json()).message || ''; } catch { /* no body */ }
  if (r.status === 401) return new Error('GitHub rejected the token. Paste a new one.');
  if (r.status === 403 || r.status === 404) return new Error(`GitHub says no access to ${S.cfg.owner}/${S.cfg.repo} (${r.status}). Check the repo name and token permissions.`);
  return new Error(`GitHub error ${r.status}${detail ? ': ' + detail : ''}`);
}

function setSync(status) { S.sync.status = status; renderSync(); }
function renderSync() {
  const chip = $('#sync-chip'); if (!chip) return;
  const dirty = Object.values(S.meta).some((m) => m.dirty) || S.pendingDeletes.length;
  const label = { local: 'Local only', syncing: 'Syncing…', synced: dirty ? 'Saved here' : 'Synced', error: 'Sync error', offline: 'Offline' }[S.sync.status];
  chip.dataset.s = S.sync.status;
  $('#sync-text').textContent = label;
  chip.title = S.sync.msg || label;
}

/* ---------- boot ---------- */
load();
renderAll();
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost') navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('online', () => sync());
window.addEventListener('offline', () => setSync('offline'));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); });
setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60000);
if (S.cfg.token) sync();
