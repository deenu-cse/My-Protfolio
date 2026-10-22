/*!
 * sarra.js — scenes for the SARRA case study. Every scene is deterministic: draw(t) renders time t (seconds),
 * so the same code drives the live page (requestAnimationFrame) and the video renderer (frame by frame).
 * Needs: uk-map-data.js (window.UK_MAP) and toon.js (window.Toon) for the migration scene.
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { ink: '#141312', paper: '#fdfbf6', red: '#EE3349', river: '#1d63d6', riverSoft: '#cfe0fb', garhwal: '#f1ebdf', kumaon: '#e7eef6', line: '#d9d0c0' };
  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const eio = (u) => { u = cl(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const eo = (u) => 1 - Math.pow(1 - cl(u), 3);
  const back = (u) => { u = cl(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ------------------------------------------------------------------ MAP */
  function MapScene(svg, opt = {}) {
    const M = root.UK_MAP, pad = 24;
    svg.setAttribute('viewBox', `${-pad} ${-pad} ${M.W + pad * 2} ${M.H + pad * 2}`);
    const o = Object.assign({ labels: true, towns: false, start: 0, speed: 520, particles: 3, fillDistricts: true, ink: C.ink }, opt);
    const gD = el('g', {}, svg), gGlow = el('g', {}, svg), gR = el('g', {}, svg), gP = el('g', {}, svg), gS = el('g', {}, svg), gL = el('g', {}, svg);
    const districts = M.districts.map((d) => {
      const p = el('path', { d: d.d, fill: o.fillDistricts ? (d.div === 'Garhwal' ? C.garhwal : C.kumaon) : 'none', stroke: o.ink, 'stroke-width': 1.3, 'stroke-linejoin': 'round', 'data-name': d.name, 'data-div': d.div }, gD);
      p.style.transition = 'fill .25s';
      return { ...d, el: p };
    });
    el('path', { d: M.state, fill: 'none', stroke: o.ink, 'stroke-width': 3.2, 'stroke-linejoin': 'round' }, gD);
    // rivers sorted north→south so they "flow" in order
    const rivers = M.rivers.slice().sort((a, b) => a.src[1] - b.src[1]).map((r, i) => {
      const w = r.major ? 5 : 3;
      const glow = el('path', { d: r.d, fill: 'none', stroke: C.riverSoft, 'stroke-width': w + 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gGlow);
      const p = el('path', { d: r.d, fill: 'none', stroke: C.river, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gR);
      const L = p.getTotalLength();
      [p, glow].forEach((x) => { x.style.strokeDasharray = `${L} ${L}`; x.style.strokeDashoffset = L; });
      const dots = Array.from({ length: o.particles }, () => el('circle', { r: r.major ? 3.2 : 2.4, fill: '#fff', opacity: 0 }, gP));
      const spring = el('circle', { cx: r.src[0], cy: r.src[1], r: 5, fill: C.river, opacity: 0 }, gS);
      const ring = el('circle', { cx: r.src[0], cy: r.src[1], r: 5, fill: 'none', stroke: C.river, 'stroke-width': 2, opacity: 0 }, gS);
      return { ...r, el: p, glow, L, dots, spring, ring, delay: i * 0.13 };
    });
    if (o.labels) districts.forEach((d) => {
      el('text', { x: d.c[0], y: d.c[1], 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 13, fill: o.ink, opacity: 0.75, 'pointer-events': 'none' }, gL, d.name.toUpperCase());
    });
    if (o.towns) M.towns.forEach((tw) => {
      el('circle', { cx: tw.p[0], cy: tw.p[1], r: 5, fill: C.red, stroke: C.paper, 'stroke-width': 2 }, gL);
      el('text', { x: tw.p[0] + 9, y: tw.p[1] + 4, 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 14, 'font-weight': 700, fill: C.red }, gL, tw.name);
    });
    function draw(t) {
      t -= o.start;
      for (const r of rivers) {
        const u = cl((t - r.delay) / (r.L / o.speed));
        const off = r.L * (1 - eio(u));
        r.el.style.strokeDashoffset = off; r.glow.style.strokeDashoffset = off;
        const sp = cl((t - r.delay + 0.2) / 0.3);
        r.spring.setAttribute('opacity', sp);
        const k = ((t * 0.8 + r.delay) % 1.6) / 1.6;
        r.ring.setAttribute('r', (5 + k * 16).toFixed(1)); r.ring.setAttribute('opacity', (sp * (1 - k)).toFixed(2));
        r.dots.forEach((d, j) => {
          if (u < 1) { d.setAttribute('opacity', 0); return; }
          const f = ((t * 60 / r.L) + j / r.dots.length) % 1;
          const pt = r.el.getPointAtLength(f * r.L);
          d.setAttribute('cx', pt.x.toFixed(1)); d.setAttribute('cy', pt.y.toFixed(1));
          d.setAttribute('opacity', (Math.sin(f * Math.PI) * 0.95).toFixed(2));
        });
      }
    }
    return { draw, districts, rivers, svg, total: Math.max(...rivers.map((r) => r.delay + r.L / o.speed)) };
  }

  /* ------------------------------------------------------- ARCHITECTURE */
  const NODES = [
    { k: 'user', t: 'Citizens & officers', s: 'browser, any device', info: 'Public pages, interactive watershed maps and government forms, open to anyone in the state.' },
    { k: 'tls', t: 'SSL / TLS', s: 'certificate + hardening', info: 'HTTPS end to end. SSL configuration hardened as part of the security audit.' },
    { k: 'iis', t: 'IIS reverse proxy', s: 'Windows Server · ITDA', info: 'IIS terminates HTTPS and forwards to the Node app. Security headers, including a nonce-based Content-Security-Policy, are set here.' },
    { k: 'pm2', t: 'PM2', s: 'process manager', info: 'Keeps the Node processes alive, restarts them on crash or reboot, and collects logs.' },
    { k: 'app', t: 'Next.js + Express', s: 'pages + REST API', info: 'Server-rendered Next.js pages with SEO across 16 routes, and an Express API behind the forms, maps and admin CRM.' },
    { k: 'db', t: 'MongoDB', s: 'on-prem · migrated', info: 'Moved from the cloud to on-premise government infrastructure with zero data loss.' },
  ];
  function icon(k, g, s = 1) {
    const st = { fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
    const P = (d, extra) => el('path', Object.assign({ d }, st, extra || {}), g);
    if (k === 'user') { P('M-20,-14 h40 v28 h-40 z'); P('M-20,-6 h40'); el('circle', { cx: -15, cy: -10, r: 1.6, fill: C.ink }, g); el('circle', { cx: -10, cy: -10, r: 1.6, fill: C.ink }, g); }
    if (k === 'tls') { P('M-12,-2 h24 v18 h-24 z'); P('M-7,-2 v-6 a7,7 0 0 1 14,0 v6'); el('circle', { cx: 0, cy: 7, r: 2.5, fill: C.ink }, g); }
    if (k === 'iis') { P('M-20,0 h12'); P('M-8,0 L6,-12 h14'); P('M-8,0 L6,12 h14'); P('M14,-16 l6,4 -6,4'); P('M14,8 l6,4 -6,4'); }
    if (k === 'pm2') { P('M12,-6 a13,13 0 1 0 2,10'); P('M14,-14 v9 h-9'); }
    if (k === 'app') { P('M-8,-14 q-6,0 -6,6 v4 q0,4 -5,4 q5,0 5,4 v4 q0,6 6,6'); P('M8,-14 q6,0 6,6 v4 q0,4 5,4 q-5,0 -5,4 v4 q0,6 -6,6'); }
    if (k === 'db') { el('ellipse', Object.assign({ cx: 0, cy: -11, rx: 15, ry: 5 }, st), g); P('M-15,-11 v22 a15,5 0 0 0 30,0 v-22'); P('M-15,0 a15,5 0 0 0 30,0'); }
  }
  function ArchScene(svg, opt = {}) {
    const o = Object.assign({ layout: 'h', start: 0, compact: false }, opt);
    const H = o.layout === 'h';
    const W = H ? 1200 : 760, HH = H ? 340 : 1180;
    svg.setAttribute('viewBox', `0 0 ${W} ${HH}`);
    const gE = el('g', {}, svg), gShield = el('g', {}, svg), gN = el('g', {}, svg), gP = el('g', {}, svg);
    const pos = NODES.map((n, i) => (H ? [100 + i * 200, 170] : [380, 90 + i * 178]));
    // edges
    const path = 'M' + pos.map((p) => p.join(',')).join('L');
    const edge = el('path', { d: path, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' }, gE);
    const edgeLen = edge.getTotalLength();
    // shield around tls + iis
    const a = pos[1], b = pos[2];
    const shield = H
      ? el('rect', { x: a[0] - 98, y: a[1] - 86, width: b[0] - a[0] + 196, height: 218, rx: 24, fill: 'none', stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, gShield)
      : el('rect', { x: a[0] - 330, y: a[1] - 80, width: 690, height: b[1] - a[1] + 160, rx: 24, fill: 'none', stroke: C.red, 'stroke-width': 3, 'stroke-dasharray': '10 8' }, gShield);
    const shieldLbl = H
      ? el('text', { x: (a[0] + b[0]) / 2, y: a[1] - 98, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 15, 'font-weight': 700, fill: C.red, 'letter-spacing': 1.5 }, gShield, 'CSP (NONCE) · SSL HARDENING · FIREWALL')
      : el('text', { x: a[0] + 346, y: a[1] - 92, 'text-anchor': 'end', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 17, 'font-weight': 700, fill: C.red, 'letter-spacing': 1.5 }, gShield, 'CSP (NONCE) · SSL · FIREWALL');
    const nodes = NODES.map((n, i) => {
      const [x, y] = pos[i];
      const g = el('g', { transform: `translate(${x},${y})`, 'data-k': n.k, tabindex: 0, role: 'button', 'aria-label': n.t }, gN);
      g.style.cursor = 'pointer'; g.style.outline = 'none';
      const box = el('rect', { x: -62, y: -50, width: 124, height: 100, fill: C.paper, stroke: C.ink, 'stroke-width': 3 }, g);
      const ig = el('g', { transform: 'translate(0,-6)' }, g); icon(n.k, ig);
      const tx = H ? 0 : 88, ty = H ? 84 : -4, anchor = H ? 'middle' : 'start';
      el('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': H ? 15 : 27, 'font-weight': 700, fill: C.ink }, g, n.t);
      el('text', { x: tx, y: ty + (H ? 20 : 32), 'text-anchor': anchor, 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': H ? 12.5 : 21, fill: '#6e6760' }, g, n.s);
      const num = el('text', { x: -54, y: -36, 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 12, fill: '#9a9188' }, g, '0' + (i + 1));
      return { ...n, g, box, x, y };
    });
    if (!H) nodes.forEach((n) => { n.g.setAttribute('transform', `translate(${n.x - 250},${n.y})`); });
    if (!H) { edge.setAttribute('d', 'M' + pos.map((p) => [p[0] - 250, p[1]].join(',')).join('L')); }
    const packets = Array.from({ length: 4 }, (_, i) => el('circle', { r: 8, fill: i % 2 ? C.river : C.red, stroke: C.paper, 'stroke-width': 3, opacity: 0 }, gP));
    let active = -1;
    function setActive(i) { active = i; }
    function draw(t) {
      t -= o.start;
      const L = edge.getTotalLength();
      // nodes pop in
      nodes.forEach((n, i) => {
        const u = back((t - i * 0.12) / 0.45);
        const base = H ? `translate(${n.x},${n.y})` : `translate(${n.x - 250},${n.y})`;
        n.g.setAttribute('transform', `${base} scale(${Math.max(0.001, u).toFixed(3)})`);
      });
      edge.style.strokeDashoffset = -t * 30;
      shield.setAttribute('opacity', cl((t - 0.9) / 0.4)); shieldLbl.setAttribute('opacity', cl((t - 1.1) / 0.4));
      shield.style.strokeDashoffset = -t * 20;
      // packets travel the chain
      const hit = new Array(nodes.length).fill(0);
      packets.forEach((p, j) => {
        const f = ((t - 0.8) / 3.2 + j / packets.length);
        if (t < 0.8 + (j / packets.length) * 0) { p.setAttribute('opacity', 0); }
        const u = ((f % 1) + 1) % 1;
        const pt = edge.getPointAtLength(u * L);
        p.setAttribute('cx', pt.x.toFixed(1)); p.setAttribute('cy', pt.y.toFixed(1));
        p.setAttribute('opacity', t > 0.8 ? Math.min(1, Math.sin(u * Math.PI) * 3).toFixed(2) : 0);
        const seg = u * (nodes.length - 1);
        const ni = Math.round(seg);
        if (Math.abs(seg - ni) < 0.12) hit[ni] = 1;
      });
      nodes.forEach((n, i) => {
        const on = hit[i] || active === i;
        n.box.setAttribute('fill', active === i ? '#ffe3e6' : on ? '#eef4ff' : C.paper);
        n.box.setAttribute('stroke', active === i ? C.red : C.ink);
      });
    }
    return { draw, nodes, setActive };
  }

  /* -------------------------------------------------------------- AUDIT */
  const AUDIT = [
    ['$', 'audit --target sarra.uk.gov.in'],
    [' ', 'auditor  Codec Networks Pvt. Ltd.'],
    [' ', 'panel    CERT-In empanelled · VAPT'],
    ['', ''],
    ['→', 'remediation'],
    ['✓', 'Content-Security-Policy with per-request nonces'],
    ['✓', 'inline styles moved out to stylesheets'],
    ['✓', 'email addresses obfuscated'],
    ['✓', 'SSL configuration hardened on IIS'],
    ['✓', 'server firewall configured'],
    ['', ''],
    ['$', 'audit --retest'],
    ['=', 'SAFE TO HOST'],
  ];
  function AuditScene(pre, opt = {}) {
    const o = Object.assign({ start: 0, cps: 70, lineGap: 0.14 }, opt);
    // precompute timeline
    let tt = 0; const tl = AUDIT.map(([m, s]) => { const st = tt; const d = Math.max(0.12, (s.length || 1) / o.cps); tt += d + o.lineGap + (m === '$' ? 0.25 : 0); return { m, s, st, d }; });
    const total = tt;
    function draw(t) {
      t -= o.start;
      let html = '';
      for (const L of tl) {
        if (t < L.st) break;
        const n = Math.floor(cl((t - L.st) / L.d) * L.s.length);
        const txt = L.s.slice(0, n).replace(/&/g, '&amp;').replace(/</g, '&lt;');
        const cur = n < L.s.length && Math.floor(t * 5) % 2 ? '<span class="cur">▍</span>' : '';
        const mk = L.m === '✓' ? '<span class="ok">[✓]</span> ' : L.m === '$' ? '<span class="pr">$</span> ' : L.m === '→' ? '<span class="pr">→</span> ' : L.m === '=' ? '<span class="pr">result</span> ' : '    ';
        html += `<div class="ln${L.m === '=' ? ' res' : ''}">${L.s ? mk : '&nbsp;'}${txt}${cur}</div>`;
      }
      pre.innerHTML = html;
    }
    return { draw, total };
  }
  // SVG stamp; returns group and a draw(t) with slam animation starting at t0
  function Stamp(svg, opt = {}) {
    const o = Object.assign({ x: 0, y: 0, r: 150, start: 0, rot: -12 }, opt);
    if (!svg.ownerDocument.getElementById('stampRough')) {
      const d = el('defs', {}, svg);
      d.innerHTML = '<filter id="stampRough"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.5"/><feComposite in="SourceGraphic" operator="in"/></filter>'
        + '<path id="stampArc" d="M -112,0 A 112,112 0 1 1 112,0 A 112,112 0 1 1 -112,0"/>';
    }
    const g = el('g', {}, svg), inner = el('g', { filter: 'url(#stampRough)' }, g);
    const R = 150;
    el('circle', { r: R, fill: 'none', stroke: C.red, 'stroke-width': 9 }, inner);
    el('circle', { r: R - 18, fill: 'none', stroke: C.red, 'stroke-width': 3 }, inner);
    el('circle', { r: 86, fill: 'none', stroke: C.red, 'stroke-width': 3 }, inner);
    const tp = el('text', { 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 17, 'font-weight': 700, fill: C.red, 'letter-spacing': 3.2 }, inner);
    el('textPath', { href: '#stampArc', startOffset: '0' }, tp, 'CERT-IN EMPANELLED AUDIT • VAPT • SARRA • ');
    el('rect', { x: -168, y: -40, width: 336, height: 80, fill: o.fill || 'none', stroke: C.red, 'stroke-width': 7 }, inner);
    el('text', { x: 0, y: 22, 'text-anchor': 'middle', 'font-family': 'var(--f-poster,Anton),Impact,sans-serif', 'font-size': 58, fill: C.red, 'letter-spacing': 2 }, inner, 'SAFE TO HOST');
    el('text', { x: 0, y: -52, 'text-anchor': 'middle', 'font-family': 'var(--f-poster,Anton),Impact,sans-serif', 'font-size': 26, fill: C.red }, inner, '★');
    el('text', { x: 0, y: 76, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 14, 'font-weight': 700, fill: C.red, 'letter-spacing': 2 }, inner, 'CERTIFIED');
    function draw(t) {
      const u = (t - o.start) / 0.38;
      if (u <= 0) { g.setAttribute('opacity', 0); return; }
      const s = (o.r / R) * (u >= 1 ? 1 : 1.9 - 0.9 * back(u));
      g.setAttribute('opacity', cl(u * 3));
      g.setAttribute('transform', `translate(${o.x},${o.y}) rotate(${o.rot}) scale(${s.toFixed(3)})`);
    }
    return { draw, g };
  }

  /* ---------------------------------------------------------- MIGRATION */
  function MigrationScene(svg, opt = {}) {
    const o = Object.assign({ start: 0, W: 1000, H: 440, toonScale: 0.42 }, opt);
    const W = o.W, HH = o.H, G = HH - 44;
    svg.setAttribute('viewBox', `0 0 ${W} ${HH}`);
    el('line', { x1: 0, y1: G + 1, x2: W, y2: G + 1, stroke: C.ink, 'stroke-width': 3 }, svg);
    // cloud (left)
    const cloud = el('g', { transform: `translate(${W * 0.17},${G - 220})` }, svg);
    el('path', { d: 'M-90,40 q-40,0 -40,-34 q0,-34 40,-34 q8,-44 58,-44 q40,0 56,30 q12,-8 28,-8 q44,0 44,44 q32,6 32,30 q0,16 -18,16 z', fill: '#eef3fb', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, cloud);
    el('text', { x: 0, y: 12, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 18, 'font-weight': 700, fill: C.ink }, cloud, 'CLOUD');
    const cloudX = el('path', { d: 'M-60,-30 L60,30 M60,-30 L-60,30', stroke: C.red, 'stroke-width': 0, 'stroke-linecap': 'round' }, cloud);
    // rack (right)
    const rx = W * 0.86;
    const rack = el('g', { transform: `translate(${rx},${G})` }, svg);
    el('rect', { x: -78, y: -250, width: 156, height: 250, fill: C.ink }, rack);
    const leds = [];
    for (let i = 0; i < 5; i++) {
      el('rect', { x: -64, y: -236 + i * 46, width: 128, height: 34, fill: '#2a2826', stroke: '#3a3734', 'stroke-width': 2 }, rack);
      for (let j = 0; j < 3; j++) leds.push(el('circle', { cx: 40 + j * 9, cy: -219 + i * 46, r: 3, fill: '#555' }, rack));
      el('line', { x1: -54, y1: -219 + i * 46, x2: 14, y2: -219 + i * 46, stroke: '#4a4744', 'stroke-width': 3 }, rack);
    }
    el('text', { x: 0, y: 26, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 15, 'font-weight': 700, fill: C.ink }, rack, 'ON-PREM · GOVT. SERVER');
    // database drum
    const drum = el('g', {}, svg);
    const DW = 120, DH = 150;
    el('path', { d: `M${-DW / 2},${-DH + 16} v${DH - 32} a${DW / 2},16 0 0 0 ${DW},0 v${-(DH - 32)}`, fill: '#e9f0fb', stroke: C.ink, 'stroke-width': 4 }, drum);
    el('ellipse', { cx: 0, cy: -DH + 16, rx: DW / 2, ry: 16, fill: '#fff', stroke: C.ink, 'stroke-width': 4 }, drum);
    el('path', { d: `M${-DW / 2},${-DH / 2 + 4} a${DW / 2},16 0 0 0 ${DW},0 M${-DW / 2},-28 a${DW / 2},16 0 0 0 ${DW},0`, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, drum);
    el('text', { x: 0, y: -44, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 16, 'font-weight': 700, fill: C.river }, drum, 'MongoDB');
    // floating docs
    const docs = Array.from({ length: 7 }, () => { const d = el('g', { opacity: 0 }, svg); el('rect', { x: -9, y: -12, width: 18, height: 24, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, d); el('path', { d: 'M-4,-5 h8 M-4,0 h8 M-4,5 h5', stroke: C.ink, 'stroke-width': 2 }, d); return d; });
    // HUD
    const hud = el('g', {}, svg);
    const pct = el('text', { x: W / 2, y: 52, 'text-anchor': 'middle', 'font-family': 'var(--f-poster,Anton),Impact,sans-serif', 'font-size': 46, fill: C.ink }, hud, '');
    const lost = el('text', { x: W / 2, y: 86, 'text-anchor': 'middle', 'font-family': 'var(--f-mono,"Space Mono"),monospace', 'font-size': 18, 'font-weight': 700, fill: C.red, 'letter-spacing': 2 }, hud, 'DATA LOST: 0');
    const toonG = el('g', {}, svg);
    // drum path keys (push with stalls)
    const x0 = W * 0.17 + 130, x1 = rx - 140;
    const K = [[0, x0], [0.7, x0], [1.2, x0 + (x1 - x0) * 0.18], [1.5, x0 + (x1 - x0) * 0.22], [2.1, x0 + (x1 - x0) * 0.5], [2.4, x0 + (x1 - x0) * 0.55], [3.2, x1], [99, x1]];
    const pos = (t) => { for (let i = 0; i < K.length - 1; i++) { const [a, p0] = K[i], [b, p1] = K[i + 1]; if (t <= b) return p0 + (p1 - p0) * (0.5 - 0.5 * Math.cos(Math.PI * cl((t - a) / (b - a)))); } return x1; };
    const total = 5.6;
    function draw(t) {
      t -= o.start;
      const tl = cl(t);
      const dx = pos(t);
      // after docking, drum slides into rack
      const dock = eio((t - 3.4) / 0.6);
      const dX = dx + (rx - dx) * dock, s = 1 - 0.55 * dock;
      drum.setAttribute('transform', `translate(${dX.toFixed(1)},${G}) scale(${s.toFixed(3)})`);
      drum.setAttribute('opacity', (1 - cl((t - 3.85) / 0.2)).toFixed(2));
      // toon pushes the drum (wall = drum's left edge)
      const sc = o.toonScale, wallLocal = 322;
      if (t < 3.3) {
        const v = (pos(t + 0.02) - pos(t - 0.02)) / 0.04;
        const x = dx - DW / 2 - wallLocal * sc;
        root.Toon.draw(toonG, { x, ground: G, scale: sc, mode: 'push', phase: x / (300 * sc), wall: wallLocal, strain: t > 0.6 ? cl(1 - v / 350) : 0, t });
      } else {
        const x = x1 - DW / 2 - wallLocal * sc + 40;
        root.Toon.draw(toonG, { x, ground: G, scale: sc, mode: 'idle', t, shades: cl((t - 4.1) / 0.3), wave: cl((t - 4.5) / 0.25), mouth: 'smile', look: [0.6, -0.2] });
      }
      // docs: dump out of cloud into drum (0..0.9), restore from drum into rack (3.4..4.2)
      docs.forEach((d, i) => {
        let u = (t - i * 0.09) / 0.55, a, b;
        if (t < 2) { a = [W * 0.17, G - 220]; b = [x0, G - 90]; }
        else { u = (t - 3.25 - i * 0.07) / 0.5; a = [dx, G - 100]; b = [rx, G - 160]; }
        if (u <= 0 || u >= 1) { d.setAttribute('opacity', 0); return; }
        const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u - Math.sin(u * Math.PI) * 70;
        d.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${(u * 200 - 100 + i * 20).toFixed(0)})`);
        d.setAttribute('opacity', Math.sin(u * Math.PI).toFixed(2));
      });
      // HUD
      const prog = cl((pos(t) - x0) / (x1 - x0)) * 0.9 + 0.1 * cl((t - 3.4) / 0.6);
      pct.textContent = t < 0.15 ? '' : `MIGRATED ${Math.round(prog * 100)}%`;
      lost.setAttribute('opacity', t > 0.3 ? 1 : 0);
      lost.setAttribute('font-size', t > 4.0 ? 22 : 18);
      // cloud retires, rack lights up
      cloud.setAttribute('opacity', (1 - 0.55 * cl((t - 4.0) / 0.4)).toFixed(2));
      leds.forEach((l, i) => l.setAttribute('fill', t > 3.9 ? ((Math.floor(t * 6) + i) % 4 ? '#3fcf7a' : '#1f8a4c') : (i % 3 === 0 ? '#777' : '#444')));
    }
    return { draw, total };
  }

  root.Sarra = { MapScene, ArchScene, AuditScene, Stamp, MigrationScene, NODES, AUDIT, C, el, cl, eo, eio, back };
})(typeof window !== 'undefined' ? window : globalThis);
