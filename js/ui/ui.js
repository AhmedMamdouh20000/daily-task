/* مكوّنات واجهة مشتركة: توست، شيت سفلي، حوار النظام (للصلاة والمنبّه) */
import { $, html, raw, render, esc } from '../core/util.js';

let tt = 0;
export function toast(msg) {
  const t = $('#toast'); t.replaceChildren();
  const d = document.createElement('div'); d.textContent = msg; t.appendChild(d);
  clearTimeout(tt); tt = setTimeout(() => t.replaceChildren(), 3100);
}

const sheetEl = () => $('#sheet'), sysEl = () => $('#sys');
export function sheet(content, onMount) {
  const d = sheetEl();
  render($('#sheetBody'), html`<div class="grab"></div>${content}`);
  if (!d.open) d.showModal();
  d.querySelector('.sheet').scrollTop = 0;
  if (onMount) onMount($('#sheetBody'));
}
export const closeSheet = () => { const d = sheetEl(); if (d.open) d.close(); };
export const sheetOpen = () => sheetEl().open;

export function sys(content, { forced = false, onMount } = {}) {
  const d = sysEl();
  d.dataset.forced = forced ? '1' : '';
  render($('#sysBody'), content);
  if (!d.open) d.showModal();
  if (onMount) onMount($('#sysBody'));
}
export const closeSys = () => { const d = sysEl(); d.dataset.forced = ''; if (d.open) d.close(); };
export const sysOpen = () => sysEl().open;

export function wireDialogs() {
  sheetEl().addEventListener('click', e => { if (e.target === sheetEl()) closeSheet(); });
  sysEl().addEventListener('cancel', e => { if (sysEl().dataset.forced === '1') e.preventDefault(); });
  sysEl().addEventListener('click', e => { if (e.target === sysEl() && sysEl().dataset.forced !== '1') closeSys(); });
}

export const sw = (id, on) => html`<span class="sw"><input type="checkbox" id="${id}" ${on ? raw('checked') : ''}><i></i></span>`;
export { esc };
