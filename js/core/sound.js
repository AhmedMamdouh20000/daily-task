/* الصوت: تنبيه قصير (Web Audio) + الأذان (ملف مدمج، أو ملف المستخدم لو رفع واحد) */
const DB = 'mk3-media', ST = 'files';
let ctx = null, customUrl = null, playing = false;

const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction(ST, mode), q = fn(t.objectStore(ST)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };

export async function loadCustomAdhan() {
  try { const b = await tx('readonly', s => s.get('adhan')); if (b) { customUrl = URL.createObjectURL(b); return b.name || 'مخصص'; } } catch { /* ignore */ }
  return null;
}
export async function setCustomAdhan(file) { await tx('readwrite', s => s.put(file, 'adhan')); if (customUrl) URL.revokeObjectURL(customUrl); customUrl = URL.createObjectURL(file); }
export async function clearCustomAdhan() { await tx('readwrite', s => s.delete('adhan')); if (customUrl) URL.revokeObjectURL(customUrl); customUrl = null; }
export const hasCustom = () => !!customUrl;

export function unlock() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { /* ignore */ }
}
addEventListener('pointerdown', unlock, { once: true, capture: true });
addEventListener('keydown', unlock, { once: true, capture: true });

export function beep(times = 3) {
  try {
    unlock(); if (!ctx) return;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.38;
      o.type = 'sine'; o.frequency.setValueAtTime(i % 2 ? 880 : 1175, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.34);
    }
  } catch { /* ignore */ }
}

export function playAdhan() {
  const el = document.getElementById('adhanEl');
  if (!el) return Promise.resolve(false);
  el.src = customUrl || 'assets/adhan.mp3';
  el.currentTime = 0; playing = true;
  return el.play().then(() => true).catch(() => { playing = false; return false; });
}
export function stopAdhan() { const el = document.getElementById('adhanEl'); if (el) { el.pause(); el.currentTime = 0; } playing = false; }
export const adhanPlaying = () => playing && !document.getElementById('adhanEl').paused;
