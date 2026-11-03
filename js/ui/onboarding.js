/* شاشة البداية: اختيار مكان التخزين */
import { $, html, render } from '../core/util.js';
import * as store from '../core/store.js';
import { startCloud } from '../features/more.js';

export function showOnboarding(onDone) {
  const el = $('#ob'); el.hidden = false;
  render(el, html`<div class="box">
    <div class="logo">مُخطّطي</div>
    <p>مهامك بمواعيدها، مواقيت الصلاة، ميزانية الشهر، وتقرير آخر اليوم. كله في مكان واحد.</p>
    <div class="field"><label class="lbl" for="ob-name" style="color:#fff;opacity:.85">اسمك (اختياري)</label><input class="in" id="ob-name" maxlength="30" autocomplete="given-name" placeholder="أحمد"></div>
    <p style="margin-top:4px;font-weight:600">فين تحب نحفظ بياناتك؟</p>
    <button class="opt" data-c="local"><svg viewBox="0 0 24 24"><use href="#i-phone"/></svg><div><b>على جهازي بس</b><span>من غير حساب. بياناتك في المتصفح ومتخرجش منه. تقدر تاخد نسخة احتياطية.</span></div></button>
    <button class="opt" data-c="cloud"><svg viewBox="0 0 24 24"><use href="#i-cloud"/></svg><div><b>سجّل بجوجل</b><span>بياناتك على حسابك ومتزامنة بين الموبايل واللاب، والتقرير اليومي يوصلك على Gmail.</span></div></button>
  </div>`);
  el.onclick = async e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    const name = $('#ob-name', el).value.trim();
    if (name) store.setSettings({ name });
    if (b.dataset.c === 'local') { store.setMeta({ mode: 'local', onboarded: true }); el.hidden = true; el.replaceChildren(); onDone && onDone(); }
    else { const ok = await startCloud(); if (!ok && !store.meta().onboarded) store.setMeta({ mode: 'local' }); if (!ok) { /* بيفضل في الشاشة */ } }
  };
}
export const hideOnboarding = () => { const el = $('#ob'); el.hidden = true; el.replaceChildren(); };
