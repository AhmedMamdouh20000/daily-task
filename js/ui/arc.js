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

/* خلفية الهيرو: أفق مدينة بقباب ومآذن + كثبان (ألوانها من متغيرات السماء) */
const dome = (x, r, y) => `<path d="M${x - r} ${y}a${r} ${r} 0 0 1 ${2 * r} 0z"/><rect x="${x - r}" y="${y}" width="${2 * r}" height="${200 - y}"/><rect x="${x - 1.5}" y="${y - r - 14}" width="3" height="14"/>`;
const minaret = (x, h) => `<rect x="${x - 4}" y="${200 - h}" width="8" height="${h}"/><rect x="${x - 7}" y="${200 - h + 24}" width="14" height="4"/><path d="M${x - 4.5} ${200 - h}L${x} ${200 - h - 24}L${x + 4.5} ${200 - h}z"/>`;
const blk = (x, w, h) => `<rect x="${x}" y="${200 - h}" width="${w}" height="${h}"/>`;
const SCENE = `<svg class="scene" viewBox="0 0 800 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<g class="s1">${blk(0, 70, 40)}${blk(60, 50, 62)}${dome(215, 30, 138)}${minaret(268, 96)}${blk(285, 60, 52)}${blk(350, 40, 34)}${minaret(440, 112)}${dome(520, 46, 134)}${dome(466, 20, 160)}${dome(574, 20, 160)}${minaret(612, 112)}${blk(640, 50, 50)}${blk(695, 40, 70)}${blk(740, 60, 44)}</g>
<path class="s2" d="M0 200V158C110 132 230 150 340 160S560 150 680 138 780 142 800 146V200z"/>
<path class="s3" d="M0 200V178C130 160 260 184 400 176S650 160 800 176V200z"/>
</svg>`;
export const sceneSVG = () => raw(SCENE);
