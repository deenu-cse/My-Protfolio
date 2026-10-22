/*!
 * yatri.js — scenes for the YatriMap / TouristGo case study.
 * Every scene is deterministic: draw(t) renders time t (seconds) so the same code drives the
 * live page and the frame-by-frame video renderer. Needs toon.js (window.Toon) and uk-map-data.js (window.UK_MAP).
 */
(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { ink: '#141312', paper: '#fdfbf6', red: '#EE3349', green: '#178a5a', greenSoft: '#d6efe2', sky: '#e8f1ec', muted: '#6e6760', line: '#ddd5c8', river: '#1d63d6' };
  const MONO = 'var(--f-mono,"Space Mono"),ui-monospace,monospace', POSTER = 'var(--f-poster,Anton),Impact,sans-serif', DISP = 'var(--f-display,Marcellus),Georgia,serif';
  const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const eo = (u) => 1 - Math.pow(1 - cl(u), 3);
  const eio = (u) => { u = cl(u); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const back = (u) => { u = cl(u); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
  const lerp = (a, b, u) => a + (b - a) * u;
  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, parent, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ============================================================ DATA */
  // Snapshot from 22 Oct 2026 (numbers supplied by Deendayal). Used when the live API can't be reached.
  const SNAPSHOT = {
    asOf: '2026-10-22',
    platform: {
      bookings: 270, bookingsSplit: { activities: 144, hotels: 99, rentals: 27 },
      guests: 620, guestsSplit: { activities: 323, hotels: 298 },
      hotels: 55, rooms: 117, hotelsWithBookings: 18, vehicles: 138, hubs: 15, qrPoints: 40,
      activitiesListed: 28, destinations: 6, states: 4,
    },
    activity: {
      bookings: 144, completed: 107, guests: 323, travellers: 94, repeat: 30, partners: 12,
      rating: 4.6, reviews: 31, fiveStar: 0.77,
      byType: [['Bungee', 68], ['Rafting', 62], ['Adventure', 9], ['Paragliding', 3], ['Zipline', 2]],
      since: 'Apr 2026', bestMonth: ['Oct 2026', 50],
      recentTrips: [{ activity: 'Bungee Jumping', city: 'Rishikesh', guests: 3, date: '21 Oct', via: 'walk-in', rating: 5 }],
      reviewHighlights: [],
    },
  };
  // Accepts the /public/impact JSON (any reasonable key naming) and maps it onto the snapshot shape.
  function normalizeImpact(json) {
    const d = (json && (json.data || json)) || {};
    const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; };
    const T = d.totals || {}, R = d.ratings || {}, TR = d.trends || {};
    const out = JSON.parse(JSON.stringify(SNAPSHOT.activity));
    out.bookings = pick(T, 'bookings') ?? out.bookings;
    out.completed = pick(T, 'completed', 'completedTrips') ?? out.completed;
    out.guests = pick(T, 'guests') ?? out.guests;
    out.travellers = pick(T, 'travellers', 'uniqueTravellers', 'travelers') ?? out.travellers;
    out.repeat = pick(T, 'repeatTravellers', 'repeat', 'returning') ?? out.repeat;
    out.partners = pick(T, 'partners', 'partnerCompanies') ?? out.partners;
    out.online = pick(T, 'online'); out.walkIn = pick(T, 'walkIn', 'walkin', 'walk_in');
    out.rating = pick(R, 'average', 'avg') ?? out.rating;
    out.reviews = pick(R, 'count', 'reviews') ?? out.reviews;
    let fs = pick(R, 'fiveStarShare', 'fiveStar', 'fiveStarPct', 'fiveStarPercent');
    if (fs != null) out.fiveStar = fs > 1 ? fs / 100 : fs;
    const toPairs = (x, nameKeys, valKeys) => Array.isArray(x)
      ? x.map((r) => [pick(r, ...nameKeys), pick(r, ...valKeys)]).filter((p) => p[0] != null && p[1] != null)
      : x && typeof x === 'object' ? Object.entries(x) : null;
    const byType = toPairs(pick(TR, 'byActivity', 'activity', 'activities', 'byType', 'type'), ['type', 'activity', 'name', '_id'], ['bookings', 'count', 'value', 'total']);
    if (byType && byType.length) out.byType = byType.sort((a, b) => b[1] - a[1]);
    const byCity = toPairs(pick(TR, 'byCity', 'city', 'cities'), ['city', 'name', '_id'], ['bookings', 'count', 'value', 'total']);
    if (byCity && byCity.length) out.byCity = byCity.sort((a, b) => b[1] - a[1]);
    const byMonth = toPairs(pick(TR, 'byMonth', 'month', 'months', 'monthly'), ['month', 'name', '_id'], ['bookings', 'count', 'value', 'total']);
    if (byMonth && byMonth.length) out.byMonth = byMonth;
    if (Array.isArray(d.recentTrips) && d.recentTrips.length) out.recentTrips = d.recentTrips;
    if (Array.isArray(d.reviewHighlights)) out.reviewHighlights = d.reviewHighlights;
    out.live = true;
    return out;
  }

  /* ============================================================ BUNGEE HERO */
  function BungeeScene(svg, opt = {}) {
    const o = Object.assign({ start: 0, W: 1000, H: 640, anchorX: 600, scale: 0.26, loop: 0 }, opt);
    const { W, H } = o;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const BY = 230; // bridge deck
    // sky + mountains
    el('rect', { width: W, height: H, fill: C.paper }, svg);
    el('path', { d: `M0,${H * 0.62} L${W * 0.12},${H * 0.36} L${W * 0.22},${H * 0.5} L${W * 0.36},${H * 0.22} L${W * 0.5},${H * 0.48} L${W * 0.62},${H * 0.3} L${W * 0.78},${H * 0.5} L${W * 0.9},${H * 0.34} L${W},${H * 0.46} L${W},${H} L0,${H} Z`, fill: '#efe9dc' }, svg);
    el('path', { d: `M${W * 0.36},${H * 0.22} l-26,40 18,-6 8,14 10,-20 16,6 Z M${W * 0.62},${H * 0.3} l-20,30 14,-4 6,10 8,-16 12,4 Z`, fill: '#fff', stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    // gorge walls
    el('path', { d: `M0,${BY + 8} L${W * 0.2},${BY + 8} L${W * 0.26},${H * 0.55} L${W * 0.3},${H} L0,${H} Z`, fill: '#2a2826', stroke: C.ink, 'stroke-width': 3 }, svg);
    el('path', { d: `M${W},${BY + 8} L${W * 0.84},${BY + 8} L${W * 0.8},${H * 0.6} L${W * 0.76},${H} L${W},${H} Z`, fill: '#2a2826', stroke: C.ink, 'stroke-width': 3 }, svg);
    // pine trees on gorge walls
    for (let i = 0; i < 9; i++) {
      const left = i < 5, x = left ? 20 + i * 38 : W - 20 - (i - 5) * 40, y = BY + 8;
      el('path', { d: `M${x},${y} l-12,0 12,-30 12,30 Z`, fill: C.green, stroke: C.ink, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
    }
    // river
    const river = el('path', { d: '', fill: C.river, opacity: 0.85 }, svg);
    // bridge
    el('rect', { x: W * 0.18, y: BY, width: W * 0.68, height: 14, fill: C.ink }, svg);
    for (let i = 0; i <= 16; i++) { const x = W * 0.18 + i * (W * 0.68 / 16); el('line', { x1: x, y1: BY, x2: x + (i % 2 ? -W * 0.68 / 32 : W * 0.68 / 32), y2: BY - 34, stroke: C.ink, 'stroke-width': 3 }, svg); }
    el('line', { x1: W * 0.18, y1: BY - 34, x2: W * 0.86, y2: BY - 34, stroke: C.ink, 'stroke-width': 4 }, svg);
    // jump platform
    const AX = o.anchorX;
    el('rect', { x: AX - 46, y: BY - 6, width: 92, height: 10, fill: C.red, stroke: C.ink, 'stroke-width': 2.5 }, svg);
    const rope = el('path', { d: '', fill: 'none', stroke: C.red, 'stroke-width': 5, 'stroke-linecap': 'round' }, svg);
    const toonG = el('g', {}, svg);
    const splash = el('g', {}, svg);
    const label = el('g', { opacity: 0 }, svg);
    el('rect', { x: 0, y: -28, width: 196, height: 56, fill: C.paper, stroke: C.ink, 'stroke-width': 3 }, label);
    el('text', { x: 14, y: 8, 'font-family': POSTER, 'font-size': 30, fill: C.ink }, label, 'BUNGEE');
    const labN = el('text', { x: 182, y: 8, 'text-anchor': 'end', 'font-family': POSTER, 'font-size': 30, fill: C.red }, label, '');
    el('text', { x: 14, y: 46, 'font-family': MONO, 'font-size': 13, 'font-weight': 700, fill: C.muted }, label, 'TOP ACTIVITY');
    const REST = BY + 110, AMP = 85, L0 = REST - BY - 40;
    const tStand = 0.9;
    function feetY(u) { // u = time since leaving the platform
      if (u < 0.5) { const k = u / 0.5; return BY - 40 * Math.sin(Math.PI * k) * (1 - k) + (REST + AMP - BY) * k * k; }
      const v = u - 0.5;
      return REST + AMP * Math.exp(-0.45 * v) * Math.cos(3.0 * v);
    }
    function draw(t) {
      t -= o.start;
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      // river waves
      let d = `M${W * 0.22},${H}`;
      for (let x = W * 0.22; x <= W * 0.8; x += 10) d += ` L${x.toFixed(0)},${(H - 34 + Math.sin(x * 0.04 + t * 3) * 4).toFixed(1)}`;
      river.setAttribute('d', d + ` L${W * 0.8},${H} Z`);
      const s = o.scale;
      if (t < tStand) {
        // standing on the platform, facing right, shades on, waving
        rope.setAttribute('d', `M${AX},${BY} q-30,40 0,60 q20,10 2,${-56}`);
        Toon.draw(toonG, { x: AX - 10, ground: BY - 4, scale: s, mode: 'idle', t, shades: 1, wave: cl(t / 0.3), mouth: 'smile' });
        label.setAttribute('opacity', 0);
      } else {
        const u = t - tStand;
        const fy = feetY(u);
        const sway = Math.sin(u * 1.7) * 18 * Math.exp(-0.3 * u);
        const fx = AX + 6 + sway;
        const taut = fy - BY > L0;
        rope.setAttribute('d', taut ? `M${AX},${BY} L${fx.toFixed(1)},${fy.toFixed(1)}` : `M${AX},${BY} Q${(AX + 46).toFixed(1)},${((BY + fy) / 2 + 40).toFixed(1)} ${fx.toFixed(1)},${fy.toFixed(1)}`);
        // inverted toon hanging by the feet: draw normally, then flip
        const flip = cl(u / 0.35);
        const ang = 180 * flip + sway * 0.4;
        Toon.draw(toonG, { x: 0, ground: 0, scale: s, mode: 'idle', t, shades: 1, wave: 1, mouth: u < 2.2 ? 'o' : 'smile', look: [0.3, 0.6] });
        toonG.firstChild.setAttribute('transform', `translate(${fx.toFixed(1)},${fy.toFixed(1)}) rotate(${ang.toFixed(1)}) translate(0,${(-14 * s).toFixed(1)}) scale(${s},${s})`);
        const lu = (u - 1.6) / 0.4;
        label.setAttribute('opacity', cl(lu * 2));
        label.setAttribute('transform', `translate(${(W * 0.06).toFixed(0)},${(H * 0.42 + (1 - back(lu)) * 30).toFixed(1)})`);
        labN.textContent = String(Math.round(68 * eo((u - 1.6) / 1.2)));
      }
      while (splash.firstChild) splash.removeChild(splash.firstChild);
    }
    return { draw };
  }

  /* ============================================================ IMPACT BOARD (DOM) */
  function ImpactBoard(rootEl, data, opt = {}) {
    const o = Object.assign({ start: 0, platform: SNAPSHOT.platform, compact: false }, opt);
    rootEl.innerHTML = '';
    rootEl.classList.add('ib');
    const P = o.platform;
    const tiles = [
      ['ALL · BOOKINGS', P.bookings, '', `real bookings: ${P.bookingsSplit.activities} activities, ${P.bookingsSplit.hotels} hotel stays, ${P.bookingsSplit.rentals} vehicle rentals`],
      ['ALL · GUESTS', P.guests, '+', `guests served (${P.guestsSplit.activities} on activities, ${P.guestsSplit.hotels} in hotels)`],
      ['ACT · RATING', data.rating, '★', `average from ${data.reviews} verified reviews, ${Math.round(data.fiveStar * 100)}% five-star`, 1],
      ['ACT · PARTNERS', data.partners, '', 'adventure companies receiving bookings through TouristGo'],
      ['ACT · LISTED', P.activitiesListed, '', `activities listed in ${P.destinations} destinations across ${P.states} states`],
      ['HTL · LISTED', P.hotels, '', `hotels and ${P.rooms} rooms listed; ${P.hotelsWithBookings} hotels with bookings`],
      ['RNT · FLEET', P.vehicles, '', `rental vehicles across ${P.hubs} hubs`],
      ['QR · POINTS', P.qrPoints, '', 'hotels, cafés and shops selling trips with a TouristGo QR'],
    ];
    const grid = h('div', 'ib-grid', rootEl);
    const nums = tiles.map(([k, v, suf, txt, dec], i) => {
      const c = h('div', 'ib-tile' + (i === 2 ? ' ib-star' : ''), grid);
      h('div', 'ib-k', c, k);
      const n = h('div', 'ib-n', c, '0');
      h('div', 'ib-t', c, txt);
      return { n, v, suf, dec, i };
    });
    // activity mix
    const mix = h('div', 'ib-mix', rootEl);
    h('div', 'ib-k', mix, `TOP ACTIVITIES · ${data.bookings} ACTIVITY BOOKINGS`);
    const max = Math.max(...data.byType.map((r) => r[1]));
    const bars = data.byType.slice(0, 6).map(([name, v]) => {
      const row = h('div', 'ib-row', mix);
      h('span', 'ib-name', row, name);
      const track = h('span', 'ib-track', row); const bar = h('i', '', track);
      const num = h('b', '', row, '0');
      return { bar, num, v, f: v / max };
    });
    const foot = h('div', 'ib-foot', rootEl);
    const live = h('span', 'ib-live', foot, `<i></i>${data.live ? 'Live from production' : 'Snapshot · ' + SNAPSHOT.asOf}`);
    h('span', '', foot, `${data.travellers} unique travellers · ${data.repeat} booked again · since ${data.since} · best month ${data.bestMonth[0]} (${data.bestMonth[1]})`);
    function draw(t) {
      t -= o.start;
      nums.forEach(({ n, v, suf, dec, i }) => {
        const u = eo((t - i * 0.08) / 1.4);
        n.textContent = (dec ? (v * u).toFixed(1) : Math.round(v * u)) + (u > 0.98 ? suf : '');
      });
      bars.forEach((b, i) => {
        const u = eo((t - 0.5 - i * 0.12) / 1.1);
        b.bar.style.width = (b.f * u * 100).toFixed(1) + '%';
        b.num.textContent = Math.round(b.v * u);
      });
    }
    return { draw };
  }

  /* ============================================================ QR → BOOKING → WHATSAPP (DOM) */
  function qrCells(n = 25, seed = 7) {
    let s = seed; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const cells = [];
    const finder = (x, y) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (finder(x, y)) {
        const fx = x >= n - 7 ? x - (n - 7) : x, fy = y >= n - 7 ? y - (n - 7) : y;
        if (fx === 0 || fy === 0 || fx === 6 || fy === 6 || (fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4)) cells.push([x, y]);
      } else if (r() > 0.52) cells.push([x, y]);
    }
    return cells;
  }
  function qrSVG(size, color = C.ink) {
    const n = 25, c = size / n;
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="#fff"/>${qrCells(n).map(([x, y]) => `<rect x="${(x * c).toFixed(2)}" y="${(y * c).toFixed(2)}" width="${(c + 0.3).toFixed(2)}" height="${(c + 0.3).toFixed(2)}" fill="${color}"/>`).join('')}</svg>`;
  }
  const CSS_QF = `
  .qf{position:relative;width:1200px;height:760px;font-family:var(--f-body,Figtree),system-ui,sans-serif;color:#141312}
  .qf *{box-sizing:border-box}
  .qf-ph{position:absolute;top:30px;width:330px;height:640px;border:3px solid #141312;border-radius:42px;background:#141312;padding:10px;box-shadow:10px 12px 0 rgba(20,19,18,.12)}
  .qf-scr{position:relative;width:100%;height:100%;border-radius:32px;overflow:hidden;background:#fdfbf6}
  .qf-cap{position:absolute;top:690px;width:330px;text-align:center;font:700 13px/1.4 var(--f-mono,"Space Mono"),monospace;letter-spacing:.12em;text-transform:uppercase}
  .qf-cap small{display:block;font-weight:400;letter-spacing:.04em;text-transform:none;color:#6e6760;font-size:13px}
  .qf-v{position:absolute;inset:0;display:flex;flex-direction:column}
  .qf-bar{height:30px;display:flex;justify-content:space-between;align-items:center;padding:0 22px;font:700 11px var(--f-mono,"Space Mono"),monospace}
  .qf-hd{padding:10px 18px 12px;border-bottom:2px solid #141312;display:flex;justify-content:space-between;align-items:baseline}
  .qf-hd b{font:400 24px var(--f-poster,Anton),Impact,sans-serif;letter-spacing:.02em}
  .qf-hd span{font:700 10px var(--f-mono,"Space Mono"),monospace;letter-spacing:.1em;color:#178a5a;text-transform:uppercase}
  .qf-cam{position:absolute;inset:0;background:#2a2826;display:grid;place-items:center}
  .qf-stand{width:200px;padding:14px;background:#fdfbf6;border:3px solid #141312;text-align:center;font:700 11px var(--f-mono,"Space Mono"),monospace;letter-spacing:.1em}
  .qf-stand svg{display:block;margin:8px auto}
  .qf-frame{position:absolute;width:236px;height:290px;border:4px solid #fff;border-radius:18px;transition:none}
  .qf-scan{position:absolute;left:12%;right:12%;height:3px;background:#3fe08a;box-shadow:0 0 12px #3fe08a}
  .qf-card{margin:10px 14px 0;border:2px solid #141312;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;background:#fff}
  .qf-card b{font:400 19px var(--f-poster,Anton),Impact,sans-serif;letter-spacing:.02em}
  .qf-card small{display:block;font:11px var(--f-mono,"Space Mono"),monospace;color:#6e6760}
  .qf-card i{font-style:normal;font:700 11px var(--f-mono,"Space Mono"),monospace;border:2px solid #141312;padding:4px 7px}
  .qf-card.on{background:#d6efe2;border-color:#178a5a}
  .qf-sum{margin:14px;border:2px solid #141312;background:#fff;padding:12px 14px;font:13px/1.9 var(--f-mono,"Space Mono"),monospace}
  .qf-sum div{display:flex;justify-content:space-between}
  .qf-sum .tot{border-top:2px dashed #141312;margin-top:6px;padding-top:6px;font-weight:700}
  .qf-btn{margin:0 14px;background:#178a5a;color:#fff;text-align:center;padding:14px;font:700 14px var(--f-mono,"Space Mono"),monospace;letter-spacing:.1em;border:2px solid #141312}
  .qf-ok{position:absolute;inset:0;background:#178a5a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center}
  .qf-ok .ck{width:84px;height:84px;border-radius:50%;background:#fff;color:#178a5a;display:grid;place-items:center;font:400 52px var(--f-poster,Anton),Impact,sans-serif}
  .qf-ok b{font:400 34px var(--f-poster,Anton),Impact,sans-serif;letter-spacing:.02em}
  .qf-ok span{font:700 12px var(--f-mono,"Space Mono"),monospace;letter-spacing:.1em}
  .qf-ok .tk{background:#fff;padding:8px;border:2px solid #141312;margin-top:6px}
  .qf-row{margin:8px 14px 0;border:2px solid #141312;padding:9px 10px;font:12px/1.35 var(--f-mono,"Space Mono"),monospace;background:#fff;display:flex;justify-content:space-between;gap:8px}
  .qf-row b{font-weight:700}
  .qf-row .st{font-weight:700;font-size:10px;letter-spacing:.06em;padding:3px 6px;border:1.5px solid currentColor;align-self:flex-start;white-space:nowrap}
  .qf-row.new{background:#d6efe2;border-color:#178a5a}
  .qf-row.dim{opacity:.45}
  .qf-toast{position:absolute;left:12px;right:12px;top:40px;background:#141312;color:#fdfbf6;border-radius:14px;padding:10px 12px;font:700 12px/1.4 var(--f-mono,"Space Mono"),monospace}
  .qf-toast small{display:block;font-weight:400;color:#9fe0bd}
  .qf-chat{background:#0f1a17}
  .qf-chat .qf-bar{color:#cfd8d4}
  .qf-ch{background:#1c2a26;color:#e9efec;padding:10px 16px;display:flex;gap:10px;align-items:center;border-bottom:1px solid #263832}
  .qf-ch i{width:30px;height:30px;border-radius:50%;background:#178a5a;display:grid;place-items:center;font:400 15px var(--f-poster,Anton),Impact,sans-serif;font-style:normal;color:#fff}
  .qf-ch b{font-size:14px}.qf-ch small{display:block;font-size:11px;color:#8fa59d}
  .qf-msgs{position:absolute;left:0;right:0;top:86px;bottom:0;padding:10px 10px 14px;display:flex;flex-direction:column;justify-content:flex-end;gap:8px;overflow:hidden}
  .qf-b{background:#1f2c33;color:#e9edef;border-radius:4px 12px 12px 12px;padding:8px 10px 6px;font-size:12.5px;line-height:1.42;max-width:94%;transform-origin:0 100%}
  .qf-b .tm{display:block;text-align:right;font-size:10px;color:#8696a0;margin-top:2px}
  .qf-b a{color:#53bdeb;text-decoration:none}
  .qf-pdf{display:flex;gap:8px;align-items:center;background:#2a3942;border-radius:8px;padding:8px;margin-bottom:6px;font-size:11.5px}
  .qf-pdf i{font-style:normal;background:#ee3349;color:#fff;font:700 9px var(--f-mono,"Space Mono"),monospace;padding:6px 4px;border-radius:3px}
  .qf-typing{background:#1f2c33;border-radius:12px;padding:10px 12px;width:58px;display:flex;gap:5px}
  .qf-typing i{width:7px;height:7px;border-radius:50%;background:#8696a0}
  `;
  function QRFlow(rootEl, opt = {}) {
    const o = Object.assign({ start: 0, loop: 0 }, opt);
    rootEl.innerHTML = '';
    if (!document.getElementById('qf-css')) { const st = document.createElement('style'); st.id = 'qf-css'; st.textContent = CSS_QF; document.head.appendChild(st); }
    const R = h('div', 'qf', rootEl);
    const phone = (x, cls) => { const p = h('div', 'qf-ph', R); p.style.left = x + 'px'; return h('div', 'qf-scr ' + (cls || ''), p); };
    const cap = (x, a, b) => { const c = h('div', 'qf-cap', R, `${a}<small>${b}</small>`); c.style.left = x + 'px'; return c; };
    // --- phone A: traveller
    const A = phone(20);
    cap(20, '1 · Traveller scans', 'books in under a minute');
    const aCam = h('div', 'qf-cam', A);
    const stand = h('div', 'qf-stand', aCam, `BOOK RIVER TRIPS HERE${qrSVG(150)}TOURISTGO · SCAN ME`);
    const frame = h('div', 'qf-frame', aCam);
    const scan = h('div', 'qf-scan', aCam);
    const aShop = h('div', 'qf-v', A); aShop.style.background = '#fdfbf6';
    h('div', 'qf-bar', aShop, '<span>9:41</span><span>TouristGo</span>');
    h('div', 'qf-hd', aShop, '<b>RISHIKESH</b><span>at your hotel</span>');
    const items = [['Bungee', 'Shivpuri · slots today'], ['River rafting', '16 km · 12 km · 9 km'], ['Zipline', 'Splash Bungy · slot 1'], ['Scooty rental', 'by the day']]
      .map(([a, b]) => h('div', 'qf-card', aShop, `<span><b>${a}</b><small>${b}</small></span><i>ADD</i>`));
    const aCart = h('div', 'qf-v', A); aCart.style.background = '#fdfbf6';
    h('div', 'qf-bar', aCart, '<span>9:41</span><span>Cart</span>');
    h('div', 'qf-hd', aCart, '<b>YOUR TRIP</b><span>1 guest</span>');
    h('div', 'qf-card on', aCart, '<span><b>Zipline</b><small>Splash Bungy · 1 guest · slot 1</small></span><i>×1</i>');
    h('div', 'qf-sum', aCart, '<div><span>Total</span><span>₹1,000</span></div><div><span>Coupon</span><span>−₹200</span></div><div><span>Pay at counter</span><span>₹700</span></div><div class="tot"><span>Advance now</span><span>₹300</span></div>');
    const payBtn = h('div', 'qf-btn', aCart, 'PAY ₹300 · RAZORPAY');
    const aOk = h('div', 'qf-ok', A, `<div class="ck">✓</div><b>BOOKED</b><span id="qfTimer">IN 0:52</span><div class="tk">${qrSVG(96)}</div><span>QR TICKET · SLOT 1</span>`);
    // --- phone B: partner portal
    const B = phone(435);
    cap(435, '2 · Company gets it', 'partner portal on their phone');
    const bV = h('div', 'qf-v', B);
    h('div', 'qf-bar', bV, '<span>9:41</span><span>Partner portal</span>');
    h('div', 'qf-hd', bV, "<b>TODAY'S BOOKINGS</b><span>walk-in +</span>");
    h('div', 'qf-row dim', bV, '<span><b>Rafting</b><br>4 guests · slot 2</span><span class="st">CHECKED IN</span>');
    h('div', 'qf-row dim', bV, '<span><b>Bungee</b><br>2 guests · slot 1</span><span class="st">PAID</span>');
    const newRow = h('div', 'qf-row new', bV, '<span><b>Zipline</b><br>1 guest · slot 1 · via QR</span><span class="st" id="qfSt">ADVANCE ₹300</span>');
    const toast = h('div', 'qf-toast', B, 'New booking · Zipline<small>1 guest · slot 1 · advance paid</small>');
    const scanBadge = h('div', 'qf-toast', B, 'QR check-in scanner<small>ticket valid · guest checked in</small>');
    // --- phone C: WhatsApp-style chat (TouristGo automation)
    const Cs = phone(850, 'qf-chat');
    cap(850, '3 · WhatsApp, automated', 'ticket · check-in · thank-you');
    const cV = h('div', 'qf-v', Cs);
    h('div', 'qf-bar', cV, '<span>9:41</span><span>●●●</span>');
    h('div', 'qf-ch', cV, '<i>T</i><span><b>TouristGo</b><small>automated messages</small></span>');
    const msgs = h('div', 'qf-msgs', Cs);
    const M = [
      [5.0, `<div class="qf-pdf"><i>PDF</i><span>TouristGo-Ticket-AC••••0B83.pdf</span></div>Booking to <b>Splash Bungy</b> is confirmed ✅<br><br>Activity · Zipline ×1<br>Slot 1<br>Total ₹1,000 · Advance ₹300<br>Discount ₹200 · <b>Pay at office ₹700</b><span class="tm">11:45 am</span>`],
      [7.9, `You're checked in for Zipline ×1.<br>Amount payable at counter: ₹700<br><br>Have an amazing time!<span class="tm">11:45 am</span>`],
      [9.9, `Thank you for choosing Splash Bungy ⭐<br><br>Total ₹1,000 · Discount ₹200<br>Paid ₹1,000 · <b>Balance: Nil</b><br><br>Loved it? <a>Rate your experience →</a><span class="tm">11:46 am</span>`],
    ].map(([at, html]) => { const b = h('div', 'qf-b', msgs, html); return { at, b }; });
    const typing = h('div', 'qf-typing', msgs, '<i></i><i></i><i></i>');
    const total = 12;
    function draw(t) {
      t -= o.start;
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      // A: camera → shop → cart → ok
      const shopIn = eio((t - 1.5) / 0.35), cartIn = eio((t - 3.0) / 0.35), okIn = eio((t - 4.3) / 0.3);
      aShop.style.transform = `translateX(${((1 - shopIn) * 100).toFixed(1)}%)`;
      aCart.style.transform = `translateX(${((1 - cartIn) * 100).toFixed(1)}%)`;
      aOk.style.transform = `scale(${Math.max(0.001, okIn).toFixed(3)})`; aOk.style.borderRadius = (1 - okIn) * 200 + 'px';
      const sy = 0.5 + 0.38 * Math.sin(t * 4.2);
      scan.style.top = (sy * 100).toFixed(1) + '%'; scan.style.opacity = t < 1.15 ? 1 : 0;
      const lock = eio((t - 0.9) / 0.3);
      frame.style.width = (236 - lock * 30) + 'px'; frame.style.height = (290 - lock * 40) + 'px';
      frame.style.borderColor = t > 1.15 ? '#3fe08a' : '#fff';
      items.forEach((it, i) => it.classList.toggle('on', i === 2 && t > 2.3));
      payBtn.style.background = t > 3.85 && t < 4.3 ? '#0f5c3b' : '#178a5a';
      const secs = Math.min(52, Math.round(52 * cl((t - 0.2) / 4.1)));
      const tm = aOk.querySelector('#qfTimer'); if (tm) tm.textContent = `IN 0:${String(secs).padStart(2, '0')}`;
      // B: new booking at 4.5, check-in at 7.6
      const nb = back((t - 4.6) / 0.45);
      newRow.style.transform = `translateY(${((1 - nb) * -40).toFixed(1)}px)`; newRow.style.opacity = cl((t - 4.6) / 0.2);
      toast.style.opacity = t > 4.5 && t < 6.6 ? 1 : 0; toast.style.transform = `translateY(${((1 - eo((t - 4.5) / 0.3)) * -60).toFixed(1)}px)`;
      scanBadge.style.opacity = t > 7.3 && t < 9.2 ? 1 : 0; scanBadge.style.transform = `translateY(${((1 - eo((t - 7.3) / 0.3)) * -60).toFixed(1)}px)`;
      const st = newRow.querySelector('#qfSt'); if (st) st.textContent = t > 9.9 ? 'PAID · DONE' : t > 7.5 ? 'CHECKED IN' : 'ADVANCE ₹300';
      // C: messages
      let showTyping = false;
      M.forEach((m, i) => {
        const u = back((t - m.at) / 0.4);
        m.b.style.display = t >= m.at ? 'block' : 'none';
        m.b.style.transform = `scale(${Math.max(0.001, u).toFixed(3)})`;
        if (t > m.at - 0.8 && t < m.at) showTyping = true;
      });
      typing.style.display = showTyping ? 'flex' : 'none';
      [...typing.children].forEach((d, i) => { d.style.transform = `translateY(${(Math.sin(t * 9 - i) * 3).toFixed(1)}px)`; });
    }
    return { draw, total, el: R };
  }

  /* ============================================================ RAFT POOL */
  function RaftPoolScene(svg, opt = {}) {
    const o = Object.assign({ start: 0, loop: 0 }, opt);
    const W = 1000, H = 560;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // river band
    const river = el('path', { d: '', fill: '#dbe7fa' }, svg);
    const companies = [['A', 'Company A', 140, 'needs 4 seats'], ['B', 'Company B', 500, '4 seats free'], ['C', 'Company C', 860, '4 seats free']];
    const rafts = companies.map(([k, name, x, sub], i) => {
      const g = el('g', { transform: `translate(${x},392)` }, svg);
      el('path', { d: 'M-118,-22 Q-128,22 -96,30 L96,30 Q128,22 118,-22 Z', fill: i === 0 ? '#ffd9de' : '#fff', stroke: C.ink, 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
      el('path', { d: 'M-104,-14 L104,-14', stroke: C.ink, 'stroke-width': 3 }, g);
      el('text', { x: 0, y: 64, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 16, 'font-weight': 700, fill: C.ink }, g, name.toUpperCase());
      el('text', { x: 0, y: 84, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 13, fill: C.muted }, g, i === 0 ? 'overbooked slot' : 'empty seats');
      const seats = [];
      for (let s = 0; s < 8; s++) seats.push(el('circle', { cx: -84 + s * 24, cy: 6, r: 9, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, g));
      return { g, x, seats };
    });
    // A's raft full (8) + 4 extra guests on bank; B has 4 free (seats 4..7 empty)
    const guests = Array.from({ length: 4 }, () => el('g', {}, svg));
    guests.forEach((g) => { el('circle', { r: 11, fill: C.green, stroke: C.ink, 'stroke-width': 2.5 }, g); el('circle', { cx: 0, cy: -20, r: 7, fill: '#fff', stroke: C.ink, 'stroke-width': 2.5 }, g); });
    const ticket = el('g', { opacity: 0 }, svg);
    el('rect', { x: -96, y: -16, width: 192, height: 32, fill: C.paper, stroke: C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, ticket);
    el('text', { x: 0, y: 6, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 13, 'font-weight': 700, fill: C.green }, ticket, 'SAME BOOKING ID · TICKET');
    // request card
    const card = el('g', {}, svg);
    el('rect', { x: -170, y: -66, width: 340, height: 132, fill: C.paper, stroke: C.ink, 'stroke-width': 4 }, card);
    el('text', { x: -150, y: -30, 'font-family': MONO, 'font-size': 14, 'font-weight': 700, fill: C.red, 'letter-spacing': 1.5 }, card, 'RAFT POOL · REQUEST');
    el('text', { x: -150, y: 10, 'font-family': POSTER, 'font-size': 38, fill: C.ink }, card, 'NEED 4 SEATS');
    const timer = el('text', { x: 150, y: 10, 'text-anchor': 'end', 'font-family': MONO, 'font-size': 22, 'font-weight': 700, fill: C.ink }, card, '20:00');
    const status = el('text', { x: -150, y: 46, 'font-family': MONO, 'font-size': 14, 'font-weight': 700, fill: C.muted }, card, 'slot 10:30 · expires in 20 min');
    // claim arrows from B and C
    const claims = [rafts[1], rafts[2]].map((r, i) => {
      const g = el('g', { opacity: 0 }, svg);
      el('rect', { x: -58, y: -20, width: 116, height: 40, fill: i === 0 ? C.green : C.ink, stroke: C.ink, 'stroke-width': 3 }, g);
      el('text', { x: 0, y: 7, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 15, 'font-weight': 700, fill: '#fff' }, g, 'CLAIM 4');
      const res = el('text', { x: 0, y: -32, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 15, 'font-weight': 700, fill: i === 0 ? C.green : C.red, opacity: 0 }, g, i === 0 ? '✓ CLAIMED' : '✗ ALREADY TAKEN');
      return { g, res, x: r.x };
    });
    const lock = el('g', { opacity: 0 }, svg);
    el('rect', { x: -14, y: -4, width: 28, height: 22, fill: C.green, stroke: C.ink, 'stroke-width': 2.5 }, lock);
    el('path', { d: 'M-8,-4 v-6 a8,8 0 0 1 16,0 v6', fill: 'none', stroke: C.ink, 'stroke-width': 3 }, lock);
    const note = el('text', { x: W / 2, y: 540, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 15, 'font-weight': 700, fill: C.ink, opacity: 0 }, svg, 'ATOMIC SEAT CLAIM · TWO COMPANIES CAN NEVER TAKE THE SAME SEATS');
    const CX = 500, CY = 120;
    function draw(t) {
      t -= o.start;
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      let d = 'M0,330';
      for (let x = 0; x <= W; x += 20) d += ` L${x},${(330 + Math.sin(x * 0.02 + t * 2) * 5).toFixed(1)}`;
      river.setAttribute('d', d + ` L${W},${H - 60} L0,${H - 60} Z`);
      rafts.forEach((r, i) => r.g.setAttribute('transform', `translate(${r.x},${(392 + Math.sin(t * 2 + i) * 4).toFixed(1)})`));
      // seats: A full; B seats 0-3 taken, 4-7 free until transfer
      rafts[0].seats.forEach((s) => s.setAttribute('fill', C.red));
      rafts[1].seats.forEach((s, i) => s.setAttribute('fill', i < 4 ? C.ink : (t > 3.2 + (i - 4) * 0.18 + 0.55 ? C.green : '#fff')));
      rafts[2].seats.forEach((s, i) => s.setAttribute('fill', i < 4 ? C.ink : '#fff'));
      // card
      const cu = back((t - 0.2) / 0.5);
      card.setAttribute('transform', `translate(${CX},${CY}) scale(${Math.max(0.001, cu).toFixed(3)})`);
      const remain = Math.max(0, 1200 - Math.max(0, t - 0.4) * 9);
      timer.textContent = t > 2.3 ? 'DONE' : `${String(Math.floor(remain / 60)).padStart(2, '0')}:${String(Math.floor(remain % 60)).padStart(2, '0')}`;
      timer.setAttribute('fill', t > 2.3 ? C.green : C.ink);
      status.textContent = t > 2.3 ? 'filled by Company B · 4 guests moved' : 'slot 10:30 · expires in 20 min';
      // claims fly up together
      claims.forEach((c, i) => {
        const u = eio((t - 1.2) / 0.7);
        const sx = c.x, sy = 300, tx = CX + (i ? 75 : -75), ty = CY + 128;
        const x = lerp(sx, tx, u), y = lerp(sy, ty, u) - Math.sin(u * Math.PI) * 30;
        let dx = 0;
        if (i === 1 && t > 2.0) { const v = (t - 2.0); dx = Math.sin(v * 40) * 8 * Math.exp(-v * 4); }
        c.g.setAttribute('opacity', t > 1.1 ? (i === 1 ? 1 - cl((t - 3.2) / 0.4) : 1 - cl((t - 4.6) / 0.4)) : 0);
        c.g.setAttribute('transform', `translate(${(x + dx).toFixed(1)},${(i === 1 && t > 2.0 ? y + eo((t - 2.0) / 0.5) * 90 : y).toFixed(1)})`);
        c.res.setAttribute('opacity', cl((t - 2.0) / 0.2));
      });
      lock.setAttribute('opacity', cl((t - 2.0) / 0.2) * (1 - cl((t - 4.6) / 0.4)));
      lock.setAttribute('transform', `translate(${CX - 175},${CY + 118}) scale(${(1 + 0.3 * Math.exp(-(t - 2) * 6) * (t > 2)).toFixed(3)})`);
      // guests move from A bank to B raft
      guests.forEach((g, i) => {
        const u = eio((t - 3.2 - i * 0.18) / 0.55);
        const sx = 60 + i * 34, sy = 300, tx = 500 - 84 + (4 + i) * 24, ty = 380;
        const x = lerp(sx, tx, u), y = lerp(sy, ty, u) - Math.sin(u * Math.PI) * 60;
        g.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${u > 0.98 ? 0.001 : 1})`);
        g.setAttribute('opacity', u > 0.98 ? 0 : 1);
      });
      const tu = eio((t - 3.3) / 0.8);
      ticket.setAttribute('opacity', cl((t - 3.2) / 0.3));
      ticket.setAttribute('transform', `translate(${lerp(170, 500, tu).toFixed(1)},${(262 - Math.sin(tu * Math.PI) * 40).toFixed(1)})`);
      note.setAttribute('opacity', cl((t - 2.2) / 0.4));
    }
    return { draw, total: 6.5 };
  }

  /* ============================================================ ARCHITECTURE HUB */
  function HubScene(svg, opt = {}) {
    const o = Object.assign({ start: 0, layout: 'h' }, opt);
    const V = o.layout === 'v';
    const W = V ? 760 : 1200, H = V ? 1240 : 600;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const cols = V
      ? { act: (i) => [130 + i * 250, 70], app: (i) => [95 + i * 190, 330], api: [380, 600], svc: (i) => [95 + i * 190, 900] }
      : { act: (i) => [110, 120 + i * 180], app: (i) => [400, 75 + i * 150], api: [720, 300], svc: (i) => [1060, 75 + i * 150] };
    const actors = ['Travellers', 'Adventure cos.', 'Hotel & admin'];
    const apps = [['yatrimap.com', 'website'], ['TouristGo', 'QR booking app'], ['Partner portal', 'booking desk'], ['Admin', 'dashboards']];
    const svcs = [['MongoDB', 'database'], ['Razorpay', 'payments'], ['Twilio', 'WhatsApp'], ['Resend', 'email']];
    const links = [[0, 0], [0, 1], [1, 2], [2, 3]]; // actor → app
    const gE = el('g', {}, svg), gP = el('g', {}, svg), gN = el('g', {}, svg);
    const paths = [];
    const line = (a, b, red) => { const p = el('path', { d: V ? `M${a[0]},${a[1]} C${a[0]},${(a[1] + b[1]) / 2} ${b[0]},${(a[1] + b[1]) / 2} ${b[0]},${b[1]}` : `M${a[0]},${a[1]} C${(a[0] + b[0]) / 2},${a[1]} ${(a[0] + b[0]) / 2},${b[1]} ${b[0]},${b[1]}`, fill: 'none', stroke: red ? C.green : C.ink, 'stroke-width': 2.5, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }, gE); paths.push(p); return p; };
    links.forEach(([a, b]) => line(cols.act(a), cols.app(b)));
    apps.forEach((_, i) => line(cols.app(i), cols.api, true));
    svcs.forEach((_, i) => line(cols.api, cols.svc(i), true));
    const node = (p, title, sub, kind, i) => {
      const g = el('g', { transform: `translate(${p[0]},${p[1]})` }, gN);
      if (kind === 'actor') {
        el('circle', { cx: 0, cy: -16, r: 14, fill: C.paper, stroke: C.ink, 'stroke-width': 3 }, g);
        el('path', { d: 'M-24,22 q0,-24 24,-24 q24,0 24,24 z', fill: i === 0 ? C.greenSoft : C.paper, stroke: C.ink, 'stroke-width': 3 }, g);
        el('text', { x: 0, y: 46, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': V ? 20 : 15, 'font-weight': 700, fill: C.ink }, g, title);
      } else if (kind === 'api') {
        el('rect', { x: -110, y: -70, width: 220, height: 140, fill: C.ink, stroke: C.ink, 'stroke-width': 3 }, g);
        el('text', { x: 0, y: -10, 'text-anchor': 'middle', 'font-family': POSTER, 'font-size': 36, fill: C.paper }, g, 'YATRIMAP');
        el('text', { x: 0, y: 26, 'text-anchor': 'middle', 'font-family': POSTER, 'font-size': 36, fill: '#3fe08a' }, g, 'API');
        el('text', { x: 0, y: 56, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 13, fill: '#a9a39b' }, g, 'Node · Express · JWT');
      } else {
        const w = V ? 170 : 200;
        el('rect', { x: -w / 2, y: -34, width: w, height: 68, fill: kind === 'svc' ? '#fff' : C.paper, stroke: C.ink, 'stroke-width': 3 }, g);
        el('text', { x: 0, y: -2, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': V ? 19 : 17, 'font-weight': 700, fill: C.ink }, g, title);
        el('text', { x: 0, y: 20, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': V ? 15 : 13, fill: C.muted }, g, sub);
      }
      return g;
    };
    const nodes = [];
    actors.forEach((a, i) => nodes.push(node(cols.act(i), a, '', 'actor', i)));
    apps.forEach(([a, b], i) => nodes.push(node(cols.app(i), a, b, 'app')));
    nodes.push(node(cols.api, '', '', 'api'));
    svcs.forEach(([a, b], i) => nodes.push(node(cols.svc(i), a, b, 'svc')));
    const dots = paths.map((p, i) => ({ p, L: p.getTotalLength(), c: el('circle', { r: 6, fill: i < 4 ? C.red : C.green, stroke: C.paper, 'stroke-width': 2.5 }, gP), off: (i * 0.37) % 1 }));
    function draw(t) {
      t -= o.start;
      nodes.forEach((g, i) => {
        const tr = g.getAttribute('transform').replace(/ scale\([^)]*\)/, '');
        g.setAttribute('transform', `${tr} scale(${Math.max(0.001, back((t - i * 0.06) / 0.45)).toFixed(3)})`);
      });
      paths.forEach((p) => { p.style.strokeDashoffset = -t * 26; });
      dots.forEach((d, i) => {
        const u = ((t * 0.55 + d.off) % 1);
        const pt = d.p.getPointAtLength((i >= 8 ? u : u) * d.L);
        d.c.setAttribute('cx', pt.x.toFixed(1)); d.c.setAttribute('cy', pt.y.toFixed(1));
        d.c.setAttribute('opacity', t > 0.8 ? Math.min(1, Math.sin(u * Math.PI) * 3).toFixed(2) : 0);
      });
    }
    return { draw };
  }

  /* ============================================================ PAYMENTS */
  function PayScene(svg, opt = {}) {
    const o = Object.assign({ start: 0, loop: 0 }, opt);
    const W = 1000, H = 440;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const box = (x, y, w, hh, title, sub, fill) => {
      const g = el('g', { transform: `translate(${x},${y})` }, svg);
      el('rect', { x: -w / 2, y: -hh / 2, width: w, height: hh, fill: fill || C.paper, stroke: C.ink, 'stroke-width': 3.5 }, g);
      el('text', { x: 0, y: sub ? -4 : 7, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 17, 'font-weight': 700, fill: fill === C.ink ? C.paper : C.ink }, g, title);
      if (sub) el('text', { x: 0, y: 20, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 13, fill: fill === C.ink ? '#a9a39b' : C.muted }, g, sub);
      return g;
    };
    box(140, 220, 220, 120, 'CART PAYMENT', '1 Razorpay order');
    const srv = box(500, 220, 250, 150, 'SERVER CHECKS', 'decides what was paid', C.ink);
    const outs = ['Rafting · 4 guests', 'Hotel stay · 2 nights', 'Scooty · 1 day'].map((s, i) => box(860, 90 + i * 130, 230, 76, s, 'booking ' + (i + 1)));
    const checks = outs.map((g) => el('text', { x: 98, y: -18, 'text-anchor': 'end', 'font-family': POSTER, 'font-size': 26, fill: C.green, opacity: 0 }, g, '✓'));
    const gl = el('g', {}, svg);
    const lines = [[250, 220, 375, 220], ...outs.map((_, i) => [625, 220, 745, 90 + i * 130])].map(([a, b, c, d]) => el('path', { d: `M${a},${b} C${(a + c) / 2},${b} ${(a + c) / 2},${d} ${c},${d}`, fill: 'none', stroke: C.ink, 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }, gl));
    const coin = el('circle', { r: 13, fill: C.green, stroke: C.ink, 'stroke-width': 3 }, svg);
    const parts = outs.map(() => el('circle', { r: 9, fill: C.green, stroke: C.ink, 'stroke-width': 2.5, opacity: 0 }, svg));
    const bad = el('g', { opacity: 0 }, svg);
    el('circle', { r: 13, fill: C.red, stroke: C.ink, 'stroke-width': 3 }, bad);
    const badTxt = el('text', { x: 500, y: 344, 'text-anchor': 'middle', 'font-family': MONO, 'font-size': 15, 'font-weight': 700, fill: C.red, opacity: 0 }, svg, '✗ TAMPERED AMOUNT OR REUSED PAYMENT → REJECTED');
    const L0 = lines[0].getTotalLength();
    function draw(t) {
      t -= o.start;
      if (o.loop) t = ((t % o.loop) + o.loop) % o.loop;
      lines.forEach((l) => { l.style.strokeDashoffset = -t * 24; });
      const u = eio((t - 0.3) / 0.8);
      const p = lines[0].getPointAtLength(u * L0);
      coin.setAttribute('cx', p.x.toFixed(1)); coin.setAttribute('cy', p.y.toFixed(1)); coin.setAttribute('opacity', t < 1.15 ? 1 : 0);
      parts.forEach((c, i) => {
        const L = lines[i + 1].getTotalLength(), v = eio((t - 1.3 - i * 0.12) / 0.7);
        const q = lines[i + 1].getPointAtLength(v * L);
        c.setAttribute('cx', q.x.toFixed(1)); c.setAttribute('cy', q.y.toFixed(1)); c.setAttribute('opacity', t > 1.2 && v < 1 ? 1 : 0);
        checks[i].setAttribute('opacity', cl((t - 2.0 - i * 0.12) / 0.2));
      });
      srv.querySelector('rect').setAttribute('stroke', t > 3.2 && t < 4.4 ? C.red : C.ink);
      // bad payment bounces off the server
      const b = (t - 3.0) / 1.2;
      if (b > 0 && b < 1) {
        const x = b < 0.45 ? lerp(250, 372, b / 0.45) : lerp(372, 230, (b - 0.45) / 0.55), y = 260 + (b < 0.45 ? 0 : (b - 0.45) * 80);
        bad.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})`); bad.setAttribute('opacity', 1 - cl((b - 0.85) / 0.15));
      } else bad.setAttribute('opacity', 0);
      badTxt.setAttribute('opacity', cl((t - 3.4) / 0.3));
    }
    return { draw, total: 5 };
  }

  /* ============================================================ PIN MAP */
  const CITIES = [
    ['Rishikesh', [206.7, 454.2], 'hotels · rentals · activities'], ['Haridwar', [169.2, 500.8], 'hotels · rentals'],
    ['Dehradun', [131.8, 377.7], 'rental hub'], ['Mussoorie', [143.3, 331.2], 'hotels · rentals'],
    ['Tehri', [261.4, 357.8], 'hotels'], ['Chopta', [471.6, 321.2], 'hotels'],
  ];
  function PinMap(svg, opt = {}) {
    const o = Object.assign({ start: 0, labels: true, crop: true }, opt);
    const M = root.UK_MAP;
    svg.setAttribute('viewBox', o.crop ? '-20 236 700 380' : `-24 -24 1048 ${M.H + 48}`);
    M.districts.forEach((d) => el('path', { d: d.d, fill: '#f1ece1', stroke: '#b9b0a0', 'stroke-width': 1.4 }, svg));
    el('path', { d: M.state, fill: 'none', stroke: C.ink, 'stroke-width': 3 }, svg);
    M.rivers.filter((r) => r.major).forEach((r) => el('path', { d: r.d, fill: 'none', stroke: '#a9c4f2', 'stroke-width': 3, 'stroke-linecap': 'round' }, svg));
    const pins = CITIES.map(([n, p, s], i) => {
      const g = el('g', {}, svg);
      const ring = el('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: C.green, 'stroke-width': 3 }, g);
      el('path', { d: 'M0,0 C-14,-18 -16,-26 -16,-32 a16,16 0 1 1 32,0 c0,6 -2,14 -16,32 z', fill: i === 0 ? C.red : C.green, stroke: C.ink, 'stroke-width': 3 }, g);
      el('circle', { cx: 0, cy: -32, r: 6, fill: C.paper }, g);
      const off = { Haridwar: [-22, -30, 'end'], Dehradun: [-22, 14, 'end'], Mussoorie: [-22, -56, 'end'] }[n] || [22, -30, 'start'];
      if (o.labels) {
        el('text', { x: off[0], y: off[1], 'text-anchor': off[2], 'font-family': MONO, 'font-size': 20, 'font-weight': 700, fill: C.ink, stroke: C.paper, 'stroke-width': 5, 'paint-order': 'stroke' }, g, n);
        el('text', { x: off[0], y: off[1] + 20, 'text-anchor': off[2], 'font-family': MONO, 'font-size': 14, fill: C.muted, stroke: C.paper, 'stroke-width': 4, 'paint-order': 'stroke' }, g, s);
      }
      return { g, ring, p, i };
    });
    const chip = el('g', { transform: o.crop ? 'translate(360,575)' : 'translate(640,780)' }, svg);
    el('rect', { x: 0, y: -26, width: 300, height: 52, fill: C.paper, stroke: C.ink, 'stroke-width': 3 }, chip);
    el('text', { x: 16, y: 8, 'font-family': MONO, 'font-size': 17, 'font-weight': 700, fill: C.ink }, chip, '+ Manali, Himachal →');
    function draw(t) {
      t -= o.start;
      pins.forEach(({ g, ring, p, i }) => {
        const u = back((t - i * 0.15) / 0.45);
        g.setAttribute('transform', `translate(${p[0]},${(p[1] - (1 - cl(u)) * 80).toFixed(1)}) scale(${Math.max(0.001, u).toFixed(3)})`);
        const k = ((t * 0.7 + i * 0.2) % 1);
        ring.setAttribute('r', (8 + k * 26).toFixed(1)); ring.setAttribute('opacity', (u >= 1 ? 1 - k : 0).toFixed(2));
      });
      chip.setAttribute('opacity', cl((t - 1.2) / 0.4));
    }
    return { draw };
  }

  root.Yatri = { SNAPSHOT, normalizeImpact, BungeeScene, ImpactBoard, QRFlow, RaftPoolScene, HubScene, PayScene, PinMap, qrSVG, C, el, h, cl, eo, eio, back };
})(typeof window !== 'undefined' ? window : globalThis);
