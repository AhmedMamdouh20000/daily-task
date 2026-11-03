/* المخزن المحلي (المصدر الأساسي للواجهة).
   كل سجل: { d: البيانات, u: وقت آخر تعديل بالميلي ثانية, x: 1 لو اتمسح }.
   كل تعديل بيتعلّم "dirty" عشان المزامنة (لو الحساب متربط) ترفعه. */
import { uid } from './util.js';

export const KEY = 'mk3', DKEY = 'mk3d';
export const KINDS = ['task', 'need', 'event', 'prayer', 'setting', 'report'];
const tzGuess = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'; } catch { return 'Africa/Cairo'; } };
export const DEFAULT_SETTINGS = { name: '', city: 'cairo', lat: null, lng: null, adj: 0, oath: true, adhanOn: true, soundOn: true, eve: '21:00', reportTime: '23:00', emailReport: false, tz: '' };
export const DEFAULT_BUDGET = { salary: '', transport: '', days: 22, saveOn: false, savePct: 30 };

let S = blank();
const subs = new Set(), cache = new Map();
let persistT = 0;

function blank() {
  return { v: 3, mode: 'local', owner: null, onboarded: false, migrated: false, cursor: null, recs: Object.fromEntries(KINDS.map(k => [k, {}])), dirty: {} };
}
function norm(o) {
  const b = blank();
  if (!o || typeof o !== 'object') return b;
  for (const k of KINDS) {
    const m = o.recs && o.recs[k];
    if (m && typeof m === 'object') for (const [id, r] of Object.entries(m)) {
      if (r && typeof r === 'object' && r.d && typeof r.d === 'object') b.recs[k][id] = { d: r.d, u: +r.u || 0, x: r.x ? 1 : 0 };
    }
  }
  if (o.dirty && typeof o.dirty === 'object') for (const key of Object.keys(o.dirty)) {
    const [k, ...rest] = key.split('|');
    if (b.recs[k] && b.recs[k][rest.join('|')]) b.dirty[key] = 1;
  }
  b.mode = o.mode === 'cloud' ? 'cloud' : 'local';
  b.owner = o.owner || null; b.onboarded = !!o.onboarded; b.migrated = !!o.migrated; b.cursor = o.cursor || null;
  return b;
}

/* نقل بيانات النسخة القديمة (planner_v2) لو موجودة على نفس الدومين */
function migrateV2(old) {
  const now = Date.now(), R = S.recs;
  for (const t of old.tasks || []) R.task[String(t.id)] = { d: { title: String(t.title || ''), date: t.date, time: t.time || '', far: !!t.far, status: t.status || 'pending' }, u: now, x: 0 };
  const b = old.budget || {};
  for (const n of b.needs || []) R.need[String(n.id)] = { d: { name: String(n.name || ''), price: +n.price || 0, day: +n.day || 0, paid: !!n.paid }, u: now, x: 0 };
  for (const e of old.events || []) R.event[String(e.id)] = { d: { name: String(e.name || ''), date: e.date, yearly: !!e.yearly }, u: now, x: 0 };
  R.setting.budget = { d: { ...DEFAULT_BUDGET, salary: b.salary ?? '', transport: b.transport ?? '', days: +b.days || 22, saveOn: !!b.saveOn, savePct: +b.savePct || 30 }, u: now, x: 0 };
  const st = old.settings || {};
  R.setting.main = { d: { ...DEFAULT_SETTINGS, eve: st.eve || '21:00', soundOn: st.sound !== false, adhanOn: st.adhan !== false, city: st.city || 'cairo', lat: st.lat ?? null, lng: st.lng ?? null, adj: +st.adj || 0, oath: st.oath !== false }, u: now, x: 0 };
  for (const [date, m] of Object.entries((old.prayer && old.prayer.days) || {})) {
    for (const [k, v] of Object.entries(m || {})) R.prayer[date + ':' + k] = { d: { date, k, s: v.s, t: v.t || 0, f: v.f || 0 }, u: now, x: 0 };
  }
  for (const key of Object.keys(R.task)) S.dirty['task|' + key] = 1;
  S.migrated = true;
}

export function load() {
  let raw = null;
  try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { /* ignore */ }
  if (raw) S = norm(raw);
  else {
    S = blank();
    try { const old = JSON.parse(localStorage.getItem('planner_v2') || localStorage.getItem('planner_v1') || 'null'); if (old && typeof old === 'object') migrateV2(old); } catch (e) { console.warn('migrate', e); }
  }
  cache.clear();
  addEventListener('storage', e => { if (e.key === KEY && e.newValue) { try { merge(norm(JSON.parse(e.newValue))); } catch { /* ignore */ } } });
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
function emit(kind, quiet) { cache.clear(); if (!quiet) subs.forEach(f => { try { f(kind); } catch (e) { console.error(e); } }); schedule(); }
function schedule() { clearTimeout(persistT); persistT = setTimeout(flush, 250); }
export function flush() { clearTimeout(persistT); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('persist failed', e); } }

/* ---- قراءة ---- */
export function list(kind) {
  const c = cache.get(kind); if (c) return c;
  const out = [];
  for (const [id, r] of Object.entries(S.recs[kind])) if (!r.x) out.push({ id, ...r.d });
  cache.set(kind, out); return out;
}
export function get(kind, id) { const r = S.recs[kind][id]; return r && !r.x ? { id, ...r.d } : null; }

/* ---- كتابة ---- */
function put(kind, id, d, merge) {
  const r = S.recs[kind][id];
  S.recs[kind][id] = { d: { ...(merge && r && !r.x ? r.d : {}), ...d }, u: Math.max(Date.now(), (r ? r.u : 0) + 1), x: 0 };
  S.dirty[kind + '|' + id] = 1;
}
export function add(kind, d, id) { id = id || uid(); put(kind, id, d, false); emit(kind); return id; }
export function upsert(kind, id, d, opt = {}) { put(kind, id, d, true); emit(kind, opt.quiet); }
export function patch(kind, id, p, opt = {}) { const r = S.recs[kind][id]; if (!r || r.x) return false; put(kind, id, p, true); emit(kind, opt.quiet); return true; }
export function remove(kind, id) {
  const r = S.recs[kind][id]; if (!r || r.x) return;
  S.recs[kind][id] = { d: {}, u: Math.max(Date.now(), r.u + 1), x: 1 };
  S.dirty[kind + '|' + id] = 1; emit(kind);
}

export const settings = () => ({ ...DEFAULT_SETTINGS, tz: tzGuess(), ...(S.recs.setting.main && !S.recs.setting.main.x ? S.recs.setting.main.d : {}) });
export const setSettings = (p, opt) => upsert('setting', 'main', p, opt);
export const budget = () => ({ ...DEFAULT_BUDGET, ...(S.recs.setting.budget && !S.recs.setting.budget.x ? S.recs.setting.budget.d : {}) });
export const setBudget = (p, opt) => upsert('setting', 'budget', p, opt);

/* ---- معلومات الحساب/المزامنة ---- */
export const meta = () => ({ mode: S.mode, owner: S.owner, onboarded: S.onboarded, migrated: S.migrated, cursor: S.cursor });
export function setMeta(p) { Object.assign(S, p); schedule(); subs.forEach(f => { try { f('meta'); } catch (e) { console.error(e); } }); }
export const dirtyKeys = () => Object.keys(S.dirty);
export const rawRec = (kind, id) => S.recs[kind] && S.recs[kind][id];
export function ack(key, u) {
  const i = key.indexOf('|'), r = S.recs[key.slice(0, i)] && S.recs[key.slice(0, i)][key.slice(i + 1)];
  if (!r || r.u === u) delete S.dirty[key];
  schedule();
}
/* دمج صفوف جاية من السيرفر: آخر تعديل يكسب */
export function applyRemote(rows) {
  let changed = false;
  for (const row of rows) {
    const m = S.recs[row.kind]; if (!m) continue;
    const u = Date.parse(row.updated_at) || 0, loc = m[row.id];
    if (loc && loc.u >= u) continue;
    m[row.id] = { d: row.data || {}, u, x: row.deleted ? 1 : 0 };
    delete S.dirty[row.kind + '|' + row.id]; changed = true;
  }
  if (changed) emit('*');
  return changed;
}
function merge(o) {
  let changed = false;
  for (const k of KINDS) for (const [id, r] of Object.entries(o.recs[k])) {
    const loc = S.recs[k][id];
    if (!loc || r.u > loc.u) { S.recs[k][id] = r; changed = true; }
  }
  for (const key of Object.keys(o.dirty)) S.dirty[key] = 1;
  if (o.onboarded && !S.onboarded) { S.onboarded = true; changed = true; }
  if (changed) { cache.clear(); subs.forEach(f => { try { f('*'); } catch (e) { console.error(e); } }); }
}
export function purge() {
  const cut = Date.now() - 30 * 864e5;
  for (const k of KINDS) for (const [id, r] of Object.entries(S.recs[k])) if (r.x && r.u < cut && !S.dirty[k + '|' + id]) delete S.recs[k][id];
  schedule();
}

/* ---- نسخ احتياطي ومسح ---- */
export function exportAll() {
  const recs = {};
  for (const k of KINDS) { recs[k] = {}; for (const [id, r] of Object.entries(S.recs[k])) if (!r.x) recs[k][id] = r.d; }
  return JSON.stringify({ app: 'mukhattati', v: 3, at: new Date().toISOString(), recs });
}
export function importAll(text) {
  const o = JSON.parse(text);
  if (!o || o.app !== 'mukhattati' || !o.recs || typeof o.recs !== 'object') throw new Error('الملف ده مش نسخة احتياطية من التطبيق');
  let n = 0;
  for (const k of KINDS) {
    const m = o.recs[k]; if (!m || typeof m !== 'object') continue;
    for (const [id, d] of Object.entries(m)) if (d && typeof d === 'object') { put(k, String(id), d, false); n++; }
  }
  emit('*'); return n;
}
/* cloud=true: نعلّم كل حاجة كمحذوفة عشان المسح يوصل للسحابة كمان */
export function wipe({ cloud = false } = {}) {
  if (cloud) {
    for (const k of KINDS) for (const [id, r] of Object.entries(S.recs[k])) if (!r.x) { S.recs[k][id] = { d: {}, u: Math.max(Date.now(), r.u + 1), x: 1 }; S.dirty[k + '|' + id] = 1; }
  } else { const { mode, owner, onboarded } = S; S = blank(); S.mode = mode; S.owner = owner; S.onboarded = onboarded; }
  emit('*'); flush();
}
export function resetForNewOwner(owner) { const { mode } = S; S = blank(); S.mode = mode; S.owner = owner; S.onboarded = true; cache.clear(); flush(); subs.forEach(f => f('*')); }

/* تفضيلات الجهاز (مش بتتزامن) */
export const dev = {
  get() { try { return JSON.parse(localStorage.getItem(DKEY)) || {}; } catch { return {}; } },
  set(p) { try { localStorage.setItem(DKEY, JSON.stringify({ ...dev.get(), ...p })); } catch { /* ignore */ } }
};
