// Petites fonctions pures : couleurs, interpolation, angles.

export function hexToRgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
export function shade(rgb, k) {
  return rgb.map(function (c) { return Math.max(0, Math.min(255, Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))); });
}
export function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
export function lerp(a, b, t) { return a + (b - a) * t; }
// Melange partiel de deux couleurs [r,g,b] (k = part de b), et couleur hex teintee par une
// souche (rendu du sac) ; currentStrain = souche du sac, null si standard.
export function mixRgb(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
export function easeOutBack(t) { var c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
export function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
export function angleDiff(a, b) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
