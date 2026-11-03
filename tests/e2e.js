// اختبار شامل بـ Playwright: node tests/e2e.js  (محتاج: npm i playwright، وسيرفر ثابت على المنفذ 8123)
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8123/';
const SHOTS = process.env.SHOTS || '';
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
const step = async (n, f) => { console.log('\n' + n); try { await f(); } catch (e) { fails++; console.log('  ✗ EXC', e.message.split('\n').slice(0, 3).join(' | ')); } };

async function fresh(browser, { time = '2026-11-03T11:00:00+02:00', ctxOpts = {}, route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Africa/Cairo', locale: 'ar-EG', hasTouch: true, ...ctxOpts });
  const page = await ctx.newPage(); const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  if (route) await route(ctx);
  await page.clock.install({ time: new Date(time) });
  await page.goto(BASE + 'index.html');
  await page.waitForSelector('#ob:not([hidden])');
  return { ctx, page, errs };
}
const shot = (p, n) => SHOTS ? p.screenshot({ path: `${SHOTS}/${n}.png` }) : null;
const swipe = async (page, dx) => {
  const c = await page.context().newCDPSession(page);
  const y = 400, x0 = dx > 0 ? 120 : 270;
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx / 2, y }] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0 + dx, y }] }).catch(() => {});
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
};

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  /* ---------------- الوضع المحلي ---------------- */
  const { page: p, errs } = await fresh(browser);
  await step('1) البداية والتخزين المحلي', async () => {
    await shot(p, '01-onboarding');
    await p.fill('#ob-name', 'أحمد'); await p.click('[data-c=local]');
    await p.waitForSelector('#ob', { state: 'hidden' });
    ok(await p.textContent('#hero .hi') === 'صباح الخير يا أحمد', 'تحية باسم المستخدم');
    ok((await p.textContent('#syncTxt')) === 'على جهازك', 'مؤشر التخزين: على جهازك');
  });

  await step('2) الإضافة السريعة + المنبّه (15 دقيقة قبل)', async () => {
    await p.fill('#q', 'مذاكرة الساعة 11:20');
    ok((await p.textContent('#qhint')).includes('11:20'), 'المعاينة الحية بتفهم الوقت');
    await p.press('#q', 'Enter');
    await p.fill('#q', 'اجتماع بكرة 5م'); await p.press('#q', 'Enter');
    ok(await p.locator('.dchip[aria-pressed=true]').textContent().then(t => t.includes('4')), 'اتنقل ليوم بكرة (الأربع 4)');
    ok(await p.locator('.task .tt').first().textContent() === 'اجتماع', 'العنوان من غير كلمات الوقت');
    ok((await p.locator('.task .tm').first().textContent()).includes('5:00 م'), 'الوقت 5:00 م');
    await p.click('.dchip:has-text("النهارده")');
    ok(await p.locator('.task').count() === 1, 'مهمة النهارده موجودة');
    await p.clock.runFor(6 * 60000);   // 11:06 -> بعد 14 دقيقة من 11:20
    await p.waitForFunction(() => document.getElementById('sys').open);
    ok((await p.textContent('#sysBody')).includes('مذاكرة'), 'ظهر منبّه المهمة');
    ok((await p.textContent('#sysBody')).includes('فاضل'), 'منبّه "قبل الميعاد"');
    await shot(p, '02-alarm');
    await p.click('#sysBody [data-i=d]', { force: true }); await p.clock.runFor(200); await p.waitForTimeout(150);
    await p.waitForFunction(() => !document.getElementById('sys').open);
    ok(await p.locator('.task[data-s=done]').count() === 1, 'علّمتها تمت');
    ok((await p.getAttribute('#ring', 'data-t')) === '100%', 'الدايرة 100%');
  });

  await step('3) الصلاة: أذان + حوار إجباري', async () => {
    await p.clock.runFor(36 * 60000);  // ~11:42 بعد الظهر
    await p.waitForFunction(() => document.getElementById('sys').open);
    const txt = await p.textContent('#sysBody');
    ok(txt.includes('حان وقت الظهر'), 'حوار الظهر ظهر: ' + txt.slice(0, 30));
    ok(await p.evaluate(() => !document.getElementById('adhanEl').paused), 'الأذان شغّال');
    ok(await p.evaluate(() => document.getElementById('adhanEl').src.endsWith('assets/adhan.mp3')), 'مصدر الأذان هو الملف المدمج');
    await shot(p, '03-prayer-dialog');
    await p.keyboard.press('Escape');
    ok(await p.evaluate(() => document.getElementById('sys').open), 'Escape مش بيقفل الحوار');
    await p.click('#sysBody [data-p=promised]');
    ok(await p.evaluate(() => document.getElementById('adhanEl').paused), 'الأذان وقف بعد الاختيار');
    ok(!(await p.evaluate(() => document.getElementById('sys').open)), 'الحوار اتقفل');
    await p.clock.runFor(21 * 60000);
    await p.waitForFunction(() => document.getElementById('sys').open);
    ok((await p.textContent('#sysBody')).includes('صليت الظهر؟'), 'متابعة بعد 20 دقيقة');
    await p.click('#sysBody [data-p=prayed]');
    await p.click('[data-tab=prayer]'); await p.waitForTimeout(100);
    ok((await p.locator('.prayer .badge.prayed').count()) === 1, 'حالة الظهر: صليت');
    await shot(p, '04-prayer-tab');
  });

  await step('4) التنقل بالسحب', async () => {
    await p.click('[data-tab=today]');
    await swipe(p, 140);  // يمين => التبويب اللي بعده
    await p.waitForTimeout(100);
    ok(await p.getAttribute('[data-tab=dash]', 'aria-selected') === 'true', 'سحب لليمين → لوحتي');
    await swipe(p, -140);
    await p.waitForTimeout(100);
    ok(await p.getAttribute('[data-tab=today]', 'aria-selected') === 'true', 'سحب لليسار → اليوم');
  });

  await step('5) الميزانية', async () => {
    await p.click('[data-tab=money]');
    await p.fill('#b-sal', '10000'); await p.fill('#b-tr', '50'); await p.fill('#b-days', '20');
    // احتياج
    await p.click('[data-act=add]'); await p.fill('#n-name', 'إيجار'); await p.fill('#n-price', '3000'); await p.click('[data-x=save]'); await p.clock.runFor(100);
    await p.clock.runFor(100);
    const per = await p.textContent('#m-sum .big');
    // 10000 - 0 (ادخار مقفول) - 3000 - 1000 = 6000 ; باقي أيام الشهر من 3 نوفمبر: 28
    ok(per.replace(/\D/g, '').startsWith('214'), `الصرف اليومي ~214 ج بدون ادخار (طلع: ${per.trim()})`);
    await p.check('#b-save', { force: true }).catch(() => p.click('#b-save + i'));
    await p.clock.runFor(100);
    const per2 = await p.textContent('#m-sum .big');
    // 10000*30% = 3000 → 10000-3000-3000-1000 = 3000 / 28 = 107
    ok(per2.replace(/\D/g, '').startsWith('107'), `مع الادخار 30% ~107 ج (طلع: ${per2.trim()})`);
    await shot(p, '05-money');
  });

  await step('6) تذكير بكرة + تقرير آخر اليوم محلي', async () => {
    const hm = () => p.evaluate(() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); });
    const advance = async (target, stopOnEve) => {
      for (let i = 0; i < 200 && (await hm()) < target; i++) {
        await p.clock.runFor(10 * 60000); await p.waitForTimeout(30);
        const open = await p.evaluate(() => document.getElementById('sys').open);
        if (open) {
          if (await p.locator('#sysBody [data-p=prayed]').count()) await p.click('#sysBody [data-p=prayed]');
          else if (stopOnEve && (await p.textContent('#sysBody')).includes('جهّز يوم بكرة')) return true;
          else await p.click('#sysBody button >> nth=-1');
        }
      }
      return false;
    };
    const eve = await advance(21 * 60 + 5, true);
    ok(eve, 'ظهر حوار "جهّز يوم بكرة" الساعة 21:00');
    if (eve) { ok((await p.textContent('#sysBody')).includes('بكرة'), 'الحوار بيذكر بكرة'); await shot(p, '07-eve'); await p.click('#sysBody [data-i=l]'); }
    await advance(23 * 60 + 5, false);
    const reports = await p.evaluate(() => JSON.parse(localStorage.getItem('mk3')).recs.report);
    const ids = Object.keys(reports);
    ok(ids.length >= 1, 'اتحفظ تقرير في التخزين المحلي: ' + ids.join(','));
    const r = reports[ids[ids.length - 1]];
    ok(r && r.d.final === true && typeof r.d.pct === 'number' && r.d.total === 1 && r.d.done === 1 && r.d.pct === 100, 'التقرير: 1 من 1 = 100% ' + JSON.stringify(r && { t: r.d.total, d: r.d.done, p: r.d.pct, pr: r.d.prayed }));
    await p.click('[data-tab=dash]', { force: true }); await p.clock.runFor(300); await p.waitForTimeout(300); await shot(p, '08-dash');
    ok(await p.locator('.rep').count() >= 1, 'التقرير ظاهر في لوحتي');
  });

  await step('7) الاستمرارية بعد إعادة التحميل + نقل بيانات الإصدار القديم', async () => {
    await p.reload(); await p.waitForTimeout(500);
    ok(await p.evaluate(() => !!JSON.parse(localStorage.getItem('mk3')).recs.task && Object.keys(JSON.parse(localStorage.getItem('mk3')).recs.task).length === 2), 'المهام فضلت بعد التحميل');
    ok(await p.locator('#ob').isHidden(), 'مفيش onboarding تاني');
  });
  ok(errs.length === 0, 'مفيش أخطاء كونسول في الوضع المحلي ' + (errs[0] || ''));

  /* ---------------- وضع جوجل مع Supabase وهمي ---------------- */
  const fake = { rows: [], calls: [] };
  const stubLib = `
    (function(){
      const state = window.__fake = { rows: [], upserts: 0, signed: false, cb: null, invoked: 0 };
      const user = { id: 'u-123', email: 'ahmed@example.com' }, session = { user };
      function q(table){ let filt = null; const o = {
        upsert: async (rows) => { state.upserts++; for (const r of rows) { const i = state.rows.findIndex(x => x.kind===r.kind && x.id===r.id); const row = { ...r, server_at: new Date(Date.now()+state.rows.length).toISOString() }; if (i>=0) state.rows[i]=row; else state.rows.push(row);} return { error: null }; },
        select: () => o, order: () => o, limit: () => o,
        gt: (c, v) => { filt = v; return o; },
        then: (res) => res({ data: state.rows.filter(r => !filt || r.server_at > filt).slice(0,500), error: null })
      }; return o; }
      window.supabase = { createClient: () => ({
        auth: {
          getSession: async () => ({ data: { session: state.signed ? session : null } }),
          onAuthStateChange: (cb) => { state.cb = cb; return { data: {} }; },
          signInWithOAuth: async () => { state.signed = true; setTimeout(()=>state.cb('SIGNED_IN', session), 50); return { error: null }; },
          signOut: async () => { state.signed = false; state.cb('SIGNED_OUT', null); }
        },
        from: q,
        functions: { invoke: async () => { state.invoked++; return { data: { ok: true, to: user.email }, error: null }; } }
      }) };
    })();`;
  const route = async ctx => {
    await ctx.route('**/js/vendor/supabase.js', r => r.fulfill({ contentType: 'text/javascript', body: stubLib }));
    await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export const SUPABASE_URL='https://x.supabase.co'; export const SUPABASE_ANON_KEY='anon';" }));
  };
  const { page: c, errs: errs2 } = await fresh(browser, { route, ctxOpts: { serviceWorkers: 'block' } });
  await step('8) وضع جوجل: تسجيل دخول ومزامنة', async () => {
    await c.click('[data-c=cloud]');
    await c.waitForSelector('#ob', { state: 'hidden' });
    await c.waitForFunction(() => document.querySelector('#syncTxt').textContent === 'متزامن', null, { timeout: 8000 }).catch(() => {});
    await c.fill('#q', 'مهمة سحابية 9ص'); await c.press('#q', 'Enter');
    await c.clock.runFor(3000); await c.waitForTimeout(200);
    const st = await c.evaluate(() => ({ n: window.__fake.rows.filter(r => r.kind === 'task').length, u: window.__fake.upserts, row: window.__fake.rows.find(r => r.kind === 'task') }));
    ok(st.n === 1, 'المهمة اترفعت للسيرفر (' + st.n + ')');
    ok(st.row && st.row.user_id === 'u-123' && st.row.data.title === 'مهمة سحابية' && !st.row.deleted, 'الصف فيه user_id والبيانات صح');
    ok((await c.textContent('#syncTxt')) === 'متزامن', 'مؤشر: متزامن');
    // حذف
    await c.click('[data-act=menu]'); await c.click('#sheetBody [data-x=del]');
    await c.clock.runFor(3000); await c.waitForTimeout(200);
    const del = await c.evaluate(() => window.__fake.rows.find(r => r.kind === 'task').deleted);
    ok(del === true, 'الحذف اتزامن كـ soft delete');
  });
  await step('9) إعدادات الإيميل والتقرير التجريبي', async () => {
    await c.click('[data-tab=more]'); await c.clock.runFor(300); await c.waitForTimeout(300);
    await c.evaluate(() => document.getElementById('s-email').click());
    await c.clock.runFor(2000); await c.waitForTimeout(200);
    const s = await c.evaluate(() => window.__fake.rows.find(r => r.kind === 'setting' && r.id === 'main'));
    ok(s && s.data.emailReport === true && s.data.tz === 'Africa/Cairo', 'emailReport و tz اتسجلوا في السحابة: ' + JSON.stringify(s && s.data));
    await c.click('[data-tab=dash]'); await c.clock.runFor(300); await c.waitForTimeout(300);
    await c.click('[data-act=test]'); await c.waitForTimeout(300);
    ok(await c.evaluate(() => window.__fake.invoked) === 1, 'زرار التقرير التجريبي بينده الدالة');
    await shot(c, '06-dash-cloud');
  });
  await step('10) تسجيل الخروج بيحافظ على البيانات محليًا', async () => {
    await c.click('[data-tab=more]'); await c.clock.runFor(300); await c.waitForTimeout(300); await c.click('[data-act=logout]'); await c.waitForTimeout(200);
    ok((await c.textContent('#syncTxt')) === 'على جهازك', 'رجع للوضع المحلي');
  });
  ok(errs2.length === 0, 'مفيش أخطاء كونسول في وضع السحابة ' + (errs2[0] || ''));

  await browser.close();
  console.log(fails ? `\n❌ ${fails} فشل` : '\n✅ كل الاختبارات نجحت');
  process.exit(fails ? 1 : 0);
})();
