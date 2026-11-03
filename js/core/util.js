/* أدوات عامة: تواريخ، تنسيق، وقوالب HTML آمنة (بتعمل escape تلقائي) */
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const pad = n => String(n).padStart(2, '0');
export const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return fmt(d); };
export const today = () => fmt(new Date());
export const uid = () => (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'x' + Math.random().toString(36).slice(2) + Date.now().toString(36);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const haptic = (p = 10) => { try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(p); } catch { /* ignore */ } };

export const DAYS = ['الأحد', 'الإثنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'];
export const DAYS_S = ['أحد', 'إثنين', 'تلات', 'أربع', 'خميس', 'جمعة', 'سبت'];
export const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const dlong = s => { const d = parse(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const rel = s => s === today() ? 'النهارده' : s === addDays(today(), 1) ? 'بكرة' : s === addDays(today(), -1) ? 'امبارح' : dlong(s);

export const num = n => Math.round(n).toLocaleString('en-US');
export const money = n => (n < 0 ? '−' : '') + num(Math.abs(n)) + ' ج';
export const fmtT = d => { const h = d.getHours(); return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'ص' : 'م'}`; };
export const fmtHM = s => { if (!s) return ''; const [h, m] = s.split(':').map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'ص' : 'م'}`; };
export const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

/* مدة بالعربي المصري: "ساعة و15 دقيقة" */
export function dur(mins) {
  mins = Math.max(0, Math.round(mins));
  if (mins < 1) return 'أقل من دقيقة';
  const h = Math.floor(mins / 60), m = mins % 60, parts = [];
  if (h) parts.push(h === 1 ? 'ساعة' : h === 2 ? 'ساعتين' : h <= 10 ? `${h} ساعات` : `${h} ساعة`);
  if (m) parts.push(m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتين' : m <= 10 ? `${m} دقايق` : `${m} دقيقة`);
  return parts.join(' و');
}

/* ---- HTML آمن ---- */
export class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Safe(String(s));
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const part = v => v == null || v === false ? '' : Array.isArray(v) ? v.map(part).join('') : v instanceof Safe ? v.s : esc(v);
export const html = (strs, ...vals) => new Safe(strs.reduce((o, s, i) => o + s + (i < vals.length ? part(vals[i]) : ''), ''));
export const render = (el, v) => { el.innerHTML = part(v); };
