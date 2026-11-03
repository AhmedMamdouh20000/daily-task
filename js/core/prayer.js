/* حساب مواقيت الصلاة (adhan-js — الهيئة المصرية العامة للمساحة) + حالة كل صلاة */
import { addDays, fmt, parse } from './util.js';
import * as store from './store.js';

export const NAMES = { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' };
export const KEYS = Object.keys(NAMES);
export const CITIES = [
  ['cairo', 'القاهرة', 30.0444, 31.2357], ['giza', 'الجيزة', 30.0131, 31.2089], ['alex', 'الإسكندرية', 31.2001, 29.9187],
  ['benisuef', 'بني سويف', 29.0661, 31.0994], ['fayoum', 'الفيوم', 29.3084, 30.8428], ['minya', 'المنيا', 28.1099, 30.7503],
  ['assiut', 'أسيوط', 27.1783, 31.1859], ['sohag', 'سوهاج', 26.5591, 31.6957], ['luxor', 'الأقصر', 25.6872, 32.6396],
  ['aswan', 'أسوان', 24.0889, 32.8998], ['tanta', 'طنطا', 30.7865, 31.0004], ['mansoura', 'المنصورة', 31.0409, 31.3785],
  ['zagazig', 'الزقازيق', 30.5877, 31.502], ['portsaid', 'بورسعيد', 31.2653, 32.3019], ['suez', 'السويس', 29.9668, 32.5498],
  ['ismailia', 'الإسماعيلية', 30.5965, 32.2715], ['sharm', 'شرم الشيخ', 27.9158, 34.33], ['hurghada', 'الغردقة', 27.2579, 33.8116]
];
export const cityName = id => (CITIES.find(c => c[0] === id) || CITIES[0])[1];

export function coords(s) {
  if (s.city === 'custom' && s.lat != null && s.lng != null) return { lat: +s.lat, lng: +s.lng };
  const c = CITIES.find(x => x[0] === s.city) || CITIES[0];
  return { lat: c[2], lng: c[3] };
}

const cache = new Map();
export function timesFor(dateStr, s) {
  const key = dateStr + '|' + s.city + '|' + s.lat + '|' + s.lng + '|' + (+s.adj || 0);
  if (cache.has(key)) return cache.get(key);
  const A = globalThis.adhan; if (!A) return null;
  const { lat, lng } = coords(s);
  const p = A.CalculationMethod.Egyptian(); p.madhab = A.Madhab.Shafi;
  const t = new A.PrayerTimes(new A.Coordinates(lat, lng), parse(dateStr), p);
  const adj = (+s.adj || 0) * 60000, f = d => new Date(d.getTime() + adj);
  const out = { fajr: f(t.fajr), sunrise: f(t.sunrise), dhuhr: f(t.dhuhr), asr: f(t.asr), maghrib: f(t.maghrib), isha: f(t.isha) };
  if (cache.size > 40) cache.clear();
  cache.set(key, out); return out;
}

/* نوافذ الصلاة ليوم معيّن: الفجر→الشروق، الظهر→العصر، العصر→المغرب، المغرب→العشاء، العشاء→فجر بكرة */
export function windows(dateStr, s) {
  const t = timesFor(dateStr, s), n = timesFor(addDays(dateStr, 1), s);
  if (!t || !n) return [];
  const ends = { fajr: t.sunrise, dhuhr: t.asr, asr: t.maghrib, maghrib: t.isha, isha: n.fajr };
  return KEYS.map(k => ({ k, date: dateStr, name: NAMES[k], start: t[k], end: ends[k], id: dateStr + ':' + k }));
}

export const rec = id => store.get('prayer', id);
export function setStatus(w, s, extra = {}) {
  store.upsert('prayer', w.id, { date: w.date, k: w.k, s, ...extra }, { quiet: false });
}
export function dayMap(dateStr) {
  const out = {};
  for (const r of store.list('prayer')) if (r.date === dateStr) out[r.k] = r.s;
  return out;
}

/* الصلاة الجاية/الحالية لعرضها في الهيرو */
export function nowNext(now, s) {
  const today = fmt(now), ws = [...windows(addDays(today, -1), s).slice(4), ...windows(today, s), ...windows(addDays(today, 1), s).slice(0, 1)];
  const cur = ws.find(w => now >= w.start && now < w.end) || null;
  const next = ws.find(w => w.start > now) || null;
  return { cur, next, today: windows(today, s) };
}
