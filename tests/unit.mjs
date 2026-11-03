import assert from 'node:assert/strict';
import { parseQuick } from '../js/core/quick.js';
import { buildReport, reportHTML, localParts } from '../js/core/report-core.js';
import { decide, processUser } from '../supabase/functions/_shared/run.js';
let n = 0; const t = (name, f) => { try { f(); n++; console.log('  ✓', name); } catch (e) { console.log('  ✗', name, e.message); process.exitCode = 1; } };
const base = new Date(2026, 10, 3, 10, 0); // الثلاثاء 3 نوفمبر
t('بكرة 5م', () => { const r = parseQuick('اجتماع بكرة 5م', base); assert.equal(r.title, 'اجتماع'); assert.equal(r.date, '2026-11-04'); assert.equal(r.time, '17:00'); });
t('ساعة 9 صباحاً', () => { const r = parseQuick('دكتور الساعة 9 ص', base); assert.equal(r.time, '09:00'); assert.equal(r.title, 'دكتور'); });
t('مشوار بعيد', () => { const r = parseQuick('مشوار بعيد الخميس 3م', base); assert.equal(r.far, true); assert.equal(r.date, '2026-11-05'); });
t('أرقام عربية', () => { assert.equal(parseQuick('جيم ٦:٣٠م', base).time, '18:30'); });
t('من غير وقت', () => { const r = parseQuick('اشتري خبز', base); assert.equal(r.time, ''); assert.equal(r.date, '2026-11-03'); });
const tasks = [{ title: 'أ', date: '2026-11-03', time: '09:00', status: 'done' }, { title: 'ب', date: '2026-11-03', status: 'postponed' }, { title: '<b>', date: '2026-11-03', status: 'cancelled' }, { title: 'ج', date: '2026-11-04', status: 'done' }];
t('نسبة الإنجاز', () => { const r = buildReport({ date: '2026-11-03', tasks, prayers: { fajr: 'prayed', dhuhr: 'missed' } }); assert.equal(r.total, 3); assert.equal(r.pct, 33); assert.equal(r.prayed, 1); });
t('escape في الإيميل', () => { const h = reportHTML(buildReport({ date: '2026-11-03', tasks })); assert.ok(!h.includes('<b>') && h.includes('&lt;b&gt;')); });
t('يوم فاضي', () => { assert.equal(buildReport({ date: '2026-11-03', tasks: [] }).pct, 0); });
t('التايم زون', () => { const p = localParts(new Date('2026-11-03T21:30:00Z'), 'Africa/Cairo'); assert.equal(p.date, '2026-11-03'); assert.equal(p.hm, '23:30'); });
const S = { emailReport: true, reportTime: '23:00', tz: 'Africa/Cairo' };
t('قبل الميعاد: مفيش', () => assert.equal(decide({ settings: S, now: new Date('2026-11-03T20:00:00Z') }), null)); // 22:00 القاهرة
t('بعد الميعاد: يبعت', () => assert.equal(decide({ settings: S, now: new Date('2026-11-03T21:05:00Z') }), '2026-11-03'));
t('اتبعت قبل كده: مفيش', () => assert.equal(decide({ settings: S, existing: { emailedAt: 'x' }, now: new Date('2026-11-03T21:05:00Z') }), null));
t('الخيار مقفول: مفيش', () => assert.equal(decide({ settings: { ...S, emailReport: false }, now: new Date('2026-11-03T21:05:00Z') }), null));
t('force بيبعت دايمًا', () => assert.equal(decide({ settings: { ...S, emailReport: false }, force: true, now: new Date('2026-11-03T08:00:00Z') }), '2026-11-03'));
t('processUser بيبعت ويحفظ مرة', async () => {});
const sent = [], saved = [];
const r = await processUser({ email: 'a@b.c', settings: S, tasks, prayers: {}, now: new Date('2026-11-03T21:05:00Z'), send: async m => sent.push(m), save: async x => saved.push(x) });
t('processUser: إرسال + حفظ', () => { assert.equal(r.sent, true); assert.equal(sent.length, 1); assert.equal(sent[0].to, 'a@b.c'); assert.equal(saved[0].emailedAt.length > 5, true); });
const r2 = await processUser({ email: '', settings: S, tasks, now: new Date('2026-11-03T21:05:00Z'), send: async () => { throw new Error('no'); }, save: async () => {} });
t('من غير إيميل: مفيش إرسال', () => assert.equal(r2.reason, 'no-email'));
console.log(`\n${n} اختبار`);
