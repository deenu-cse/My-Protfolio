/*!
 * hbc.js — scenes for HackByteCodex. Same contract as sarra.js / yatri.js:
 * every scene is deterministic, draw(t) renders time t in seconds.
 *   Hbc.TreeScene(svg)   4-tier hierarchy + event lifecycle (create → register → attend → judge → reward)
 *   Hbc.GeoScene(svg)    signed QR that rotates every 30 s + 500 m geofence check
 *   Hbc.BoardScene(svg)  judges' scores → leaderboard reorders → scores lock
 *   Hbc.RateScene(svg)   API platform: per-plan rate limits (30 / 120 / 500 req per minute)
 * Logic mirrors the real backend (codexbkend): role enum, scanAttendanceQR (jwt 30s + haversine ≤ 500 m),
 * score.locked, API_TIER_LIMITS. Team names in BoardScene are illustrative.
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { ink: '#141312', paper: '#fdfbf6', stage: '#fdfbf6', red: '#EE3349', amber: '#E39B17', amberSoft: '#fbe9c6', green: '#178A5A', greenSoft: '#d6efe2', line: '#d9d0c0', muted: '#6e6760', chip: '#f1ebdf', bronze: '#c58a5a', silver: '#b9bcc2' };
  const MONO = 'var(--f-mono,"Space Mono"),monospace';
  const POSTER = 'var(--f-poster,Anton),Impact,sans-serif';
  const DISPLAY = 'var(--f-display,Marcellus),Georgia,serif';
  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const eo = (u) => 1 - Math.pow(1 - cl(u), 3);
  const eio = (u) => { u = cl(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const back = (u) => { u = cl(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const lerp = (a, b, u) => a + (b - a) * u;
  const f1 = (n) => (+n).toFixed(1);
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const set = (e, a) => { for (const k in a) e.setAttribute(k, a[k]); };
  const tr = (x, y, s = 1, r = 0) => `translate(${f1(x)},${f1(y)})${r ? ` rotate(${f1(r)})` : ''} scale(${(+s).toFixed(3)})`;
  const txt = (p, x, y, s, o = {}) => el('text', Object.assign({ x, y, 'font-family': MONO, 'font-weight': 700, 'font-size': 13, fill: C.ink, 'letter-spacing': 1 }, o), p, s);
  function dash(path) { const L = path.getTotalLength(); path.style.strokeDasharray = `${L} ${L}`; path.style.strokeDashoffset = L; return L; }
  function strokeTo(path, L, u) { path.style.strokeDashoffset = f1(L * (1 - cl(u))); }

  // pseudo-random but deterministic QR-ish matrix (finder squares in 3 corners)
  function qrGroup(parent, x, y, size, seed, color = C.ink) {
    const n = 21, c = size / n, g = el('g', { transform: `translate(${x},${y})` }, parent);
    el('rect', { width: size, height: size, fill: '#fff' }, g);
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const finder = (fx, fy) => {
      el('rect', { x: fx * c, y: fy * c, width: 7 * c, height: 7 * c, fill: color }, g);
      el('rect', { x: (fx + 1) * c, y: (fy + 1) * c, width: 5 * c, height: 5 * c, fill: '#fff' }, g);
      el('rect', { x: (fx + 2) * c, y: (fy + 2) * c, width: 3 * c, height: 3 * c, fill: color }, g);
    };
    const inF = (i, j) => (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
    let d = '';
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (!inF(i, j) && rnd() > 0.52) d += `M${f1(i * c)},${f1(j * c)}h${f1(c + 0.3)}v${f1(c + 0.3)}h${f1(-c - 0.3)}z`;
    el('path', { d, fill: color }, g);
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    return g;
  }

  /* ================================================================ TREE + LIFECYCLE */
  function TreeScene(svg, opt = {}) {
    const o = Object.assign({ loop: 12.4 }, opt);
    const W = 1000, H = 556;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const root = el('g', {}, svg);
    const gE = el('g', {}, root), gN = el('g', {}, root), gFx = el('g', {}, root), gUI = el('g', {}, root);

    const node = (p, n, fill, color, size) => {
      const g = el('g', { opacity: 0 }, p);
      el('rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 9, fill, stroke: C.ink, 'stroke-width': 2.5 }, g);
      txt(g, 0, size * 0.36, n.label, { 'text-anchor': 'middle', 'font-size': size, fill: color });
      return Object.assign(n, { g });
    };
    const sa = node(gN, { x: 500, y: 58, w: 214, h: 46, label: 'SUPER ADMIN' }, C.ink, C.paper, 15);
    const cols = [{ x: 255, label: 'CHAPTER 02' }, { x: 500, label: 'GKV HARIDWAR' }, { x: 745, label: 'CHAPTER 03' }]
      .map((c, i) => node(gN, Object.assign(c, { y: 166, w: 196, h: i === 1 ? 54 : 42 }), i === 1 ? C.amberSoft : C.paper, C.ink, 13));
    cols[1].g.querySelector('text').setAttribute('y', -2);
    const more = node(gN, { x: 926, y: 166, w: 92, h: 36, label: '+47' }, C.paper, C.muted, 13);
    more.g.querySelector('rect').setAttribute('stroke-dasharray', '5 4');
    const clubs = [{ x: 352, label: 'DESIGN' }, { x: 500, label: 'CODING CLUB' }, { x: 648, label: 'ROBOTICS' }]
      .map((c) => node(gN, Object.assign(c, { y: 272, w: 140, h: 38 }), C.paper, C.ink, 12));
    const ptsTxt = txt(cols[1].g, 0, 16, '1,240 PTS', { 'text-anchor': 'middle', 'font-size': 10.5, fill: C.muted, opacity: 0 });
    const lvl = [['L1', 58], ['L2', 166], ['L3', 272], ['L4', 388]].map(([s, y]) => txt(gN, 34, y + 4, s, { 'font-size': 11, fill: C.muted, opacity: 0 }));

    // tier badges on clubs
    const tiers = clubs.map((c, i) => {
      const g = el('g', { opacity: 0 }, gN);
      const circ = el('circle', { r: 12, fill: [C.bronze, C.silver, C.bronze][i], stroke: C.ink, 'stroke-width': 2 }, g);
      const t = txt(g, 0, 4.5, ['B', 'S', 'B'][i], { 'text-anchor': 'middle', 'font-size': 12, fill: C.ink, 'letter-spacing': 0 });
      return { g, circ, t, x: c.x + c.w / 2 - 4, y: c.y - c.h / 2 + 2 };
    });

    // students
    const studs = [];
    clubs.forEach((c, ci) => {
      for (let k = 0; k < 4; k++) {
        const x = c.x - 51 + k * 34, y = 392;
        const g = el('g', { opacity: 0 }, gN);
        const body = el('path', { d: 'M-12,12 v-4 a12,10 0 0 1 24,0 v4 z', fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, g);
        el('circle', { cx: 0, cy: -6, r: 7, fill: C.paper, stroke: C.ink, 'stroke-width': 2 }, g);
        const ok = el('g', { opacity: 0 }, g);
        el('circle', { cx: 11, cy: -14, r: 8, fill: C.green }, ok);
        el('path', { d: 'M7,-14 l3,3 l5,-6', fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ok);
        const no = el('g', { opacity: 0 }, g);
        el('circle', { cx: 11, cy: -14, r: 8, fill: C.red }, no);
        el('path', { d: 'M8,-17 l6,6 M14,-17 l-6,6', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, no);
        const pts = txt(g, 0, 40, '+50', { 'text-anchor': 'middle', 'font-size': 12, fill: C.amber, opacity: 0 });
        studs.push({ g, body, ok, no, pts, x, y, club: ci, i: studs.length });
      }
    });
    // who registers / attends / wins (index into studs)
    const REG = [0, 1, 3, 4, 5, 6, 7, 8, 9, 11];
    const ABSENT = [3, 9]; // rejected at the door (outside geofence)
    const WIN = [4, 5, 6];

    // edges
    const curve = (a, b, ya, yb) => `M${a.x},${ya} C${a.x},${(ya + yb) / 2} ${b.x},${(ya + yb) / 2} ${b.x},${yb}`;
    const edges = [];
    cols.forEach((c) => edges.push({ p: el('path', { d: curve(sa, c, sa.y + 23, c.y - c.h / 2), fill: 'none', stroke: C.ink, 'stroke-width': 2.2 }, gE), t0: 0.25 }));
    edges.push({ p: el('path', { d: `M${sa.x + 107},${sa.y} C${more.x},${sa.y} ${more.x},${sa.y} ${more.x},${more.y - 18}`, fill: 'none', stroke: C.muted, 'stroke-width': 2, 'stroke-dasharray': '4 5' }, gE), t0: 0.35, keep: true });
    clubs.forEach((c) => edges.push({ p: el('path', { d: curve(cols[1], c, cols[1].y + cols[1].h / 2, c.y - 19), fill: 'none', stroke: C.ink, 'stroke-width': 2.2 }, gE), t0: 0.6 }));
    studs.forEach((s) => edges.push({ p: el('path', { d: curve(clubs[s.club], s, clubs[s.club].y + 19, s.y - 16), fill: 'none', stroke: C.line, 'stroke-width': 1.6 }, gE), t0: 0.95 + s.i * 0.02 }));
    edges.forEach((e) => { if (!e.keep) e.L = dash(e.p); });

    // event card
    const card = el('g', { opacity: 0 }, gUI);
    const CX = 122, CY = 300;
    el('rect', { x: -96, y: -62, width: 192, height: 124, rx: 12, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, card);
    el('rect', { x: -96, y: -62, width: 192, height: 30, rx: 12, fill: C.amber }, card);
    el('rect', { x: -96, y: -44, width: 192, height: 12, fill: C.amber }, card);
    txt(card, -82, -42, 'NEW EVENT', { 'font-size': 11, fill: C.ink });
    el('text', { x: -82, y: -4, 'font-family': POSTER, 'font-size': 26, fill: C.ink, 'letter-spacing': 0.5 }, card, 'HACKATHON 24H');
    const regTxt = txt(card, -82, 24, 'REG 0 / 120', { 'font-size': 12 });
    const attTxt = txt(card, -82, 46, 'PRESENT 0', { 'font-size': 12, fill: C.green, opacity: 0 });
    const qr = qrGroup(card, 50, 8, 36, 7);
    qr.setAttribute('opacity', 0);
    const conn = el('path', { d: `M${clubs[1].x - 70},${clubs[1].y - 6} C 380,226 300,236 ${CX + 96},${CY - 30}`, fill: 'none', stroke: C.amber, 'stroke-width': 2.4, 'stroke-dasharray': '6 6', opacity: 0 }, gE);

    // registration particles
    const dots = REG.map((si, k) => ({ c: el('circle', { r: 5, fill: C.amber, stroke: C.ink, 'stroke-width': 1.5, opacity: 0 }, gFx), s: studs[si], k }));

    // leaderboard mini
    const lb = el('g', { opacity: 0, transform: 'translate(800,300)' }, gUI);
    el('rect', { x: 0, y: -66, width: 180, height: 166, rx: 12, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, lb);
    txt(lb, 14, -42, 'LEADERBOARD', { 'font-size': 11 });
    const lock = el('g', { transform: 'translate(160,-46)' }, lb);
    const shackle = el('path', { d: 'M-6,0 v-6 a6,6 0 0 1 12,0 v6', fill: 'none', stroke: C.ink, 'stroke-width': 2.2 }, lock);
    el('rect', { x: -8, y: 0, width: 16, height: 12, rx: 2, fill: C.ink }, lock);
    const TEAMS = [['TEAM A', 0.62, 0], ['TEAM B', 0.92, 1], ['TEAM C', 0.74, 2]]; // final order: B, C, A
    const bars = TEAMS.map(([name, v], i) => {
      const g = el('g', {}, lb);
      const nm = txt(g, 14, 0, name, { 'font-size': 10, fill: C.muted });
      el('rect', { x: 14, y: 6, width: 152, height: 12, rx: 3, fill: C.chip }, g);
      const b = el('rect', { x: 14, y: 6, width: 0, height: 12, rx: 3, fill: i === 1 ? C.red : C.amber }, g);
      return { g, b, v, i };
    });

    // judge
    const JX = 752, JY = 250;
    const judge = el('g', { opacity: 0, transform: `translate(${JX},${JY})` }, gUI);
    el('circle', { r: 17, fill: C.ink }, judge);
    txt(judge, 0, 4.5, 'J', { 'text-anchor': 'middle', 'font-size': 13, fill: C.paper, 'letter-spacing': 0 });
    txt(judge, 0, -26, 'JUDGES', { 'text-anchor': 'middle', 'font-size': 10, fill: C.muted });
    const chips = [0, 1, 2].map(() => { const g = el('g', { opacity: 0 }, gFx); el('rect', { x: -15, y: -10, width: 30, height: 20, rx: 6, fill: C.ink }, g); txt(g, 0, 4, '+9', { 'text-anchor': 'middle', 'font-size': 11, fill: C.paper, 'letter-spacing': 0 }); return g; });

    // reward chips
    const rewards = WIN.map((si) => { const g = el('g', { opacity: 0 }, gFx); el('rect', { x: -24, y: -12, width: 48, height: 24, rx: 12, fill: C.amber, stroke: C.ink, 'stroke-width': 1.5 }, g); txt(g, 0, 4.5, '+50', { 'text-anchor': 'middle', 'font-size': 12, 'letter-spacing': 0 }); return { g, s: studs[si] }; });

    // step rail
    const STEPS = ['CREATE', 'REGISTER', 'ATTEND', 'JUDGE', 'REWARD'];
    const sx = (i) => 130 + i * 185, SY = 508;
    el('line', { x1: sx(0), y1: SY, x2: sx(4), y2: SY, stroke: C.line, 'stroke-width': 3 }, gUI);
    const rail = el('line', { x1: sx(0), y1: SY, x2: sx(0), y2: SY, stroke: C.amber, 'stroke-width': 3 }, gUI);
    const pills = STEPS.map((s, i) => {
      const g = el('g', { transform: `translate(${sx(i)},${SY})` }, gUI);
      const r = el('rect', { x: -66, y: -17, width: 132, height: 34, rx: 17, fill: C.paper, stroke: C.line, 'stroke-width': 2 }, g);
      const t = txt(g, 0, 4.5, `${i + 1} ${s}`, { 'text-anchor': 'middle', 'font-size': 12, fill: C.muted });
      return { r, t };
    });

    // timeline marks
    const S = { create: 1.6, reg: 2.8, att: 4.8, judge: 6.5, reward: 8.5, hold: 10.6, out: 11.8 };
    function draw(t) {
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      root.setAttribute('opacity', f1(1 - cl((t - S.out) / 0.5)));
      // build
      const pop = (g, x, y, t0) => { const u = cl((t - t0) / 0.35); g.setAttribute('opacity', f1(cl(u * 3))); g.setAttribute('transform', tr(x, y, back(u))); };
      pop(sa.g, sa.x, sa.y, 0);
      cols.forEach((c, i) => pop(c.g, c.x, c.y, 0.3 + i * 0.08));
      pop(more.g, more.x, more.y, 0.55);
      clubs.forEach((c, i) => pop(c.g, c.x, c.y, 0.7 + i * 0.08));
      studs.forEach((s) => pop(s.g, s.x, s.y, 1.0 + s.i * 0.025));
      tiers.forEach((b, i) => pop(b.g, b.x, b.y, 1.1 + i * 0.06));
      lvl.forEach((l, i) => l.setAttribute('opacity', f1(cl((t - 0.2 - i * 0.25) / 0.4) * 0.8)));
      edges.forEach((e) => { if (e.keep) { e.p.setAttribute('opacity', f1(cl((t - e.t0) / 0.4))); return; } strokeTo(e.p, e.L, (t - e.t0) / 0.45); });
      ptsTxt.setAttribute('opacity', f1(cl((t - 0.6) / 0.4)));

      // step state
      const marks = [S.create, S.reg, S.att, S.judge, S.reward];
      let step = -1; marks.forEach((m, i) => { if (t >= m) step = i; });
      pills.forEach((p, i) => {
        const active = i === step, done = i < step;
        set(p.r, { fill: active ? C.amber : done ? C.ink : C.paper, stroke: active || done ? C.ink : C.line });
        p.t.setAttribute('fill', active ? C.ink : done ? C.paper : C.muted);
      });
      const railTo = step < 0 ? sx(0) : lerp(sx(Math.max(0, step - 1)), sx(step), eo((t - marks[Math.max(0, step)]) / 0.5));
      rail.setAttribute('x2', f1(step <= 0 ? sx(0) : railTo));

      // CREATE
      const uc = eo((t - S.create) / 0.6);
      card.setAttribute('opacity', f1(cl((t - S.create) / 0.25)));
      card.setAttribute('transform', tr(lerp(clubs[1].x, CX, uc), lerp(clubs[1].y, CY, uc), lerp(0.3, 1, back((t - S.create) / 0.6))));
      conn.setAttribute('opacity', f1(cl((t - S.create - 0.5) / 0.3)));

      // REGISTER
      let regN = 0;
      dots.forEach(({ c, s, k }) => {
        const t0 = S.reg + 0.1 + k * 0.14, u = cl((t - t0) / 0.7);
        const x0 = s.x, y0 = s.y - 8, x1 = CX + 60, y1 = CY + 20, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - 120;
        const e = eio(u), x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * mx + e * e * x1, y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * my + e * e * y1;
        set(c, { cx: f1(x), cy: f1(y), opacity: u > 0 && u < 1 ? 1 : 0 });
        if (u >= 1) regN++;
        s.body.setAttribute('fill', t > t0 ? C.ink : C.paper);
      });
      regTxt.textContent = `REG ${Math.round((regN / REG.length) * 120)} / 120`;

      // ATTEND
      qr.setAttribute('opacity', f1(cl((t - S.att) / 0.3)));
      let present = 0;
      REG.forEach((si, k) => {
        const s = studs[si], t0 = S.att + 0.3 + k * 0.11, on = cl((t - t0) / 0.25);
        const bad = ABSENT.includes(si);
        (bad ? s.no : s.ok).setAttribute('opacity', f1(on));
        (bad ? s.no : s.ok).setAttribute('transform', `translate(11,-14) scale(${back(on).toFixed(3)}) translate(-11,14)`);
        if (!bad && on >= 1) present++;
      });
      attTxt.setAttribute('opacity', f1(cl((t - S.att) / 0.3)));
      attTxt.textContent = `PRESENT ${present} · 500 m ✓`;

      // JUDGE
      lb.setAttribute('opacity', f1(cl((t - S.judge) / 0.3)));
      judge.setAttribute('opacity', f1(cl((t - S.judge) / 0.3)));
      chips.forEach((g, i) => {
        const t0 = S.judge + 0.3 + i * 0.35, u = cl((t - t0) / 0.5);
        const b = bars[i];
        const x = lerp(JX, 800 + 90, eio(u)), y = lerp(JY, 300 + [-12, 22, 56][i] + 2, eio(u));
        set(g, { opacity: u > 0 && u < 1 ? 1 : 0, transform: tr(x, y) });
      });
      // bars grow then reorder (final ranking B > C > A)
      const grow = eo((t - S.judge - 0.6) / 1.0), re = eio((t - S.judge - 1.5) / 0.5);
      const startRow = [0, 1, 2], endRow = [2, 0, 1];
      bars.forEach((b) => {
        set(b.b, { width: f1(152 * b.v * grow) });
        b.g.setAttribute('transform', `translate(0,${f1(-14 + 34 * lerp(startRow[b.i], endRow[b.i], re))})`);
      });
      shackle.setAttribute('transform', `translate(0,${f1(lerp(-4, 0, cl((t - S.judge - 1.8) / 0.3)))})`);
      lock.setAttribute('opacity', f1(cl((t - S.judge - 1.5) / 0.3)));

      // REWARD
      rewards.forEach(({ g, s }, i) => {
        const t0 = S.reward + 0.1 + i * 0.15, u = cl((t - t0) / 0.8), e = eio(u);
        const x = lerp(880, s.x, e), y = lerp(290, s.y - 34, e) - Math.sin(e * Math.PI) * 60;
        set(g, { opacity: u > 0 && u < 1 ? 1 : 0, transform: tr(x, y) });
        s.pts.setAttribute('opacity', f1(cl((t - t0 - 0.8) / 0.2)));
      });
      // club tier: SILVER → GOLD flip
      const fl = cl((t - S.reward - 0.9) / 0.4), sc = Math.abs(Math.cos(fl * Math.PI));
      const tb = tiers[1];
      tb.circ.setAttribute('fill', fl > 0.5 ? C.amber : C.silver);
      tb.t.textContent = fl > 0.5 ? 'G' : 'S';
      if (t > 1.6) tb.g.setAttribute('transform', `translate(${tb.x},${tb.y}) scale(${(sc * (fl > 0 && fl < 1 ? 1.2 : 1)).toFixed(3)},${fl > 0 && fl < 1 ? 1.2 : 1})`);
      const pu = eo((t - S.reward - 1.0) / 0.8);
      ptsTxt.textContent = `${(1240 + Math.round(150 * pu)).toLocaleString('en-IN')} PTS`;
      ptsTxt.setAttribute('fill', pu > 0 && pu < 1 ? C.amber : C.muted);
    }
    return { draw, loop: o.loop };
  }

  /* ================================================================ QR + GEOFENCE */
  function GeoScene(svg, opt = {}) {
    const o = Object.assign({ loop: 9 }, opt);
    const W = 1000, H = 620;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const root = el('g', {}, svg);

    // event screen
    const scr = el('g', {}, root);
    el('rect', { x: 46, y: 54, width: 324, height: 372, rx: 18, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5 }, scr);
    txt(scr, 66, 86, 'EVENT QR · SIGNED JWT', { 'font-size': 12 });
    txt(scr, 66, 106, 'GET /:eventId/qr', { 'font-size': 11, fill: C.muted, 'letter-spacing': 0.5 });
    const qrs = [1, 2, 3].map((s) => { const g = qrGroup(scr, 108, 124, 200, s * 13); g.setAttribute('opacity', 0); return g; });
    el('rect', { x: 108, y: 124, width: 200, height: 200, fill: 'none', stroke: C.ink, 'stroke-width': 2 }, scr);
    el('rect', { x: 66, y: 352, width: 284, height: 10, rx: 5, fill: C.chip }, scr);
    const timeBar = el('rect', { x: 66, y: 352, width: 284, height: 10, rx: 5, fill: C.amber }, scr);
    const timeTxt = txt(scr, 66, 396, 'EXPIRES IN 30s', { 'font-size': 13 });
    const rotTxt = txt(scr, 350, 396, 'TOKEN ROTATED', { 'font-size': 12, fill: C.red, 'text-anchor': 'end', opacity: 0 });
    const flash = el('rect', { x: 108, y: 124, width: 200, height: 200, fill: C.amber, opacity: 0 }, scr);

    // map
    const map = el('g', {}, root);
    el('rect', { x: 410, y: 54, width: 546, height: 372, rx: 18, fill: '#f3eee4', stroke: C.ink, 'stroke-width': 2.5 }, map);
    const clip = el('clipPath', { id: 'hbcGeoClip' + Math.random().toString(36).slice(2, 6) }, map);
    el('rect', { x: 412, y: 56, width: 542, height: 368, rx: 16 }, clip);
    const streets = el('g', { 'clip-path': `url(#${clip.id})`, stroke: '#e2d9c8', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }, map);
    ['M410,150 L960,120', 'M410,300 C560,280 760,330 960,290', 'M520,54 L560,426', 'M790,54 C760,200 820,320 800,426', 'M410,400 L960,370'].forEach((d) => el('path', { d }, streets));
    const VX = 680, VY = 236, R = 136;
    const fence = el('circle', { cx: VX, cy: VY, r: R, fill: 'rgba(227,155,23,.10)', stroke: C.amber, 'stroke-width': 2.5, 'stroke-dasharray': '8 7' }, map);
    txt(map, VX + R * 0.72 + 8, VY - R * 0.72 - 4, '500 m', { 'font-size': 13, fill: C.amber });
    const pin = el('g', { transform: `translate(${VX},${VY})` }, map);
    el('path', { d: 'M0,0 C-14,-18 -14,-34 0,-34 C14,-34 14,-18 0,0 z', fill: C.red, stroke: C.ink, 'stroke-width': 2 }, pin);
    el('circle', { cx: 0, cy: -23, r: 4.5, fill: '#fff' }, pin);
    txt(map, VX, VY + 20, 'VENUE', { 'font-size': 11, 'text-anchor': 'middle' });
    const counter = txt(map, 936, 86, 'PRESENT 0 / 4', { 'font-size': 13, 'text-anchor': 'end' });
    txt(map, 432, 86, 'HAVERSINE CHECK', { 'font-size': 11, fill: C.muted });

    // log terminal
    const term = el('g', {}, root);
    el('rect', { x: 46, y: 448, width: 910, height: 150, rx: 14, fill: C.ink }, term);
    [0, 1, 2].forEach((i) => el('circle', { cx: 68 + i * 16, cy: 468, r: 5, fill: '#3a3734' }, term));

    const S = [
      { x: 616, y: 186, t0: 0.7, ok: true, d: '212 m', log: ['token ✓', '212 m', '200 present'] },
      { x: 758, y: 300, t0: 1.9, ok: true, d: '348 m', log: ['token ✓', '348 m', '200 present'] },
      { x: 892, y: 372, t0: 3.1, ok: false, code: 403, d: '1.2 km', log: ['token ✓', '1.2 km', '403 not at the event location'] },
      { x: 596, y: 348, t0: 4.6, ok: false, code: 401, d: '', old: true, log: ['token ✗', 'expired', '401 jwt expired · old screenshot'] },
    ];
    const ROT = 4.15; // QR rotates just before the screenshot attempt
    const people = S.map((p, i) => {
      const line = el('path', { d: `M${VX},${VY} L${p.x},${p.y}`, stroke: p.ok ? C.green : C.red, 'stroke-width': 1.8, 'stroke-dasharray': '4 4', fill: 'none', opacity: 0 }, map);
      const lab = p.d ? txt(map, (VX + p.x) / 2 + 8, (VY + p.y) / 2 - 6, p.d, { 'font-size': 12, fill: p.ok ? C.green : C.red, opacity: 0 }) : null;
      const beam = el('path', { d: `M${p.x},${p.y - 10} C${p.x - 120},${p.y - 120} 460,190 308,224`, fill: 'none', stroke: C.ink, 'stroke-width': 1.6, 'stroke-dasharray': '3 6', opacity: 0 }, root);
      const bL = beam.getTotalLength();
      const ph = el('g', { opacity: 0 }, root);
      el('rect', { x: -11, y: -38, width: 22, height: 36, rx: 4, fill: C.paper, stroke: C.ink, 'stroke-width': 2.2 }, ph);
      el('rect', { x: -6, y: -32, width: 12, height: 12, fill: p.old ? '#bbb' : C.ink }, ph);
      el('circle', { cx: 0, cy: -8, r: 1.6, fill: C.ink }, ph);
      if (p.old) txt(ph, 0, -46, 'SCREENSHOT', { 'font-size': 10, 'text-anchor': 'middle', fill: C.muted });
      const res = el('g', { opacity: 0 }, root);
      el('circle', { r: 13, fill: p.ok ? C.green : C.red, stroke: C.ink, 'stroke-width': 1.5 }, res);
      el('path', { d: p.ok ? 'M-6,0 l4,4 l8,-9' : 'M-5,-5 l10,10 M5,-5 l-10,10', fill: 'none', stroke: '#fff', 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, res);
      const code = !p.ok ? txt(root, p.x + 20, p.y - 30, String(p.code), { 'font-size': 14, fill: C.red, opacity: 0 }) : null;
      // log line
      const ly = 498 + i * 26;
      const lg = el('g', { opacity: 0 }, term);
      el('text', { x: 68, y: ly, 'font-family': MONO, 'font-size': 13.5, fill: '#ff6b7c' }, lg, '$');
      el('text', { x: 86, y: ly, 'font-family': MONO, 'font-size': 13.5, fill: '#f1ece4' }, lg, 'POST /qr/attendance');
      el('text', { x: 288, y: ly, 'font-family': MONO, 'font-size': 13.5, fill: p.log[0].includes('✗') ? '#ff6b7c' : '#7fb3ff' }, lg, p.log[0]);
      el('text', { x: 386, y: ly, 'font-family': MONO, 'font-size': 13.5, fill: '#a29a90' }, lg, p.log[1]);
      el('text', { x: 474, y: ly, 'font-family': MONO, 'font-size': 13.5, 'font-weight': 700, fill: p.ok ? '#3fc488' : '#ff6b7c' }, lg, '→ ' + p.log[2]);
      return Object.assign({}, p, { line, lab, beam, bL, ph, res, code, lg });
    });

    function draw(t) {
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      root.setAttribute('opacity', f1(1 - cl((t - (o.loop - 0.5)) / 0.45)));
      // QR + token timer (30s mapped onto ROT seconds)
      const cyc = t < ROT ? 0 : 1, local = t < ROT ? t / ROT : (t - ROT) / ROT;
      qrs.forEach((g, i) => g.setAttribute('opacity', i === cyc ? 1 : 0));
      set(timeBar, { width: f1(284 * (1 - cl(local))) });
      timeTxt.textContent = `EXPIRES IN ${Math.max(1, Math.ceil(30 * (1 - cl(local))))}s`;
      const fu = cl((t - ROT) / 0.6);
      flash.setAttribute('opacity', f1(t >= ROT ? (1 - fu) * 0.85 : 0));
      rotTxt.setAttribute('opacity', f1(t >= ROT && t < ROT + 1.4 ? 1 : 0));
      let present = 0;
      people.forEach((p) => {
        const u = cl((t - p.t0) / 0.35);
        set(p.ph, { opacity: f1(cl(u * 2)), transform: tr(p.x, p.y, back(u)) });
        const bu = cl((t - p.t0 - 0.35) / 0.4), bo = 1 - cl((t - p.t0 - 1.0) / 0.3);
        p.beam.style.strokeDasharray = `${f1(p.bL * bu)} ${f1(p.bL)}`;
        p.beam.setAttribute('opacity', f1(bu > 0 ? bo : 0));
        const ru = cl((t - p.t0 - 0.85) / 0.3);
        set(p.res, { opacity: f1(cl(ru * 2)), transform: tr(p.x + 18, p.y - 44, back(ru)) });
        p.line.setAttribute('opacity', f1(cl((t - p.t0 - 0.7) / 0.3)));
        if (p.lab) p.lab.setAttribute('opacity', f1(cl((t - p.t0 - 0.75) / 0.3)));
        if (p.code) p.code.setAttribute('opacity', f1(cl((t - p.t0 - 0.95) / 0.3)));
        p.lg.setAttribute('opacity', f1(cl((t - p.t0 - 0.85) / 0.25)));
        if (p.ok && ru >= 1) present++;
      });
      counter.textContent = `PRESENT ${present} / ${people.filter((p) => t > p.t0).length || 0}`;
      fence.setAttribute('stroke-width', f1(2.5 + Math.max(0, Math.sin(t * 3)) * 0.8));
    }
    return { draw, loop: o.loop };
  }

  /* ================================================================ LEADERBOARD */
  function BoardScene(svg, opt = {}) {
    const o = Object.assign({ loop: 11.5 }, opt);
    const W = 1000, H = 620;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const root = el('g', {}, svg);
    el('text', { x: 50, y: 74, 'font-family': POSTER, 'font-size': 36, fill: C.ink, 'letter-spacing': 0.5 }, root, 'LIVE LEADERBOARD');
    txt(root, 52, 102, 'HACKATHON 24H · 3 JUDGES · SCORES OUT OF 100', { 'font-size': 11, fill: C.muted });
    const judges = [0, 1, 2].map((i) => {
      const g = el('g', { transform: `translate(${770 + i * 64},70)` }, root);
      const ring = el('circle', { r: 22, fill: 'none', stroke: C.amber, 'stroke-width': 3, opacity: 0 }, g);
      el('circle', { r: 18, fill: C.ink }, g);
      txt(g, 0, 4.5, 'J' + (i + 1), { 'text-anchor': 'middle', 'font-size': 12, fill: C.paper, 'letter-spacing': 0 });
      return { g, ring, x: 770 + i * 64 };
    });
    const lock = el('g', { transform: 'translate(944,118)', opacity: 0 }, root);
    const shackle = el('path', { d: 'M-8,0 v-8 a8,8 0 0 1 16,0 v8', fill: 'none', stroke: C.ink, 'stroke-width': 2.6 }, lock);
    el('rect', { x: -11, y: 0, width: 22, height: 16, rx: 3, fill: C.ink }, lock);
    const banner = el('g', { opacity: 0 }, root);
    el('rect', { x: 50, y: 548, width: 900, height: 44, rx: 10, fill: C.ink }, banner);
    txt(banner, 500, 576, 'SCORES LOCKED · RESULTS FINAL · TOP TEAM +100 REWARD POINTS', { 'font-size': 13, fill: C.paper, 'text-anchor': 'middle' });

    const TEAMS = ['NullPointers', 'Stack Smashers', 'Git Push Force', 'Byte Me', '404 Found'];
    const R = [[24, 28, 22, 30, 19], [27, 25, 31, 24, 20], [29, 27, 30, 23, 22]];
    const cum = [[0, 0, 0, 0, 0]];
    R.forEach((r, k) => cum.push(cum[k].map((v, i) => v + r[i])));
    const rankOf = (sc) => { const idx = sc.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]); const rk = []; idx.forEach(([, i], r) => (rk[i] = r)); return rk; };
    const ranks = cum.map(rankOf);
    const rowY = (r) => 140 + r * 78;
    const rows = TEAMS.map((name, i) => {
      const g = el('g', {}, root);
      const box = el('rect', { x: 50, y: 0, width: 900, height: 62, rx: 12, fill: C.paper, stroke: C.ink, 'stroke-width': 2.2 }, g);
      const rk = el('text', { x: 84, y: 42, 'font-family': POSTER, 'font-size': 30, fill: C.ink, 'text-anchor': 'middle' }, g, String(i + 1));
      el('text', { x: 122, y: 40, 'font-family': DISPLAY, 'font-size': 23, fill: C.ink }, g, name);
      el('rect', { x: 400, y: 23, width: 400, height: 16, rx: 4, fill: C.chip }, g);
      const bar = el('rect', { x: 400, y: 23, width: 0, height: 16, rx: 4, fill: C.amber }, g);
      const sc = el('text', { x: 920, y: 43, 'font-family': POSTER, 'font-size': 30, fill: C.ink, 'text-anchor': 'end' }, g, '0');
      const lk = el('g', { opacity: 0, transform: 'translate(836,31)' }, g);
      el('path', { d: 'M-5,0 v-5 a5,5 0 0 1 10,0 v5', fill: 'none', stroke: C.muted, 'stroke-width': 2 }, lk);
      el('rect', { x: -7, y: 0, width: 14, height: 10, rx: 2, fill: C.muted }, lk);
      const chip = el('g', { opacity: 0 }, root);
      el('rect', { x: -22, y: -13, width: 44, height: 26, rx: 8, fill: C.ink }, chip);
      const chipT = txt(chip, 0, 5, '+0', { 'text-anchor': 'middle', 'font-size': 12, fill: C.paper, 'letter-spacing': 0 });
      return { g, box, rk, bar, sc, lk, chip, chipT, i };
    });
    txt(root, 50, 612, 'Illustrative teams', { 'font-size': 10, fill: C.muted, opacity: 0.8 });

    const R0 = 0.9, RD = 2.1, LOCK = R0 + RD * 3 + 0.2;
    function draw(t) {
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      root.setAttribute('opacity', f1(1 - cl((t - (o.loop - 0.5)) / 0.45)));
      // which round are we in
      const k = cl(Math.floor((t - R0) / RD), -1, 2);
      rows.forEach((row) => {
        const i = row.i;
        // score: interpolate cumulative after round k
        let score = 0, rankF = i;
        for (let r = 0; r < 3; r++) {
          const t0 = R0 + r * RD;
          const su = eo((t - t0 - 0.75) / 0.5);
          score += R[r][i] * su;
        }
        // rank: lerp between ranks of each round
        rankF = i;
        for (let r = 0; r < 3; r++) {
          const t0 = R0 + r * RD + 1.35;
          const ru = eio((t - t0) / 0.6);
          rankF = lerp(rankF, ranks[r + 1][i], ru);
        }
        const enter = eo((t - i * 0.08) / 0.5);
        row.g.setAttribute('transform', `translate(${f1((1 - enter) * -40)},${f1(rowY(rankF))})`);
        row.g.setAttribute('opacity', f1(enter));
        row.bar.setAttribute('width', f1(4 * score));
        row.sc.textContent = Math.round(score);
        const final = ranks[3][i] === 0 && t > LOCK;
        row.bar.setAttribute('fill', final ? C.red : C.amber);
        row.box.setAttribute('fill', final ? C.amberSoft : C.paper);
        row.rk.textContent = String(Math.round(rankF) + 1);
        row.lk.setAttribute('opacity', f1(cl((t - LOCK - 0.2 - i * 0.05) / 0.25)));
        // chip flying from current judge
        if (k >= 0) {
          const t0 = R0 + k * RD + i * 0.07, u = cl((t - t0) / 0.7), e = eio(u);
          const jx = judges[k].x, jy = 70, tx = 400 + 4 * (cum[k][i] + R[k][i] * 0.5), ty = rowY(ranks[k][i]) + 31;
          const x = lerp(jx, tx, e), y = lerp(jy, ty, e) - Math.sin(e * Math.PI) * 40;
          set(row.chip, { opacity: u > 0 && u < 1 ? 1 : 0, transform: tr(x, y) });
          row.chipT.textContent = '+' + R[k][i];
        } else row.chip.setAttribute('opacity', 0);
      });
      judges.forEach((j, i) => {
        const t0 = R0 + i * RD, a = t >= t0 && t < t0 + 0.9;
        set(j.ring, { opacity: a ? 1 : 0, r: f1(22 + (a ? Math.sin((t - t0) * 12) * 2 : 0)) });
      });
      const lu = cl((t - LOCK) / 0.3);
      lock.setAttribute('opacity', f1(cl((t - LOCK + 0.4) / 0.3)));
      shackle.setAttribute('transform', `translate(0,${f1(lerp(-6, 0, eio(lu)))})`);
      banner.setAttribute('opacity', f1(cl((t - LOCK - 0.3) / 0.3)));
      banner.setAttribute('transform', `translate(0,${f1((1 - eo((t - LOCK - 0.3) / 0.4)) * 20)})`);
    }
    return { draw, loop: o.loop };
  }

  /* ================================================================ RATE LIMITS (API platform) */
  function RateScene(svg, opt = {}) {
    const o = Object.assign({ loop: 9 }, opt);
    const W = 1000, H = 560;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const root = el('g', {}, svg);
    const PLANS = [
      { name: 'BASIC', lim: 30, price: '₹499 / mo', rate: 9, col: C.silver },
      { name: 'PRO', lim: 120, price: '₹1,999 / mo', rate: 9, col: C.amber },
      { name: 'ENTERPRISE', lim: 500, price: '₹5,999 / mo', rate: 9, col: C.green },
    ];
    // demand is the same for all three lanes; capacity differs (scaled: 1 dot = 10 req)
    txt(root, 50, 52, 'SAME TRAFFIC, THREE PLANS · 1 DOT = 10 REQUESTS', { 'font-size': 12, fill: C.muted });
    const key = el('g', { transform: 'translate(50,96)' }, root);
    el('rect', { x: 0, y: -22, width: 210, height: 44, rx: 10, fill: C.ink }, key);
    txt(key, 14, 5, 'x-api-key: hbc_••••', { 'font-size': 12, fill: C.paper, 'letter-spacing': 0.5 });
    const winTxt = txt(root, 950, 52, 'WINDOW 60s', { 'font-size': 12, 'text-anchor': 'end' });
    const lanes = PLANS.map((p, li) => {
      const y = 170 + li * 128;
      const g = el('g', {}, root);
      el('text', { x: 50, y: y + 8, 'font-family': POSTER, 'font-size': 30, fill: C.ink }, g, p.name);
      txt(g, 50, y + 32, `${p.lim} REQ/MIN · ${p.price}`, { 'font-size': 11, fill: C.muted });
      el('line', { x1: 300, y1: y, x2: 640, y2: y, stroke: C.line, 'stroke-width': 3, 'stroke-dasharray': '2 8' }, g);
      // gate
      const gate = el('rect', { x: 640, y: y - 30, width: 18, height: 60, rx: 4, fill: C.ink }, g);
      // bucket meter
      el('rect', { x: 700, y: y - 14, width: 200, height: 28, rx: 8, fill: C.chip, stroke: C.ink, 'stroke-width': 2 }, g);
      const fill = el('rect', { x: 702, y: y - 12, width: 0, height: 24, rx: 6, fill: p.col }, g);
      const cnt = txt(g, 912, y + 5, '0', { 'font-size': 13 });
      const n429 = txt(g, 700, y + 40, '', { 'font-size': 12, fill: C.red });
      const dots = Array.from({ length: 16 }, () => el('circle', { r: 6, fill: C.ink, opacity: 0 }, g));
      return Object.assign({ y, g, gate, fill, cnt, n429, dots }, p);
    });
    const DEMAND = 400; // requests per minute hitting every lane
    function draw(t) {
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      root.setAttribute('opacity', f1(1 - cl((t - (o.loop - 0.4)) / 0.4)));
      const WIN = 4.0; // seconds of scene time = one 60 s window
      const w = (t % WIN) / WIN;
      winTxt.textContent = `WINDOW ${Math.ceil(60 * (1 - w))}s`;
      lanes.forEach((L) => {
        const sent = DEMAND * w; // requests sent this window
        const allowed = Math.min(sent, L.lim);
        L.fill.setAttribute('width', f1(196 * Math.min(1, allowed / L.lim)));
        L.fill.setAttribute('fill', allowed >= L.lim ? C.red : L.col);
        L.cnt.textContent = `${Math.round(allowed)}/${L.lim}`;
        const rej = Math.max(0, Math.round(sent - L.lim));
        L.n429.textContent = rej > 0 ? `429 Too Many Requests × ${rej}` : '';
        L.dots.forEach((d, i) => {
          const period = 0.25, ph = ((t + i * period) % (L.dots.length * period)) / (L.dots.length * period);
          const reqIdx = Math.floor(sent / 10);
          const blocked = allowed >= L.lim;
          let x, y = L.y, op = 1, fillC = C.ink;
          if (ph < 0.5) { x = lerp(300, 640, ph / 0.5); }
          else if (!blocked) { x = lerp(660, 700, (ph - 0.5) / 0.5); op = 1 - (ph - 0.5) / 0.5; }
          else { const u = (ph - 0.5) / 0.5; x = lerp(640, 560, u); y = L.y - Math.sin(u * Math.PI) * 30; fillC = C.red; op = 1 - u; }
          set(d, { cx: f1(x), cy: f1(y), opacity: f1(op * (reqIdx >= 0 ? 1 : 0)), fill: fillC });
        });
        L.gate.setAttribute('fill', allowed >= L.lim ? C.red : C.ink);
      });
    }
    return { draw, loop: o.loop };
  }

  root.Hbc = { TreeScene, GeoScene, BoardScene, RateScene, qrGroup, C, el };
})(typeof window !== 'undefined' ? window : globalThis);
