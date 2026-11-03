/* المناسبات وأعياد الميلاد */
import { html, today, parse, fmt, dlong, $ } from '../core/util.js';
import * as store from '../core/store.js';
import { parseICS } from '../core/ics.js';
import { sheet, closeSheet, toast, sw } from '../ui/ui.js';

const DAY = 864e5;
export function nextOccurrence(e, from = today()) {
  const f = parse(from);
  if (!e.yearly) { const d = parse(e.date); return d >= f ? e.date : null; }
  const b = parse(e.date);
  for (let y = f.getFullYear(); y <= f.getFullYear() + 1; y++) {
    let d = new Date(y, b.getMonth(), b.getDate());
    if (b.getMonth() === 1 && b.getDate() === 29 && d.getMonth() !== 1) d = new Date(y, 2, 1);
    if (d >= f) return fmt(d);
  }
  return null;
}
export function upcomingEvents(within = 5, from = today()) {
  const f = parse(from), out = [];
  for (const e of store.list('event')) {
    const n = nextOccurrence(e, from); if (!n) continue;
    const days = Math.round((parse(n) - f) / DAY);
    if (days <= within) out.push({ ...e, next: n, days });
  }
  return out.sort((a, b) => a.days - b.days);
}
export function allEvents() {
  return store.list('event').map(e => ({ ...e, next: nextOccurrence(e) })).sort((a, b) => (a.next || '9999').localeCompare(b.next || '9999'));
}

export function eventSheet(id) {
  const e = id ? store.get('event', id) : { name: '', date: today(), yearly: true };
  if (!e) return;
  sheet(html`<h3>${id ? 'تعديل المناسبة' : 'مناسبة جديدة'}</h3>
    <div class="field"><label for="e-name">الاسم</label><input class="in" id="e-name" value="${e.name}" placeholder="عيد ميلاد محمد" maxlength="100"></div>
    <div class="field"><label for="e-date">التاريخ</label><input class="in" type="date" id="e-date" value="${e.date}"></div>
    <div class="set"><div class="grow"><b>بتتكرر كل سنة</b><small>هنفكّرك قبلها بـ 5 أيام</small></div>${sw('e-yearly', e.yearly)}</div>
    <div class="row">${id ? html`<button class="btn bad" data-x="del">حذف</button>` : ''}<span class="grow"></span><button class="btn sec" data-x="cancel">إلغاء</button><button class="btn" data-x="save">حفظ</button></div>`,
  body => {
    body.onclick = ev => {
      const x = ev.target.closest('[data-x]'); if (!x) return;
      if (x.dataset.x === 'cancel') return closeSheet();
      if (x.dataset.x === 'del') { store.remove('event', id); closeSheet(); return; }
      const name = $('#e-name', body).value.trim(), date = $('#e-date', body).value;
      if (!name || !date) return toast('اكتب الاسم واختار التاريخ');
      const d = { name, date, yearly: $('#e-yearly', body).checked };
      if (id) store.patch('event', id, d); else store.add('event', d);
      closeSheet();
    };
  });
}

export async function importICS(file) {
  if (!file) return;
  if (file.size > 3e6) return toast('الملف كبير قوي');
  const items = parseICS(await file.text());
  if (!items.length) return toast('مالقيتش مناسبات في الملف');
  const have = new Set(store.list('event').map(e => e.name + '|' + e.date));
  let n = 0;
  for (const it of items) if (!have.has(it.name + '|' + it.date)) { store.add('event', it); have.add(it.name + '|' + it.date); n++; }
  toast(n ? `اتضاف ${n} مناسبة` : 'كلها موجودة قبل كده');
}
export { dlong };
