/*!
 * case.js — scene wiring for the case-study pages (SARRA, YatriMap, HackByteCodex).
 * Each block runs only if its elements are on the page.
 */
(function () {
  'use strict';
  const DV = window.DV, $ = DV.$, $$ = DV.$$;
  const S = DV.scenes;
  if (window.Toon) window.Toon.defs();
  DV.initReveals();
  // tilt-in screenshots + feature reveals
  $$('.shot-wrap, .ladder').forEach((el) => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
  });

  /* ---------------------------------------------------------------- SARRA */
  if (window.Sarra && $('#mapSvg')) {
    const map = window.Sarra.MapScene($('#mapSvg'), { towns: true });
    const mapIt = S.add($('#mapStage'), (t) => map.draw(t), { still: 99 });
    const tip = $('#tip'), stage = $('#mapStage');
    map.districts.forEach((d) => {
      const p = d.el, base = p.getAttribute('fill');
      const show = (e) => { const r = stage.getBoundingClientRect(); tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px'; tip.innerHTML = d.name + '<small>' + d.div + ' division</small>'; tip.style.opacity = 1; p.setAttribute('fill', d.div === 'Garhwal' ? '#e6d9bf' : '#cddcf0'); };
      p.addEventListener('pointermove', show); p.addEventListener('pointerdown', show);
      p.addEventListener('pointerleave', () => { tip.style.opacity = 0; p.setAttribute('fill', base); });
    });
    $('#replayMap').addEventListener('click', () => S.replay(mapIt));

    // architecture (horizontal on wide screens, vertical on narrow)
    let arch = null, layout = null, archIt = null;
    const buildArch = () => {
      const L = $('#archStage').clientWidth < 640 ? 'v' : 'h';
      if (L === layout) return;
      layout = L;
      const svg = $('#archSvg'); svg.innerHTML = '';
      arch = window.Sarra.ArchScene(svg, { layout: L });
      arch.nodes.forEach((n, i) => {
        const pick = () => { arch.setActive(i); $('#info').innerHTML = '<b>' + n.t + '</b><span>' + n.info + '</span>'; };
        n.g.addEventListener('click', pick);
        n.g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
      });
      if (archIt) S.replay(archIt);
    };
    buildArch();
    archIt = S.add($('#archStage'), (t) => arch.draw(t), { still: 5 });
    addEventListener('resize', DV.debounce(buildArch, 200));

    const audit = window.Sarra.AuditScene($('#term'));
    const stamp = window.Sarra.Stamp($('#stampSvg'), { x: 0, y: 0, r: 150, start: audit.total + 0.1, fill: '#fdfbf6' });
    const auditIt = S.add($('#auditStage'), (t) => { audit.draw(t); stamp.draw(t); }, { still: 99 });
    $('#replayAudit').addEventListener('click', () => S.replay(auditIt));

    const mig = window.Sarra.MigrationScene($('#migSvg'));
    const migIt = S.add($('#migStage'), (t) => mig.draw(t), { still: 99 });
    $('#replayMig').addEventListener('click', () => S.replay(migIt));

    const seo = $('#seo');
    if (seo) for (let i = 0; i < 16; i++) { const b = document.createElement('i'); b.style.animationDelay = (i * 0.13) + 's'; seo.appendChild(b); }
    const mm = $('#miniMap');
    if (mm && window.UK_MAP) {
      const md = window.UK_MAP.districts.map((d) => window.Sarra.el('path', { d: d.d, fill: '#fff', stroke: '#141312', 'stroke-width': 5 }, mm));
      window.UK_MAP.rivers.forEach((r) => window.Sarra.el('path', { d: r.d, fill: 'none', stroke: '#1d63d6', 'stroke-width': r.major ? 9 : 5, 'stroke-linecap': 'round' }, mm));
      DV.whileVisible(mm, (now) => { const k = Math.floor(now / 1300) % md.length; md.forEach((p, i) => p.setAttribute('fill', i === k ? '#ffd6db' : '#fff')); });
    }
  }

  /* ---------------------------------------------------------------- YATRIMAP */
  if (window.Yatri && $('#bungeeSvg')) {
    const Y = window.Yatri;
    const bungee = Y.BungeeScene($('#bungeeSvg'));
    const bIt = S.add($('#bungee'), (t) => bungee.draw(t), { still: 8 });
    $('#bungee').addEventListener('click', () => S.replay(bIt));
    $('#replayB').addEventListener('click', () => S.replay(bIt));

    // impact board: snapshot first, swap to live numbers if the public API answers
    const host = $('#impact');
    let board = Y.ImpactBoard(host, Y.SNAPSHOT.activity);
    const iIt = S.add(host, (t) => board.draw(t), { still: 9 });
    if (window.fetch) {
      fetch('https://api.yatrimap.com/public/impact').then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (!j) return;
        const data = Y.normalizeImpact(j);
        data.live = true;
        board = Y.ImpactBoard(host, data);
        host.classList.add('is-live');
        S.replay(iIt);
      }).catch(() => {});
    }

    const qf = Y.QRFlow($('#qf'), { loop: 12.5 });
    const fitQF = () => { const w = $('#qfwrap').clientWidth, s = Math.max(0.56, Math.min(1, w / 1200)); const sc = $('#qfscale'); sc.style.transform = `scale(${s})`; sc.style.width = (1200 * s) + 'px'; sc.style.height = (760 * s) + 'px'; };
    fitQF(); addEventListener('resize', fitQF);
    const qIt = S.add($('#qfwrap'), (t) => qf.draw(t), { still: 11 });
    $('#replayQ').addEventListener('click', () => S.replay(qIt));

    const raft = Y.RaftPoolScene($('#raftSvg'), { loop: 7.5 });
    S.add($('#raftStage'), (t) => raft.draw(t), { still: 6 });
    const pay = Y.PayScene($('#paySvg'), { loop: 6 });
    S.add($('#payStage'), (t) => pay.draw(t), { still: 4.5 });
    const pins = Y.PinMap($('#pinSvg'));
    S.add($('#mapStage2'), (t) => pins.draw(t), { still: 5 });
    let hub = null, hubL = null, hubIt = null;
    const buildHub = () => { const L = $('#hubStage').clientWidth < 640 ? 'v' : 'h'; if (L === hubL) return; hubL = L; $('#hubSvg').innerHTML = ''; hub = Y.HubScene($('#hubSvg'), { layout: L }); if (hubIt) S.replay(hubIt); };
    buildHub();
    hubIt = S.add($('#hubStage'), (t) => hub.draw(t), { still: 5 });
    addEventListener('resize', DV.debounce(buildHub, 200));
  }

  /* ---------------------------------------------------------------- HACKBYTECODEX */
  if (window.Hbc && $('#treeSvg')) {
    const H = window.Hbc, reg = {};
    const tree = H.TreeScene($('#treeSvg'));
    reg.treeStage = S.add($('#treeStage'), (t) => tree.draw(t), { still: 10.4 });
    const geo = H.GeoScene($('#geoSvg'));
    reg.geoStage = S.add($('#geoStage'), (t) => geo.draw(t), { still: 7.5 });
    const board = H.BoardScene($('#boardSvg'));
    reg.boardStage = S.add($('#boardStage'), (t) => board.draw(t), { still: 10.2 });
    const rate = H.RateScene($('#rateSvg'));
    reg.rateStage = S.add($('#rateStage'), (t) => rate.draw(t), { still: 3.5 });
    $$('[data-replay-for]').forEach((b) => b.addEventListener('click', () => { const it = reg[b.dataset.replayFor]; if (it) S.replay(it); }));
    // emails drop in one after another
    const mails = $$('.mail');
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      mails.forEach((m, i) => setTimeout(() => m.classList.add('is-in'), DV.reduce ? 0 : i * 90));
      io.disconnect();
    }, { threshold: 0.2 });
    if ($('#mails')) io.observe($('#mails'));
  }
})();
