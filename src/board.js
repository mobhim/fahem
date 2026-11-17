/* فاهم — السبورة الكبيرة: عدة مشاهد على سبورة واحدة، كل مشهد بشكله (خريطة، خطوات، دورة، مقارنة، أعمدة، خط، نسب، قائمة، عبارة كبيرة).
 * الكاميرا تسافر من مشهد لمشهد وتقرّب على ما ينرسم، وقلم يتبع الخط. الحركة كلها تحويلات خفيفة، بدون مرشّحات ثقيلة. */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const L = F.Lesson, W = L.CELL.w, H = L.CELL.h;
  const INKS = ['var(--ink-a)', 'var(--ink-b)', 'var(--ink-c)', 'var(--ink-d)', 'var(--ink-e)', 'var(--ink-f)'];
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let boards = 0;

  /* أيقونات صغيرة (24×24) لكل منها حركة تناسب معناها */
  const ICONS = {
    idea: ['<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>', 'pulse'],
    in: ['<path d="M12 3v11M7 10l5 5 5-5M4 20h16"/>', 'drop'],
    out: ['<path d="M12 16V5M7 9l5-5 5 5M4 20h16"/>', 'rise'],
    stack: ['<path d="M4 18h16M6 13h12M8 8h8"/>', 'drop'],
    queue: ['<circle cx="5" cy="12" r="2.2"/><circle cx="12" cy="12" r="2.2"/><circle cx="19" cy="12" r="2.2"/>', 'slide'],
    bolt: ['<path d="M13 2 5 14h6l-1 8 8-12h-6z"/>', 'flash'],
    clock: ['<circle cx="12" cy="12" r="9"/><path class="hand-tick" d="M12 12V6"/><path d="M12 12h4"/>', 'tick'],
    search: ['<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 6 6"/>', 'wiggle'],
    check: ['<path d="m4 12.5 5 5L20 6"/>', 'pulse'],
    warn: ['<path d="M12 3 2 20h20zM12 10v5M12 17.5v.5"/>', 'shake'],
    loop: ['<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', 'spin'],
    grid: ['<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>', 'blink'],
    chart: ['<path d="M4 20h16"/><path class="bar" d="M7 20v-6M12 20V8M17 20V5"/>', 'grow'],
    link: ['<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', 'wiggle'],
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const el = (name, attrs, parent) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const r1 = (n) => Math.round(n * 10) / 10;
  const fmtNum = (v) => (Math.abs(v) >= 1000 ? v.toLocaleString('en-US') : String(Math.round(v * 100) / 100));

  function roughRect(b, rand, j = 2.6, r = 14) {
    const o = () => (rand() - 0.5) * 2 * j;
    const x = b.x, y = b.y, w = b.w, h = b.h;
    const p = [[x + r, y], [x + w - r, y], [x + w, y], [x + w, y + r], [x + w, y + h - r], [x + w, y + h], [x + w - r, y + h],
      [x + r, y + h], [x, y + h], [x, y + h - r], [x, y + r], [x, y], [x + r + 6, y]].map(([a, c]) => [r1(a + o()), r1(c + o())]);
    return `M${p[0]} L${p[1]} Q${p[2]} ${p[3]} L${p[4]} Q${p[5]} ${p[6]} L${p[7]} Q${p[8]} ${p[9]} L${p[10]} Q${p[11]} ${p[12]}`;
  }
  function roughEllipse(c, rand, j = 3) {
    const pts = [];
    for (let k = 0; k <= 26; k++) {
      const t = (k / 24) * Math.PI * 2 - 0.5, f = 1 + (rand() - 0.5) * 0.05;
      pts.push([r1(c.x + Math.cos(t) * c.rx * f + (rand() - 0.5) * j), r1(c.y + Math.sin(t) * c.ry * f + (rand() - 0.5) * j)]);
    }
    let d = `M${pts[0]}`;
    for (let k = 1; k < pts.length - 1; k++) d += ` Q${pts[k]} ${[r1((pts[k][0] + pts[k + 1][0]) / 2), r1((pts[k][1] + pts[k + 1][1]) / 2)]}`;
    return d;
  }
  /** خط منحنٍ بخط اليد؛ يرجّع المسار ونقطة التحكم (لحساب رأس السهم). */
  function curve(a, b, rand, bend = 0) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const c = { x: mx + (-dy / len) * bend + (rand() - 0.5) * 6, y: my + (dx / len) * bend + (rand() - 0.5) * 6 };
    return { d: `M${r1(a.x)},${r1(a.y)} Q${r1(c.x)},${r1(c.y)} ${r1(b.x)},${r1(b.y)}`, c };
  }
  const roughLine = (a, b, rand, bend) => curve(a, b, rand, bend).d;

  function create(svg) {
    boards++;
    const FULL = [0, 0, W, H];
    let groups = [], pen = null, penRun = 0, frames = [], overview = FULL, view = FULL.slice(), cam = 0, lastBeat = 0, wide = false;
    svg.setAttribute('viewBox', FULL.join(' '));

    /* ---------- أدوات الرسم ---------- */
    const stroke = (g, d, color, width, delay, dur) => el('path', {
      d, class: 'ink', pathLength: 1, stroke: color, 'stroke-width': width, fill: 'none', style: `--d:${delay}s;--t:${dur}s`, 'data-d': delay, 'data-t': dur,
    }, g);
    /** نص بخط اليد. maxW: أقصى عرض؛ لو النص أعرض يصغر الخط، ولو ما كفى ينضغط حتى ما يطلع من مكانه أبدًا. */
    const text = (g, str, x, y, size, delay, cls, anchor, maxW) => {
      const t = el('text', { x, y, 'font-size': size, class: `hand ${cls || ''}`, 'text-anchor': anchor || 'middle', style: `--d:${delay}s`, 'data-d': delay, 'data-t': 0.45 }, g);
      t.textContent = str;
      if (maxW) {
        let len = 0;
        try { len = t.getComputedTextLength(); } catch (e) { /* خارج الصفحة */ }
        if (!len) len = str.length * size * 0.56; // السبورة مخفية الآن: تقدير، ويُعاد الرسم لما تظهر
        if (len > maxW) {
          const next = Math.max(size * 0.6, (size * maxW) / len);
          t.setAttribute('font-size', r1(next));
          if ((len * next) / size > maxW * 1.02) { t.setAttribute('textLength', r1(maxW)); t.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
        }
      }
      return t;
    };
    function arrow(g, a, b, rand, bend, color, delay, width) {
      const cv = curve(a, b, rand, bend), dx = b.x - cv.c.x, dy = b.y - cv.c.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      stroke(g, cv.d, color, width || 2.6, delay, 0.5);
      const wing = (s) => `M${r1(b.x)},${r1(b.y)} L${r1(b.x - ux * 15 + s * uy * 8)},${r1(b.y - uy * 15 - s * ux * 8)}`;
      stroke(g, wing(1), color, width || 2.6, delay + 0.45, 0.15); stroke(g, wing(-1), color, width || 2.6, delay + 0.5, 0.15);
    }
    /** بطاقة مرسومة باليد: ظل + تعبئة + حدّين. ترجّع مجموعة تتحرك كقطعة واحدة. */
    function card(g, box, ink, rand, delay) {
      const c = el('g', { class: 'box-g', style: `transform-origin:${box.x + box.w / 2}px ${box.y + box.h / 2}px` }, g);
      el('rect', { x: box.x + 7, y: box.y + 9, width: box.w, height: box.h, rx: 16, class: 'box-shadow', fill: ink, style: `--d:${delay + 0.25}s` }, c);
      el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 16, class: 'box-fill', style: `--d:${delay + 0.25}s;--tone:${ink}` }, c);
      stroke(c, roughRect(box, rand), ink, 2.8, delay, 0.7);
      stroke(c, roughRect(box, rand, 3.4), ink, 1.1, delay + 0.15, 0.7);
      return c;
    }
    /** شارة دائرية: أيقونة متحركة أو رقم. */
    function badge(g, x, y, what, ink, delay) {
      const b = el('g', { class: 'badge', transform: `translate(${x} ${y})`, style: `--d:${delay}s` }, g);
      el('circle', { r: 21, fill: 'var(--paper)', stroke: ink, 'stroke-width': 2.4 }, b);
      const icon = ICONS[what];
      if (icon) { const glyph = el('g', { class: 'glyph m-' + icon[1], transform: 'translate(-12 -12)', stroke: ink }, b); glyph.innerHTML = icon[0]; }
      else { const t = el('text', { y: 8, 'font-size': 22, class: 'hand num', 'text-anchor': 'middle', fill: ink }, b); t.textContent = what; }
      return b;
    }
    const title = (g, str, rand, rtl) => {
      if (!str) return;
      const x = rtl ? W - 44 : 44, t = text(g, str, x, 60, 34, 0, 'title', 'start', 880);
      let tw = Math.min(880, str.length * 17);
      try { tw = Math.min(880, t.getComputedTextLength() || tw); } catch (e) { /* خارج الصفحة */ }
      stroke(g, roughLine({ x: rtl ? x + 6 : x - 6, y: 78 }, { x: rtl ? x - 6 - tw : x + 6 + tw, y: 80 }, rand, 3), 'var(--ink-a)', 4, 0.45, 0.45);
    };
    /** عنوان وتفصيل داخل بطاقة عرضها w: الاثنان يتقيّدان بعرض البطاقة. */
    const labelLines = (g, it, cx, cy, delay, per, w) => {
      const max = (w || 276) - 34, detail = L.wrap(it.detail, per || 30, 2), two = detail.length > 1;
      text(g, it.label, cx, cy - (detail.length ? (two ? 12 : 4) : -9), 24, delay, 'label', null, max);
      detail.forEach((line, k) => text(g, line, cx, cy + (two ? 12 : 24) + k * 20, 15.5, delay + 0.2 + k * 0.12, 'detail', null, max));
    };

    /* ---------- أشكال المشاهد. كل دالة ترسم داخل خلية 1000×640 وتحدد إطار الكاميرا لكل عنصر ---------- */
    const SHAPES = {
      map(c, sc) {
        const HUB = { x: 500, y: 355, rx: 104, ry: 50 }, BOX = { w: 276, h: 96 };
        const SLOTS = [{ x: 812, y: 220 }, { x: 188, y: 220 }, { x: 812, y: 490 }, { x: 188, y: 490 }, { x: 500, y: 178 }, { x: 500, y: 545 }];
        el('ellipse', { cx: HUB.x, cy: HUB.y, rx: HUB.rx + 16, ry: HUB.ry + 14, class: 'halo' }, c.intro);
        el('ellipse', { cx: HUB.x, cy: HUB.y, rx: HUB.rx + 16, ry: HUB.ry + 14, class: 'halo late' }, c.intro);
        const hub = el('g', { class: 'hub-g' }, c.intro);
        el('path', { d: roughEllipse(HUB, c.rand), class: 'hub-fill', style: '--d:0.9s' }, hub);
        stroke(hub, roughEllipse(HUB, c.rand), 'var(--ink)', 2.6, 0.8, 0.8);
        text(hub, sc.hub, HUB.x, HUB.y + 10, 30, 1.3, 'hub', null, HUB.rx * 2 - 44);
        sc.items.forEach((it, n) => {
          const p = SLOTS[n], g = c.item(n, 'branch'), ink = INKS[n % INKS.length];
          const box = { x: p.x - BOX.w / 2, y: p.y - BOX.h / 2, w: BOX.w, h: BOX.h };
          const dx = p.x - HUB.x, dy = p.y - HUB.y, len = Math.hypot(dx, dy) || 1;
          const from = { x: HUB.x + (dx / len) * HUB.rx * 0.92, y: HUB.y + (dy / len) * HUB.ry * 1.05 };
          const to = Math.abs(dx) < 40 ? { x: p.x, y: dy < 0 ? box.y + box.h : box.y } : { x: dx > 0 ? box.x : box.x + box.w, y: p.y };
          const link = roughLine(from, to, c.rand, n % 2 ? 26 : -26);
          stroke(g, link, 'var(--ink-soft)', 2.4, 0, 0.45);
          const spark = el('circle', { r: 5.5, class: 'spark', fill: ink }, g);
          el('animateMotion', { dur: '1.5s', repeatCount: 'indefinite', path: link }, spark);
          const b = card(g, box, ink, c.rand, 0.35);
          labelLines(b, it, p.x, p.y, 0.9);
          if (it.icon) badge(b, box.x + box.w - 8, box.y + 6, it.icon, ink, 1.2);
          const x0 = Math.min(box.x, HUB.x - HUB.rx), x1 = Math.max(box.x + box.w, HUB.x + HUB.rx), y0 = Math.min(box.y, HUB.y - HUB.ry), y1 = Math.max(box.y + box.h, HUB.y + HUB.ry);
          c.focus(n, x0, y0, x1 - x0, y1 - y0, 60);
        });
      },

      steps(c, sc) {
        const n = sc.items.length, perRow = n <= 3 ? n : Math.ceil(n / 2), rows = n <= 3 ? 1 : 2, BW = perRow >= 3 ? 250 : 290, BH = 124;
        const pos = sc.items.map((_, i) => {
          const row = Math.floor(i / perRow), k = i % perRow, inRow = row === rows - 1 ? n - perRow * row : perRow, slot = 900 / inRow;
          // الصف الثاني يرجع بالاتجاه المعاكس، فالسهم بين الصفين ينزل مباشرة
          const fromRight = c.rtl ? row % 2 === 0 : row % 2 === 1;
          const at = fromRight ? 950 - slot * (k + 0.5) : 50 + slot * (k + 0.5);
          return { x: at, y: rows === 1 ? 350 : row ? 480 : 245 };
        });
        sc.items.forEach((it, i) => {
          const p = pos[i], g = c.item(i), ink = INKS[i % INKS.length], box = { x: p.x - BW / 2, y: p.y - BH / 2, w: BW, h: BH };
          if (i) {
            const q = pos[i - 1], same = q.y === p.y, dir = p.x < q.x ? -1 : 1;
            if (same) arrow(g, { x: q.x + dir * (BW / 2 + 8), y: q.y }, { x: p.x - dir * (BW / 2 + 10), y: p.y }, c.rand, -10 * dir, 'var(--ink-soft)', 0, 3);
            else arrow(g, { x: q.x, y: q.y + BH / 2 + 8 }, { x: p.x, y: p.y - BH / 2 - 12 }, c.rand, 40, 'var(--ink-soft)', 0, 3);
          }
          const b = card(g, box, ink, c.rand, i ? 0.5 : 0.1);
          labelLines(b, it, p.x, p.y + 4, 1, BW > 260 ? 28 : 24, BW);
          badge(b, box.x + box.w - 6, box.y + 4, it.icon || String(i + 1), ink, 1.2);
          if (rows === 2) c.focus(i, 0, p.y - 190, W, 380, 0);
        });
      },

      cycle(c, sc) {
        const n = sc.items.length, C = { x: 500, y: 365 }, RX = 300, RY = 190, NODE = { rx: 112, ry: 44 };
        const pos = sc.items.map((_, i) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2 * (c.rtl ? -1 : 1); return { x: C.x + Math.cos(a) * RX, y: C.y + Math.sin(a) * RY }; });
        const edge = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, t = 1 / Math.sqrt((ux / NODE.rx) ** 2 + (uy / NODE.ry) ** 2) + 10; return { x: p.x + ux * t, y: p.y + uy * t }; };
        badge(c.intro, C.x, C.y, 'loop', 'var(--ink-soft)', 0.8);
        sc.items.forEach((it, i) => {
          const p = pos[i], g = c.item(i), ink = INKS[i % INKS.length];
          if (i) arrow(g, edge(pos[i - 1], p), edge(p, pos[i - 1]), c.rand, c.rtl ? 34 : -34, 'var(--ink-soft)', 0, 3);
          const b = el('g', { class: 'box-g', style: `transform-origin:${p.x}px ${p.y}px` }, g);
          el('ellipse', { cx: p.x, cy: p.y, rx: NODE.rx, ry: NODE.ry, class: 'box-fill', style: `--d:0.7s;--tone:${ink}` }, b);
          stroke(b, roughEllipse({ x: p.x, y: p.y, rx: NODE.rx, ry: NODE.ry }, c.rand, 2), ink, 2.8, i ? 0.45 : 0.1, 0.7);
          text(b, it.label, p.x, p.y + 8, 22, 0.95, 'label', null, NODE.rx * 2 - 40);
          if (i === n - 1) arrow(g, edge(p, pos[0]), edge(pos[0], p), c.rand, c.rtl ? 34 : -34, 'var(--ink-soft)', 1.4, 3);
        });
      },

      compare(c, sc) {
        const cols = { a: c.rtl ? 740 : 260, b: c.rtl ? 260 : 740 }, count = { a: 0, b: 0 }, tone = { a: INKS[0], b: INKS[1] };
        stroke(c.intro, roughLine({ x: 500, y: 112 }, { x: 500, y: 610 }, c.rand, 4), 'var(--ink-soft)', 2.4, 1.1, 0.6);
        ['a', 'b'].forEach((side, k) => {
          const head = card(c.intro, { x: cols[side] - 190, y: 108, w: 380, h: 68 }, tone[side], c.rand, 0.6 + k * 0.5);
          text(head, sc[side], cols[side], 153, 28, 1 + k * 0.5, 'label', null, 340);
        });
        sc.items.forEach((it, i) => {
          const side = it.side, k = count[side]++, cx = cols[side], y = 240 + k * 100, g = c.item(i), ink = tone[side];
          const row = el('g', { class: 'box-g', style: `transform-origin:${cx}px ${y}px` }, g);
          const dir = c.rtl ? 1 : -1;
          stroke(row, roughEllipse({ x: cx + dir * 172, y: y - 6, rx: 9, ry: 9 }, c.rand, 1.2), ink, 3, 0, 0.3);
          text(row, it.label, cx + dir * 150, y, 24, 0.3, 'label', 'start', 330);
          L.wrap(it.detail, 32, 2).forEach((line, m) => text(row, line, cx + dir * 150, y + 26 + m * 20, 15.5, 0.55 + m * 0.12, 'detail', 'start', 330));
          c.focus(i, cx - 250, 90, 500, 520, 0);
        });
      },

      bars(c, sc) {
        const n = sc.items.length, X0 = 110, X1 = 890, BASE = 540, TOP = 170, max = Math.max(...sc.items.map((i) => i.value)) || 1;
        const band = (X1 - X0) / n, bw = Math.min(130, band * 0.56), axisX = c.rtl ? X1 : X0;
        stroke(c.intro, roughLine({ x: X0 - 10, y: BASE }, { x: X1 + 10, y: BASE }, c.rand, 2), 'var(--ink)', 3, 0.6, 0.6);
        stroke(c.intro, roughLine({ x: axisX, y: BASE + 8 }, { x: axisX, y: TOP - 40 }, c.rand, 2), 'var(--ink)', 3, 0.9, 0.5);
        if (sc.unit) text(c.intro, sc.unit, axisX, TOP - 52, 17, 1.2, 'detail');
        if (sc.approx) text(c.intro, c.rtl ? 'قيم توضيحية للمقارنة' : 'Illustrative values', c.rtl ? 60 : W - 60, H - 14, 14.5, 1.3, 'detail', c.rtl ? 'end' : 'start');
        sc.items.forEach((it, i) => {
          const cx = c.rtl ? X1 - band * (i + 0.5) : X0 + band * (i + 0.5), h = Math.max(7, (it.value / max) * (BASE - TOP)), g = c.item(i), ink = INKS[i % INKS.length];
          const box = { x: cx - bw / 2, y: BASE - h, w: bw, h };
          el('rect', { x: box.x, y: box.y, width: bw, height: h, rx: 6, class: 'bar-fill', fill: ink, style: '--d:0.1s' }, g);
          if (h > 24) stroke(g, roughRect(box, c.rand, 2, 6), ink, 2.6, 0.7, 0.6);
          text(g, fmtNum(it.value), cx, box.y - 14, 26, 0.9, 'label value', null, band - 12);
          L.wrap(it.label, 14, 2).forEach((line, m) => text(g, line, cx, BASE + 30 + m * 21, 17, 0.2 + m * 0.1, 'detail axis', null, band - 12));
        });
      },

      line(c, sc) {
        const n = sc.items.length, X0 = 110, X1 = 890, BASE = 540, TOP = 180, max = Math.max(...sc.items.map((i) => i.value)) || 1;
        stroke(c.intro, roughLine({ x: X0 - 10, y: BASE }, { x: X1 + 10, y: BASE }, c.rand, 2), 'var(--ink)', 3, 0.6, 0.6);
        stroke(c.intro, roughLine({ x: X0, y: BASE + 8 }, { x: X0, y: TOP - 50 }, c.rand, 2), 'var(--ink)', 3, 0.9, 0.5);
        if (sc.unit) text(c.intro, sc.unit, X0 + 8, TOP - 60, 17, 1.2, 'detail', c.rtl ? 'end' : 'start');
        if (sc.approx) text(c.intro, c.rtl ? 'قيم توضيحية للمقارنة' : 'Illustrative values', W - 60, H - 14, 14.5, 1.3, 'detail', c.rtl ? 'start' : 'end');
        const pts = sc.items.map((it, i) => ({ x: X0 + 60 + (i * (X1 - X0 - 120)) / (n - 1), y: BASE - (it.value / max) * (BASE - TOP) }));
        sc.items.forEach((it, i) => {
          const p = pts[i], g = c.item(i);
          if (i) stroke(g, roughLine(pts[i - 1], p, c.rand, 0), 'var(--ink-a)', 5, 0, 0.7);
          el('circle', { cx: p.x, cy: p.y, r: 9, class: 'pt', fill: 'var(--ink-b)', style: `--d:${i ? 0.65 : 0.1}s` }, g);
          text(g, fmtNum(it.value), p.x, p.y - 20, 23, i ? 0.8 : 0.3, 'label value');
          text(g, it.label, p.x, BASE + 30, 17, 0.2, 'detail axis', null, (X1 - X0 - 120) / (n - 1) - 10);
        });
      },

      pie(c, sc) {
        const total = sc.items.reduce((s, i) => s + i.value, 0) || 1, C = { x: c.rtl ? 290 : 710, y: 360 }, R = 150;
        let a0 = -Math.PI / 2;
        sc.items.forEach((it, i) => {
          const frac = Math.min(0.9999, it.value / total), a1 = a0 + frac * Math.PI * 2, g = c.item(i), ink = INKS[i % INKS.length];
          const P = (a) => `${r1(C.x + Math.cos(a) * R)},${r1(C.y + Math.sin(a) * R)}`;
          stroke(g, `M${P(a0 + 0.012)} A${R} ${R} 0 ${frac > 0.5 ? 1 : 0} 1 ${P(a1 - 0.012)}`, ink, 70, 0, 0.8).classList.add('slice');
          const lx = c.rtl ? 930 : 70, y = 190 + i * 66, row = el('g', { class: 'box-g', style: `transform-origin:${lx}px ${y}px` }, g);
          el('rect', { x: lx - 13, y: y - 22, width: 26, height: 26, rx: 6, class: 'pt', fill: ink, style: '--d:0.5s' }, row);
          text(row, `${it.label} · ${Math.round((it.value / total) * 100)}%`, c.rtl ? lx - 30 : lx + 30, y, 23, 0.6, 'label', 'start', 400);
          a0 = a1;
        });
        if (sc.unit) text(c.intro, sc.unit, C.x, C.y + 8, 22, 0.8, 'detail');
      },

      list(c, sc) {
        const n = sc.items.length, gap = Math.min(92, 440 / n), y0 = 350 - ((n - 1) * gap) / 2, bx = c.rtl ? 905 : 95, tx = c.rtl ? 868 : 132;
        sc.items.forEach((it, i) => {
          const y = y0 + i * gap, g = c.item(i), ink = INKS[i % INKS.length];
          const row = el('g', { class: 'box-g', style: `transform-origin:${bx}px ${y}px` }, g);
          badge(row, bx, y - 6, it.icon || 'check', ink, 0);
          text(row, it.label, tx, y, 27, 0.3, 'label', 'start', 740);
          const d = L.wrap(it.detail, 64, 1)[0];
          if (d) text(row, d, tx, y + 27, 16.5, 0.6, 'detail', 'start', 740);
          stroke(row, roughLine({ x: tx + (c.rtl ? 4 : -4), y: y + 42 }, { x: c.rtl ? 120 : 880, y: y + 44 }, c.rand, 2), 'var(--paper-line)', 2, 0.7, 0.5);
        });
      },

      /* كود يُتتبّع سطرًا سطرًا داخل نافذة محرر */
      code(c, sc) {
        const n = sc.items.length, lh = Math.min(58, 400 / n), top = 330 - (n * lh) / 2 - 20, box = { x: 90, y: top - 30, w: 820, h: n * lh + 78 };
        el('rect', { x: box.x + 8, y: box.y + 10, width: box.w, height: box.h, rx: 18, class: 'box-shadow', fill: 'var(--ink)' }, c.intro);
        el('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: 18, class: 'code-bg', style: '--d:0.5s' }, c.intro);
        ['var(--ink-b)', 'var(--hub)', 'var(--ink-c)'].forEach((f, k) => el('circle', { cx: box.x + 28 + k * 24, cy: box.y + 24, r: 7, fill: f, class: 'pt', style: `--d:${0.8 + k * 0.1}s` }, c.intro));
        sc.items.forEach((it, i) => {
          const y = top + 44 + i * lh, g = c.item(i);
          el('rect', { x: box.x + 10, y: y - lh * 0.62, width: box.w - 20, height: lh * 0.9, rx: 8, class: 'code-line', style: '--d:0s' }, g);
          text(g, String(i + 1), box.x + 44, y, 18, 0.1, 'code num', 'end');
          const t = text(g, it.label, box.x + 64, y, Math.min(25, lh * 0.5), 0.2, 'code', 'start', box.w - 100);
          t.setAttribute('xml:space', 'preserve');
        });
      },

      /* معادلة تُشتق أو تُحل سطرًا سطرًا، وآخر سطر يتأطّر كجواب */
      formula(c, sc) {
        const n = sc.items.length, lh = Math.min(92, 440 / n), size = Math.min(46, lh * 0.56), y0 = 360 - ((n - 1) * lh) / 2;
        sc.items.forEach((it, i) => {
          const y = y0 + i * lh, g = c.item(i), row = el('g', { class: 'box-g', style: `transform-origin:500px ${y}px` }, g);
          if (i) arrow(g, { x: 500, y: y - lh + 16 }, { x: 500, y: y - size * 0.95 }, c.rand, 0, 'var(--ink-soft)', 0, 2.4);
          const t = text(row, it.label, 500, y, size, i ? 0.4 : 0.1, 'math', null, 600);
          if (it.detail) text(row, it.detail, c.rtl ? 930 : 70, y - 4, 17, 0.7, 'detail', 'start', 160);
          if (i === n - 1 && n > 1) {
            let w = it.label.length * size * 0.5; try { w = t.getComputedTextLength() || w; } catch (e) { /* خارج الصفحة */ }
            w = Math.min(600, w);
            stroke(row, roughRect({ x: 500 - w / 2 - 22, y: y - size * 0.95, w: w + 44, h: size * 1.45 }, c.rand, 3), 'var(--ink-c)', 3.4, 0.9, 0.8);
          }
        });
      },

      /* مختبر: أوعية فيها سوائل ترتفع وفقاعات، وأسهم بين المراحل */
      lab(c, sc) {
        const n = sc.items.length, slot = 880 / n, cy = 320;
        sc.items.forEach((it, i) => {
          const cx = c.rtl ? 940 - slot * (i + 0.5) : 60 + slot * (i + 0.5), g = c.item(i), ink = INKS[i % INKS.length];
          const kind = it.vessel || ['beaker', 'flask', 'tube'][i % 3];
          if (i) { const d = c.rtl ? 1 : -1; arrow(g, { x: cx + d * (slot - 78), y: cy }, { x: cx + d * 80, y: cy }, c.rand, -12 * d, 'var(--ink-soft)', 0, 3); }
          const v = el('g', { class: 'box-g', style: `transform-origin:${cx}px ${cy}px` }, g), t0 = i ? 0.5 : 0.1;
          const liquid = (d) => el('path', { d, class: 'bar-fill liquid', fill: ink, style: `--d:${t0 + 0.6}s` }, v);
          if (kind === 'beaker') {
            liquid(`M${cx - 50},${cy - 5} H${cx + 50} V${cy + 70} Q${cx + 50},${cy + 81} ${cx + 38},${cy + 81} H${cx - 38} Q${cx - 50},${cy + 81} ${cx - 50},${cy + 70}Z`);
            stroke(v, `M${cx - 62},${cy - 84} L${cx - 55},${cy - 78} V${cy + 70} Q${cx - 55},${cy + 86} ${cx - 40},${cy + 86} H${cx + 40} Q${cx + 55},${cy + 86} ${cx + 55},${cy + 70} V${cy - 78} L${cx + 62},${cy - 84}`, ink, 3.2, t0, 0.8);
            [-40, -10, 20].forEach((dy, k) => stroke(v, `M${cx - 55},${cy + dy} h14`, ink, 2, t0 + 0.5 + k * 0.08, 0.2));
          } else if (kind === 'flask') {
            liquid(`M${cx - 37},${cy + 10} H${cx + 37} L${cx + 62},${cy + 68} Q${cx + 66},${cy + 81} ${cx + 50},${cy + 81} H${cx - 50} Q${cx - 66},${cy + 81} ${cx - 62},${cy + 68}Z`);
            stroke(v, `M${cx - 26},${cy - 86} H${cx + 26} M${cx - 18},${cy - 86} V${cy - 30} L${cx - 66},${cy + 68} Q${cx - 72},${cy + 86} ${cx - 50},${cy + 86} H${cx + 50} Q${cx + 72},${cy + 86} ${cx + 66},${cy + 68} L${cx + 18},${cy - 30} V${cy - 86}`, ink, 3.2, t0, 0.9);
          } else if (kind === 'tube') {
            liquid(`M${cx - 18},${cy - 10} H${cx + 18} V${cy + 62} Q${cx + 18},${cy + 81} ${cx},${cy + 81} Q${cx - 18},${cy + 81} ${cx - 18},${cy + 62}Z`);
            stroke(v, `M${cx - 30},${cy - 86} H${cx + 30} M${cx - 23},${cy - 86} V${cy + 62} Q${cx - 23},${cy + 86} ${cx},${cy + 86} Q${cx + 23},${cy + 86} ${cx + 23},${cy + 62} V${cy - 86}`, ink, 3.2, t0, 0.8);
          } else if (kind === 'pill') {
            const p = el('g', { transform: `rotate(-24 ${cx} ${cy})` }, v);
            el('path', { d: `M${cx},${cy - 30} H${cx + 38} a30,30 0 0 1 0,60 H${cx}Z`, class: 'pt', fill: ink, opacity: 0.55, style: `--d:${t0 + 0.6}s` }, p);
            stroke(p, `M${cx - 38},${cy - 30} H${cx + 38} a30,30 0 0 1 0,60 H${cx - 38} a30,30 0 0 1 0,-60 M${cx},${cy - 30} V${cy + 30}`, ink, 3.2, t0, 0.9);
          } else {
            el('path', { d: `M${cx},${cy - 72} C${cx + 62},${cy} ${cx + 52},${cy + 74} ${cx},${cy + 74} C${cx - 52},${cy + 74} ${cx - 62},${cy} ${cx},${cy - 72}Z`, class: 'pt', fill: ink, opacity: 0.5, style: `--d:${t0 + 0.6}s` }, v);
            stroke(v, `M${cx},${cy - 72} C${cx + 62},${cy} ${cx + 52},${cy + 74} ${cx},${cy + 74} C${cx - 52},${cy + 74} ${cx - 62},${cy} ${cx},${cy - 72}`, ink, 3.2, t0, 0.9);
          }
          if (kind !== 'pill' && kind !== 'drop') [-14, 4, 16].forEach((dx, k) => el('circle', { cx: cx + dx * (kind === 'tube' ? 0.5 : 1), cy: cy + 60, r: 4 + (k % 2), class: 'bubble', fill: 'var(--paper)', style: `--d:${k * 0.5}s` }, v));
          text(v, it.label, cx, cy + 128, 23, t0 + 0.9, 'label', null, slot - 16);
          L.wrap(it.detail, Math.max(12, Math.floor(slot / 9.5)), 2).forEach((line, m) => text(v, line, cx, cy + 154 + m * 20, 15.5, t0 + 1.1 + m * 0.1, 'detail', null, slot - 16));
        });
      },

      /* خط زمني: أحداث على محور، بالتبادل فوق وتحت */
      timeline(c, sc) {
        const n = sc.items.length, Y = 360, slot = 840 / n, BW = Math.min(250, slot * 1.7 - 14), BH = 92;
        stroke(c.intro, roughLine({ x: c.rtl ? 940 : 60, y: Y }, { x: c.rtl ? 60 : 940, y: Y + 2 }, c.rand, 3), 'var(--ink)', 3.4, 0.6, 0.9);
        sc.items.forEach((it, i) => {
          const cx = c.rtl ? 920 - slot * (i + 0.5) : 80 + slot * (i + 0.5), up = i % 2 === 0, g = c.item(i), ink = INKS[i % INKS.length];
          const by = up ? Y - 70 - BH : Y + 70, box = { x: Math.max(20, Math.min(W - 20 - BW, cx - BW / 2)), y: by, w: BW, h: BH };
          el('circle', { cx, cy: Y, r: 11, class: 'pt', fill: ink, style: '--d:0.05s' }, g);
          stroke(g, roughLine({ x: cx, y: up ? Y - 14 : Y + 14 }, { x: cx, y: up ? by + BH : by }, c.rand, 2), ink, 2.4, 0.15, 0.3);
          const b = card(g, box, ink, c.rand, 0.4);
          labelLines(b, { label: it.label, detail: '' }, box.x + BW / 2, by + BH / 2 - 2, 0.9, 20, BW);
          if (it.detail) text(g, it.detail, cx, up ? Y + 36 : Y - 22, 20, 0.5, 'label value', null, slot - 8);
        });
      },

      /* جدول: صف عناوين ثم صف لكل عنصر */
      table(c, sc) {
        const n = sc.items.length, k = sc.cols.length, X0 = 60, X1 = 940, headW = 230, colW = (X1 - X0 - headW) / k, TOP = 118, HH = 62, rh = Math.min(96, 430 / n);
        const colX = (j) => (c.rtl ? X1 - headW - colW * (j + 0.5) : X0 + headW + colW * (j + 0.5)), headX = c.rtl ? X1 - headW / 2 : X0 + headW / 2;
        el('rect', { x: X0, y: TOP, width: X1 - X0, height: HH, rx: 12, class: 'box-fill', style: '--d:0.6s;--tone:var(--ink-a)' }, c.intro);
        stroke(c.intro, roughRect({ x: X0, y: TOP, w: X1 - X0, h: HH + rh * n }, c.rand, 2.4, 12), 'var(--ink)', 2.8, 0.5, 1);
        sc.cols.forEach((h, j) => {
          text(c.intro, h, colX(j), TOP + 40, 23, 1 + j * 0.15, 'label', null, colW - 20);
          const lx = c.rtl ? X1 - headW - colW * j : X0 + headW + colW * j;
          stroke(c.intro, roughLine({ x: lx, y: TOP + 4 }, { x: lx, y: TOP + HH + rh * n - 4 }, c.rand, 2), 'var(--ink-soft)', 2, 1.1 + j * 0.1, 0.5);
        });
        sc.items.forEach((it, i) => {
          const y = TOP + HH + rh * i, g = c.item(i), mid = y + rh / 2 + 7;
          stroke(g, roughLine({ x: X0 + 6, y }, { x: X1 - 6, y: y + 1 }, c.rand, 2), 'var(--ink-soft)', 2, 0, 0.4);
          el('rect', { x: X0 + 4, y: y + 4, width: X1 - X0 - 8, height: rh - 8, rx: 8, class: 'code-line' }, g);
          text(g, it.label, headX, mid, 22, 0.3, 'label', null, headW - 24);
          it.cells.forEach((cell, j) => {
            const lines = L.wrap(cell, Math.max(10, Math.floor(colW / 11)), 2);
            lines.forEach((line, m) => text(g, line, colX(j), mid - (lines.length - 1) * 11 + m * 22, 19, 0.5 + j * 0.2, 'detail cell', null, colW - 18));
          });
        });
      },

      /* هرم مستويات: ينبني من القاعدة للقمة */
      pyramid(c, sc) {
        const n = sc.items.length, TOP = 120, BASE = 590, lh = (BASE - TOP) / n, half = (y) => 60 + ((y - TOP) / (BASE - TOP)) * 330;
        sc.items.forEach((it, i) => {
          const y1 = BASE - i * lh, y0 = y1 - lh + 8, g = c.item(i), ink = INKS[i % INKS.length], cx = 500, cy = (y0 + y1) / 2;
          const lvl = el('g', { class: 'box-g', style: `transform-origin:${cx}px ${cy}px` }, g);
          const pts = [[cx - half(y0), y0], [cx + half(y0), y0], [cx + half(y1), y1], [cx - half(y1), y1]];
          el('path', { d: `M${pts.map((p) => p.map(r1)).join(' L')}Z`, class: 'box-fill', style: `--d:0.5s;--tone:${ink}` }, lvl);
          const j = () => r1((c.rand() - 0.5) * 5);
          stroke(lvl, `M${pts.concat([pts[0], pts[1]]).map((p) => [r1(p[0]) + j(), r1(p[1]) + j()]).join(' L')}`, ink, 2.8, 0.1, 0.9);
          const w = half(cy) * 2 - 40;
          text(lvl, it.label, cx, cy + (it.detail ? -2 : 8), 25, 0.8, 'label', null, w);
          if (it.detail) text(lvl, it.detail, cx, cy + 24, 16, 1, 'detail', null, w);
        });
      },

      big(c, sc) {
        const lines = L.wrap(sc.text, 18, 2), size = sc.text.length <= 10 ? 92 : sc.text.length <= 20 ? 68 : 54, lh = size * 1.25, y0 = 350 - ((lines.length - 1) * lh) / 2;
        const g = el('g', { class: 'box-g', style: 'transform-origin:500px 350px' }, c.intro);
        lines.forEach((line, k) => {
          const w = Math.min(820, line.length * size * 0.5 + 60);
          stroke(g, roughLine({ x: 500 + w / 2, y: y0 + k * lh - size * 0.22 }, { x: 500 - w / 2, y: y0 + k * lh - size * 0.2 }, c.rand, 3), 'var(--marker)', size * 0.62, 0.9 + k * 0.4, 0.6).classList.add('marker');
          text(g, line, 500, y0 + k * lh, size, 0.5 + k * 0.4, 'label big', null, 760);
        });
        stroke(g, roughEllipse({ x: 500, y: 350 - size * 0.18, rx: 420, ry: 80 + lines.length * lh * 0.55 }, c.rand, 5), 'var(--ink-a)', 3, 1.4, 1);
        if (sc.note) text(c.intro, sc.note, 500, 350 + 110 + lines.length * lh * 0.55, 22, 2, 'detail', null, 860);
      },
    };

    /* ---------- بناء السبورة ---------- */
    function load(lesson) {
      penRun++; cam++;
      svg.textContent = '';
      groups = []; frames = []; lastBeat = lesson.beats.length - 1;
      const g2 = L.grid(lesson.scenes.length), rtl = lesson.lang !== 'en', tail = lesson.takeaway ? 110 : 0;
      svg.style.direction = rtl ? 'rtl' : 'ltr'; // يضبط اتجاه النص وموضع علامة الاختصار «…»
      wide = lesson.scenes.length > 1;
      overview = L.fit(0, 0, g2.w, g2.h + tail, wide ? 46 : 0);
      const defs = el('defs', {}, svg), dots = el('pattern', { id: 'dots' + boards, width: 28, height: 28, patternUnits: 'userSpaceOnUse' }, defs);
      el('circle', { cx: 2, cy: 2, r: 1.4, class: 'grid-dot' }, dots);
      el('rect', { x: overview[0] - 600, y: overview[1] - 400, width: overview[2] + 1200, height: overview[3] + 800, fill: `url(#dots${boards})` }, svg);
      const layer = el('g', { class: 'layer' }, svg);
      const rand = rng([...lesson.title].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7));
      const group = (parent, beat, cls, ox, oy) => { const g = el('g', { class: 'beat pending ' + (cls || '') }, parent); g.dataset.beat = beat; g._ox = ox || 0; g._oy = oy || 0; groups.push(g); return g; };

      lesson.scenes.forEach((sc, s) => {
        const cell = g2.cells[s], holder = el('g', { class: 'scene', transform: `translate(${cell.x} ${cell.y})` }, layer);
        const cellFrame = L.fit(cell.x, cell.y, W, H, wide ? 18 : 0);
        // سهم الطريق من المشهد السابق لهذا المشهد
        if (s) {
          const p = g2.cells[s - 1], route = group(layer, sc.at, 'route');
          const a = p.row === cell.row ? { x: cell.x < p.x ? p.x - 16 : p.x + W + 16, y: p.y + H / 2 } : { x: p.x + W / 2, y: p.y + H + 12 };
          const b = p.row === cell.row ? { x: cell.x < p.x ? cell.x + W + 22 : cell.x - 22, y: cell.y + H / 2 } : { x: cell.x + W / 2, y: cell.y - 22 };
          arrow(route, a, b, rand, 18, 'var(--ink-soft)', 0, 4);
        }
        const intro = group(holder, sc.at, 'core', cell.x, cell.y);
        frames[sc.at] = cellFrame;
        title(intro, sc.title, rand, rtl);
        const ctx = {
          rand, rtl, intro,
          item: (j, cls) => group(holder, sc.items[j].at, cls, cell.x, cell.y),
          // إطار الكاميرا لعنصر: مستطيل داخل الخلية يتوسّع لنسبة السبورة ويبقى داخلها
          focus(j, x, y, w, h, pad) {
            const beat = sc.items[j].at; if (beat === sc.at) return;
            let f = L.fit(x, y, w, h, pad); if (f[2] < 620) f = L.fit(f[0] + f[2] / 2 - 310, f[1] + f[3] / 2 - 198.4, 620, 396.8, 0);
            if (f[2] >= W) { frames[beat] = cellFrame; return; }
            f[0] = Math.max(0, Math.min(W - f[2], f[0])); f[1] = Math.max(0, Math.min(H - f[3], f[1]));
            frames[beat] = [f[0] + cell.x, f[1] + cell.y, f[2], f[3]];
          },
        };
        SHAPES[sc.type](ctx, sc);
        sc.items.forEach((it) => { if (!frames[it.at]) frames[it.at] = cellFrame; });
      });

      if (lesson.takeaway) {
        const g = group(layer, lastBeat, 'extra'), cx = g2.w / 2, y = g2.h + 74, big = wide ? 1.7 : 1;
        const w = Math.min(g2.w - 80, lesson.takeaway.length * 15 * big + 90);
        // (النص نفسه يتقيّد بعرض السبورة)
        stroke(g, roughLine({ x: cx + w / 2, y: y - 9 * big }, { x: cx - w / 2, y: y - 7 * big }, rand, 2), 'var(--marker)', 32 * big, 3, 0.6).classList.add('marker');
        text(g, lesson.takeaway, cx, y, 23 * big, 3.4, 'takeaway', null, g2.w - 120);
      }
      pen = el('g', { class: 'pen-tip', visibility: 'hidden' }, svg);
      pen.innerHTML = '<path d="M0 0 7-19 19-14z" fill="var(--ink)"/><path d="M7-19 26-64 38-59 19-14z" fill="var(--ink-a)"/><path d="M26-64 29-72 41-67 38-59z" fill="var(--ink)"/>';
      view = overview.slice(); svg.setAttribute('viewBox', view.map(r1).join(' '));
    }

    /** القلم يتبع كل خط وهو ينرسم، ويمرّ على النص وهو ينكتب. */
    function runPen(i) {
      const run = ++penRun;
      if (calm || !pen) return;
      const segs = [];
      groups.filter((g) => Number(g.dataset.beat) === i && !g.classList.contains('extra')).forEach((g) => g.querySelectorAll('.ink, .hand').forEach((n) => {
        const from = Number(n.dataset.d) * 1000, dur = Number(n.dataset.t) * 1000;
        try {
          if (n.tagName === 'path') segs.push({ from, to: from + dur, len: n.getTotalLength(), n, ox: g._ox, oy: g._oy });
          else if (n.dataset.d !== undefined) segs.push({ from, to: from + dur, box: n.getBBox(), ox: g._ox, oy: g._oy });
        } catch (e) { /* غير مرسوم */ }
      }));
      if (!segs.length) return;
      segs.sort((a, b) => a.from - b.from);
      const end = Math.max(...segs.map((x) => x.to)), t0 = performance.now(), scale = () => view[2] / W;
      pen.setAttribute('visibility', 'visible');
      (function frame(now) {
        if (run !== penRun) return;
        const t = now - t0;
        if (t > end + 250) { pen.setAttribute('visibility', 'hidden'); return; }
        let seg = segs[0];
        for (const x of segs) if (x.from <= t) seg = x;
        const k = Math.max(0, Math.min(1, (t - seg.from) / (seg.to - seg.from || 1)));
        let x, y;
        if (seg.n) { const p = seg.n.getPointAtLength(k * seg.len); x = p.x; y = p.y; }
        else { x = seg.box.x + seg.box.width * (1 - k); y = seg.box.y + seg.box.height * (0.55 + 0.25 * Math.sin(k * 18)); }
        pen.setAttribute('transform', `translate(${r1(x + seg.ox)} ${r1(y + seg.oy)}) scale(${r1(Math.max(1, scale()))})`);
        requestAnimationFrame(frame);
      })(t0);
    }

    /* ---------- الكاميرا ---------- */
    function moveTo(target, ms) {
      const run = ++cam, from = view.slice(), t0 = performance.now();
      if (calm || !ms) { view = target.slice(); svg.setAttribute('viewBox', view.map(r1).join(' ')); return; }
      (function step(now) {
        if (run !== cam) return;
        const k = Math.min(1, (now - t0) / ms), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        view = from.map((v, n) => v + (target[n] - v) * e);
        svg.setAttribute('viewBox', view.map(r1).join(' '));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }

    /** يظهر كل ما قبل اللقطة i جاهزًا، ويرسم اللقطة i بالحركة والكاميرا تروح لها. */
    function show(i, animate) {
      groups.forEach((g) => {
        const b = Number(g.dataset.beat);
        g.classList.toggle('pending', b > i);
        g.classList.remove('drawing');
        g.classList.toggle('now', b === i && !g.classList.contains('extra'));
      });
      if (animate === false) { penRun++; if (pen) pen.setAttribute('visibility', 'hidden'); moveTo(overview, 0); return; }
      void svg.getBoundingClientRect(); // يعيد تشغيل الحركة لو نفس اللقطة انعرضت مرتين
      groups.forEach((g) => g.classList.toggle('drawing', Number(g.dataset.beat) === i));
      const far = Math.abs((frames[i] || overview)[0] - view[0]) + Math.abs((frames[i] || overview)[1] - view[1]) > 500;
      moveTo(frames[i] || overview, far ? 1500 : 1000);
      // آخر لقطة: بعد ما ينرسم العنصر نرجع للسبورة كاملة وتنكتب الخلاصة
      if (i === lastBeat) { const run = cam; setTimeout(() => { if (run === cam) moveTo(overview, 1400); }, 2400); }
      runPen(i);
    }
    /** الحركة المستمرة (الشرارة، الأيقونات، الطفو) تشتغل وقت الشرح فقط. */
    const setAlive = (on) => svg.classList.toggle('alive', !!on && !calm);
    return { load, show, setAlive };
  }

  F.Board = { create, ICONS: Object.keys(ICONS), SHAPES: L.TYPES };
})();
