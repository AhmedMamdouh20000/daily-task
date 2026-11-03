/* قوس اليوم: من الفجر للعشاء، الشمس/القمر بتتحرك عليه، وعلامات الصلوات الخمس */
import { html, raw } from '../core/util.js';
import { KEYS, NAMES } from '../core/prayer.js';

const P0 = [20, 112], P1 = [160, -38], P2 = [300, 112];
const pt = t => [(1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0], (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]];
const clamp01 = v => Math.min(1, Math.max(0, v));

export function skyOf(now, t) {
  if (!t) return 'day';
  const m = 60000;
  if (now < t.fajr) return 'night';
  if (now < new Date(t.sunrise.getTime() + 30 * m)) return 'dawn';
  if (now < new Date(t.maghrib.getTime() - 40 * m)) return 'day';
  if (now < new Date(t.isha.getTime())) return 'dusk';
  return 'night';
}

/* t: مواقيت اليوم، st: { fajr:'prayed'|... } */
export function arcSVG(now, t, st) {
  if (!t) return raw('');
  const span = t.isha - t.fajr, at = d => clamp01((d - t.fajr) / span);
  const pos = at(now), night = now < t.fajr || now > t.isha, [sx, sy] = pt(pos);
  const ticks = KEYS.map(k => {
    const p = at(t[k]), [x, y] = pt(p), s = st && st[k];
    return html`<circle class="tick ${s === 'prayed' ? 'ok' : s === 'missed' ? 'miss' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6.5"/><text class="lbl" x="${x.toFixed(1)}" y="${(y + 20).toFixed(1)}">${NAMES[k]}</text>`;
  });
  const body = night
    ? html`<circle cx="0" cy="0" r="10" fill="#E6EEFF"/><circle cx="5" cy="-3" r="8.5" style="fill:var(--sky-b,#06142a)"/>`
    : html`<circle cx="0" cy="0" r="17" fill="#F2B454" opacity=".28"/><circle cx="0" cy="0" r="10" fill="#FFC95C"/>`;
  return html`<svg class="arc" viewBox="-20 0 360 146" role="img" aria-label="موضع الشمس بين الفجر والعشاء">
    <path class="track" d="M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}"/>
    <path class="done" pathLength="1" stroke-dasharray="${pos.toFixed(3)} 1" d="M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}"/>
    ${ticks}
    <g class="body" style="transform:translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)">${body}</g>
  </svg>`;
}
