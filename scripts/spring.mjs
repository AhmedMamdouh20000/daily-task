// يولّد easing زنبركي بصيغة CSS linear()
function spring(k, c, m = 1, n = 40) {
  const pts = []; let x = 0, v = 0; const dt = 1 / 240, T = 1.2;
  for (let t = 0; t <= T; t += dt) { const a = (-k * (x - 1) - c * v) / m; v += a * dt; x += v * dt; pts.push(x); }
  const out = []; const step = Math.floor(pts.length / n);
  for (let i = 0; i < pts.length; i += step) out.push(+pts[i].toFixed(3));
  out.push(1); return 'linear(' + out.join(', ') + ')';
}
console.log('SPRING=' + spring(170, 22));
console.log('BOUNCE=' + spring(190, 12));
