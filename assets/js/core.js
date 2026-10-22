/*!
 * core.js — shared runtime for every page: smooth scroll, cursor, nav, reveals,
 * page transitions, scene scheduling. Exposes window.DV.
 */
(function () {
  'use strict';
  const DV = (window.DV = window.DV || {});
  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  DV.$ = $; DV.$$ = $$;

  const reduce = (DV.reduce = matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fine = (DV.fine = matchMedia('(hover: hover) and (pointer: fine)').matches);
  const G = (DV.gsap = window.gsap || null);
  if (reduce) doc.classList.add('no-motion');
  if (G) {
    G.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) G.registerPlugin(window.SplitText);
    G.defaults({ ease: 'expo.out', duration: 1 });
  }

  DV.store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* storage blocked */ } },
  };
  DV.debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* ------------------------------------------------------------ smooth scroll */
  let lenis = null;
  if (G && window.Lenis && !reduce) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', window.ScrollTrigger.update);
    G.ticker.add((time) => lenis.raf(time * 1000));
    G.ticker.lagSmoothing(0);
  }
  DV.lenis = lenis;
  DV.scrollTo = (target, opt = {}) => {
    const el = typeof target === 'string' ? $(target) : target;
    if (lenis) { lenis.scrollTo(el == null ? 0 : el, { offset: opt.offset || 0, duration: opt.immediate ? 0 : opt.duration || 1.5, immediate: !!opt.immediate, force: true }); return; }
    if (typeof el === 'number') scrollTo({ top: el, behavior: opt.immediate || reduce ? 'auto' : 'smooth' });
    else if (el) el.scrollIntoView({ behavior: opt.immediate || reduce ? 'auto' : 'smooth' });
  };
  DV.lock = (on) => {
    if (lenis) (on ? lenis.stop() : lenis.start());
    doc.style.overflow = on ? 'hidden' : '';
  };

  /* ------------------------------------------------------------ in-page anchors */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const el = id.length > 1 ? $(id) : null;
    if (!el) return;
    e.preventDefault();
    DV.closeMenu && DV.closeMenu();
    DV.scrollTo(el);
  });

  /* ------------------------------------------------------------ mobile menu */
  const burger = $('#burger'), menu = $('#menu');
  if (burger && menu) {
    const set = (open) => {
      document.body.classList.toggle('menu-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', String(!open));
      DV.lock(open);
    };
    DV.closeMenu = () => document.body.classList.contains('menu-open') && set(false);
    burger.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
    addEventListener('keydown', (e) => { if (e.key === 'Escape') DV.closeMenu(); });
  }

  /* ------------------------------------------------------------ nav: hide on scroll down, active link */
  const nav = $('#nav'), bar = $('#progress');
  if (G && nav) {
    window.ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate(self) {
        if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
        const y = self.scroll();
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 240 && !document.body.classList.contains('menu-open'));
      },
    });
    $$('.nav__links a[href^="#"]').forEach((a) => {
      const sec = $(a.getAttribute('href'));
      if (!sec) return;
      window.ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 45%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
    });
  }

  /* ------------------------------------------------------------ IST clock */
  const clocks = $$('[data-ist], #heroClock, #loaderClock');
  if (clocks.length) {
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }); } catch (e) { fmt = null; }
    const tick = () => { const s = fmt ? fmt.format(new Date()) : ''; clocks.forEach((c) => (c.textContent = s)); };
    tick(); setInterval(tick, 15000);
  }

  /* ------------------------------------------------------------ magnetic buttons */
  if (G && fine && !reduce) {
    $$('.magnetic').forEach((el) => {
      const xTo = G.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' });
      const yTo = G.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.28);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }

  /* ------------------------------------------------------------ 3D tilt cards */
  if (fine && !reduce) {
    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', `${((px - 0.5) * 8).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${((0.5 - py) * 6).toFixed(2)}deg`);
        el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      });
      el.addEventListener('pointerleave', () => { el.classList.remove('is-tilting'); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* ------------------------------------------------------------ text helpers */
  // scramble: letters resolve left → right like a decoder
  DV.scramble = (el, dur = 0.9) => {
    const final = el.dataset.text || el.textContent;
    if (reduce) { el.textContent = final; return; }
    const chars = '!<>-_\\/[]{}=+*^?#ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    const t0 = performance.now();
    const step = (now) => {
      const u = Math.min(1, (now - t0) / (dur * 1000));
      const n = Math.floor(u * final.length);
      let out = final.slice(0, n);
      for (let i = n; i < final.length; i++) out += final[i] === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0];
      el.textContent = out;
      if (u < 1) requestAnimationFrame(step); else el.textContent = final;
    };
    requestAnimationFrame(step);
  };

  // odometer digits: returns { el, set(text, delay) }
  DV.odometer = (el, text) => {
    const label = text;
    el.setAttribute('aria-label', label);
    el.textContent = '';
    const cols = [];
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const box = document.createElement('span'); box.className = 'odo'; box.setAttribute('aria-hidden', 'true');
        const col = document.createElement('span'); col.className = 'odo__col';
        for (let i = 0; i <= 9; i++) { const s = document.createElement('span'); s.textContent = i; col.appendChild(s); }
        box.appendChild(col); el.appendChild(box); cols.push({ col, d: +ch });
      } else {
        const s = document.createElement('span'); s.textContent = ch; s.setAttribute('aria-hidden', 'true'); el.appendChild(s); cols.push(null);
      }
    }
    return {
      roll(delay = 0, dur = 1.8) {
        cols.forEach((c, i) => {
          if (!c) return;
          if (!G || reduce) { c.col.style.transform = `translateY(${-c.d * 10}%)`; return; }
          G.fromTo(c.col, { yPercent: 0 }, { yPercent: -c.d * 10, duration: dur + i * 0.18, ease: 'expo.out', delay });
        });
      },
      jump(next) {
        let k = 0;
        for (const ch of next) {
          const c = cols[k++];
          if (!c || !/\d/.test(ch)) continue;
          c.d = +ch;
          if (G) G.set(c.col, { yPercent: -c.d * 10 }); else c.col.style.transform = `translateY(${-c.d * 10}%)`;
        }
      },
      set(next) { // same length numbers only (years)
        let k = 0;
        for (const ch of next) {
          const c = cols[k++];
          if (!c || !/\d/.test(ch)) continue;
          c.d = +ch;
          if (G && !reduce) G.to(c.col, { yPercent: -c.d * 10, duration: 0.9, ease: 'expo.out' });
          else c.col.style.transform = `translateY(${-c.d * 10}%)`;
        }
        el.setAttribute('aria-label', next);
      },
    };
  };

  /* ------------------------------------------------------------ heading + block reveals */
  DV.initReveals = () => {
    if (!G || reduce) return;
    $$('.split').forEach((h) => {
      if (h.dataset.splitDone) return;
      h.dataset.splitDone = '1';
      if (window.SplitText) {
        window.SplitText.create(h, {
          type: 'lines', mask: 'lines', linesClass: 'line-mask-in', autoSplit: true,
          onSplit(self) {
            return G.from(self.lines, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
          },
        });
      } else {
        G.from(h, { y: 40, opacity: 0, duration: 1.1, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
      }
    });
    $$('.rv').forEach((el) => {
      window.ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => el.classList.add('is-in') });
    });
  };

  /* ------------------------------------------------------------ run fn(now) every frame while el is visible */
  DV.whileVisible = (el, fn, margin = '120px') => {
    let vis = false, raf = 0;
    const loop = (now) => { if (!vis) { raf = 0; return; } fn(now); raf = requestAnimationFrame(loop); };
    const io = new IntersectionObserver(([e]) => { vis = e.isIntersecting; if (vis && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: margin });
    io.observe(el);
    return { io };
  };

  /* ------------------------------------------------------------ deterministic scenes (draw(t)) */
  DV.scenes = (() => {
    const items = [];
    const now = () => performance.now() / 1000;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      const it = e.target.__scene; if (!it) return;
      it.visible = e.isIntersecting;
      if (it.visible && it.start == null && it.active) it.start = now();
    }), { threshold: 0.15 });
    let running = false;
    const tick = () => {
      const t = now();
      let any = false;
      for (const it of items) {
        if (!it.visible || !it.active) continue;
        any = true;
        if (it.start == null) it.start = t;
        it.draw(reduce ? it.still : t - it.start);
      }
      requestAnimationFrame(tick);
      void any;
    };
    return {
      add(el, draw, opt = {}) {
        const it = { el, draw, start: null, visible: false, active: opt.active !== false, still: opt.still != null ? opt.still : 99 };
        el.__scene = it; io.observe(el); items.push(it);
        if (!running) { running = true; requestAnimationFrame(tick); }
        if (reduce) draw(it.still);
        return it;
      },
      replay(it) { it.start = now(); },
      activate(it, on) { it.active = on; if (on) it.start = now(); },
      now,
    };
  })();

  /* ------------------------------------------------------------ tabs that switch scenes */
  DV.initTabs = (container, registry) => {
    const tabs = $$('[role="tab"]', container), replay = $('[data-replay]', container);
    const scenes = $$('.scene', container);
    let current = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    const show = (tab) => {
      current = tab;
      const id = tab.dataset.scene;
      tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      scenes.forEach((s) => {
        const on = s.dataset.sceneId === id;
        s.classList.toggle('is-on', on);
        const it = registry[s.dataset.sceneId];
        if (it) DV.scenes.activate(it, on);
      });
    };
    tabs.forEach((t) => t.addEventListener('click', () => show(t)));
    container.addEventListener('keydown', (e) => {
      if (!['ArrowRight', 'ArrowLeft'].includes(e.key) || !e.target.matches('[role="tab"]')) return;
      const i = tabs.indexOf(e.target), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      n.focus(); show(n);
    });
    if (replay) replay.addEventListener('click', () => { const it = registry[current.dataset.scene]; if (it) DV.scenes.replay(it); });
    show(current);
  };

  /* ------------------------------------------------------------ page transitions */
  const wipe = $('#wipe');
  if (wipe && G) {
    const label = $('span', wipe);
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-transition]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      const href = a.href;
      DV.store.set('dv-wipe', '1');
      if (reduce) { location.href = href; return; }
      if (label && a.dataset.label) label.textContent = a.dataset.label;
      wipe.classList.add('is-in');
      G.timeline({ onComplete: () => { location.href = href; } })
        .fromTo(wipe, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.75, ease: 'expo.inOut' })
        .to(label, { opacity: 1, duration: 0.25 }, '-=0.3');
    });
    if (DV.store.get('dv-wipe') === '1') {
      DV.store.set('dv-wipe', '');
      DV.fromWipe = true;
      G.set(wipe, { clipPath: 'inset(0% 0% 0% 0%)' });
      G.to(wipe, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut', delay: 0.1, onComplete: () => wipe.classList.remove('is-in') });
    }
    addEventListener('pageshow', (e) => { if (e.persisted) { wipe.classList.remove('is-in'); G.set(wipe, { clipPath: 'inset(100% 0% 0% 0%)' }); } });
  }

  /* ------------------------------------------------------------ autoplay muted videos on screen */
  $$('video[data-autoplay]').forEach((v) => {
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      else v.pause();
    }, { threshold: 0.2 });
    io.observe(v);
  });

  /* ------------------------------------------------------------ refresh on resize */
  if (G) addEventListener('resize', DV.debounce(() => window.ScrollTrigger.refresh(), 250));
})();
