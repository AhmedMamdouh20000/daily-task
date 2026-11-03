/* التقرير اليومي: بناء + تخزين محلي + عرض "لوحتي" */
import { $, html, raw, render, today, addDays, dlong, rel, fmtHM } from '../core/util.js';
import * as store from '../core/store.js';
import * as P from '../core/prayer.js';
import { buildReport, reportText, STATUS_AR } from '../core/report-core.js';
import * as cloud from '../core/cloud.js';
import { sheet, closeSheet, toast } from '../ui/ui.js';

export function liveReport(date = today()) {
  return buildReport({ date, tasks: store.list('task'), prayers: P.dayMap(date) });
}
/* بيحفظ لقطة نهائية لليوم. بيحافظ على emailedAt لو السيرفر بعت قبل كده */
export function snapshot(date = today()) {
  const r = liveReport(date), old = store.get('report', date);
  store.upsert('report', date, { ...r, generatedAt: new Date().toISOString(), final: true, ...(old && old.emailedAt ? { emailedAt: old.emailedAt } : {}) });
  return r;
}
/* لو الإيميل شغّال في وضع السحابة، السيرفر هو اللي بيحفظ تقرير اليوم (منعًا لتضارب emailedAt) */
export function serverOwnsReports() { return store.meta().mode === 'cloud' && store.settings().emailReport; }

let root;
export function mount(el) {
  root = el;
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'snap') { snapshot(); toast('اتحفظ تقرير النهارده'); render_(); }
    if (b.dataset.act === 'open') detail(b.dataset.d);
    if (b.dataset.act === 'test') {
      b.disabled = true; b.textContent = 'بنبعت…';
      try { const r = await cloud.sendTestReport(); toast(r && r.to ? `اتبعت على ${r.to}` : 'اتبعت'); }
      catch (err) { toast('فشل: ' + err.message); }
      b.disabled = false; b.textContent = 'ابعت تقرير تجريبي على إيميلي';
    }
  });
  render_();
}

export function render_() {
  if (!root) return;
  const r = liveReport(), t0 = today(), s = store.settings(), cloudOn = store.meta().mode === 'cloud' && cloud.user();
  const week = Array.from({ length: 7 }, (_, i) => { const d = addDays(t0, i - 6), x = liveReport(d); return { d, x }; });
  const hist = store.list('report').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  render(root, html`
    <div class="card"><div class="prog">
      <div class="ring num" data-t="${r.pct}%" style="--p:${r.pct}" role="img" aria-label="${r.pct}% اتنجز"></div>
      <div class="grow"><div class="lbl">لوحة النهارده</div><div class="big num">${r.pct}%<small> اتنجز</small></div><div class="sub num">باقي ${100 - (r.total ? r.pct : 0)}% · ${r.total} مهمة</div></div></div>
      <div class="stats num" style="margin-top:12px"><div class="stat ok"><b>${r.done}</b><span>تمت</span></div><div class="stat warn"><b>${r.postponed}</b><span>اتأجلت</span></div><div class="stat bad"><b>${r.cancelled}</b><span>اتلغت</span></div></div></div>
    <div class="card"><div class="lbl" style="margin-bottom:8px">آخر 7 أيام</div>
      <div class="week num">${week.map(w => html`<div class="${w.d === t0 ? 'today' : ''}"><i style="height:${Math.max(4, w.x.pct)}%" title="${w.x.pct}%"></i>${w.x.total ? w.x.pct + '%' : '—'}</div>`)}</div></div>
    <div class="row wrap"><button class="btn sec" data-act="snap">احفظ تقرير النهارده</button>${cloudOn && s.emailReport ? html`<button class="btn ghost" data-act="test">ابعت تقرير تجريبي على إيميلي</button>` : ''}</div>
    <h2 class="t">التقارير السابقة</h2>
    ${hist.length ? html`<div class="card">${hist.map(h => html`<button class="rep row" data-act="open" data-d="${h.date}" style="width:100%;text-align:start"><div class="grow"><b>${dlong(h.date)}</b><div class="sub num">${h.done} من ${h.total} · اتأجل ${h.postponed} · اتلغى ${h.cancelled}${h.emailedAt ? ' · اتبعت على الإيميل' : ''}</div></div><b class="num" style="color:var(--brand)">${h.pct}%</b></button>`)}</div>`
      : html`<div class="empty"><b>مفيش تقارير لسه</b>التقرير بيتحفظ لوحده في آخر اليوم (${s.reportTime}).</div>`}`);
}

function download(name, text) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function detail(date) {
  const h = store.get('report', date); if (!h) return;
  const txt = reportText(h, { name: store.settings().name });
  sheet(html`<h3>${dlong(h.date)}</h3><div class="big num">${h.pct}%<small> اتنجز</small></div>
    <div class="card flat">${(h.items || []).length ? h.items.map(i => html`<div class="rep row"><div class="grow">${i.title}<div class="sub num">${i.time ? fmtHM(i.time) : ''}</div></div><span class="badge ${i.status === 'done' ? 'prayed' : i.status === 'pending' ? '' : i.status === 'postponed' ? 'promised' : 'missed'}">${STATUS_AR[i.status]}</span></div>`) : html`<div class="sub">مفيش مهام في اليوم ده.</div>`}</div>
    <div class="sub">الصلوات: ${h.prayed || 0} من 5</div>
    <div class="row"><button class="btn sec" data-x="copy">نسخ</button><button class="btn sec" data-x="dl">تنزيل .txt</button><span class="grow"></span><button class="btn" data-x="ok">تمام</button></div>`,
  body => {
    body.onclick = async e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'copy') { try { await navigator.clipboard.writeText(txt); toast('اتنسخ'); } catch { toast('المتصفح منع النسخ'); } }
      else if (x.dataset.x === 'dl') download(`report-${h.date}.txt`, txt);
      else closeSheet();
    };
  });
}
export { rel, raw, $ };
