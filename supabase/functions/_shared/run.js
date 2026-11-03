/* قلب الدالة: قرار الإرسال + بناء الرسالة. مفصول عن Deno/Supabase عشان نختبره بـ Node. */
import { buildReport, reportHTML, reportSubject, reportText, localParts } from './report-core.js';

/* هل لازم نبعت تقرير لليوزر ده دلوقتي؟ بيرجّع التاريخ أو null */
export function decide({ settings, existing, now, force }) {
  const s = settings || {};
  const p = localParts(now, s.tz);
  if (force) return p.date;
  if (!s.emailReport) return null;
  const at = /^\d{2}:\d{2}$/.test(s.reportTime || '') ? s.reportTime : '23:00';
  if (p.hm < at) return null;                  // لسه معادش وقت التقرير
  if (existing && existing.emailedAt) return null; // اتبعت قبل كده
  return p.date;
}

export function composeEmail({ date, tasks, prayers, name }) {
  const r = buildReport({ date, tasks, prayers });
  return { report: r, subject: reportSubject(r), html: reportHTML(r, { name }), text: reportText(r, { name }) };
}

/* send({to,subject,html,text}) و save(report) بيتحقنوا من برّه */
export async function processUser({ email, settings, tasks, prayers, existing, now, force, send, save }) {
  const date = decide({ settings, existing, now, force });
  if (!date) return { sent: false, reason: 'not-due' };
  if (!email) return { sent: false, reason: 'no-email' };
  const m = composeEmail({ date, tasks, prayers, name: settings && settings.name });
  await send({ to: email, subject: m.subject, html: m.html, text: m.text });
  if (!force) await save({ ...m.report, generatedAt: new Date().toISOString(), emailedAt: new Date().toISOString() });
  return { sent: true, date, pct: m.report.pct };
}

export function prayersMap(rows, date) {
  const out = {};
  for (const r of rows || []) { const d = r.data || {}; if (d.date === date && d.k) out[d.k] = d.s; }
  return out;
}
