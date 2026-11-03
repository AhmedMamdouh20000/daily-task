/* نقطة البداية: ربط الشاشات، التنقل (نقر + سحب)، الدورة الزمنية (tick)، الحساب */
import { $, $$, today, reducedMotion, addDays } from './core/util.js';
import * as store from './core/store.js';
import * as cloud from './core/cloud.js';
import { loadCustomAdhan } from './core/sound.js';
import { wireDialogs, toast } from './ui/ui.js';
import { showOnboarding, hideOnboarding } from './ui/onboarding.js';
import * as todayV from './features/today.js';
import * as reportsV from './features/reports.js';
import * as prayerV from './features/prayer.js';
import * as moneyV from './features/money.js';
import * as moreV from './features/more.js';
import * as alerts from './features/alerts.js';

const TABS = ['today', 'dash', 'prayer', 'money', 'more'];
const VIEWS = { today: todayV, dash: reportsV, prayer: prayerV, money: moneyV, more: moreV };
const mounted = new Set();
let cur = 'today', lastDay = today();

store.load();
const tzNow = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'; } catch { return 'Africa/Cairo'; } };
wireDialogs();

/* ---------- الثيم ---------- */
function applyTheme(t) { document.documentElement.dataset.theme = t; const m = $('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#071417' : '#0B7F7A'; }
applyTheme(document.documentElement.dataset.theme || 'light');
$('#themeBtn').addEventListener('click', e => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', root = document.documentElement;
  store.dev.set({ theme: t });
  if (!document.startViewTransition || reducedMotion()) return applyTheme(t);
  const b = e.currentTarget.getBoundingClientRect(), x = e.clientX || b.x + b.width / 2, y = e.clientY || b.y + b.height / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.dataset.vt = 'theme';
  const vt = document.startViewTransition(() => applyTheme(t));
  vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] }, { duration: 750, easing: 'cubic-bezier(.45,0,.15,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
  vt.finished.finally(() => { delete root.dataset.vt; });
});

/* ---------- التنقل ---------- */
function ensure(name) { if (!mounted.has(name)) { mounted.add(name); VIEWS[name].mount($('#v-' + name)); } }
function paint(name) {
  cur = name; ensure(name);
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
  $$('nav.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  $('.in-nav').style.setProperty('--i', TABS.indexOf(name));
  refresh(name);
}
export function go(name, dirHint) {
  if (name === cur || !TABS.includes(name)) return;
  const dir = dirHint || (TABS.indexOf(name) > TABS.indexOf(cur) ? 1 : -1);
  if (document.startViewTransition && !reducedMotion()) {
    document.documentElement.dataset.vt = dir;
    const t = document.startViewTransition(() => paint(name));
    t.finished.finally(() => { delete document.documentElement.dataset.vt; });
  } else { paint(name); $('#v-' + name).classList.add('fallback'); setTimeout(() => $('#v-' + name).classList.remove('fallback'), 400); }
  scrollTo({ top: 0 });
}
$('nav.tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab); });

/* سحب يمين/شمال: في الـ RTL السحب لليمين بيروح للتبويب اللي بعده */
(function swipe() {
  let x0, y0, t0, ok = false;
  const skip = t => t.closest('.dates, input, textarea, select, dialog, .ob, [data-noswipe]');
  addEventListener('touchstart', e => { if (e.touches.length !== 1 || skip(e.target)) { ok = false; return; } ok = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now(); }, { passive: true });
  addEventListener('touchend', e => {
    if (!ok) return; ok = false;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
    if (Math.abs(dx) < 64 || Math.abs(dx) < Math.abs(dy) * 1.6 || Date.now() - t0 > 700) return;
    const i = TABS.indexOf(cur) + (dx > 0 ? 1 : -1);
    if (i >= 0 && i < TABS.length) go(TABS[i]);
  }, { passive: true });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input,textarea,select')) return;
    if (e.key === 'ArrowLeft') { const i = TABS.indexOf(cur) + 1; if (i < TABS.length) go(TABS[i]); }
    if (e.key === 'ArrowRight') { const i = TABS.indexOf(cur) - 1; if (i >= 0) go(TABS[i]); }
  });
})();

/* ---------- إعادة الرسم عند تغيّر البيانات ---------- */
function refresh(name = cur) {
  switch (name) {
    case 'today': todayV.renderAll(); break;
    case 'dash': reportsV.render_(); break;
    case 'prayer': prayerV.render_(); break;
    case 'money': moneyV.renderAll(); break;
    case 'more': moreV.render_(); break;
  }
}
let raf = 0;
store.subscribe(k => {
  if (k === 'meta') { if (store.meta().onboarded) hideOnboarding(); updatePill(); if (cur === 'more') moreV.render_(); return; }
  cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { refresh(); if (cur !== 'today' && mounted.has('today')) todayV.renderHero(); });
});

/* ---------- حالة التخزين/المزامنة ---------- */
function updatePill() {
  const p = $('#syncPill'), t = $('#syncTxt'), m = store.meta(); p.hidden = false;
  const st = cloud.getStatus();
  if (m.mode !== 'cloud') { p.dataset.s = 'ok'; t.textContent = 'على جهازك'; return; }
  if (!cloud.user()) { p.dataset.s = 'err'; t.textContent = 'مش مسجّل دخول'; return; }
  p.dataset.s = st === 'busy' ? 'busy' : st === 'ok' ? 'ok' : st === 'off' ? 'busy' : 'err';
  t.textContent = { busy: 'بيزامن…', ok: 'متزامن', err: 'مشكلة في المزامنة', offline: 'أوفلاين', off: 'بيتصل…' }[st] || '';
}
cloud.onStatus(() => { updatePill(); if (cur === 'more') moreV.render_(); });

/* ---------- الدورة الزمنية ---------- */
function tick() {
  const now = new Date();
  if (today() !== lastDay) { const wasToday = todayV.getSel() === lastDay; lastDay = today(); if (wasToday) todayV.setSel(lastDay); refresh(); }
  prayerV.tick(now); alerts.tick(now);
  if (cur === 'today') todayV.renderHero(); else if (cur === 'prayer') prayerV.render_();
}
setInterval(tick, 20000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
alerts.setHandlers({ tomorrow() { go('today'); todayV.setSel(addDays(today(), 1)); setTimeout(todayV.focusComposer, 350); } });

/* ---------- تشغيل ---------- */
(async function boot() {
  const raw = store.rawRec('setting', 'main');
  if (!raw || raw.x || raw.d.tz !== tzNow()) store.setSettings({ tz: tzNow() }, { quiet: true });
  ensure('today'); paint('today'); updatePill();
  loadCustomAdhan().then(() => { if (cur === 'more') moreV.render_(); });
  const oauthReturn = /[?&#](code|access_token|error_description)=/.test(location.search + location.hash);
  const m = store.meta();
  if (!m.onboarded && !oauthReturn) showOnboarding();
  if (m.mode === 'cloud' || oauthReturn) {
    if (cloud.configured()) {
      try { await cloud.init(); updatePill(); } catch (e) { toast('الحساب: ' + e.message); }
      if (oauthReturn) history.replaceState(null, '', location.pathname);
    }
  }
  setTimeout(tick, 600);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();

export { store };
