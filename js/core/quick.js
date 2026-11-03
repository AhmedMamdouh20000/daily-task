/* الإضافة السريعة: بتفهم "اجتماع بكرة 5م" وتطلّع عنوان + تاريخ + وقت */
import { fmt, addDays } from './util.js';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => s.replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
const WEEKDAYS = { 'الأحد': 0, 'الاحد': 0, 'الإثنين': 1, 'الاثنين': 1, 'الاتنين': 1, 'التلات': 2, 'الثلاثاء': 2, 'الأربع': 3, 'الاربع': 3, 'الأربعاء': 3, 'الاربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'الجمعه': 5, 'السبت': 6 };
const PM = /^(م|مساء|مساءً|مساءا|pm|العصر|الضهر|الظهر|بالليل|الليل)$/i;
const AM = /^(ص|صباحا|صباحاً|الصبح|am)$/i;
const MARK = '(ص|صباحا|صباحاً|الصبح|م|مساء|مساءً|مساءا|العصر|الضهر|الظهر|بالليل|الليل|am|pm|AM|PM)';

function cut(s, re, fn) { const m = s.match(re); if (!m) return [s, null]; return [s.replace(re, m[1] !== undefined && m[0].startsWith(m[1]) && /^\s/.test(m[1]) ? ' ' : ' '), fn ? fn(m) : m]; }

function to24(h, mark) {
  if (mark) {
    if (PM.test(mark)) return /^(الضهر|الظهر)$/.test(mark) ? (h >= 1 && h <= 5 ? h + 12 : h) : (h < 12 ? h + 12 : h);
    if (AM.test(mark)) return h === 12 ? 0 : h;
  }
  if (h >= 1 && h <= 6) return h + 12;   // من غير ص/م: 1–6 مساءً
  return h;                              // 7–11 صباحاً، 12 ضهر، و13+ بنظام 24 ساعة
}

export function parseQuick(input, now = new Date()) {
  let s = ' ' + toLatin(String(input || '')) + ' ';
  let date = null, time = '', far = false;
  const todayStr = fmt(now);

  [s] = cut(s, /(\s)(?:مشوار\s*بعيد|مشوار|بعيد)(?=\s)/, () => { far = true; });

  let r;
  [s, r] = cut(s, /(\s)بعد\s*(?:بكرة|بكره|غدا|غداً)(?=\s)/, () => 2); if (r != null) date = addDays(todayStr, r);
  if (date === null) { [s, r] = cut(s, /(\s)(?:بكرة|بكره|غدا|غداً|tomorrow)(?=\s)/i, () => 1); if (r != null) date = addDays(todayStr, r); }
  if (date === null) { [s, r] = cut(s, /(\s)(?:النهارده|النهاردة|انهارده|اليوم|today)(?=\s)/i, () => 0); if (r != null) date = todayStr; }
  if (date === null) {
    for (const [name, idx] of Object.entries(WEEKDAYS)) {
      const re = new RegExp('(\\s)(?:يوم\\s*)?' + name + '(?=\\s)');
      if (re.test(s)) { s = s.replace(re, ' '); let diff = (idx - now.getDay() + 7) % 7; if (diff === 0) diff = 7; date = addDays(todayStr, diff); break; }
    }
  }

  const setTime = (h, mi, mark) => {
    h = parseInt(h, 10); mi = mi == null || mi === '' ? 0 : parseInt(mi, 10);
    if (!(h >= 0 && h <= 23 && mi >= 0 && mi <= 59)) return false;
    const hh = to24(h, mark || ''); if (hh > 23) return false;
    time = String(hh).padStart(2, '0') + ':' + String(mi).padStart(2, '0'); return true;
  };
  const patterns = [
    new RegExp('(\\s)(?:الساعة|الساعه|ساعة|ساعه)\\s*(\\d{1,2})(?::(\\d{2}))?\\s*' + MARK + '?(?=\\s)', 'i'),
    new RegExp('(\\s)(\\d{1,2}):(\\d{2})\\s*' + MARK + '?(?=\\s)', 'i'),
    new RegExp('(\\s)(\\d{1,2})()\\s*' + MARK + '(?=\\s)', 'i')
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m && setTime(m[2], m[3], m[4])) { s = s.replace(re, ' '); break; }
  }

  const title = s.replace(/\s+/g, ' ').trim();
  return { title, date: date || todayStr, time, far, hasDate: date !== null, hasTime: time !== '' };
}
