/* الميزانية: المرتب، الاحتياجات، المواصلات، الادخار (اختياري)، وإجمالي الصرف اليومي */
import { $, html, raw, render, num, money, today, parse } from '../core/util.js';
import * as store from '../core/store.js';
import { sheet, closeSheet, toast, sw } from '../ui/ui.js';

export function calc(b, needs, now = new Date()) {
  const sal = +b.salary || 0, tr = +b.transport || 0, days = +b.days || 0;
  const sav = b.saveOn ? sal * (+b.savePct || 0) / 100 : 0;
  const nd = needs.reduce((s, n) => s + (+n.price || 0), 0), trTotal = tr * days;
  const ent = sal - sav - nd - trTotal;
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), rem = dim - now.getDate() + 1;
  return { sal, sav, nd, trTotal, ent, rem, perDay: ent / Math.max(1, rem) };
}

let root;
export function mount(el) {
  root = el;
  const b = store.budget();
  render(el, html`
    <div class="card" id="m-sum"></div>
    <div class="card"><h2 class="t" style="margin-top:0">الأساسيات</h2>
      <div class="grid2">
        <div class="field"><label for="b-sal">المرتب الشهري</label><input class="in num" id="b-sal" inputmode="decimal" value="${b.salary}" placeholder="0"></div>
        <div class="field"><label for="b-tr">مواصلات اليوم</label><input class="in num" id="b-tr" inputmode="decimal" value="${b.transport}" placeholder="0"></div>
        <div class="field"><label for="b-days">أيام الشغل في الشهر</label><input class="in num" id="b-days" inputmode="numeric" value="${b.days}"></div>
      </div>
      <div class="set"><div class="grow"><b>ادّخر من المرتب</b><small>اختياري — لو قفلته مفيش حاجة بتتخصم</small></div>${sw('b-save', b.saveOn)}</div>
      <div class="field" id="b-pctw" ${b.saveOn ? '' : raw('hidden')}><label for="b-pct">نسبة الادخار: <b class="num" id="b-pcttxt">${b.savePct}</b>%</label><input type="range" id="b-pct" min="5" max="60" step="5" value="${b.savePct}"></div>
    </div>
    <div class="card"><div class="row between"><h2 class="t" style="margin:0">الاحتياجات الشهرية</h2><button class="btn sm" data-act="add">ضيف</button></div><div id="m-needs"></div></div>`);
  el.addEventListener('input', e => {
    const id = e.target.id;
    if (id === 'b-sal') store.setBudget({ salary: e.target.value }, { quiet: true });
    else if (id === 'b-tr') store.setBudget({ transport: e.target.value }, { quiet: true });
    else if (id === 'b-days') store.setBudget({ days: e.target.value }, { quiet: true });
    else if (id === 'b-pct') { $('#b-pcttxt').textContent = e.target.value; store.setBudget({ savePct: +e.target.value }, { quiet: true }); }
    else return;
    renderSum();
  });
  el.addEventListener('change', e => {
    if (e.target.id === 'b-save') { store.setBudget({ saveOn: e.target.checked }); $('#b-pctw').hidden = !e.target.checked; renderSum(); }
    else if (e.target.dataset && e.target.dataset.paid) store.patch('need', e.target.dataset.paid, { paid: e.target.checked });
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'add') needSheet(null);
    if (b.dataset.act === 'edit') needSheet(b.dataset.id);
  });
  renderAll();
}

export function renderAll() { if (!root) return; renderSum(); renderNeeds(); }

function renderSum() {
  const el = $('#m-sum'); if (!el) return;
  const c = calc(store.budget(), store.list('need'));
  const parts = [['الاحتياجات', c.nd, 'var(--rose)'], ['المواصلات', c.trTotal, 'var(--lamp)'], ['الادخار', c.sav, 'var(--brand)'], ['للترفيه', Math.max(0, c.ent), 'var(--ok)']].filter(p => p[1] > 0);
  render(el, html`
    <div class="lbl">تقدر تصرف النهارده</div>
    <div class="big num" style="color:${c.ent < 0 ? 'var(--rose)' : 'var(--ink)'}">${c.sal ? money(c.perDay) : '—'} <small>/ اليوم</small></div>
    <div class="sub num">${c.sal ? `${money(c.ent)} للترفيه على ${c.rem} يوم باقيين في الشهر` : 'اكتب مرتبك عشان نحسب لك'}</div>
    ${c.sal ? html`<div class="split" style="margin-top:12px" aria-hidden="true">${parts.map(p => html`<i style="flex-grow:${Math.max(1, Math.round(p[1]))};background:${raw(p[2])}"></i>`)}</div>
      <div class="legend num">${parts.map(p => html`<div><i style="background:${raw(p[2])}"></i>${p[0]}<b>${money(p[1])}</b></div>`)}</div>` : ''}
    ${c.ent < 0 ? html`<div class="tag late" style="margin-top:10px">المصاريف أكبر من المرتب بـ ${money(-c.ent)}</div>` : ''}`);
}

function renderNeeds() {
  const el = $('#m-needs'); if (!el) return;
  const ns = store.list('need').sort((a, b) => (+a.day || 99) - (+b.day || 99));
  render(el, ns.length ? ns.map(n => html`<div class="need">
      <span class="sw"><input type="checkbox" data-paid="${n.id}" aria-label="اتدفع: ${n.name}" ${n.paid ? raw('checked') : ''}><i></i></span>
      <button class="grow" data-act="edit" data-id="${n.id}" style="text-align:start"><div style="${n.paid ? 'text-decoration:line-through;color:var(--ink-3)' : ''}">${n.name}</div><div class="sub">${n.day ? `يوم ${n.day} في الشهر` : 'من غير ميعاد'}</div></button>
      <b class="num">${money(+n.price || 0)}</b></div>`)
    : html`<div class="empty" style="margin-top:10px"><b>مفيش احتياجات لسه</b>إيجار، كهربا، نت… أي حاجة بتتدفع كل شهر.</div>`);
}

function needSheet(id) {
  const n = id ? store.get('need', id) : { name: '', price: '', day: '', paid: false };
  if (!n) return;
  sheet(html`<h3>${id ? 'تعديل احتياج' : 'احتياج جديد'}</h3>
    <div class="field"><label for="n-name">الاسم</label><input class="in" id="n-name" value="${n.name}" maxlength="60"></div>
    <div class="grid2"><div class="field"><label for="n-price">السعر</label><input class="in num" id="n-price" inputmode="decimal" value="${n.price}"></div>
    <div class="field"><label for="n-day">يوم الدفع (1–31)</label><input class="in num" id="n-day" inputmode="numeric" value="${n.day}" placeholder="اختياري"></div></div>
    <div class="row">${id ? html`<button class="btn bad" data-x="del">حذف</button>` : ''}<span class="grow"></span><button class="btn sec" data-x="cancel">إلغاء</button><button class="btn" data-x="save">حفظ</button></div>`,
  body => {
    body.onclick = e => {
      const x = e.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'cancel') return closeSheet();
      if (x.dataset.x === 'del') { store.remove('need', id); closeSheet(); return; }
      const name = $('#n-name', body).value.trim(), price = parseFloat($('#n-price', body).value), day = parseInt($('#n-day', body).value, 10);
      if (!name || !(price >= 0)) return toast('اكتب الاسم والسعر');
      const d = { name, price, day: day >= 1 && day <= 31 ? day : 0, paid: n.paid };
      if (id) store.patch('need', id, d); else store.add('need', d);
      closeSheet();
    };
  });
}
export { num, parse, today };
