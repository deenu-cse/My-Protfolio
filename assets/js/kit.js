/*!
 * kit.js — vanilla ports of the portfolio-kit React components (SpotlightReveal, ScrollWalker, CursorBuddy).
 * Each returns a frame(nowMs) function; the page runs it only while the element is on screen.
 */
(function (root) {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // page-wide pointer
  const ptr = { x: 0, y: 0, has: false };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; }, { passive: true });

  /* Halftone + sketch print; the pointer is a lens that shows the real photo. Drifts when idle. */
  function Spotlight(stage, fig, real, ring, opt = {}) {
    const radius = opt.radius || 110;
    const s = { x: 0.5, y: 0.3, tx: 0.5, ty: 0.3, r: 0, tr: radius, last: -9 };
    stage.addEventListener('pointermove', (e) => {
      const f = fig.getBoundingClientRect();
      s.tx = (e.clientX - f.left) / f.width; s.ty = (e.clientY - f.top) / f.height;
      s.last = performance.now() / 1000; s.tr = e.pointerType === 'touch' ? radius * 1.2 : radius;
    });
    stage.addEventListener('pointerdown', () => { s.tr = radius * 1.4; });
    stage.addEventListener('pointerup', () => { s.tr = radius; });
    stage.addEventListener('pointerleave', () => { s.last = -9; });
    return function frame(now) {
      const t = reduce() ? 0 : now / 1000;
      if (now / 1000 - s.last > 1.2) { s.tx = 0.5 + Math.sin(t * 0.7) * 0.3; s.ty = 0.4 + Math.sin(t * 1.13) * 0.28; }
      s.x += (s.tx - s.x) * 0.14; s.y += (s.ty - s.y) * 0.14; s.r += (s.tr - s.r) * 0.12;
      const f = fig.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const m = `radial-gradient(circle ${s.r.toFixed(1)}px at ${(s.x * 100).toFixed(2)}% ${(s.y * 100).toFixed(2)}%, #000 98%, transparent 100%)`;
      real.style.webkitMaskImage = m; real.style.maskImage = m;
      ring.style.width = ring.style.height = `${(s.r * 2).toFixed(1)}px`;
      ring.style.left = `${(f.left - sr.left + s.x * f.width).toFixed(1)}px`;
      ring.style.top = `${(f.top - sr.top + s.y * f.height).toFixed(1)}px`;
    };
  }

  /* Scroll-driven walk across the stack; skills light up as he passes; shades on at 100%. */
  function Walker(box, svg, g, pctEl, tagsEl, skills, accent = '#EE3349') {
    const pos = (i) => 0.1 + i * (0.8 / Math.max(1, skills.length - 1));
    const tags = skills.map((sk, i) => {
      const s = document.createElement('span');
      s.textContent = sk; s.style.left = `${pos(i) * 100}%`;
      tagsEl.appendChild(s); return s;
    });
    const st = { p: 0, ph: 0, lastX: null, moveT: 0, dir: 1 };
    return function frame(now) {
      const t = now / 1000, r = box.getBoundingClientRect(), vh = innerHeight;
      const target = clamp((vh * 0.88 - r.top) / (vh * 0.88 - vh * 0.12 + r.height * 0.2));
      st.p += (target - st.p) * 0.12;
      const sc = r.height / 330, worldW = r.width / sc;
      svg.setAttribute('viewBox', `0 0 ${worldW.toFixed(1)} 330`);
      const x = 40 + st.p * (worldW - 120);
      if (st.lastX !== null && Math.abs(x - st.lastX) > 0.25) { st.ph += Math.abs(x - st.lastX) / (256 * 0.33); st.moveT = t; st.dir = x < st.lastX ? -1 : 1; }
      st.lastX = x;
      const moving = t - st.moveT < 0.12, done = st.p > 0.97;
      root.Toon.draw(g, {
        x, ground: 250, scale: 0.33, mode: moving ? 'walk' : 'idle', facing: st.dir, phase: st.ph, t,
        shades: done ? 1 : 0, mouth: done ? 'smile' : 'flat', wave: st.p > 0.985 && !moving ? 1 : 0,
      });
      const fx = x / worldW;
      tags.forEach((el, i) => el.classList.toggle('is-lit', fx >= pos(i) - 0.01));
      pctEl.textContent = `${Math.round(st.p * 100)}%`;
    };
  }

  /* Watches the cursor, turns, blinks, waves on hover, drops aviators on click / Enter. */
  function Buddy(box, g, vb = { x: 0, w: 800 }) {
    const s = { shades: 0, on: false, wave: 0, waveUntil: 0, facing: 1 };
    const toggle = () => { s.on = !s.on; s.waveUntil = performance.now() / 1000 + 1.1; };
    box.addEventListener('click', toggle);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    box.addEventListener('pointerenter', () => { s.waveUntil = performance.now() / 1000 + 1.4; });
    return function frame(now) {
      const t = now / 1000, r = box.getBoundingClientRect();
      const sc = Math.min(r.width / vb.w, r.height / 440);
      const ox = r.left + (r.width - vb.w * sc) / 2 - vb.x * sc, oy = r.top + (r.height - 440 * sc);
      const headX = ox + 400 * sc, headY = oy + (430 - 310) * sc;
      const dx = (ptr.has ? ptr.x : headX + 200) - headX, dy = (ptr.has ? ptr.y : headY) - headY;
      if (Math.abs(dx) > 40) s.facing = dx < 0 ? -1 : 1;
      const look = [clamp(Math.abs(dx) / 300) * 0.9, clamp(dy / 260, -1, 1)];
      const target = s.on ? 1 : 0;
      s.shades += (target - s.shades) * (target > s.shades ? 0.14 : 0.2);
      const waving = t < s.waveUntil;
      s.wave += ((waving ? 1 : 0) - s.wave) * 0.18;
      root.Toon.draw(g, {
        x: 400, ground: 430, scale: 0.54, mode: 'idle', facing: s.facing, t, look,
        shades: s.shades, wave: s.wave, blink: t % 4.2 > 4.05,
        mouth: s.on || waving ? 'smile' : look[1] < -0.6 ? 'o' : 'flat',
      });
    };
  }

  root.Kit = { Spotlight, Walker, Buddy, ptr };
})(window);
