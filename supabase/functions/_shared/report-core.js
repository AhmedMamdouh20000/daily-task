/* منطق التقرير اليومي. ملف مشترك: التطبيق بيستخدمه، ونسخة مطابقة منه في supabase/functions/_shared
   (اتأكد إنهم متطابقين بـ: node scripts/check-shared.mjs) */
export const PRAYERS = [['fajr', 'الفجر'], ['dhuhr', 'الظهر'], ['asr', 'العصر'], ['maghrib', 'المغرب'], ['isha', 'العشاء']];
export const STATUS_AR = { done: 'تمت', cancelled: 'اتلغت', postponed: 'اتأجلت', pending: 'لسه' };
const DAYS = ['الأحد', 'الإثنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number), w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[w]} ${d} ${MONTHS[m - 1]}`;
}
export function timeLabel(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`;
}

/* tasks: مصفوفة مهام ({title,date,time,status}) — prayers: { fajr:'prayed'|... } */
export function buildReport({ date, tasks, prayers }) {
  const items = (tasks || []).filter(t => t && t.date === date)
    .map(t => ({ title: String(t.title || ''), time: t.time || '', status: STATUS_AR[t.status] ? t.status : 'pending' }))
    .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  const c = s => items.filter(i => i.status === s).length;
  const total = items.length, done = c('done');
  const pr = {};
  for (const [k] of PRAYERS) pr[k] = (prayers && prayers[k]) || null;
  return {
    date, total, done, cancelled: c('cancelled'), postponed: c('postponed'), pending: c('pending'),
    pct: total ? Math.round(done / total * 100) : 0, items, prayers: pr,
    prayed: PRAYERS.filter(([k]) => pr[k] === 'prayed').length
  };
}

export const reportSubject = r => `تقرير ${dateLabel(r.date)}: ${r.pct}% اتنجز`;

export function reportText(r, { name } = {}) {
  const L = [`${name ? name + '، ' : ''}ده تقرير ${dateLabel(r.date)}`, '',
    `الإنجاز: ${r.pct}% (${r.done} من ${r.total} مهمة)`,
    `اتلغى: ${r.cancelled}  |  اتأجل: ${r.postponed}  |  لسه: ${r.pending}`, `الصلوات: ${r.prayed} من 5`, ''];
  for (const i of r.items) L.push(`- ${STATUS_AR[i.status]}: ${i.title}${i.time ? ' (' + timeLabel(i.time) + ')' : ''}`);
  return L.join('\n');
}

/* HTML للإيميل: inline styles وRTL عشان يشتغل في Gmail */
export function reportHTML(r, { name } = {}) {
  const col = { done: '#2A8A55', cancelled: '#C23A5B', postponed: '#B7791F', pending: '#52666A' };
  const rows = r.items.length ? r.items.map(i =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #DDE5E1;font-size:15px;color:#11272B">${esc(i.title)}${i.time ? `<span style="color:#52666A;font-size:13px"> ${esc(timeLabel(i.time))}</span>` : ''}</td>` +
    `<td style="padding:10px 0 10px 12px;border-bottom:1px solid #DDE5E1;text-align:left;white-space:nowrap;font-size:13px;font-weight:700;color:${col[i.status]}">${STATUS_AR[i.status]}</td></tr>`).join('')
    : '<tr><td style="padding:14px 0;color:#52666A">مفيش مهام اتسجلت في اليوم ده.</td></tr>';
  const stat = (n, label, c) => `<td style="text-align:center;padding:12px 4px;background:#F2F6F4;border-radius:12px"><div style="font-size:24px;font-weight:800;color:${c}">${n}</div><div style="font-size:12px;color:#52666A">${label}</div></td>`;
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#E9EEEB;padding:20px 12px;font-family:Tahoma,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:24px;direction:rtl;text-align:right">
<div style="font-size:13px;color:#52666A">${esc(name ? 'أهلاً ' + name : 'تقرير اليوم')}</div>
<div style="font-size:20px;font-weight:800;color:#11272B;margin:2px 0 14px">${esc(dateLabel(r.date))}</div>
<div style="font-size:44px;font-weight:800;color:#0B7F7A;line-height:1.1">${r.pct}%</div>
<div style="font-size:14px;color:#52666A;margin-bottom:12px">اتنجز ${r.done} من ${r.total} مهمة، وباقي ${r.total - r.done}</div>
<div style="height:10px;background:#DDE5E1;border-radius:99px;overflow:hidden;margin-bottom:16px"><div style="height:10px;width:${r.pct}%;background:#0B7F7A"></div></div>
<table role="presentation" width="100%" cellspacing="6" style="border-collapse:separate;margin-bottom:12px"><tr>${stat(r.done, 'تمت', '#2A8A55')}${stat(r.postponed, 'اتأجلت', '#B7791F')}${stat(r.cancelled, 'اتلغت', '#C23A5B')}${stat(r.prayed + '/5', 'صلوات', '#0B7F7A')}</tr></table>
<table role="presentation" width="100%" cellspacing="0" style="border-collapse:collapse">${rows}</table>
<div style="font-size:12px;color:#8A9A9C;margin-top:18px">اتبعت من مُخطّطي. تقدر توقف التقرير من الإعدادات.</div>
</div></body></html>`;
}

/* الوقت المحلي عند المستخدم (حسب التايم زون بتاعه) */
export function localParts(now, tz) {
  const mk = z => new Intl.DateTimeFormat('en-GB', { timeZone: z, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let f; try { f = mk(tz || 'Africa/Cairo'); } catch { f = mk('Africa/Cairo'); }
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
