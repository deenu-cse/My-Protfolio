/*!
 * toon.js — "Deenu" cartoon character (SVG, no dependencies)
 * Draws the character into an <svg> <g> for any pose, every frame.
 *
 *   Toon.defs()                                 // once per page
 *   Toon.draw(gElement, {
 *     x, ground, scale=1, facing=1,              // placement (x = feet centre)
 *     mode: 'push' | 'walk' | 'idle',
 *     phase,                                     // gait phase (walk/push), 1 = one full cycle
 *     wall,                                      // push: wall x in LOCAL px in front of hips (default 322)
 *     look: [x,y],                               // -1..1 where the eyes look
 *     shades: 0..1,                              // aviators (0 = off, animates a drop-in)
 *     wave: 0..1, t,                             // idle wave amount + time (s) for waving
 *     strain: 0..1, blink: bool, mouth: 'smile'|'grit'|'flat'|'o'
 *   })
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const deg = Math.PI / 180;
  const OUT = 6;
  const C = {
    ink: '#000', skin: '#fff', skinFar: '#ececec',
    shirt: '#202020', shirtFar: '#141414',
    jeans: '#b4b4b4', jeansFar: '#8c8c8c',
    shoe: '#a3a3a3', shoeFar: '#7d7d7d', hair: '#0d0d0d',
  };

  // One shared, always-rendered <defs> holder for the whole page (patterns inside
  // display:none elements don't paint, so never rely on a per-svg copy).
  function defs() {
    if (document.getElementById('tn-dots')) return;
    const holder = document.createElementNS(NS, 'svg');
    holder.setAttribute('width', '0'); holder.setAttribute('height', '0');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = `<defs>
      <pattern id="tn-dots" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
        <circle cx="3.5" cy="3.5" r="1.25" fill="#6f6f6f"/></pattern>
      <pattern id="tn-stripes" width="9" height="20" patternUnits="userSpaceOnUse">
        <rect width="9" height="20" fill="#202020"/>
        <line x1="4.5" y1="0" x2="4.5" y2="20" stroke="#353535" stroke-width="1.6"/></pattern></defs>`;
    (document.body || document.documentElement).appendChild(holder);
  }

  // ---------- small helpers ----------
  const f1 = (n) => (+n).toFixed(1);
  const P = (pts) => pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ');
  function mk(parent) {
    const el = (tag, attrs, p) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      (p || parent).appendChild(e);
      return e;
    };
    const limb = (pts, w, fill, p) => {
      el('polyline', { points: P(pts), fill: 'none', stroke: C.ink, 'stroke-width': w + OUT * 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p);
      el('polyline', { points: P(pts), fill: 'none', stroke: fill, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, p);
    };
    return { el, limb };
  }
  function ik(a, b, la, lb, pick) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    let d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(la - lb) + 1, Math.min(la + lb - 0.5, d));
    const th = Math.atan2(dy, dx);
    const al = Math.acos(Math.min(1, Math.max(-1, (la * la + d * d - lb * lb) / (2 * la * d))));
    const j1 = [a[0] + la * Math.cos(th - al), a[1] + la * Math.sin(th - al)];
    const j2 = [a[0] + la * Math.cos(th + al), a[1] + la * Math.sin(th + al)];
    const j = pick(j1, j2);
    const ang = Math.atan2(b[1] - j[1], b[0] - j[0]);
    return { j, e: [j[0] + lb * Math.cos(ang), j[1] + lb * Math.sin(ang)] };
  }
  const rot = (p, o, a) => {
    const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1];
    return [o[0] + x * c - y * s, o[1] + x * s + y * c];
  };

  // ---------- gaits: foot {x (rel. hips), lift, ang} ----------
  function gait(ph, front, back, lift, heel) {
    ph = ((ph % 1) + 1) % 1;
    const st = 0.6;
    if (ph < st) {
      const u = ph / st;
      return { x: front + (back - front) * u, lift: 0, ang: u > 0.7 ? ((u - 0.7) / 0.3) * heel * deg : 0 };
    }
    const u = (ph - st) / (1 - st);
    return {
      x: back + (front - back) * (0.5 - 0.5 * Math.cos(Math.PI * u)),
      lift: lift * Math.sin(Math.PI * u),
      ang: (1 - u) * heel * deg - Math.sin(Math.PI * u) * 6 * deg,
    };
  }

  // ---------- parts ----------
  function shoe(c, ank, ang, far) {
    const g = c.el('g', { transform: `translate(${f1(ank[0])},${f1(ank[1])}) rotate(${f1(ang / deg)})` });
    c.el('path', { d: 'M-30,10 L66,10 Q76,10 75,20 L74,24 Q72,29 64,29 L-28,29 Q-36,29 -36,20 Q-36,10 -30,10 Z', fill: '#fff', stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    const up = 'M-30,12 L-26,-22 Q-10,-30 8,-24 Q22,-8 44,-4 Q70,0 72,12 Z';
    c.el('path', { d: up, fill: far ? C.shoeFar : C.shoe, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: up, fill: 'url(#tn-dots)', opacity: 0.55 }, g);
    c.el('path', { d: 'M6,-20 L16,-12 M14,-16 L24,-9 M22,-11 L32,-6', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round', fill: 'none' }, g);
    c.el('path', { d: 'M-14,4 Q14,-2 50,6', stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', fill: 'none' }, g);
    c.el('path', { d: 'M-30,19 L72,19', stroke: C.ink, 'stroke-width': 2.5, fill: 'none' }, g);
  }

  function leg(c, hip, foot, far) {
    const ank = [hip[0] + foot.x, -24 - foot.lift - Math.sin(foot.ang) * 48];
    const r = ik(hip, ank, 152, 150, (a, b) => (a[0] > b[0] ? a : b));
    c.limb([hip, r.j, r.e], 58, far ? C.jeansFar : C.jeans);
    c.el('polyline', { points: P([hip, r.j, r.e]), fill: 'none', stroke: 'url(#tn-dots)', 'stroke-width': 58, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: far ? 0.7 : 0.45 });
    const k = r.j;
    c.el('path', { d: `M${f1(k[0] - 10)},${f1(k[1] - 6)} q8,4 14,-2 M${f1(k[0] - 6)},${f1(k[1] + 8)} q8,2 12,-4`, fill: 'none', stroke: C.ink, 'stroke-width': 2.5, 'stroke-linecap': 'round' });
    const a = Math.atan2(r.e[1] - r.j[1], r.e[0] - r.j[0]);
    const h = [r.e[0] - Math.cos(a) * 14, r.e[1] - Math.sin(a) * 14];
    c.el('path', { d: `M${f1(h[0] - Math.sin(a) * 30)},${f1(h[1] + Math.cos(a) * 30)} L${f1(h[0] + Math.sin(a) * 30)},${f1(h[1] - Math.cos(a) * 30)}`, stroke: C.ink, 'stroke-width': 3 });
    shoe(c, r.e, foot.ang, far);
  }

  function torso(c, hip, lean) {
    const g = c.el('g', { transform: `translate(${f1(hip[0])},${f1(hip[1])}) rotate(${f1(lean)})` });
    const d = 'M-60,34 Q-70,-40 -62,-120 Q-58,-180 -26,-204 L34,-206 Q62,-186 64,-120 Q66,-40 60,34 Q30,44 0,40 Q-30,44 -60,34 Z';
    c.el('path', { d, fill: 'url(#tn-stripes)', stroke: C.ink, 'stroke-width': OUT, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M44,-196 Q50,-80 46,38', stroke: '#4c4c4c', 'stroke-width': 3, fill: 'none' }, g);
    for (let i = 0; i < 5; i++) c.el('circle', { cx: 47, cy: -170 + i * 44, r: 4, fill: '#d8d8d8', stroke: C.ink, 'stroke-width': 1.5 }, g);
    c.el('path', { d: 'M8,-206 L28,-178 L44,-206 Z', fill: '#fff', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-6,-210 L14,-196 L24,-214 M40,-212 L48,-190 L60,-200', fill: '#202020', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-30,-90 q20,10 40,4 M-40,-20 q24,12 52,2', stroke: '#4a4a4a', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' }, g);
  }

  function wallHand(c, wr, wallX, far) {
    const wy = wr[1], L = wallX - 34, top = wy - 52;
    c.el('path', {
      d: `M${L + 2},${wy + 16} Q${L - 6},${wy - 6} ${L + 6},${wy - 28} Q${L + 12},${top} ${wallX - 12},${top} Q${wallX},${top} ${wallX},${top + 12} L${wallX},${wy + 12} Q${wallX},${wy + 22} ${wallX - 12},${wy + 22} Q${L + 8},${wy + 24} ${L + 2},${wy + 16} Z`,
      fill: far ? C.skinFar : C.skin, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round',
    });
    for (let i = 0; i < 3; i++) { const x = wallX - 6 - i * 8; c.el('path', { d: `M${x},${top + 2 + i * 3} L${x - 1},${top + 18 + i * 3}`, stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }); }
    c.el('path', { d: `M${L + 4},${wy - 2} Q${L + 18},${wy - 18} ${L + 28},${wy - 6}`, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' });
  }
  function fist(c, wr, a, far) {
    const g = c.el('g', { transform: `translate(${f1(wr[0])},${f1(wr[1])}) rotate(${f1(a / deg)})` });
    c.el('path', { d: 'M-4,-18 Q22,-22 26,-4 Q28,16 8,20 Q-8,20 -10,6 Z', fill: far ? C.skinFar : C.skin, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M10,-14 L12,6 M18,-12 L19,4', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
  }
  function openHand(c, wr, a) {
    const g = c.el('g', { transform: `translate(${f1(wr[0])},${f1(wr[1])}) rotate(${f1(a / deg)})` });
    // fingers splayed along the arm direction (+x)
    const fingers = [[-34, 14], [-12, 22], [10, 22], [32, 16]];
    for (const [ang, len] of fingers) {
      const r = ang * deg, ex = Math.cos(r) * (22 + len), ey = Math.sin(r) * (22 + len);
      c.el('line', { x1: 8, y1: 0, x2: f1(ex + 8), y2: f1(ey), stroke: C.ink, 'stroke-width': 20, 'stroke-linecap': 'round' }, g);
      c.el('line', { x1: 8, y1: 0, x2: f1(ex + 8), y2: f1(ey), stroke: C.skin, 'stroke-width': 10, 'stroke-linecap': 'round' }, g);
    }
    c.el('line', { x1: 0, y1: 0, x2: 4, y2: 30, stroke: C.ink, 'stroke-width': 17, 'stroke-linecap': 'round' }, g); // thumb
    c.el('line', { x1: 0, y1: 0, x2: 4, y2: 30, stroke: C.skin, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    c.el('ellipse', { cx: 8, cy: 2, rx: 25, ry: 22, fill: C.skin, stroke: C.ink, 'stroke-width': 5 }, g);
  }

  // arm: hand = 'wall' | 'fist' | 'open' | 'pocket'
  function arm(c, sh, target, opt) {
    const { far, hand, wallX, elbowPick } = opt;
    const r = ik(sh, target, 122, 118, elbowPick || ((a, b) => (a[1] > b[1] ? a : b)));
    const el_ = r.j, wr = r.e;
    c.limb([sh, el_], 44, far ? C.shirtFar : C.shirt);
    c.limb([el_, wr], 30, far ? C.skinFar : C.skin);
    const fx = (el_[0] + wr[0]) / 2, fy = (el_[1] + wr[1]) / 2;
    c.el('path', { d: `M${f1(fx - 12)},${f1(fy - 4)} l5,-4 M${f1(fx + 2)},${f1(fy - 3)} l5,-4`, stroke: C.ink, 'stroke-width': 2, 'stroke-linecap': 'round' });
    const a = Math.atan2(wr[1] - el_[1], wr[0] - el_[0]);
    const cc = [el_[0] + Math.cos(a) * 10, el_[1] + Math.sin(a) * 10];
    const g = c.el('g', { transform: `translate(${f1(cc[0])},${f1(cc[1])}) rotate(${f1(a / deg)})` });
    c.el('rect', { x: -14, y: -27, width: 28, height: 54, rx: 10, fill: far ? C.shirtFar : '#262626', stroke: C.ink, 'stroke-width': 5 }, g);
    c.el('path', { d: 'M0,-24 L0,24', stroke: '#4a4a4a', 'stroke-width': 2 }, g);
    if (!far && hand !== 'pocket') {
      const wa = [wr[0] - Math.cos(a) * 16, wr[1] - Math.sin(a) * 16];
      const gw = c.el('g', { transform: `translate(${f1(wa[0])},${f1(wa[1])}) rotate(${f1(a / deg)})` });
      c.el('rect', { x: -6, y: -19, width: 12, height: 38, rx: 3, fill: C.ink }, gw);
    }
    if (hand === 'wall') wallHand(c, wr, wallX, far);
    else if (hand === 'fist') fist(c, wr, a, far);
    else if (hand === 'open') openHand(c, wr, a);
    else if (hand === 'pocket') {
      // jeans pocket patch swallowing the hand
      const g2 = c.el('g', { transform: `translate(${f1(wr[0])},${f1(wr[1])}) rotate(${f1(a / deg - 90)})` });
      c.el('path', { d: 'M-30,-6 Q0,-14 30,-6 L26,26 Q0,34 -26,26 Z', fill: far ? C.jeansFar : C.jeans, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g2);
      c.el('path', { d: 'M-30,-6 Q0,-14 30,-6 L26,26 Q0,34 -26,26 Z', fill: 'url(#tn-dots)', opacity: 0.45 }, g2);
      c.el('path', { d: 'M-22,0 Q0,-6 22,0', fill: 'none', stroke: C.ink, 'stroke-width': 3 }, g2);
    }
  }

  function head(c, ctr, o) {
    const { tilt = 0, strain = 0, blink = false, look = [0, 0], shades = 0, mouth } = o;
    const g = c.el('g', { transform: `translate(${f1(ctr[0])},${f1(ctr[1])}) rotate(${f1(tilt)})` });
    c.el('path', { d: 'M-62,6 Q-80,-30 -66,-62 Q-56,-92 -24,-100 Q4,-112 30,-98 Q56,-96 64,-72 Q74,-56 62,-40 L20,-46 Q-10,-40 -30,-20 Q-44,-6 -44,20 Q-56,22 -62,6 Z', fill: C.hair, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-40,-30 Q-40,-62 -6,-66 Q40,-70 52,-38 L56,-20 Q66,-10 60,-2 L56,2 Q60,10 56,18 Q54,40 40,58 Q20,74 -6,66 Q-34,56 -42,24 Z', fill: C.skin, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-34,8 Q-30,40 -10,58 Q12,74 38,62 Q52,52 56,30 Q48,40 40,38 Q30,30 18,36 Q8,40 -2,30 Q-12,18 -18,4 Q-24,-2 -34,8 Z', fill: '#111', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-20,40 l4,-6 M-8,52 l4,-6 M6,58 l4,-6 M22,56 l3,-6', stroke: '#3a3a3a', 'stroke-width': 2.5, 'stroke-linecap': 'round' }, g);
    c.el('path', { d: 'M30,24 Q42,16 56,22 Q50,30 40,28 Q34,30 30,24 Z', fill: '#111', stroke: C.ink, 'stroke-width': 3 }, g);
    const m = mouth || (strain > 0.5 ? 'grit' : 'flat');
    if (m === 'grit') {
      c.el('path', { d: 'M38,34 L54,32 L52,40 L40,40 Z', fill: '#fff', stroke: C.ink, 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
      c.el('path', { d: 'M44,33 L44,40 M49,33 L49,40', stroke: C.ink, 'stroke-width': 1.5 }, g);
    } else if (m === 'smile') {
      c.el('path', { d: 'M36,34 Q46,44 56,33', fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
    } else if (m === 'o') {
      c.el('ellipse', { cx: 48, cy: 37, rx: 5, ry: 6, fill: '#000' }, g);
    } else {
      c.el('path', { d: 'M40,36 Q48,34 54,36', fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    }
    c.el('path', { d: 'M50,-18 Q62,-4 60,6 Q54,10 48,6', fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-30,-6 Q-46,-12 -46,4 Q-44,20 -28,18', fill: C.skin, stroke: C.ink, 'stroke-width': 4.5 }, g);
    c.el('path', { d: 'M-36,0 Q-40,6 -34,10', fill: 'none', stroke: C.ink, 'stroke-width': 2.5 }, g);
    const by = -28 - (m === 'smile' ? 2 : 0) + look[1] * 2;
    c.el('path', { d: `M20,${by - 2} Q34,${by - 6} 48,${by + 2}`, fill: 'none', stroke: C.ink, 'stroke-width': 7, 'stroke-linecap': 'round' }, g);
    if (blink || strain > 0.5) {
      c.el('path', { d: 'M28,-14 Q36,-20 44,-14', fill: 'none', stroke: C.ink, 'stroke-width': 3.5, 'stroke-linecap': 'round' }, g);
      if (strain > 0.5) c.el('path', { d: 'M26,-18 l-5,-3 M27,-12 l-6,1', stroke: C.ink, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
    } else {
      c.el('ellipse', { cx: 37, cy: -14, rx: 7, ry: 8, fill: '#fff', stroke: C.ink, 'stroke-width': 2 }, g);
      c.el('ellipse', { cx: f1(38 + look[0] * 3.5), cy: f1(-14 + look[1] * 3.5), rx: 4, ry: 5.5, fill: '#000' }, g);
    }
    c.el('path', { d: 'M-46,-30 Q-58,-70 -30,-96 Q-6,-124 30,-112 Q60,-106 70,-80 Q78,-60 62,-46 Q66,-62 50,-68 Q44,-48 26,-50 Q30,-62 18,-66 Q12,-50 -4,-52 Q-2,-40 -16,-34 Q-18,-14 -30,-6 Q-40,-14 -46,-30 Z', fill: C.hair, stroke: C.ink, 'stroke-width': 5, 'stroke-linejoin': 'round' }, g);
    c.el('path', { d: 'M-30,-80 Q-6,-100 24,-96 M-20,-66 Q4,-84 36,-82 M40,-100 Q58,-92 62,-74', fill: 'none', stroke: '#5c5c5c', 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
    c.el('path', { d: 'M-30,-6 Q-24,0 -26,14 L-34,10 Z', fill: '#111' }, g);
    if (shades > 0) {
      const drop = (1 - Math.min(1, shades)) * 240;
      const sg = c.el('g', { transform: `translate(0,${f1(-drop)})` }, g);
      c.el('path', { d: 'M20,-6 L-32,-4', stroke: C.ink, 'stroke-width': 4.5, 'stroke-linecap': 'round' }, sg);
      c.el('path', { d: 'M18,-24 Q40,-30 60,-24 Q62,-8 52,0 Q36,8 24,0 Q14,-10 18,-24 Z', fill: '#151515', stroke: C.ink, 'stroke-width': 4.5, 'stroke-linejoin': 'round' }, sg);
      c.el('path', { d: 'M26,-18 L36,-22 M24,-10 L42,-20', stroke: '#9a9a9a', 'stroke-width': 3, 'stroke-linecap': 'round' }, sg);
      c.el('path', { d: 'M60,-24 L66,-22', stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round' }, sg);
    }
  }

  function effort(c, ctr, t, strain) {
    if (strain < 0.3) return;
    const flick = Math.floor(t * 12) % 2;
    const g = c.el('g', { transform: `translate(${f1(ctr[0])},${f1(ctr[1])})`, opacity: Math.min(1, strain) });
    const dy = (t * 60) % 30;
    c.el('path', { d: `M86,${f1(-60 + dy)} q6,10 0,14 q-6,-4 0,-14 Z`, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, g);
    c.el('path', { d: `M72,${f1(-84 + dy * 0.6)} q5,8 0,11 q-5,-3 0,-11 Z`, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, g);
    c.el('path', { d: flick ? 'M-130,-10 l10,-6 M-136,4 l12,-4 M-130,18 l10,-2' : 'M-126,-6 l10,-6 M-132,8 l12,-4', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, g);
  }

  // ---------- main ----------
  function draw(G, o) {
    defs();
    while (G.firstChild) G.removeChild(G.firstChild);
    const s = o.scale || 1, fc = o.facing || 1;
    const root = document.createElementNS(NS, 'g');
    root.setAttribute('transform', `translate(${f1(o.x || 0)},${f1(o.ground || 0)}) scale(${s * fc},${s})`);
    G.appendChild(root);
    const c = mk(root);
    const t = o.t || 0, ph = o.phase || 0, mode = o.mode || 'idle';
    const look = o.look || [0, 0];
    let lean, hip, nearFoot, farFoot, armsNear, armsFar;

    if (mode === 'push') {
      lean = 31;
      const bob = Math.abs(Math.sin(ph * 2 * Math.PI)) * 9;
      const jit = (o.strain || 0) > 0.6 ? Math.sin(t * 90) * 2.2 : 0;
      hip = [jit, -318 + bob];
      nearFoot = gait(ph, 34, -175, 34, 28); farFoot = gait(ph + 0.5, 34, -175, 34, 28);
    } else if (mode === 'walk') {
      lean = 6;
      const bob = Math.abs(Math.sin(ph * 2 * Math.PI)) * 10;
      hip = [0, -322 + bob];
      nearFoot = gait(ph, 64, -64, 40, 16); farFoot = gait(ph + 0.5, 64, -64, 40, 16);
    } else {
      lean = 2 + look[0] * 2;
      const br = Math.sin(t * 2.2) * 2;
      hip = [0, -318 + br * 0.4];
      nearFoot = { x: 26, lift: 0, ang: 0 }; farFoot = { x: -30, lift: 0, ang: 0 };
    }
    const L = lean * deg;
    const sh = rot([hip[0], hip[1] - 178], hip, L);
    const neck = rot([hip[0] + 18, hip[1] - 206], hip, L);
    const hc = rot([hip[0] + 30 + lean * 0.45, hip[1] - 262], hip, L);
    const tilt = (mode === 'push' ? -8 : 0) + look[1] * 6 + (mode === 'idle' ? Math.sin(t * 1.3) * 1.5 : 0);

    // far arm
    const shF = [sh[0] - 6, sh[1] + 4];
    if (mode === 'push') arm(c, shF, [o.wall - 14, sh[1] - 22], { far: true, hand: 'wall', wallX: o.wall });
    else if (mode === 'walk') {
      const a = Math.sin(ph * 2 * Math.PI) * 30 * deg; // opposite of near leg
      arm(c, shF, [shF[0] + Math.sin(a) * 200, shF[1] + Math.cos(a) * 200], { far: true, hand: 'fist', elbowPick: (p, q) => (p[0] < q[0] ? p : q) });
    } else arm(c, shF, [hip[0] - 22 + Math.sin(t * 2.2) * 2, hip[1] + 34], { far: true, hand: 'fist', elbowPick: (p, q) => (p[0] < q[0] ? p : q) });

    leg(c, [hip[0] - 6, hip[1]], farFoot, true);
    leg(c, [hip[0] + 6, hip[1] + 4], nearFoot, false);
    c.limb([neck, [hc[0] - 10, hc[1] + 30]], 34, C.skin);
    torso(c, hip, lean);
    head(c, hc, { tilt, strain: o.strain || 0, blink: o.blink, look, shades: o.shades || 0, mouth: o.mouth });

    // near arm
    if (mode === 'push') arm(c, sh, [o.wall - 12, sh[1] + 6], { hand: 'wall', wallX: o.wall });
    else if (mode === 'walk') {
      const a = -Math.sin(ph * 2 * Math.PI) * 30 * deg;
      arm(c, sh, [sh[0] + Math.sin(a) * 200, sh[1] + Math.cos(a) * 200], { hand: 'fist', elbowPick: (p, q) => (p[0] < q[0] ? p : q) });
    } else {
      const w = Math.max(0, Math.min(1, o.wave || 0));
      if (w > 0.02) {
        const sway = Math.sin(t * 12) * 30 * w;
        const down = [hip[0] + 24, hip[1] + 34], up = [sh[0] + 175 + sway * 0.4, sh[1] - 120 + Math.abs(sway) * 0.3];
        const tg = [down[0] + (up[0] - down[0]) * w, down[1] + (up[1] - down[1]) * w];
        arm(c, sh, tg, { hand: w > 0.4 ? 'open' : 'fist', elbowPick: (p, q) => (p[1] > q[1] ? p : q) });
      } else arm(c, sh, [hip[0] + 24 + Math.sin(t * 2.2 + 1) * 2, hip[1] + 34], { hand: 'fist', elbowPick: (p, q) => (p[0] < q[0] ? p : q) });
    }
    if (mode === 'push') effort(c, hc, t, o.strain || 0);
    return { head: hc, hip };
  }

  root.Toon = { defs, draw, gait };
})(typeof window !== 'undefined' ? window : globalThis);
