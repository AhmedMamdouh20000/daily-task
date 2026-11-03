/* التنبيهات: منبّه المهام، تذكير "جهّز بكرة"، لقطة التقرير آخر اليوم، المناسبات، والاحتياجات */
import { html, today, addDays, parse, fmtHM, toMin, pad } from '../core/util.js';
import * as store from '../core/store.js';
import { once, notify } from '../core/notify.js';
import { beep } from '../core/sound.js';
import { sys, closeSys, sysOpen } from '../ui/ui.js';
import { upcomingEvents } from './events.js';
import { snapshot, serverOwnsReports, liveReport } from './reports.js';

let handlers = { tomorrow() {} }, queue = [], shown = null, boot = true;
const snoozed = new Map();
export const setHandlers = h => Object.assign(handlers, h);

const hm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
function flag(name, d = today()) { const k = 'f_' + name, v = store.dev.get(); if (v[k] === d) return false; store.dev.set({ [k]: d }); return true; }

function enqueue(a) { if (queue.some(q => q.key === a.key)) return; queue.push(a); showNext(); }
function showNext() {
  if (shown || !queue.length || sysOpen()) return;
  const a = shown = queue.shift();
  sys(html`<div class="big-ic">${a.icon || '⏰'}</div><h3 style="font-family:var(--font);font-size:22px;color:var(--ink)">${a.title}</h3><p class="sub">${a.text}</p>
    <div class="stack">${a.buttons.map(b => html`<button class="btn ${b.cls || ''} block" data-i="${b.id}">${b.label}</button>`)}</div>
    ${queue.length ? html`<p class="sub">وفي ${queue.length} تنبيه كمان</p>` : ''}`,
  { onMount: body => { body.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; const f = a.buttons.find(x => x.id === b.dataset.i); closeSys(); shown = null; if (f && f.run) f.run(); setTimeout(showNext, 200); }; } });
  const d = document.getElementById('sys'); d.addEventListener('close', () => { shown = null; setTimeout(showNext, 200); }, { once: true });
}

function taskAlarm(t, now) {
  const [h, m] = t.time.split(':').map(Number), at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m), lead = t.far ? 30 : 15;
  const pre = at.getTime() - lead * 60000, n = now.getTime();
  const sn = snoozed.get(t.id);
  let kind = null;
  if (sn && n >= sn) { snoozed.delete(t.id); kind = 'at'; }
  else if (!sn && n >= pre && n < at.getTime() && once('pre:' + t.id)) kind = 'pre';
  else if (!sn && n >= at.getTime() && n - at.getTime() < 30 * 60000 && once('at:' + t.id)) kind = 'at';
  if (!kind) return;
  const left = Math.max(1, Math.round((at.getTime() - n) / 60000));
  const title = kind === 'pre' ? `بعد ${left} دقيقة: ${t.title}` : `حان الموعد: ${t.title}`;
  if (store.settings().soundOn) beep(3);
  notify(title, t.far ? 'مشوار بعيد — اتحرك' : 'مهمتك قربت', 'task-' + t.id + kind);
  enqueue({ key: 'task-' + t.id + kind, icon: '⏰', title: t.title, text: kind === 'pre' ? `فاضل ${left} دقيقة (${fmtHM(t.time)})${t.far ? ' — مشوار بعيد' : ''}` : `الساعة ${fmtHM(t.time)} — دلوقتي`,
    buttons: [{ id: 'd', label: 'تمت ✓', run: () => store.patch('task', t.id, { status: 'done' }) }, { id: 's', label: 'فكّرني بعد 10 دقايق', cls: 'sec', run: () => snoozed.set(t.id, Date.now() + 10 * 60000) }, { id: 'o', label: 'تمام', cls: 'ghost' }] });
}

export function tick(now = new Date()) {
  const s = store.settings(), d = today(), cur = hm(now);
  const tasks = store.list('task');
  for (const t of tasks) if (t.date === d && t.status === 'pending' && t.time && !sysOpen()) taskAlarm(t, now);

  // جهّز بكرة
  if (cur >= s.eve && cur < '23:59' && !sysOpen() && flag('eve')) {
    const n = tasks.filter(t => t.date === addDays(d, 1) && t.status !== 'cancelled').length;
    notify('جهّز مهام بكرة', n ? `عندك ${n} مهام لبكرة` : 'لسه ما ضفتش حاجة لبكرة', 'eve');
    enqueue({ key: 'eve-' + d, icon: '🌙', title: 'جهّز يوم بكرة', text: n ? `عندك ${n} مهام لبكرة. تحب تضيف حاجة؟` : 'لسه مفيش مهام لبكرة. دقيقتين دلوقتي بيريّحوك الصبح.',
      buttons: [{ id: 'a', label: 'ضيف مهام لبكرة', run: () => handlers.tomorrow() }, { id: 'l', label: 'بعدين', cls: 'ghost' }] });
  }

  // التقرير
  if (!serverOwnsReports()) {
    const old = store.get('report', d);
    if (cur >= s.reportTime && !(old && old.final) && once('rep:' + d)) { const r = snapshot(d); notify('تقرير النهارده جاهز', `${r.pct}% اتنجز (${r.done} من ${r.total})`, 'report'); }
    if (boot) { const y = addDays(d, -1), oy = store.get('report', y); if (!(oy && oy.final) && liveReport(y).total) snapshot(y); }
  }
  boot = false;

  // أعياد الميلاد (≥ 5 أيام قبلها) والاحتياجات
  if (flag('ev')) for (const e of upcomingEvents(5)) notify(`${e.name}`, e.days === 0 ? 'النهارده!' : `بعد ${e.days} ${e.days <= 2 ? (e.days === 1 ? 'يوم' : 'يومين') : 'أيام'}`, 'ev-' + e.id);
  if (flag('need')) {
    const dom = parse(d).getDate();
    for (const n of store.list('need')) if (!n.paid && n.day && (n.day === dom || n.day === dom + 1)) notify(`احتياج: ${n.name}`, n.day === dom ? 'ميعاده النهارده' : 'ميعاده بكرة', 'need-' + n.id);
  }
}
export { toMin };
