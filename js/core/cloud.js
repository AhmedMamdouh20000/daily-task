/* الحساب والمزامنة (Supabase). بيتحمّل بس لما المستخدم يختار وضع جوجل. */
import * as store from './store.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../config.js';

let client = null, loading = null, session = null, timer = 0, interval = 0, running = false, fails = 0, status = 'off', started = false;
const listeners = new Set();

export const configured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const user = () => (session && session.user) || null;
export const getStatus = () => status;
export const onStatus = fn => { listeners.add(fn); return () => listeners.delete(fn); };
function setStatus(s, msg) { status = s; listeners.forEach(f => f(s, msg)); }

function loadLib() {
  if (globalThis.supabase && globalThis.supabase.createClient) return Promise.resolve();
  return loading || (loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'js/vendor/supabase.js';
    s.onload = res; s.onerror = () => { loading = null; rej(new Error('تعذّر تحميل مكتبة الحساب')); };
    document.head.appendChild(s);
  }));
}

export async function init() {
  if (!configured()) throw new Error('ربط Supabase مش متظبط (config.js فاضي)');
  await loadLib();
  if (!client) {
    client = globalThis.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    client.auth.onAuthStateChange((ev, sess) => {
      session = sess;
      if (ev === 'SIGNED_OUT') { setStatus('off'); stop(); }
      else if (sess) { setTimeout(() => adopt().catch(e => fail(e)), 0); }
    });
  }
  const { data } = await client.auth.getSession();
  session = data.session;
  return session;
}

export async function signInGoogle() {
  await init();
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } } });
  if (error) throw error;
}
export async function signOut() { if (client) await client.auth.signOut(); session = null; stop(); setStatus('off'); }

/* أول ما الجلسة تظهر: نتأكد إن الكاش المحلي بتاع نفس الحساب، وبعدين نزامن */
async function adopt() {
  const u = user(); if (!u) return;
  const m = store.meta();
  if (m.owner && m.owner !== u.id) store.resetForNewOwner(u.id);          // كاش حساب تاني: مننقلوش بياناته
  else if (!m.owner) {                                                     // بيانات محلية لأول مرة: نرفعها للحساب
    for (const k of store.KINDS) for (const r of store.list(k)) store.upsert(k, r.id, {}, { quiet: true });
    store.setMeta({ owner: u.id });
  }
  store.setMeta({ mode: 'cloud', onboarded: true });
  start();
  await syncNow();
}

function start() {
  if (started) return; started = true;
  store.subscribe(k => { if (k !== 'meta') queue(1500); });
  interval = setInterval(() => { if (!document.hidden) queue(0); }, 60000);
  addEventListener('online', () => queue(0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(0); });
}
function stop() { started = false; clearInterval(interval); clearTimeout(timer); }
export function queue(ms = 800) { if (!user()) return; clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), ms); }
function fail(e) { fails++; setStatus(navigator.onLine ? 'err' : 'offline', e && e.message); clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), Math.min(300000, 5000 * 2 ** Math.min(fails, 6))); }

export async function syncNow() {
  if (!user() || running) return; if (!navigator.onLine) return setStatus('offline');
  running = true; setStatus('busy');
  try {
    const uid = user().id;
    // 1) رفع التعديلات المحلية
    let keys = store.dirtyKeys();
    while (keys.length) {
      const batch = keys.slice(0, 200), rows = [], meta = [];
      for (const key of batch) {
        const i = key.indexOf('|'), kind = key.slice(0, i), id = key.slice(i + 1), r = store.rawRec(kind, id);
        if (!r) { store.ack(key, undefined); continue; }
        rows.push({ user_id: uid, kind, id, data: r.d, deleted: !!r.x, updated_at: new Date(r.u).toISOString() }); meta.push([key, r.u]);
      }
      if (rows.length) {
        const { error } = await client.from('records').upsert(rows, { onConflict: 'user_id,kind,id' });
        if (error) throw error;
        meta.forEach(([k, u]) => store.ack(k, u));
      }
      keys = store.dirtyKeys().filter(k => !batch.includes(k));
    }
    // 2) سحب الجديد
    for (;;) {
      let q = client.from('records').select('kind,id,data,deleted,updated_at,server_at').order('server_at', { ascending: true }).limit(500);
      const cur = store.meta().cursor; if (cur) q = q.gt('server_at', cur);
      const { data, error } = await q; if (error) throw error;
      if (!data || !data.length) break;
      store.applyRemote(data);
      store.setMeta({ cursor: data[data.length - 1].server_at });
      if (data.length < 500) break;
    }
    store.purge(); fails = 0; setStatus('ok');
  } catch (e) { fail(e); throw e; } finally { running = false; }
}

/* تقرير تجريبي على الإيميل (بيستدعي Edge Function بتوكن المستخدم) */
export async function sendTestReport() {
  if (!user()) throw new Error('سجّل دخول الأول');
  await syncNow().catch(() => {});
  const { data, error } = await client.functions.invoke('daily-report', { body: { test: true } });
  if (error) { let msg = error.message; try { const j = await error.context.json(); if (j && j.error) msg = j.error; } catch { /* ignore */ } throw new Error(msg); }
  return data;
}
