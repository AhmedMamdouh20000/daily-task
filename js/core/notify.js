/* إشعارات النظام + منع التكرار */
const seen = new Set();
export const once = key => { if (seen.has(key)) return false; seen.add(key); if (seen.size > 600) seen.delete(seen.values().next().value); return true; };

export const perm = () => ('Notification' in window ? Notification.permission : 'unsupported');
export async function ask() { if (!('Notification' in window)) return 'unsupported'; try { return await Notification.requestPermission(); } catch { return Notification.permission; } }

export async function notify(title, body, tag) {
  if (perm() !== 'granted') return false;
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
    const opt = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', dir: 'rtl', lang: 'ar', requireInteraction: true };
    if (reg && reg.showNotification) await reg.showNotification(title, opt); else new Notification(title, opt);
    return true;
  } catch { return false; }
}
