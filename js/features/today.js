/* شاشة "اليوم": الهيرو، التقدم، شريط الأيام، المهام، والإضافة السريعة */
import { $, $$, html, raw, render, today, addDays, rel, dlong, fmtHM, fmtT, dur, haptic, parse, DAYS_S, toMin, pad, fmt } from '../core/util.js';
import * as store from '../core/store.js';
import * as P from '../core/prayer.js';
import { parseQuick } from '../core/quick.js';
import { arcSVG, skyOf, sceneSVG } from '../ui/arc.js';
import { sheet, closeSheet, toast, sw } from '../ui/ui.js';
import { upcomingEvents } from './events.js';

let sel = today(), root, lastAdded = null, heroSig = '';

export const getSel = () => sel;
export function setSel(d) { sel = d; if (root) { renderDates(); renderTasks(); renderProg(); } }

export function mount(el) {
  root = el;
  render(el, html`
    <div class="cols"><div class="hero" id="hero"></div>
    <div id="banner"></div>
    <div class="card" id="prog"></div></div>
    <div class="cols"><div class="dates" id="dates" role="group" aria-label="الأيام"></div>
    <ul class="tasks" id="tasks"></ul>
    <form class="composer" id="composer" autocomplete="off">
      <input id="q" type="text" enterkeyhint="done" placeholder="اكتب مهمة… مثلاً: اجتماع بكرة 5م" aria-label="مهمة جديدة">
      <div class="hint" id="qhint"></div>
      <div class="row"><button type="button" class="btn sec sm" data-act="detail">تفاصيل</button><span class="grow"></span><button class="btn sm" type="submit">ضيف</button></div>
    </form></div>`);
  el.addEventListener('click', onClick);
  $('#composer', el).addEventListener('submit', onSubmit);
  $('#q', el).addEventListener('input', hint);
  render_all();
}
function render_all() { renderHero(true); renderBanner(); renderDates(); renderTasks(); renderProg(); }
export { render_all as renderAll };

/* ---------- الهيرو ---------- */
function greet(h, name) {
  const g = h < 5 ? 'سهران يا' : h < 12 ? 'صباح الخير يا' : h < 17 ? 'نهارك سعيد يا' : 'مساء الخير يا';
  return name ? `${g} ${name}` : g.replace(/ يا$/, '');
}
export function renderHero(force) {
  const el = $('#hero'); if (!el) return;
  const now = new Date(), s = store.settings(), t = P.timesFor(today(), s);
  const { cur, next } = P.nowNext(now, s);
  const st = P.dayMap(today());
  const sky = skyOf(now, t);
  const sig = [sky, Math.round(now / 60000), next && next.id, JSON.stringify(st), s.name, s.city].join('|');
  if (!force && sig === heroSig) return; heroSig = sig;
  el.dataset.sky = sky;
  const left = next ? Math.max(0, Math.round((next.start - now) / 60000)) : 0;
  render(el, html`
    <div class="hi">${greet(now.getHours(), s.name)}</div>
    <div class="meta">${dlong(today())} · ${P.cityName(s.city)}</div>
    ${sceneSVG()}${arcSVG(now, t, st)}
    <div class="next"><b>${cur ? `دلوقتي وقت ${cur.name}` : ''}${cur && next ? ' · ' : ''}${next ? `${next.name} ${fmtT(next.start)}` : ''}</b><span class="num">${next ? `بعد ${dur(left)}` : ''}</span></div>`);
}

function renderBanner() {
  const el = $('#banner'); if (!el) return;
  const ev = upcomingEvents(5);
  render(el, ev.length ? html`${ev.map(e => html`<div class="card flat row" style="border-color:var(--lamp)"><span style="font-size:22px">🎂</span><div class="grow"><b>${e.name}</b><div class="sub">${e.days === 0 ? 'النهارده!' : e.days === 1 ? 'بكرة' : `بعد ${e.days} أيام`}</div></div></div>`)}` : '');
}

/* ---------- التقدم ---------- */
function dayTasks(d) { return store.list('task').filter(t => t.date === d); }
export function renderProg() {
  const el = $('#prog'); if (!el) return;
  const ts = dayTasks(sel), done = ts.filter(t => t.status === 'done').length, tot = ts.length;
  const pct = tot ? Math.round(done / tot * 100) : 0;
  const other = ts.filter(t => t.status === 'cancelled' || t.status === 'postponed').length;
  render(el, html`<div class="prog">
    <div class="ring num" id="ring" data-t="${pct}%" style="--p:0" role="img" aria-label="${pct}% اتنجز"></div>
    <div class="grow"><div class="lbl" style="margin-bottom:6px">إنجاز ${rel(sel)}</div>
      <div class="stats num"><div class="stat ok"><b>${done}</b><span>تمت</span></div><div class="stat"><b>${tot - done - other}</b><span>باقي</span></div><div class="stat warn"><b>${other}</b><span>مؤجلة/ملغية</span></div></div></div></div>`);
  requestAnimationFrame(() => requestAnimationFrame(() => { const r = $('#ring'); if (r) r.style.setProperty('--p', pct); }));
}

/* ---------- شريط الأيام ---------- */
export function renderDates() {
  const el = $('#dates'); if (!el) return;
  const t0 = today(), all = store.list('task');
  const days = Array.from({ length: 16 }, (_, i) => addDays(t0, i - 1));
  if (!days.includes(sel)) days.push(sel), days.sort();
  render(el, days.map(d => {
    const has = all.some(t => t.date === d && t.status === 'pending');
    return html`<button class="dchip" data-act="day" data-d="${d}" aria-pressed="${d === sel ? 'true' : 'false'}">${has ? raw('<i class="dot"></i>') : ''}${d === t0 ? 'النهارده' : DAYS_S[parse(d).getDay()]}<b class="num">${parse(d).getDate()}</b></button>`;
  }));
  const on = $('[aria-pressed=true]', el); if (on) el.scrollTo({ left: on.offsetLeft - el.clientWidth / 2 + on.offsetWidth / 2, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
}

/* ---------- المهام ---------- */
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || a.title.localeCompare(b.title, 'ar');
export function renderTasks() {
  const el = $('#tasks'); if (!el) return;
  const ts = dayTasks(sel).sort(byTime), now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
  if (!ts.length) {
    render(el, html`<li class="empty"><b>${sel === today() ? 'اليوم فاضي' : `مفيش مهام ${rel(sel)}`}</b>اكتب أول مهمة تحت. اكتب الوقت واليوم جوّه الجملة وهو هيفهمهم.</li>`);
    return;
  }
  render(el, ts.map(t => {
    const late = t.status === 'pending' && t.time && (sel < today() || (sel === today() && toMin(t.time) < nowM - 1));
    return html`<li class="task ${t.id === lastAdded ? 'new' : ''}" data-s="${t.status}" data-id="${t.id}">
      <button class="check" data-act="toggle" aria-label="${t.status === 'done' ? 'رجّعها معلّقة' : 'علّمها تمت'}: ${t.title}"><span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></button>
      <div class="grow"><div class="tt">${t.title}</div>
        <div class="tm num">${t.time ? html`<span>${fmtHM(t.time)}</span>` : ''}${t.far ? html`<span class="tag far">مشوار بعيد</span>` : ''}${late ? html`<span class="tag late">فاتت</span>` : ''}${t.status === 'cancelled' ? html`<span class="tag">اتلغت</span>` : ''}${t.status === 'postponed' ? html`<span class="tag">اتأجلت</span>` : ''}</div></div>
      <button class="more" data-act="menu" aria-label="خيارات ${t.title}">⋯</button></li>`;
  }));
  lastAdded = null;
}

function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('[data-id]') && b.closest('[data-id]').dataset.id;
  switch (b.dataset.act) {
    case 'day': setSel(b.dataset.d); break;
    case 'toggle': { const t = store.get('task', id); if (!t) break; haptic(12); store.patch('task', id, { status: t.status === 'done' ? 'pending' : 'done' }); break; }
    case 'menu': taskMenu(id); break;
    case 'detail': taskSheet(null, parseQuick($('#q').value, new Date())); break;
  }
}

function hint() {
  const v = $('#q').value, h = $('#qhint');
  if (!v.trim()) { h.textContent = ''; return; }
  const p = parseQuick(v, new Date()), d = p.hasDate ? p.date : sel;
  h.textContent = `← ${rel(d)}${p.time ? ' · ' + fmtHM(p.time) : ''}${p.far ? ' · مشوار بعيد' : ''}`;
}
function onSubmit(e) {
  e.preventDefault();
  const q = $('#q'), p = parseQuick(q.value, new Date());
  if (!p.title) { toast('اكتب عنوان المهمة'); q.focus(); return; }
  const date = p.hasDate ? p.date : sel;
  lastAdded = store.add('task', { title: p.title, date, time: p.time, far: p.far, status: 'pending' });
  q.value = ''; hint(); haptic(8);
  if (date !== sel) setSel(date);
  toast(`اتضافت ${rel(date)}${p.time ? ' ' + fmtHM(p.time) : ''}`);
}

export function taskSheet(id, pre = {}) {
  const t = id ? store.get('task', id) : { title: pre.title || '', date: pre.hasDate ? pre.date : sel, time: pre.time || '', far: !!pre.far };
  if (!t) return;
  sheet(html`<h3>${id ? 'تعديل المهمة' : 'مهمة جديدة'}</h3>
    <div class="field"><label for="f-title">العنوان</label><input class="in" id="f-title" value="${t.title}" maxlength="140"></div>
    <div class="grid2"><div class="field"><label for="f-date">اليوم</label><input class="in" type="date" id="f-date" value="${t.date}"></div>
    <div class="field"><label for="f-time">الوقت</label><input class="in" type="time" id="f-time" value="${t.time}"></div></div>
    <div class="set"><div class="grow"><b>مشوار بعيد</b><small>التذكير بيجي قبلها بنص ساعة بدل ربع ساعة</small></div>${sw('f-far', t.far)}</div>
    <div class="row">${id ? html`<button class="btn bad" data-x="del">حذف</button>` : ''}<span class="grow"></span><button class="btn sec" data-x="cancel">إلغاء</button><button class="btn" data-x="save">${id ? 'حفظ' : 'ضيف'}</button></div>`,
  body => {
    body.onclick = e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'cancel') return closeSheet();
      if (x.dataset.x === 'del') { store.remove('task', id); closeSheet(); toast('اتحذفت'); return; }
      const title = $('#f-title', body).value.trim(), date = $('#f-date', body).value;
      if (!title) { $('#f-title', body).focus(); return toast('اكتب عنوان المهمة'); }
      if (!date) return toast('اختار اليوم');
      const d = { title, date, time: $('#f-time', body).value, far: $('#f-far', body).checked };
      if (id) store.patch('task', id, d); else { lastAdded = store.add('task', { ...d, status: 'pending' }); $('#q').value = ''; hint(); }
      closeSheet(); if (date !== sel) setSel(date);
    };
  });
}

function taskMenu(id) {
  const t = store.get('task', id); if (!t) return;
  sheet(html`<h3 style="font-family:var(--font);font-size:18px">${t.title}</h3>
    <div class="stack">
      <button class="btn sec" data-x="edit">تعديل</button>
      ${t.status !== 'postponed' ? html`<button class="btn sec" data-x="post">أجّلها لبكرة</button>` : ''}
      ${t.status !== 'cancelled' ? html`<button class="btn sec" data-x="cancel">إلغاء المهمة</button>` : ''}
      ${t.status !== 'pending' ? html`<button class="btn sec" data-x="pend">رجّعها معلّقة</button>` : ''}
      <button class="btn bad" data-x="del">حذف</button></div>`,
  body => {
    body.onclick = e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      switch (x.dataset.x) {
        case 'edit': taskSheet(id); return;
        case 'post': {
          const nd = addDays(t.date, 1);
          store.patch('task', id, { status: 'postponed' });
          store.add('task', { title: t.title, date: nd, time: t.time, far: t.far, status: 'pending', from: id });
          toast(`اتأجلت لـ ${rel(nd)}`); break;
        }
        case 'cancel': store.patch('task', id, { status: 'cancelled' }); break;
        case 'pend': store.patch('task', id, { status: 'pending' }); break;
        case 'del': store.remove('task', id); toast('اتحذفت'); break;
      }
      closeSheet();
    };
  });
}

export function focusComposer() { const q = $('#q'); if (q) q.focus(); }
