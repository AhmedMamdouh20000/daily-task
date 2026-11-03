/* الصلاة: عرض اليوم + محرّك الأذان والحوار الإجباري (والله صليت / والله هصلي) */
import { $, html, raw, render, today, addDays, fmtT, fmtHM, dur } from '../core/util.js';
import * as store from '../core/store.js';
import * as P from '../core/prayer.js';
import { once, notify, perm, ask } from '../core/notify.js';
import { playAdhan, stopAdhan, adhanPlaying, beep } from '../core/sound.js';
import { sys, closeSys, sysOpen, sheet, closeSheet, toast } from '../ui/ui.js';

const LABEL = { prayed: 'صليت', promised: 'هصلي', called: 'ندهت', missed: 'فاتت' };
let root, queue = [], shown = null, testing = false;

export function mount(el) {
  root = el;
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'row') rowSheet(b.dataset.id);
    if (b.dataset.act === 'perm') { await ask(); render_(); }
    if (b.dataset.act === 'test') { if (adhanPlaying()) { stopAdhan(); b.textContent = 'جرّب الأذان'; } else if (await playAdhan()) b.textContent = 'وقّف الأذان'; else toast('المتصفح منع الصوت — اضغط تاني'); }
  });
  render_();
}

export function render_() {
  if (!root) return;
  const s = store.settings(), now = new Date(), ws = P.windows(today(), s), t = P.timesFor(today(), s);
  const prayed = ws.filter(w => (P.rec(w.id) || {}).s === 'prayed').length, nowNext = P.nowNext(now, s);
  render(root, html`
    <div class="card"><div class="row between"><div><div class="lbl">صلواتك النهارده</div><div class="big num">${prayed}<small> من 5</small></div></div><div class="sub" style="text-align:end">${P.cityName(s.city)}<br>الشروق ${t ? fmtT(t.sunrise) : ''}</div></div>
      <div class="bar" style="margin-top:10px"><i style="width:${prayed * 20}%"></i></div></div>
    <div class="stack">${ws.map(w => {
      const r = P.rec(w.id), st = r && r.s, cur = nowNext.cur && nowNext.cur.id === w.id;
      return html`<button class="prayer ${cur ? 'now' : ''}" data-act="row" data-id="${w.id}" style="width:100%;text-align:start">
        <div class="grow"><div class="nm">${w.name}</div><div class="tm num">${fmtT(w.start)}${cur ? ' · وقتها دلوقتي' : ''}</div></div>
        <span class="badge ${st || ''}">${st ? LABEL[st] : now < w.start ? 'لسه' : 'مسجّلتش'}</span></button>`;
    })}</div>
    ${perm() === 'default' ? html`<div class="card flat"><b>فعّل الإشعارات</b><div class="sub" style="margin:4px 0 10px">عشان الأذان والتذكير يظهروا حتى لو التبويب في الخلفية.</div><button class="btn sm" data-act="perm">فعّل</button></div>` : ''}
    ${perm() === 'denied' ? html`<div class="card flat sub">الإشعارات مقفولة من إعدادات المتصفح. الأذان والحوار هيشتغلوا لما التطبيق يبقى مفتوح.</div>` : ''}
    <button class="btn sec block" data-act="test">جرّب الأذان</button>
    <p class="sub" style="text-align:center">الأذان والحوار بيشتغلوا لما التطبيق مفتوح (حتى في تبويب في الخلفية). المواقيت بالتقويم المصري (الهيئة العامة للمساحة) وتقدر تعدّلها بالدقايق من المزيد.</p>`);
}

function rowSheet(id) {
  const [date, k] = id.split(':'), w = P.windows(date, store.settings()).find(x => x.k === k); if (!w) return;
  sheet(html`<h3>${w.name}</h3><div class="sub num">من ${fmtT(w.start)} لحد ${fmtT(w.end)}</div>
    <div class="stack"><button class="btn" data-x="prayed">صليتها</button><button class="btn sec" data-x="missed">فاتتني</button><button class="btn ghost" data-x="clear">مسح الحالة</button></div>`,
  body => {
    body.onclick = e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'clear') { store.remove('prayer', id); dequeue(id); } else { P.setStatus(w, x.dataset.x, { t: Date.now() }); dequeue(id); }
      closeSheet(); render_(); showNext();
    };
  });
}

/* ---------- محرّك الأذان ---------- */
const oath = () => store.settings().oath;
function enqueue(w, type) { if (!queue.some(q => q.w.id === w.id)) queue.push({ w, type }); showNext(); }
function dequeue(id) { queue = queue.filter(q => q.w.id !== id); if (shown && shown.w.id === id) { shown = null; stopAdhan(); closeSys(); } showNext(); }

function showNext() {
  if (shown && queue[0] && shown.w.id === queue[0].w.id && sysOpen()) return;
  if (!queue.length) { if (shown) { shown = null; stopAdhan(); closeSys(); } return; }
  const q = queue[0]; shown = q;
  const o = oath(), call = q.type === 'call';
  sys(html`<div class="big-ic">🕌</div>
    <h3>${call ? `حان وقت ${q.w.name}` : `صليت ${q.w.name}؟`}</h3>
    <p class="sub">${call ? 'قوم صلّي، والأذان مش هيقف غير لما تختار.' : 'عدّى وقت من ساعة ما قلت إنك هتصلي.'}</p>
    <div class="stack"><button class="btn block" data-p="prayed">${o ? 'والله صليت' : 'صليت'}</button>
    ${call ? html`<button class="btn sec block" data-p="promised">${o ? 'والله هصلي' : 'هصلي'}</button>` : html`<button class="btn sec block" data-p="later">لسه</button>`}
    ${store.settings().adhanOn ? html`<button class="btn ghost block" data-p="play">شغّل الأذان</button>` : ''}</div>
    ${queue.length > 1 ? html`<p class="sub">وفي ${queue.length - 1} صلاة تانية مستنية</p>` : ''}`,
  { forced: true, onMount: body => { body.onclick = e => { const b = e.target.closest('[data-p]'); if (b) answer(b.dataset.p); }; } });
}

function answer(a) {
  const q = shown; if (!q) return;
  if (a === 'play') { playAdhan(); return; }
  stopAdhan();
  if (a === 'prayed') P.setStatus(q.w, 'prayed', { t: Date.now(), f: 1 });
  else if (a === 'promised') P.setStatus(q.w, 'promised', { t: Date.now(), f: 0 });
  else if (a === 'later') P.setStatus(q.w, 'promised', { t: Date.now(), f: 1 });
  queue.shift(); shown = null; closeSys();
  render_();
  setTimeout(showNext, 250);
}

export function tick(now = new Date()) {
  const s = store.settings(), t0 = today();
  const ws = [...P.windows(addDays(t0, -1), s).slice(4), ...P.windows(t0, s)];
  for (const w of ws) {
    const r = P.rec(w.id), st = r && r.s;
    if (now >= w.start && now < w.end) {
      if (!st) {
        if (once('call:' + w.id)) {
          P.setStatus(w, 'called', { t: now.getTime(), f: 0 });
          const fresh = now - w.start < 10 * 60000;
          if (fresh && s.adhanOn) playAdhan().then(ok => { if (!ok) beep(3); }); else if (fresh && s.soundOn) beep(3);
          notify(`حان وقت ${w.name}`, 'افتح التطبيق وسجّل صلاتك', 'pr-' + w.id);
          enqueue(w, 'call'); render_();
        }
      } else if (st === 'called') { if (once('re:' + w.id)) enqueue(w, 'call'); }
      else if (st === 'promised' && !r.f && now.getTime() - (r.t || 0) >= 20 * 60000) {
        P.setStatus(w, 'promised', { t: r.t, f: 1 });
        notify(`صليت ${w.name}؟`, 'عدّى 20 دقيقة', 'pr2-' + w.id); enqueue(w, 'follow'); render_();
      }
    } else if (now >= w.end && (st === 'called' || st === 'promised')) {
      P.setStatus(w, 'missed', { t: now.getTime() }); dequeue(w.id); render_();
    }
  }
}
export const pendingDialogs = () => queue.length;
export { fmtHM, dur, raw };
