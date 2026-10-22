/*!
 * home.js — the home page: intro (video → name morph → portrait pop), hero, about,
 * git-graph journey, case-study scenes, CLI terminal, client list, stack, proof, contact.
 */
(function () {
  'use strict';
  const { $, $$, reduce, fine, store } = window.DV;
  const DV = window.DV, G = DV.gsap, ST = window.ScrollTrigger;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  if (window.Toon) window.Toon.defs();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* =====================================================================
     INTRO
     ===================================================================== */
  const loader = $('#loader'), video = $('#loaderVideo'), lname = $('#loaderName'), wall = $('#loaderWall');
  const pctEl = $('#loaderPct'), barEl = $('#loaderBar'), skipBtn = $('#loaderSkip');
  const hero = $('#top'), frame = $('#heroFrame'), img = $('#heroImg'), word = $('#heroWord');
  const letters = $$('.ltr', word);
  // Only honour #section when arriving from inside the site (e.g. "All work" on a case page).
  // A fresh load or a reload always starts on the hero.
  const hashTarget = DV.fromWipe && location.hash.length > 1 ? (() => { try { return $(location.hash); } catch (e) { return null; } })() : null;
  if (location.hash && !hashTarget) history.replaceState(null, '', location.pathname + location.search);
  const mode = reduce || hashTarget || !G ? 'instant' : store.get('dv-intro') === '1' || DV.fromWipe ? 'short' : 'full';
  const goTop = () => { scrollTo(0, 0); if (DV.lenis) DV.lenis.scrollTo(0, { immediate: true, force: true }); };
  if (!hashTarget) {
    goTop();
    // the browser can restore the old position after scripts run; undo that while the intro is still on
    addEventListener('load', () => { if (!started || mode !== 'instant') goTop(); });
  }

  // Wall edge of the landscape push-reveal video, frames 27–112 (×1000 of video width). Measured from the file.
  const EDGE = [0, 31, 75, 125, 175, 219, 252, 269, 271, 274, 279, 284, 291, 297, 302, 305, 305, 306, 308, 311, 314, 318, 322, 326, 329, 331, 333, 334, 343, 371, 412, 459, 504, 539, 558, 560, 562, 567, 571, 577, 583, 588, 592, 594, 594, 595, 595, 596, 597, 599, 600, 602, 603, 604, 604, 605, 605, 606, 609, 614, 618, 624, 630, 634, 639, 642, 644, 644, 651, 665, 683, 705, 729, 751, 770, 784, 792, 794, 806, 828, 858, 894, 932, 967, 997, 1000];
  const edgeAt = (time) => { const f = time * 30 - 27; if (f <= 0) return 0; if (f >= EDGE.length - 1) return 1; const a = Math.floor(f), u = f - a; return (EDGE[a] * (1 - u) + EDGE[a + 1] * u) / 1000; };

  let started = false;
  const vertical = innerHeight > innerWidth * 1.05;
  const V = vertical
    ? { src: 'assets/video/push-reveal-vertical.mp4', w: 1080, h: 1920, need: 0.76, paper: '#fcfbf4' }
    : { src: 'assets/video/push-reveal.mp4', w: 1920, h: 872, need: 0.8, paper: '#fcfcfc' };
  let box = null, finished = false;

  function layoutVideo() {
    const W = innerWidth, H = innerHeight;
    const cover = Math.max(W / V.w, H / V.h), s = Math.min(cover, W / (V.w * V.need));
    const dw = V.w * s, dh = V.h * s, left = (W - dw) / 2, top = (H - dh) / 2;
    Object.assign(video.style, { width: dw + 'px', height: dh + 'px', left: left + 'px', top: top + 'px', objectFit: 'fill' });
    loader.style.setProperty('--bar', Math.max(0, Math.ceil(top) + 1) + 'px');
    loader.style.setProperty('--paperV', V.paper);
    box = { W, H, dw, dh, left, top };
  }

  // the morphing name is built from the same inline-block letters as the hero title
  lname.innerHTML = letters.map((l) => `<span class="ltr">${l.textContent}</span>`).join('') + '<span class="bl"></span>';

  const fontsReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('100px Marcellus'), document.fonts.load('700 12px "Space Mono"')]).catch(() => {}) : Promise.resolve();
  const imgReady = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
  const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
  const assets = withTimeout(Promise.all([fontsReady, imgReady]), 6000);
  let assetsDone = 0;
  fontsReady.then(() => assetsDone++); imgReady.then(() => assetsDone++);

  function hideLoader() { loader.classList.add('is-done'); loader.setAttribute('hidden', ''); video.pause(); video.removeAttribute('src'); try { video.load(); } catch (e) { /* noop */ } }

  if (mode === 'instant') {
    hideLoader();
    finishInstant();
  } else if (mode === 'short') {
    DV.lock(true);
    scrollTo(0, 0);
    loader.style.background = '#050505';
    $('.loader__ui', loader).style.display = 'none';
    assets.then(() => { heroIntro(true); hideLoader(); });
  } else {
    DV.lock(true);
    scrollTo(0, 0);
    runVideoIntro();
  }

  function runVideoIntro() {
    layoutVideo();
    addEventListener('resize', () => { if (!finished) layoutVideo(); });
    loader.classList.add('loader__bars');
    video.src = V.src;
    video.muted = true; video.defaultMuted = true; video.playsInline = true;
    video.addEventListener('loadeddata', () => { video.classList.add('is-ready'); if (vertical) video.playbackRate = 1.3; }, { once: true });
    video.addEventListener('ended', () => end('ended'));
    video.addEventListener('error', () => fallback());
    const p = video.play();
    if (p && p.catch) p.catch(() => fallback());
    // if playback never starts (low-power mode, blocked autoplay), fall back
    setTimeout(() => { if (!finished && video.currentTime < 0.05) fallback(); }, 3500);
    setTimeout(() => { if (!finished) end('timeout'); }, 12000);
    skipBtn.addEventListener('click', () => end('skip'));

    let shown = 0;
    const tickUI = () => {
      if (finished) return;
      const d = video.duration || (vertical ? 7.6 : 5.27);
      const vp = clamp(video.currentTime / d);
      const target = Math.min(99, 100 * (0.25 * (assetsDone / 2) + 0.75 * vp));
      shown += (target - shown) * 0.12;
      pctEl.textContent = String(Math.round(shown)).padStart(3, '0');
      barEl.style.transform = `scaleX(${(shown / 100).toFixed(3)})`;
      if (box) {
        const e = vertical ? (video.currentTime > 3.6 ? 1 : 0) : edgeAt(video.currentTime);
        loader.style.setProperty('--edge', (((box.left + e * box.dw) / box.W) * 100).toFixed(2) + '%');
      }
      requestAnimationFrame(tickUI);
    };
    requestAnimationFrame(tickUI);
  }

  // autoplay failed: draw the reveal ourselves, then continue
  function fallback() {
    if (finished || fallback.done) return;
    fallback.done = true;
    video.style.display = 'none';
    loader.style.background = '#050505';
    lname.style.fontSize = Math.min(innerWidth * 0.17, innerHeight * 0.3) + 'px';
    lname.style.left = '50%'; lname.style.top = '50%';
    G.set(lname, { xPercent: -50, yPercent: -50, opacity: 1, clipPath: 'inset(0 100% 0 0)' });
    G.to(lname, { clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'expo.inOut', onComplete: () => setTimeout(() => end('fallback'), 400) });
  }

  async function end(why) {
    if (finished) return;
    finished = true;
    pctEl.textContent = '100'; barEl.style.transform = 'scaleX(1)';
    await assets;
    if (why === 'ended' && !vertical && !fallback.done) morphOut();
    else wallOut();
  }

  // the wall the cartoon pushed away comes back as the dark stage
  function wallOut() {
    G.set(wall, vertical ? { yPercent: 101, xPercent: 0, x: 0 } : { xPercent: 101 });
    G.timeline()
      .to(wall, vertical ? { yPercent: 0, duration: 0.85, ease: 'expo.inOut' } : { xPercent: 0, duration: 0.85, ease: 'expo.inOut' })
      .to('.loader__ui', { opacity: 0, duration: 0.3 }, 0)
      .add(() => { heroIntro(true); hideLoader(); });
  }

  // landscape: the red DEENDAYAL from the last frame glides down and becomes the hero title
  function morphOut() {
    layoutVideo();
    const x0 = box.left + 0.1323 * box.dw, x1 = box.left + 0.8729 * box.dw, y0 = box.top + 0.344 * box.dh, y1 = box.top + 0.6514 * box.dh;
    // ink bounds of the word (canvas) vs the advance box of our letter spans
    let inkL = 0.011, inkR = 0.998, cap = 0.72;
    try {
      const c = document.createElement('canvas').getContext('2d');
      c.font = '100px Marcellus';
      const m = c.measureText('DEENDAYAL');
      inkL = -m.actualBoundingBoxLeft / m.width; inkR = m.actualBoundingBoxRight / m.width;
      if (m.actualBoundingBoxAscent) cap = m.actualBoundingBoxAscent / 100;
    } catch (e) { /* defaults */ }
    lname.style.fontSize = '100px'; lname.style.left = '0px'; lname.style.top = '0px';
    const r100 = lname.getBoundingClientRect();
    const fs0 = (100 * (x1 - x0)) / (r100.width * (inkR - inkL));
    lname.style.fontSize = fs0.toFixed(2) + 'px';
    const r0 = lname.getBoundingClientRect();
    const left = x0 - inkL * r0.width;
    const blOff = $('.bl', lname).getBoundingClientRect().top - r0.top;
    const top = y1 - blOff;
    lname.style.left = left.toFixed(1) + 'px'; lname.style.top = top.toFixed(1) + 'px';

    // target: hero title (in place, behind the loader)
    const fsH = parseFloat(getComputedStyle($('#heroName')).fontSize);
    const hx = letters[0].getBoundingClientRect().left, hy = $('.bl', word).getBoundingClientRect().top;
    const k = fsH / fs0;
    const tx = hx - left, ty = hy - top - k * blOff;
    // the video's lettering is a condensed cut: start stretched to its height, relax while moving
    const sy = clamp((y1 - y0) / (cap * fs0), 0.6, 2);

    G.set(lname, { opacity: 1, transformOrigin: '0 0', scaleY: sy, y: blOff * (1 - sy) });    loader.style.background = V.paper;
    video.style.visibility = 'hidden';
    loader.classList.remove('loader__bars');
    G.set(letters, { opacity: 1 });
    const tl = G.timeline({ onComplete: () => { heroIntro(false); hideLoader(); } });
    tl.to('.loader__ui', { opacity: 0, duration: 0.3 }, 0)
      .to(loader, { backgroundColor: '#050505', duration: 1.0, ease: 'power2.inOut' }, 0.15)
      .to(lname, { x: tx, y: ty, scaleX: k, scaleY: k, duration: 1.35, ease: 'expo.inOut' }, 0.1)
      .to($$('.ltr', lname), { keyframes: { y: [0, -18, 0] }, duration: 0.9, stagger: 0.035, ease: 'sine.inOut' }, 0.25);
  }

  function heroIntro(withName) {
    store.set('dv-intro', '1');
    const fw = frame.offsetWidth, fh = frame.offsetHeight;
    // start as a small card around the face, then open to the full portrait
    const fx = 0.555, fy = 0.25, ch = 0.3, cw = 0.23;
    const inset = `inset(${((fy - ch / 2) * 100).toFixed(1)}% ${((1 - fx - cw / 2) * 100).toFixed(1)}% ${((1 - fy - ch / 2) * 100).toFixed(1)}% ${((fx - cw / 2) * 100).toFixed(1)}% round 18px)`;
    G.set(frame, { x: (0.5 - fx) * fw, y: (0.5 - fy) * fh, scale: 0.5, rotate: -8, clipPath: inset, visibility: 'visible' });
    G.set(img, { scale: 1.25, transformOrigin: `${fx * 100}% ${fy * 100}%` });

    const tl = G.timeline({ defaults: { ease: 'expo.out' } });
    tl.to(frame, { scale: 1, rotate: 0, duration: 0.85, ease: 'back.out(1.7)' }, 0.05)
      .to(frame, { clipPath: 'inset(0% 0% 0% 0% round 0px)', x: 0, y: 0, duration: 1.5, ease: 'expo.inOut' }, 0.95)
      .to(img, { scale: 1, duration: 1.8, ease: 'expo.inOut' }, 0.95);
    if (withName) tl.from(letters, { yPercent: 120, opacity: 0, duration: 1.2, stagger: 0.05 }, 1.45);
    tl.from('.hero__surname', { opacity: 0, y: 10, duration: 0.8 }, 1.9)
      .from('.hero__lead .line > span', { yPercent: 135, duration: 1.15, stagger: 0.1 }, 1.65)
      .from('.hero__sub', { opacity: 0, y: 16, duration: 0.9 }, 1.9)
      .from('.hero__meta', { opacity: 0, duration: 0.3 }, 1.75)
      .call(() => $$('.hero__meta .scramble').forEach((el, i) => setTimeout(() => DV.scramble(el, 0.9), i * 140)), null, 1.75)
      .from('#heroNotes li', { opacity: 0, x: 26, duration: 0.9, stagger: 0.12 }, 2.0)
      .call(() => buildLeaders(true), null, 2.15)
      .from('.hero__badge', { scale: 0, rotate: -140, duration: 1.2, ease: 'back.out(1.4)' }, 2.0)
      .from('.hero__status', { opacity: 0, y: 12, duration: 0.8 }, 2.1)
      .call(() => { document.body.classList.remove('is-intro'); DV.lock(false); goTop(); startSite(); }, null, 2.05);
  }

  function finishInstant() {
    frame.style.visibility = 'visible';
    document.body.classList.remove('is-intro');
    DV.lock(false);
    store.set('dv-intro', '1');
    startSite();
    buildLeaders(false);
    if (hashTarget) {
      // re-measure after fonts/images settle so we land exactly on the section
      const jump = () => { const y = Math.round(hashTarget.getBoundingClientRect().top + window.scrollY); if (DV.lenis) DV.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y); };
      requestAnimationFrame(() => { ST && ST.refresh(); jump(); });
      const onLoad = () => { ST && ST.refresh(); jump(); setTimeout(jump, 350); };
      if (document.readyState === 'complete') onLoad(); else addEventListener('load', onLoad, { once: true });
    }
  }

  /* ---------------------------------------------------------- hero leader lines */
  function buildLeaders(animate) {
    const svg = $('#heroLeaders'), notes = $('#heroNotes');
    if (!svg || !notes || getComputedStyle(svg).display === 'none') return;
    const hr = hero.getBoundingClientRect(), W = hr.width, H = hr.height;
    const cs = getComputedStyle(frame), fw = frame.offsetWidth, fh = frame.offsetHeight;
    const fl = parseFloat(cs.left) - fw / 2, ft = parseFloat(cs.top) - fh / 2;
    const nr = notes.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    $$('li', notes).forEach((li, i) => {
      const [px, py] = li.dataset.target.split(',').map(Number);
      const ax = nr.left - hr.left - 10, ay = nr.top - hr.top + li.offsetTop + 9;
      const tx = fl + px * fw, ty = ft + py * fh;
      const NS = 'http://www.w3.org/2000/svg';
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${ax.toFixed(1)},${ay.toFixed(1)} H${(ax - 34).toFixed(1)} L${tx.toFixed(1)},${ty.toFixed(1)}`);
      svg.appendChild(p);
      const d = document.createElementNS(NS, 'circle'); d.setAttribute('class', 'd'); d.setAttribute('cx', tx); d.setAttribute('cy', ty); d.setAttribute('r', 3.5);
      const r = document.createElementNS(NS, 'circle'); r.setAttribute('class', 'r'); r.setAttribute('cx', tx); r.setAttribute('cy', ty); r.setAttribute('r', 6);
      r.style.animationDelay = (i * 0.4) + 's';
      svg.appendChild(d); svg.appendChild(r);
      const a = $('a', li);
      a.onmouseenter = () => { p.style.stroke = '#ee3349'; p.style.strokeWidth = '1.6'; };
      a.onmouseleave = () => { p.style.stroke = ''; p.style.strokeWidth = ''; };
      if (animate && G) {
        const L = p.getTotalLength();
        G.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, delay: i * 0.12, ease: 'expo.inOut' });
        G.from([d, r], { opacity: 0, duration: 0.4, delay: 0.8 + i * 0.12 });
      }
    });
  }

  /* =====================================================================
     SITE (after intro)
     ===================================================================== */
  function startSite() {
    if (started) return;
    started = true;
    initHeroMotion();
    initAbout();
    initJourney();
    initWork();
    initCli();
    initClients();
    initStack();
    initProof();
    initContact();
    DV.initReveals();
    addEventListener('resize', DV.debounce(() => buildLeaders(false), 200));
    // late layout shifts (fonts, images) → recompute triggers
    addEventListener('load', () => ST && ST.refresh());
    setTimeout(() => ST && ST.refresh(), 600);
  }

  /* ---------------------------------------------------------- hero motion */
  function initHeroMotion() {
    if (!G || reduce) return;
    const light = $('#heroLight');
    if (fine) {
      const ix = G.quickTo(img, 'x', { duration: 1.4, ease: 'power3.out' }), iy = G.quickTo(img, 'y', { duration: 1.4, ease: 'power3.out' });
      const nx = G.quickTo(word, 'x', { duration: 1.2, ease: 'power3.out' });
      const tx = G.quickTo('.hero__tagline', 'x', { duration: 1.2, ease: 'power3.out' });
      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        ix(-px * 22); iy(-py * 14); nx(px * 18); tx(px * -10);
        const fr = frame.getBoundingClientRect();
        light.style.setProperty('--lx', (((e.clientX - fr.left) / fr.width) * 100).toFixed(1) + '%');
        light.style.setProperty('--ly', (((e.clientY - fr.top) / fr.height) * 100).toFixed(1) + '%');
        hero.classList.add('is-lit');
      });
      hero.addEventListener('pointerleave', () => { ix(0); iy(0); nx(0); tx(0); hero.classList.remove('is-lit'); });
    }
    const st = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    G.to('#heroInner', { yPercent: 16, ease: 'none', scrollTrigger: st });
    G.to(frame, { scale: 0.9, opacity: 0.35, ease: 'none', scrollTrigger: st });
    G.to('#heroName', { yPercent: -40, ease: 'none', scrollTrigger: st });
  }

  /* ---------------------------------------------------------- about */
  function initAbout() {
    const spot = $('#spot');
    if (spot && window.Kit) DV.whileVisible(spot, window.Kit.Spotlight(spot, $('#spotFig'), $('#spotReal'), $('#spotRing'), { radius: innerWidth < 600 ? 80 : 110 }));
    const s = $('#aboutStatement');
    if (s) {
      s.innerHTML = s.textContent.split(/(\s+)/).map((w) => (/^\s+$/.test(w) ? w : `<span class="w">${w}</span>`)).join('');
      if (G && !reduce) G.to($$('.w', s), { opacity: 1, ease: 'none', stagger: 0.1, scrollTrigger: { trigger: s, start: 'top 82%', end: 'bottom 48%', scrub: 0.6 } });
    }
    const dds = $$('#stats dd');
    const odos = dds.map((dd) => DV.odometer(dd, dd.textContent.trim()));
    if (ST) ST.create({ trigger: '#stats', start: 'top 88%', once: true, onEnter: () => odos.forEach((o, i) => o.roll(i * 0.08)) });
    else odos.forEach((o) => o.roll());
  }

  /* ---------------------------------------------------------- journey: git graph */
  function initJourney() {
    const graph = $('#graph'), svg = $('#graphSvg');
    if (!graph || !svg) return;
    const commits = $$('.commit', graph);
    const LANE = ['#cfc8bf', '#3fc488', '#ff4b5f', '#6ea4ff'];
    const BR = [
      { lane: 3, from: 1, to: 'short', color: '#6ea4ff' },
      { lane: 1, from: 2, to: 7, color: '#3fc488' },
      { lane: 2, from: 3, to: 4, color: '#ff4b5f' },
      { lane: 2, from: 5, to: null, color: '#e39b17' },
    ];
    const YEARS = ['2023', '2024', '2025', '2025', '2025', '2026', '2026', '2026', '2027'];
    const LABELS = ['main · <b>1</b> branch', 'oss/custom-db-cli · <b>2</b> branches', 'internship/yatrimap opened · <b>2</b> branches', 'two internships in parallel · <b>3</b> branches', 'merged social-purpose-trust · <b>2</b> branches', 'hackbytecodex opened · <b>3</b> branches', 'tag v1.0-safe-to-host · <b>3</b> branches', 'merged yatrimap · <b>2</b> branches', 'HEAD → main · <b>open to work</b>'];
    const yearEl = $('#yearNum'), labelEl = $('#yearLabel');
    const yo = yearEl ? DV.odometer(yearEl, '2023') : null;
    if (yo) yo.jump('2023');
    let lastRow = -1;
    const NS = 'http://www.w3.org/2000/svg';
    let live = [], nodes = [], rowsY = [];

    function build() {
      const laneW = parseFloat(getComputedStyle(graph).getPropertyValue('--lane')) || 24;
      const gr = graph.getBoundingClientRect();
      rowsY = commits.map((c) => c.getBoundingClientRect().top - gr.top + 28);
      const H = graph.offsetHeight, X = (l) => 9 + l * laneW;
      svg.setAttribute('viewBox', `0 0 ${svg.clientWidth || 110} ${H}`);
      svg.innerHTML = '';
      live = []; nodes = [];
      const add = (d, color, dashed) => {
        const g = document.createElementNS(NS, 'path'); g.setAttribute('d', d); g.setAttribute('class', 'ghost'); svg.appendChild(g);
        const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('stroke', color); svg.appendChild(p);
        if (dashed) { g.setAttribute('stroke-dasharray', '2 7'); }
        const L = p.getTotalLength(); p.style.strokeDasharray = `${L} ${L}`; p.style.strokeDashoffset = L;
        const bb = p.getBBox();
        live.push({ p, L, y0: bb.y, y1: bb.y + bb.height, dashed });
      };
      add(`M${X(0)},${rowsY[0]} L${X(0)},${rowsY[8]}`, LANE[0]);
      BR.forEach((b) => {
        const xL = X(b.lane), y0 = rowsY[b.from] - 52;
        const yEnd = b.to === 'short' ? rowsY[b.from] + 70 : b.to == null ? rowsY[8] + 4 : rowsY[b.to];
        let d = `M${X(0)},${y0} C${X(0)},${y0 + 22} ${xL},${y0 + 14} ${xL},${y0 + 38} L${xL},${yEnd - (b.to == null ? 0 : 38)}`;
        if (b.to != null) d += ` C${xL},${yEnd - 14} ${X(0)},${yEnd - 22} ${X(0)},${yEnd}`;
        add(d, b.color, b.to == null);
      });
      commits.forEach((c, i) => {
        const lane = +c.dataset.lane, kind = c.dataset.kind, x = X(lane), y = rowsY[i];
        const color = lane === 0 ? LANE[0] : (BR.find((b) => b.from === i) || {}).color || LANE[lane];
        const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'node'); g.style.transform = 'scale(0)';
        if (kind === 'merge') {
          const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x - 6.5); r.setAttribute('y', y - 6.5); r.setAttribute('width', 13); r.setAttribute('height', 13); r.setAttribute('transform', `rotate(45 ${x} ${y})`); r.setAttribute('fill', '#0b0a09'); r.setAttribute('stroke', color); r.setAttribute('stroke-width', 3); g.appendChild(r);
        } else {
          const ci = document.createElementNS(NS, 'circle'); ci.setAttribute('cx', x); ci.setAttribute('cy', y); ci.setAttribute('r', kind === 'head' || kind === 'tag' ? 9 : 7.5); ci.setAttribute('fill', kind === 'head' ? '#ee3349' : color); ci.setAttribute('stroke', '#0b0a09'); ci.setAttribute('stroke-width', 3.5); g.appendChild(ci);
          if (kind === 'tag' || kind === 'head') { const ring = document.createElementNS(NS, 'circle'); ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', 14); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', kind === 'head' ? '#ee3349' : color); ring.setAttribute('stroke-width', 1.5); ring.setAttribute('opacity', 0.7); g.appendChild(ring); }
        }
        svg.appendChild(g);
        nodes.push({ g, y, c, i });
      });
      update();
    }

    function update() {
      const gr = graph.getBoundingClientRect();
      const lineY = innerHeight * (innerWidth < 760 ? 0.72 : 0.62) - gr.top;
      live.forEach((l) => { const u = reduce ? 1 : clamp((lineY - l.y0) / Math.max(1, l.y1 - l.y0)); l.p.style.strokeDashoffset = (l.L * (1 - u)).toFixed(1); });
      let row = -1;
      nodes.forEach((n) => {
        const on = reduce || lineY >= n.y - 2;
        n.g.style.transform = on ? 'scale(1)' : 'scale(0)';
        n.c.classList.toggle('is-in', on);
        if (on) row = n.i;
      });
      if (row !== lastRow && row >= 0) {
        lastRow = row;
        if (yo) yo.set(YEARS[row]);
        if (labelEl) labelEl.innerHTML = LABELS[row];
      }
    }
    build();
    if (ST) ST.create({ trigger: graph, start: 'top bottom', end: 'bottom top', onUpdate: update, onRefresh: build });
    addEventListener('resize', DV.debounce(build, 200));
  }

  /* ---------------------------------------------------------- work: case cards + scenes */
  function initWork() {
    // stacked sticky cards dim and shrink as the next one slides over
    if (G && !reduce) {
      G.matchMedia().add('(min-width: 1001px) and (min-height: 721px)', () => {
        const cards = $$('.case');
        cards.forEach((card, i) => {
          const next = cards[i + 1];
          if (!next) return;
          G.to(card, { scale: 0.94, '--dim': 0.22, ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top 25%', scrub: true } });
        });
      });
    }
    const reg = {};
    const sceneEl = (id) => $(`[data-scene-id="${id}"]`);
    // SARRA
    if (window.Sarra && window.UK_MAP) {
      const map = window.Sarra.MapScene($('#sMap'), { towns: true });
      reg['sarra-map'] = DV.scenes.add(sceneEl('sarra-map'), (t) => map.draw(t), { still: 99 });
      const tip = $('#sTip'), stg = sceneEl('sarra-map');
      map.districts.forEach((d) => {
        const p = d.el, base = p.getAttribute('fill');
        const show = (e) => { const r = stg.getBoundingClientRect(); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.innerHTML = d.name + '<small>' + d.div + ' division</small>'; tip.style.opacity = 1; p.setAttribute('fill', d.div === 'Garhwal' ? '#e6d9bf' : '#cddcf0'); };
        p.addEventListener('pointermove', show); p.addEventListener('pointerdown', show);
        p.addEventListener('pointerleave', () => { tip.style.opacity = 0; p.setAttribute('fill', base); });
      });
      const audit = window.Sarra.AuditScene($('#sTerm'));
      const stamp = window.Sarra.Stamp($('#sStamp'), { x: 0, y: 0, r: 150, start: audit.total + 0.1, fill: '#fdfbf6' });
      reg['sarra-audit'] = DV.scenes.add(sceneEl('sarra-audit'), (t) => { audit.draw(t); stamp.draw(t); }, { active: false, still: 99 });
      const mig = window.Sarra.MigrationScene($('#sMig'));
      reg['sarra-mig'] = DV.scenes.add(sceneEl('sarra-mig'), (t) => mig.draw(t), { active: false, still: 99 });
      DV.initTabs($('#case-sarra .case__stage'), reg);
    }
    // YatriMap
    if (window.Yatri) {
      const bungee = window.Yatri.BungeeScene($('#yBungee'));
      reg['y-bungee'] = DV.scenes.add(sceneEl('y-bungee'), (t) => bungee.draw(t), { still: 8 });
      sceneEl('y-bungee').addEventListener('click', () => DV.scenes.replay(reg['y-bungee']));
      const raft = window.Yatri.RaftPoolScene($('#yRaft'), { loop: 7.5 });
      reg['y-raft'] = DV.scenes.add(sceneEl('y-raft'), (t) => raft.draw(t), { active: false, still: 6 });
      const pay = window.Yatri.PayScene($('#yPay'), { loop: 6 });
      reg['y-pay'] = DV.scenes.add(sceneEl('y-pay'), (t) => pay.draw(t), { active: false, still: 4.5 });
      DV.initTabs($('#case-yatri .case__stage'), reg);
      // live rating from the production API (falls back silently to the printed snapshot)
      if (window.fetch) {
        fetch('https://api.yatrimap.com/public/impact').then((r) => (r.ok ? r.json() : null)).then((j) => {
          const d = j && (j.data || j);
          if (!d || !d.ratings || d.ratings.average == null) return;
          const rt = $('#yFacts [data-k="rating"]'), rv = $('#yFacts [data-k="reviews"]');
          if (rt) rt.textContent = (+d.ratings.average).toFixed(1) + '★';
          if (rv && d.ratings.count) rv.textContent = `${d.ratings.count} reviews · live`;
        }).catch(() => {});
      }
    }
    // HackByteCodex
    if (window.Hbc) {
      const tree = window.Hbc.TreeScene($('#hTree'));
      reg['h-tree'] = DV.scenes.add(sceneEl('h-tree'), (t) => tree.draw(t), { still: 10.4 });
      const geo = window.Hbc.GeoScene($('#hGeo'));
      reg['h-geo'] = DV.scenes.add(sceneEl('h-geo'), (t) => geo.draw(t), { active: false, still: 7.5 });
      const board = window.Hbc.BoardScene($('#hBoard'));
      reg['h-board'] = DV.scenes.add(sceneEl('h-board'), (t) => board.draw(t), { active: false, still: 10.2 });
      DV.initTabs($('#case-hbc .case__stage'), reg);
    }
    // reel modal
    const modal = $('#reelModal');
    if (modal) {
      const mv = $('video', modal), closeBtn = $('.modal__close', modal);
      let lastFocus = null;
      const open = () => { lastFocus = document.activeElement; modal.hidden = false; DV.lock(true); mv.currentTime = 0; const p = mv.play(); if (p && p.catch) p.catch(() => {}); closeBtn.focus(); };
      const close = () => { mv.pause(); modal.hidden = true; DV.lock(false); lastFocus && lastFocus.focus(); };
      $$('[data-reel]').forEach((b) => b.addEventListener('click', open));
      closeBtn.addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
      addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
    }
  }

  /* ---------------------------------------------------------- custom-db-cli terminal */
  function initCli() {
    const out = $('#cliOut'), wrap = $('#cli');
    if (!out) return;
    const P = '<span class="p">$</span> ';
    const CMDS = {
      install: { cmd: 'npm install -g custom-db-cli', out: ['<span class="d">added 1 package in 2s</span>', '<span class="ok">✓</span> custom-db and custom-db-server are on your PATH'] },
      create: { cmd: 'custom-db create --name="Asha" --age=21 --email="asha@gkv.ac.in"', out: ['<span class="ok">✓ record created</span>', '{ <span class="k">"id"</span>: <span class="s">"m3k9x2"</span>, <span class="k">"name"</span>: <span class="s">"Asha"</span>, <span class="k">"age"</span>: 21 }'] },
      read: { cmd: 'custom-db read', out: ['[', '  { <span class="k">"id"</span>: <span class="s">"m3k9x2"</span>, <span class="k">"name"</span>: <span class="s">"Asha"</span>, <span class="k">"age"</span>: 21 },', '  { <span class="k">"id"</span>: <span class="s">"p7d1q8"</span>, <span class="k">"name"</span>: <span class="s">"Rahul"</span>, <span class="k">"age"</span>: 22 }', ']', '<span class="d">2 records · db.json</span>'] },
      update: { cmd: 'custom-db update --id="m3k9x2" --age=22', out: ['<span class="ok">✓</span> record m3k9x2 updated'] },
      migrate: { cmd: 'npx custom-db migrateMongo --DbUri="mongodb+srv://…"', out: ['<span class="d">connecting to MongoDB…</span>', '<span class="d">moving 2 records from db.json</span>', '<span class="ok">✓ migration complete · 2 inserted · 0 failed</span>'] },
    };
    let lines = [], token = 0, typing = '';
    const render = (cursor = true) => {
      const all = lines.concat(typing != null ? [P + typing + (cursor ? '<span class="cur"></span>' : '')] : []);
      out.innerHTML = all.slice(-15).join('\n');
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    async function run(key) {
      const my = ++token, c = CMDS[key];
      $$('.cli__cmds button').forEach((b) => b.classList.toggle('is-on', b.dataset.cmd === key));
      typing = '';
      for (let i = 0; i <= c.cmd.length; i++) {
        if (my !== token) return;
        typing = c.cmd.slice(0, i).replace(/</g, '&lt;'); render();
        await wait(reduce ? 0 : 16 + Math.random() * 26);
      }
      await wait(reduce ? 0 : 260);
      if (my !== token) return;
      lines.push(P + c.cmd.replace(/</g, '&lt;')); typing = null; render(false);
      for (const l of c.out) { await wait(reduce ? 0 : 170); if (my !== token) return; lines.push(l); render(false); }
      lines.push(''); typing = ''; render();
    }
    $$('.cli__cmds button').forEach((b) => b.addEventListener('click', () => { auto = false; run(b.dataset.cmd); }));
    let auto = true;
    typing = ''; render();
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      for (const k of ['install', 'create', 'read', 'migrate']) {
        if (!auto) return;
        await run(k);
        await wait(900);
      }
    }, { threshold: 0.4 });
    io.observe(wrap);
  }

  /* ---------------------------------------------------------- client list preview */
  function initClients() {
    const fl = $('#cfloat'), inner = $('#cfloatInner'), rows = $$('.crow');
    if (!fl || !fine || !G) return;
    let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => {
        const th = $('.crow__thumb', row);
        inner.innerHTML = '';
        if (th) { const c = th.cloneNode(true); c.classList.remove('crow__thumb'); c.removeAttribute('loading'); inner.appendChild(c); }
        fl.classList.add('is-on'); G.to(fl, { opacity: 1, duration: 0.3, overwrite: 'auto' });
      });
      row.addEventListener('pointerleave', () => { fl.classList.remove('is-on'); G.to(fl, { opacity: 0, duration: 0.3, overwrite: 'auto' }); });
    });
    addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
    DV.whileVisible($('#clients'), () => {
      const dx = x - cx; cx += dx * 0.14; cy += (y - cy) * 0.14;
      const rot = clamp(dx * 0.06, -10, 10);
      fl.style.transform = `translate3d(${(cx + 24).toFixed(1)}px,${(cy - fl.offsetHeight * 0.6).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg)`;
    });
  }

  /* ---------------------------------------------------------- stack: walker + skill matrix */
  function initStack() {
    const walkerBox = $('#walker');
    if (walkerBox && window.Kit) {
      const skills = innerWidth < 640 ? ['Next.js', 'Node.js', 'MongoDB', 'Redis', 'Express'] : ['Next.js', 'React', 'Node.js', 'Express', 'MongoDB', 'Redis', 'TypeScript', 'WebSockets', 'CF Workers'];
      DV.whileVisible(walkerBox, window.Kit.Walker(walkerBox, $('#walkerSvg'), $('#walkerG'), $('#walkerPct'), $('#walkerTags'), skills));
    }
    const P = {
      sarra: ['SARRA', '#1d63d6', 'Gov. portal'], yatri: ['YatriMap', '#178a5a', 'Startup'], hbc: ['HackByteCodex', '#e39b17', 'Platform'],
      surya: ['SuryaSangam', '#ee3349', 'Internship'], lux: ['LuggageLux', '#141312', 'Freelance'], cli: ['custom-db-cli', '#6e6760', 'npm'],
      vedic: ['VedicPedia', '#b45309', 'Freelance'], medi: ['MediMeal', '#9a928a', 'Project'], trisco: ['Trisco', '#9a928a', 'Project'],
    };
    const FE = ['sarra', 'yatri', 'hbc', 'surya', 'lux', 'vedic', 'medi', 'trisco'], BE = ['sarra', 'yatri', 'hbc', 'surya', 'lux', 'medi', 'trisco', 'cli'], ALL = Object.keys(P);
    const GROUPS = [
      ['Frontend', [['React.js', FE], ['Next.js', ['sarra', 'yatri', 'hbc', 'surya']], ['TailwindCSS', ['yatri', 'hbc', 'surya']], ['ShadcnUI', ['hbc']], ['Redux Toolkit', ['lux', 'yatri']], ['Figma', ['surya']]]],
      ['Backend', [['Node.js', BE], ['Express.js', BE], ['REST APIs', BE], ['JWT', ['yatri', 'hbc', 'surya', 'lux']], ['Google OAuth', ['hbc', 'surya', 'lux']], ['WebSockets', []]]],
      ['Databases', [['MongoDB', ['sarra', 'yatri', 'hbc', 'surya', 'lux', 'medi', 'cli']], ['Mongoose', ['sarra', 'yatri', 'hbc', 'surya']], ['MongoDB Atlas', ['sarra']], ['Redis', []]]],
      ['DevOps & cloud', [['Git & GitHub', ALL], ['Vercel', ['yatri', 'hbc', 'medi', 'trisco']], ['ITDA Gov. servers', ['sarra']], ['IIS reverse proxy', ['sarra']], ['PM2', ['sarra']], ['Cloudinary', ['hbc']], ['Cloudflare Workers', []]]],
      ['Security', [['CERT-In VAPT remediation', ['sarra']], ['OWASP Top 10', ['sarra']], ['CSP / Helmet.js', ['sarra', 'hbc']], ['RBAC', ['surya', 'hbc', 'trisco', 'lux']]]],
      ['Payments & messaging', [['Razorpay', ['yatri', 'hbc', 'lux', 'trisco']], ['Twilio WhatsApp', ['yatri']], ['Resend email', ['yatri', 'hbc']]]],
      ['Languages', [['JavaScript', ALL], ['TypeScript', ['hbc']], ['HTML & CSS', FE], ['C', []], ['C++', []]]],
      ['CS fundamentals', [['DSA', []], ['DBMS', []], ['OOP', []], ['Software design', []], ['Agile', []]]],
    ];
    const host = $('#matrix'), used = $('#usedList'), usedSkill = $('#usedSkill');
    if (!host || !used) return;
    host.innerHTML = GROUPS.map(([g, items]) => `<div class="mgroup"><h3><span>${g}</span><span>${String(items.length).padStart(2, '0')}</span></h3><ul>${items.map(([s]) => `<li><button type="button" class="skill" data-skill="${s}">${s}</button></li>`).join('')}</ul></div>`).join('');
    used.innerHTML = Object.entries(P).map(([k, [n, c, tag]]) => `<li data-p="${k}" style="--c:${c}"><i></i><span>${n}</span><small>${tag}</small></li>`).join('');
    const map = {}; GROUPS.forEach(([, items]) => items.forEach(([s, ps]) => (map[s] = ps)));
    const btns = $$('.skill', host), lis = $$('li', used);
    let auto = true, timer = 0;
    const pick = (s) => {
      btns.forEach((b) => b.classList.toggle('is-on', b.dataset.skill === s));
      const ps = map[s] || [];
      lis.forEach((li) => li.classList.toggle('is-on', ps.includes(li.dataset.p)));
      usedSkill.textContent = s + (ps.length ? '' : ' · coursework & practice builds');
    };
    btns.forEach((b) => {
      const go = () => { auto = false; clearInterval(timer); pick(b.dataset.skill); };
      b.addEventListener('click', go);
      if (fine) b.addEventListener('pointerenter', go);
    });
    const demo = ['Next.js', 'MongoDB', 'Razorpay', 'RBAC', 'CERT-In VAPT remediation', 'Node.js'];
    let di = 0;
    pick(demo[0]);
    if (!reduce) {
      const io = new IntersectionObserver(([e]) => {
        clearInterval(timer);
        if (e.isIntersecting && auto) timer = setInterval(() => { if (!auto) return clearInterval(timer); di = (di + 1) % demo.length; pick(demo[di]); }, 2200);
      }, { threshold: 0.3 });
      io.observe(host);
    }
  }

  /* ---------------------------------------------------------- proof */
  function initProof() {
    const ps = $('#proofStamp');
    if (ps && window.Sarra) {
      const stamp = window.Sarra.Stamp(ps, { x: 0, y: 0, r: 150, start: 0.25, fill: '#fdfbf6' });
      DV.scenes.add(ps, (t) => stamp.draw(t), { still: 9 });
    }
    const arc = $('#cgpaArc'), val = $('#cgpaVal');
    if (arc && G && !reduce) {
      ST.create({ trigger: '#cgpaRing', start: 'top 88%', once: true, onEnter: () => {
        const o = { v: 0 };
        G.to(arc, { strokeDashoffset: 326.73 * (1 - 0.81), duration: 2.2, ease: 'expo.out' });
        G.to(o, { v: 8.1, duration: 2.2, ease: 'expo.out', onUpdate: () => (val.textContent = o.v.toFixed(1)) });
      } });
    } else if (arc) arc.style.strokeDashoffset = 326.73 * (1 - 0.81);
  }

  /* ---------------------------------------------------------- contact */
  function initContact() {
    const b = $('#buddy');
    if (b && window.Kit) DV.whileVisible(b, window.Kit.Buddy(b, $('#buddyG'), { x: 190, w: 420 }));
    const mb = $('#mailBtn'), state = $('#mailState');
    if (mb) {
      mb.addEventListener('click', async () => {
        const email = mb.dataset.email;
        let ok = false;
        try { await navigator.clipboard.writeText(email); ok = true; } catch (e) {
          const ta = document.createElement('textarea'); ta.value = email; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta); ta.select();
          try { ok = document.execCommand('copy'); } catch (er) { ok = false; }
          ta.remove();
        }
        if (!ok) { location.href = 'mailto:' + email; return; }
        state.textContent = 'Copied ✓'; mb.classList.add('is-copied');
        clearTimeout(mb._t); mb._t = setTimeout(() => { state.textContent = 'Copy'; mb.classList.remove('is-copied'); }, 2200);
      });
    }
  }
})();
