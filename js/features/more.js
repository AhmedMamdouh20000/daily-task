/* "المزيد": الحساب، الإعدادات، المناسبات، النسخ الاحتياطي */
import { $, html, raw, render, dlong } from '../core/util.js';
import * as store from '../core/store.js';
import * as cloud from '../core/cloud.js';
import * as P from '../core/prayer.js';
import { setCustomAdhan, clearCustomAdhan, hasCustom, playAdhan, stopAdhan } from '../core/sound.js';
import { ask, perm } from '../core/notify.js';
import { sheet, closeSheet, toast, sw } from '../ui/ui.js';
import { allEvents, eventSheet, importICS } from './events.js';

let root;
const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo'; } catch { return 'Africa/Cairo'; } };

export async function startCloud() {
  if (!cloud.configured()) {
    sheet(html`<h3>ربط جوجل مش متظبط لسه</h3><p class="sub">عشان تسجّل بجوجل لازم تنشئ مشروع Supabase مجاني وتحط مفاتيحه في ملف <b>config.js</b>. الخطوات كلها في ملف <b>SETUP.md</b> (حوالي 10 دقايق). لحد ما تخلّصها التطبيق شغّال محلي على جهازك بكل مميزاته.</p><button class="btn block" data-x="ok">تمام</button>`, b => { b.onclick = () => closeSheet(); });
    return false;
  }
  try { store.setMeta({ mode: 'cloud', onboarded: true }); await cloud.signInGoogle(); return true; }
  catch (e) { toast('تعذّر تسجيل الدخول: ' + e.message); return false; }
}

export function mount(el) {
  root = el;
  el.addEventListener('click', onClick);
  el.addEventListener('change', onChange);
  el.addEventListener('input', e => { if (e.target.id === 's-name') store.setSettings({ name: e.target.value.trim() }, { quiet: true }); });
  render_();
}

export function render_() {
  if (!root) return;
  const s = store.settings(), m = store.meta(), u = cloud.user(), cloudMode = m.mode === 'cloud';
  render(root, html`
    <div class="card">
      <h2 class="t" style="margin:0 0 6px">الحساب والتخزين</h2>
      ${cloudMode ? (u ? html`<div class="row"><div class="grow"><b>${u.email}</b><div class="sub">البيانات متخزنة على حسابك ومتزامنة بين أجهزتك</div></div></div>
          <div class="row wrap" style="margin-top:10px"><button class="btn sec sm" data-act="sync">زامن دلوقتي</button><button class="btn ghost sm" data-act="logout">تسجيل خروج</button></div>`
        : html`<p class="sub">وضع الحساب شغّال بس لسه مسجّلتش دخول.</p><button class="btn" data-act="login" style="margin-top:8px">سجّل بجوجل</button>`)
        : html`<p class="sub">البيانات على جهازك بس، من غير أي حساب. لو عايزها على أكتر من جهاز وتوصلك التقارير على الإيميل اربط حساب جوجل.</p><button class="btn" data-act="login" style="margin-top:8px">اربط بحساب جوجل</button>`}
    </div>

    <div class="card"><div class="field"><label for="s-name">اسمك</label><input class="in" id="s-name" value="${s.name}" maxlength="30" placeholder="بيظهر في التحية والتقرير"></div></div>

    <div class="card"><h2 class="t" style="margin:0">التذكيرات والتقرير</h2>
      <div class="set"><div class="grow"><b>تذكير تجهيز بكرة</b><small>بيفكّرك تضيف مهام اليوم الجاي</small></div><input class="in" type="time" id="s-eve" value="${s.eve}" style="width:auto"></div>
      <div class="set"><div class="grow"><b>وقت تقرير آخر اليوم</b><small>بيتحفظ التقرير في الوقت ده</small></div><input class="in" type="time" id="s-rep" value="${s.reportTime}" style="width:auto"></div>
      <div class="set"><div class="grow"><b>ابعت التقرير على إيميلي</b><small>${cloudMode && u ? `هيوصل على ${u.email}` : 'متاح بعد ما تربط حساب جوجل'}</small></div>${sw('s-email', s.emailReport && cloudMode)}</div>
      <div class="set"><div class="grow"><b>الإشعارات</b><small>${{ granted: 'مفعّلة', denied: 'مقفولة من المتصفح', default: 'لسه متفعّلتش', unsupported: 'المتصفح مش بيدعمها' }[perm()]}</small></div>${perm() === 'default' ? html`<button class="btn sm" data-act="perm">فعّل</button>` : ''}</div>
      <div class="set"><div class="grow"><b>صوت التنبيه</b></div>${sw('s-sound', s.soundOn)}</div></div>

    <div class="card"><h2 class="t" style="margin:0">الصلاة</h2>
      <div class="set"><div class="grow"><b>المدينة</b></div><select class="in" id="s-city" style="width:auto">${P.CITIES.map(c => html`<option value="${c[0]}" ${s.city === c[0] ? raw('selected') : ''}>${c[1]}</option>`)}${s.city === 'custom' ? html`<option value="custom" selected>موقعي</option>` : ''}</select></div>
      <div class="set"><div class="grow"><b>استخدم موقعي</b><small>أدق من المدينة</small></div><button class="btn sm sec" data-act="geo">حدّد</button></div>
      <div class="set"><div class="grow"><b>تعديل المواقيت بالدقايق</b><small>لو التقويم عندك مختلف دقيقة أو اتنين</small></div><select class="in" id="s-adj" style="width:auto">${[-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5].map(n => html`<option value="${n}" ${+s.adj === n ? raw('selected') : ''}>${n > 0 ? '+' + n : n}</option>`)}</select></div>
      <div class="set"><div class="grow"><b>الأذان</b></div>${sw('s-adhan', s.adhanOn)}</div>
      <div class="set"><div class="grow"><b>صوت أذان تاني</b><small>${hasCustom() ? 'مستخدم ملفك الخاص' : 'الأذان المدمج (الحرم المكي)'}</small></div><label class="btn sm sec" style="cursor:pointer">اختار<input type="file" accept="audio/*" id="s-adhanfile" hidden></label>${hasCustom() ? html`<button class="btn sm ghost" data-act="adhanreset">رجّع</button>` : ''}</div>
      <div class="set"><div class="grow"><b>صيغة "والله"</b><small>في حوار الصلاة: والله صليت / والله هصلي</small></div>${sw('s-oath', s.oath)}</div></div>

    <div class="card"><div class="row between"><h2 class="t" style="margin:0">المناسبات وأعياد الميلاد</h2><button class="btn sm" data-act="evadd">ضيف</button></div>
      ${allEvents().length ? allEvents().map(e => html`<button class="need row" data-act="evedit" data-id="${e.id}" style="width:100%;text-align:start"><span style="font-size:20px">🎂</span><div class="grow">${e.name}<div class="sub">${dlong(e.date)}${e.yearly ? ' · كل سنة' : ''}</div></div></button>`) : html`<div class="empty" style="margin-top:10px"><b>مفيش مناسبات</b>هنفكّرك قبلها بـ 5 أيام.</div>`}
      <div class="row" style="margin-top:10px"><label class="btn sm sec" style="cursor:pointer">استورد من جوجل كاليندر (.ics)<input type="file" accept=".ics,text/calendar" id="s-ics" hidden></label></div>
      <p class="sub" style="margin-top:6px">من جوجل كاليندر: الإعدادات ← استيراد وتصدير ← تصدير، وبعدين اختار الملف هنا.</p></div>

    <div class="card"><h2 class="t" style="margin:0">بياناتك</h2>
      <div class="row wrap" style="margin-top:8px"><button class="btn sec sm" data-act="export">نسخة احتياطية</button><label class="btn sec sm" style="cursor:pointer">استرجاع<input type="file" accept="application/json,.json" id="s-import" hidden></label><button class="btn bad sm" data-act="wipe">مسح الكل</button></div></div>
    <p class="sub" style="text-align:center">مُخطّطي · نسخة 3</p>`);
}

async function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  switch (b.dataset.act) {
    case 'login': await startCloud(); break;
    case 'logout': await cloud.signOut(); store.setMeta({ mode: 'local' }); toast('خرجت. بياناتك لسه على الجهاز'); render_(); break;
    case 'sync': try { await cloud.syncNow(); toast('اتزامن'); } catch (er) { toast('فشلت المزامنة: ' + er.message); } break;
    case 'perm': await ask(); render_(); break;
    case 'geo': navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => { store.setSettings({ city: 'custom', lat: +p.coords.latitude.toFixed(4), lng: +p.coords.longitude.toFixed(4) }); toast('اتحدّد موقعك'); }, () => toast('معرفتش أحدد الموقع'), { timeout: 10000 }) : toast('المتصفح مش بيدعم تحديد الموقع'); break;
    case 'adhanreset': await clearCustomAdhan(); render_(); break;
    case 'evadd': eventSheet(null); break;
    case 'evedit': eventSheet(b.dataset.id); break;
    case 'export': {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([store.exportAll()], { type: 'application/json' })); a.download = `mukhattati-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); break;
    }
    case 'wipe':
      sheet(html`<h3>مسح كل البيانات؟</h3><p class="sub">${store.meta().mode === 'cloud' ? 'هتتمسح من الجهاز ومن حسابك كمان.' : 'هتتمسح من الجهاز.'} الخطوة دي مش بترجع (عدا لو عندك نسخة احتياطية).</p><div class="row"><button class="btn sec" data-x="n">لأ</button><span class="grow"></span><button class="btn bad" data-x="y">امسح</button></div>`,
        body => { body.onclick = ev => { const x = ev.target.closest('[data-x]'); if (!x) return; if (x.dataset.x === 'y') { store.wipe({ cloud: store.meta().mode === 'cloud' }); toast('اتمسح كل حاجة'); } closeSheet(); }; });
      break;
  }
}

async function onChange(e) {
  const t = e.target, id = t.id;
  if (id === 's-eve') store.setSettings({ eve: t.value || '21:00' });
  else if (id === 's-rep') store.setSettings({ reportTime: t.value || '23:00' });
  else if (id === 's-email') {
    if (t.checked && !(store.meta().mode === 'cloud' && cloud.user())) { t.checked = false; toast('اربط حساب جوجل الأول'); return; }
    store.setSettings({ emailReport: t.checked, tz: tz() }); toast(t.checked ? 'هيوصلك التقرير على الإيميل آخر اليوم' : 'اتوقف إرسال الإيميل');
  } else if (id === 's-sound') store.setSettings({ soundOn: t.checked });
  else if (id === 's-adhan') store.setSettings({ adhanOn: t.checked });
  else if (id === 's-oath') store.setSettings({ oath: t.checked });
  else if (id === 's-city') store.setSettings({ city: t.value, lat: null, lng: null });
  else if (id === 's-adj') store.setSettings({ adj: +t.value });
  else if (id === 's-adhanfile') { const f = t.files[0]; if (f) { if (f.size > 12e6) return toast('الملف كبير (أقصى 12 ميجا)'); await setCustomAdhan(f); toast('اتغيّر صوت الأذان'); render_(); } }
  else if (id === 's-ics') { await importICS(t.files[0]); t.value = ''; }
  else if (id === 's-import') {
    const f = t.files[0]; if (!f) return;
    try { const n = store.importAll(await f.text()); toast(`اترجع ${n} عنصر`); } catch (er) { toast(er.message); } t.value = '';
  }
}
export { stopAdhan, playAdhan };
