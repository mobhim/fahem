/* فاهم — نموذج الدرس: سبورة كبيرة مفتوحة.
 * درس = عدة «مشاهد» على سبورة واحدة، كل مشهد بالشكل الأنسب لفكرته (خريطة، خطوات، أعمدة، خط، نسب، مقارنة، دورة، قائمة، عبارة كبيرة).
 * كل مشهد له تمهيد يُنطق، ثم عناصر تنرسم واحدًا واحدًا مع جملة لكل عنصر. بدون DOM، فيشتغل تحت `node --test`. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.F = root.F || {}).Lesson = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_ITEMS = 6, MAX_SCENES = 6;
  const TYPES = ['map', 'steps', 'cycle', 'compare', 'bars', 'line', 'pie', 'list', 'code', 'formula', 'lab', 'timeline', 'table', 'pyramid', 'big'];
  const VESSELS = ['beaker', 'flask', 'tube', 'pill', 'drop'];
  const RAW_LABEL = { code: 58, formula: 48 }; // أسطر الكود والمعادلات تبقى كما هي وبطول أكبر
  const CHARTS = ['bars', 'line', 'pie'];
  const ICON_NAMES = ['idea', 'in', 'out', 'stack', 'queue', 'bolt', 'clock', 'search', 'check', 'warn', 'loop', 'grid', 'chart', 'link'];
  const GENERIC_ICONS = ['idea', 'check', 'search', 'bolt', 'grid', 'loop'];
  const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };

  function cleanItem(it, cap) {
    if (!it || typeof it !== 'object') return null;
    const label = cap > 30 ? String(it.label == null ? '' : it.label).replace(/\s+$/, '').slice(0, cap) : clip(it.label, 30), value = it.value === '' || it.value == null ? NaN : Number(it.value);
    if (!label) return null;
    return { label, detail: clip(it.detail, 64), cells: (Array.isArray(it.cells) ? it.cells : []).map((x) => clip(x, 44)).slice(0, 4),
      vessel: VESSELS.includes(it.vessel) ? it.vessel : '', value: Number.isFinite(value) && value >= 0 ? value : null,
      side: it.side === 'b' ? 'b' : 'a', icon: ICON_NAMES.includes(it.icon) ? it.icon : '', say: clip(it.say, 300) };
  }

  /** ينظّف مشهدًا واحدًا، ولو بياناته ما تكفي لشكله ينزّله لشكل أبسط بدل ما يرسم شيئًا مضلّلًا. */
  function cleanScene(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let type = TYPES.includes(raw.type) ? raw.type : 'map';
    // سطر الكود يبقى كما هو (بمسافاته) وبطول أكبر من عنوان الفرع
    const items = (Array.isArray(raw.items) ? raw.items : []).map((it) => cleanItem(it, RAW_LABEL[type] || 30)).filter(Boolean).slice(0, type === 'code' ? 8 : type === 'lab' || type === 'pyramid' ? 5 : MAX_ITEMS);
    const cols = (Array.isArray(raw.cols) ? raw.cols : []).map((x) => clip(x, 22)).filter(Boolean).slice(0, 3);
    const title = clip(raw.title, 40), text = clip(raw.text, 44);
    const valued = items.filter((i) => i.value !== null).length === items.length;
    if (type === 'big' && !text && !title) type = 'list';
    if (CHARTS.includes(type) && (!valued || items.length < (type === 'line' ? 3 : 2) || !items.some((i) => i.value > 0))) type = 'list';
    if (type === 'compare' && !(items.some((i) => i.side === 'a') && items.some((i) => i.side === 'b'))) type = 'list';
    if (type !== 'big' && !items.length) { if (!title && !text) return null; type = 'big'; }
    if (['steps', 'cycle', 'lab', 'timeline', 'pyramid'].includes(type) && items.length < 2) type = 'list';
    if (type === 'table' && (cols.length < 1 || !items.every((i) => i.cells.length))) type = 'list';
    const scene = { type, title, say: clip(raw.say, 420) || title || text, items: type === 'big' ? [] : items };
    if (type === 'map') scene.hub = clip(raw.hub, 20) || clip(title, 20) || 'الفكرة';
    if (type === 'table') { scene.cols = cols; scene.items.forEach((i) => { i.cells = cols.map((_, k) => i.cells[k] || ''); }); }
    if (type === 'compare') { scene.a = clip(raw.a, 24) || 'الأول'; scene.b = clip(raw.b, 24) || 'الثاني'; }
    if (type === 'big') { scene.text = text || title; scene.note = clip(raw.note, 90); }
    if (CHARTS.includes(type)) { scene.unit = clip(raw.unit, 16); scene.approx = !!raw.approx; }
    return scene.say ? scene : null;
  }

  /** الصيغة القديمة (لقطات بفروع) تتحوّل إلى مشهد خريطة واحد. */
  function fromBeats(raw) {
    const beats = (Array.isArray(raw.beats) ? raw.beats : []).filter((b) => b && b.say);
    const items = []; let intro = '';
    beats.forEach((b) => {
      const n = b.node && typeof b.node === 'object' && b.node.label ? b.node : null;
      if (n) items.push({ label: n.label, detail: n.detail, icon: n.icon, say: b.say });
      else if (items.length) items[items.length - 1].say += ' ' + b.say;
      else intro += (intro ? ' ' : '') + b.say;
    });
    return [{ type: items.length ? 'map' : 'big', title: raw.title, hub: raw.hub, text: raw.title, say: intro || raw.title, items }];
  }

  /** يحوّل أي JSON راجع من النموذج إلى درس صالح، أو يرمي خطأ لو ما ينفع. */
  function normalize(raw, source, lang) {
    if (!raw || typeof raw !== 'object') throw new Error('الدرس الراجع غير صالح.');
    const scenes = (Array.isArray(raw.scenes) ? raw.scenes : fromBeats(raw)).map(cleanScene).filter(Boolean).slice(0, MAX_SCENES);
    if (!scenes.length) throw new Error('الدرس الراجع فاضي.');

    // اللقطات: تمهيد كل مشهد ثم عنصر بعد عنصر. العنصر اللي ما له جملة ينرسم مع اللي قبله.
    const beats = [];
    scenes.forEach((sc, s) => {
      sc.at = beats.length; beats.push({ say: sc.say, scene: s, item: -1 });
      sc.items.forEach((it, j) => { if (it.say) beats.push({ say: it.say, scene: s, item: j }); it.at = beats.length - 1; });
    });

    const quiz = (Array.isArray(raw.quiz) ? raw.quiz : []).map((q) => {
      const options = (Array.isArray(q && q.options) ? q.options : []).map((o) => clip(o, 90)).filter(Boolean).slice(0, 4);
      const answer = Number(q && q.answer);
      return q && q.q && options.length >= 2 && Number.isInteger(answer) && answer >= 0 && answer < options.length
        ? { q: clip(q.q, 160), options, answer, why: clip(q.why, 200) } : null;
    }).filter(Boolean).slice(0, 4);
    let cards = (Array.isArray(raw.cards) ? raw.cards : []).map((c) => (c && c.front && c.back ? { front: clip(c.front, 80), back: clip(c.back, 240) } : null)).filter(Boolean).slice(0, 8);
    let tf = (Array.isArray(raw.tf) ? raw.tf : []).map((t) => (t && t.s && typeof t.answer === 'boolean' ? { s: clip(t.s, 200), answer: t.answer, why: clip(t.why, 200) } : null)).filter(Boolean).slice(0, 6);
    // لو النموذج ما رجّع بطاقات أو صح/خطأ (أو الشرح محلي) نشتقّها من الدرس نفسه
    if (!cards.length) scenes.forEach((sc) => sc.items.forEach((it) => { if (cards.length < 8 && (it.say || it.detail)) cards.push({ front: it.label, back: it.say || it.detail }); }));
    if (!tf.length) quiz.forEach((q, k) => {
      const wrong = q.options.findIndex((_, i) => i !== q.answer), pick = k % 2 ? q.answer : wrong;
      const A = lang === 'en' ? 'Answer:' : 'الجواب:';
      tf.push({ s: `${q.q} ${A} ${q.options[pick]}`, answer: pick === q.answer, why: q.why || `${lang === 'en' ? 'The correct answer:' : 'الجواب الصحيح:'} ${q.options[q.answer]}` });
      if (quiz.length < 2) tf.push({ s: `${q.q} ${A} ${q.options[q.answer]}`, answer: true, why: q.why });
    });
    return { title: clip(raw.title, 46) || scenes[0].title || 'شرح الشريحة', scenes, beats, takeaway: clip(raw.takeaway, 90), quiz, cards, tf, source: source || 'ai', lang: lang || raw.lang || 'ar' };
  }

  /** لغة النص الغالبة: 'en' لو الحروف اللاتينية أكثر بوضوح، وإلا 'ar'. */
  function detectLang(text) {
    const t = String(text || ''), en = (t.match(/[A-Za-z]/g) || []).length, ar = (t.match(/[؀-ۿ]/g) || []).length;
    return en > ar * 1.5 && en > 12 ? 'en' : 'ar';
  }

  /** يقسّم الجملة إلى مقاطع حسب اللغة عشان كل مقطع ينطقه صوت لغته.
   *  المقاطع الإنجليزية الأقصر من minRun كلمات تبقى مع العربي (مصطلح داخل جملة). */
  function segments(text, minRun) {
    const runs = [];
    let at = 0;
    String(text).split(' ').forEach((tok) => {
      const lang = /[A-Za-z]/.test(tok) ? 'en' : /[؀-ۿ]/.test(tok) ? 'ar' : null;
      const last = runs[runs.length - 1];
      if (last && (lang === null || lang === last.lang)) { last.text += ' ' + tok; last.words++; }
      else runs.push({ lang: lang || 'ar', text: tok, at, words: 1 });
      at += tok.length + 1;
    });
    if (runs.length < 2) return runs;
    const out = [];
    runs.forEach((r) => {
      const lang = r.lang === 'en' && r.words < (minRun || 1) ? 'ar' : r.lang, last = out[out.length - 1];
      if (last && last.lang === lang) { last.text += ' ' + r.text; last.words += r.words; }
      else out.push({ lang, text: r.text, at: r.at, words: r.words });
    });
    return out;
  }

  /** شرح بدون ذكاء اصطناعي: يبني مشهدًا من نص الشريحة نفسه، بلغة الشريحة. لو السطور فيها أرقام يرسمها أعمدة. */
  function fromText(slide, lang) {
    const en = (lang || detectLang(slide.text)) === 'en';
    const lines = String(slide.text || '').split(/\n+/).map((l) => l.replace(/^[\s•\-–*·▪◦\d.)]+/, '').trim()).filter((l) => l.length > 2);
    const title = clip(slide.title || lines[0] || (en ? `Slide ${slide.index + 1}` : `الشريحة ${slide.index + 1}`), 40);
    const points = lines.filter((l) => l !== title && l !== slide.title).slice(0, MAX_ITEMS);
    const ord = en ? ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Finally'] : ['أول نقطة', 'ثاني نقطة', 'ثالث نقطة', 'رابع نقطة', 'خامس نقطة', 'آخر نقطة'];
    const say = (p, i) => `${ord[i]}${en ? ',' : ':'} ${clip(p, 280)}.`;
    const data = points.map((p) => p.match(/^(.{2,40}?)\s*[:\-–=]\s*(\d+(?:\.\d+)?)\s*(%?)\s*$/));
    let scene;
    if (points.length >= 2 && data.every(Boolean)) {
      scene = { type: 'bars', title, unit: data[0][3], say: en ? `This slide compares numbers. Let's read them.` : 'هذي الشريحة فيها أرقام، خلّنا نقرأها.',
        items: data.map((m, i) => ({ label: m[1], value: Number(m[2]), say: say(points[i], i) })) };
    } else if (points.length) {
      // العنوان القصير: ما قبل النقطتين أو الشرطة إن وُجد، وإلا أول ثلاث كلمات. والجملة كاملة تُقال بالصوت.
      const key = (p) => {
        const m = p.match(/^(.{3,30}?)\s*[:\-–—]\s+(.{4,})$/); if (m) return { label: m[1], detail: m[2] };
        const w = p.split(' '), n = w.length <= 4 ? w.length : 3; return { label: w.slice(0, n).join(' '), detail: w.slice(n).join(' ') };
      };
      const seq = points.length >= 3 && points.every((p) => /^(step|first|second|third|then|next|finally|ثم|بعد|أول|ثاني|ثالث|الخطوة)/i.test(p));
      scene = { type: seq ? 'steps' : points.length > 4 ? 'list' : 'map', title, hub: clip(title.split(' ').slice(0, 2).join(' '), 20),
        say: en ? `Let's walk through the slide "${title}" point by point.` : `خلّنا نمشي على شريحة «${title}» نقطة نقطة.`,
        items: points.map((p, i) => Object.assign(key(p), { icon: GENERIC_ICONS[i], say: say(p, i) })) };
    } else {
      scene = { type: 'big', text: title, say: en ? 'I could not find readable text on this slide. Turn on AI so I can explain it from the image.' : 'ما لقيت نص مقروء في هذي الشريحة. فعّل الذكاء الاصطناعي عشان أشرحها من الصورة.' };
    }
    const takeaway = !points.length ? '' : en ? `${points.length} key points on this slide` : `${points.length} نقاط أساسية في هذي الشريحة`;
    return normalize({ title, scenes: [scene], takeaway }, 'local', en ? 'en' : 'ar');
  }

  /* ---------- هندسة السبورة: كل مشهد خلية 1000×640، والخلايا تترتب أفعوانيًا من اليمين ---------- */
  const CELL = { w: 1000, h: 640, gap: 150 };
  function grid(count) {
    const cols = count <= 1 ? 1 : 2, rows = Math.ceil(count / cols);
    const cells = [];
    for (let k = 0; k < count; k++) {
      const row = Math.floor(k / cols), pos = k % cols, col = row % 2 ? pos : cols - 1 - pos; // الصف الأول من اليمين لليسار، والثاني يرجع
      cells.push({ x: col * (CELL.w + CELL.gap), y: row * (CELL.h + CELL.gap), row, col });
    }
    return { cells, w: cols * CELL.w + (cols - 1) * CELL.gap, h: rows * CELL.h + (rows - 1) * CELL.gap };
  }
  /** يوسّع مستطيلًا ليطابق نسبة السبورة (1000:640) مع هامش. */
  function fit(x, y, w, h, pad) {
    pad = pad || 0; x -= pad; y -= pad; w += pad * 2; h += pad * 2;
    const ratio = CELL.w / CELL.h;
    if (w / h > ratio) { const nh = w / ratio; y -= (nh - h) / 2; h = nh; } else { const nw = h * ratio; x -= (nw - w) / 2; w = nw; }
    return [x, y, w, h];
  }

  function wrap(text, perLine, maxLines) {
    const words = String(text || '').split(' ').filter(Boolean), lines = [];
    let cur = '';
    words.forEach((w) => {
      if (!cur) cur = w;
      else if ((cur + ' ' + w).length <= perLine) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = clip(lines[maxLines - 1] + ' …', perLine + 1); }
    return lines;
  }

  /* ---------- عرض تجريبي جاهز: يشتغل بدون رفع ملفات وبدون ذكاء اصطناعي ---------- */
  const DEMO_DECK = {
    id: 'demo', name: 'مثال: مقدمة في هياكل البيانات', demo: true,
    slides: [
      { title: 'ما هي هياكل البيانات؟', bullets: ['طريقة لتنظيم البيانات داخل الذاكرة', 'كل هيكل يسهّل عمليات معيّنة', 'الاختيار الصح يسرّع البرنامج'] },
      { title: 'المصفوفة Array', bullets: ['عناصر متجاورة في الذاكرة', 'الوصول بالفهرس في O(1)', 'الإضافة في الوسط مكلفة O(n)'] },
      { title: 'المكدّس Stack', bullets: ['آخر من يدخل أول من يخرج LIFO', 'عمليتان: push و pop', 'مثال: زر التراجع Undo'] },
      { title: 'الطابور Queue', bullets: ['أول من يدخل أول من يخرج FIFO', 'عمليتان: enqueue و dequeue', 'مثال: طابور الطباعة'] },
    ],
    lessons: [
      { title: 'ما هي هياكل البيانات؟', takeaway: 'الهيكل الصح = برنامج أسرع',
        scenes: [
          { type: 'map', title: 'ترتيب الغرفة', hub: 'هياكل البيانات',
            say: 'تخيّل غرفتك: لو ملابسك مرمية بكل مكان بتضيّع وقت وأنت تدوّر. هياكل البيانات هي ترتيب الغرفة، بس داخل ذاكرة الكمبيوتر.',
            items: [
              { icon: 'grid', label: 'تنظيم الذاكرة', detail: 'وين تنحط كل معلومة', say: 'أول شي، هي طريقة تنظيم. نحدد وين تنحط كل معلومة وكيف ترتبط باللي جنبها.' },
              { icon: 'search', label: 'لكل هيكل تخصص', detail: 'بحث، إضافة، حذف', say: 'وكل هيكل شاطر في شي. واحد سريع في البحث، وواحد سريع في الإضافة.' },
              { icon: 'clock', label: 'الاختيار يفرق', detail: 'ثانية أو ساعة', say: 'وعشان كذا اختيارك يفرق. نفس البرنامج ممكن ياخذ ثانية أو ساعة.' },
            ] },
          { type: 'bars', title: 'كم خطوة عشان تلقى عنصر بين ألف؟', unit: 'خطوة', approx: true,
            say: 'شوف الفرق بالأرقام. نبي نلقى عنصر واحد بين ألف عنصر.',
            items: [
              { label: 'قائمة غير مرتبة', value: 1000, say: 'لو القائمة مو مرتبة، ممكن تمر على الألف كلهم.' },
              { label: 'مصفوفة مرتبة', value: 10, say: 'لو مرتبة، تقسم النص كل مرة وتوصل في عشر خطوات تقريبًا.' },
              { label: 'جدول Hash', value: 1, say: 'ومع جدول هاش توصل من أول خطوة.' },
            ] },
          { type: 'steps', title: 'اللي بندرسه', say: 'والحين بنمر على ثلاثة هياكل مشهورة بالترتيب.',
            items: [
              { icon: 'grid', label: 'المصفوفة', detail: 'خزاين مرقّمة', say: 'نبدأ بالمصفوفة.' },
              { icon: 'stack', label: 'المكدّس', detail: 'كومة صحون', say: 'بعدها المكدّس.' },
              { icon: 'queue', label: 'الطابور', detail: 'طابور الكوفي', say: 'ونختم بالطابور.' },
            ] },
        ],
        quiz: [{ q: 'ليش نهتم باختيار هيكل البيانات؟', options: ['عشان شكل الكود', 'لأنه يأثر على سرعة العمليات', 'لأن اللغة تجبرنا'], answer: 1, why: 'كل هيكل يسرّع عمليات ويبطّئ غيرها.' }],
        tf: [{ s: 'فيه هيكل بيانات واحد هو الأفضل لكل العمليات.', answer: false, why: 'كل هيكل شاطر في عمليات وضعيف في غيرها.' }, { s: 'هياكل البيانات تحدد كيف تترتب المعلومات داخل الذاكرة.', answer: true, why: 'هذا تعريفها: طريقة تنظيم البيانات.' }, { s: 'اختيار الهيكل ما يأثر على سرعة البرنامج.', answer: false, why: 'نفس البرنامج ممكن يتغير وقته كثير حسب الهيكل.' }] },

      { title: 'المصفوفة Array', takeaway: 'قراءة سريعة، إضافة في الوسط بطيئة',
        scenes: [
          { type: 'map', title: 'صف خزاين مرقّمة', hub: 'Array',
            say: 'المصفوفة مثل صف خزاين مرقّمة ورا بعض، كل خزانة فيها عنصر واحد.',
            items: [
              { icon: 'grid', label: 'عناصر متجاورة', detail: 'صف واحد في الذاكرة', say: 'العناصر متجاورة في الذاكرة، ما بينها فراغات.' },
              { icon: 'bolt', label: 'وصول فوري O(1)', detail: 'تروح للفهرس مباشرة', say: 'ولأنها مرقّمة، تروح للخزانة رقم خمسة مباشرة بدون ما تمر على اللي قبلها.' },
            ] },
          { type: 'line', title: 'تكلفة الإضافة في الوسط', unit: 'عنصر يتزحزح', approx: true,
            say: 'لكن الإضافة في النص لها ثمن، ويكبر مع حجم المصفوفة.',
            items: [
              { label: '100 عنصر', value: 50, say: 'في مصفوفة من مئة، تزحّف خمسين عنصر تقريبًا.' },
              { label: '200', value: 100, say: 'تضاعف الحجم، تضاعف الشغل.' },
              { label: '300', value: 150, say: 'وكل ما كبرت زاد.' },
              { label: '400', value: 200, say: 'وهذا اللي نسميه O إن: التكلفة تمشي مع العدد.' },
            ] },
          { type: 'big', title: 'القاعدة', text: 'اقرأ كثير، عدّل قليل', note: 'هذا المكان اللي تلمع فيه المصفوفة', say: 'فالخلاصة: استخدم المصفوفة لما تقرأ كثير وتعدّل قليل.' },
        ],
        quiz: [{ q: 'كم تكلّف قراءة العنصر رقم 100 من مصفوفة؟', options: ['O(1)', 'O(n)', 'O(n²)'], answer: 0, why: 'الفهرس يوصلك للعنصر مباشرة.' }],
        tf: [{ s: 'عناصر المصفوفة متجاورة في الذاكرة.', answer: true, why: 'وهذا سبب سرعة الوصول بالفهرس.' }, { s: 'إضافة عنصر في وسط المصفوفة تكلّف O(1).', answer: false, why: 'لازم تزحّف العناصر اللي بعده، فالتكلفة O(n).' }, { s: 'المصفوفة مناسبة لما تقرأ كثير وتعدّل قليل.', answer: true, why: 'القراءة بالفهرس فورية والتعديل في الوسط مكلف.' }] },

      { title: 'المكدّس Stack', takeaway: 'LIFO: آخر من يدخل أول من يخرج',
        scenes: [
          { type: 'map', title: 'كومة صحون', hub: 'Stack',
            say: 'المكدّس مثل كومة صحون. تحط الصحن فوق، وتاخذ من فوق.',
            items: [
              { icon: 'stack', label: 'LIFO', detail: 'آخر داخل، أول خارج', say: 'القاعدة اسمها لايفو: آخر صحن حطيته هو أول صحن تاخذه.' },
              { icon: 'in', label: 'push', detail: 'يضيف عنصر في القمة', say: 'بوش تحط عنصر فوق.' },
              { icon: 'out', label: 'pop', detail: 'يشيل عنصر القمة', say: 'وبوب تشيل العنصر اللي فوق.' },
            ] },
          { type: 'steps', title: 'جرّبها خطوة خطوة', say: 'خلّنا نجربها على أرقام.',
            items: [
              { icon: 'in', label: 'push 1', detail: 'المكدّس: 1', say: 'نحط واحد.' },
              { icon: 'in', label: 'push 2', detail: 'المكدّس: 1، 2', say: 'فوقه اثنين.' },
              { icon: 'in', label: 'push 3', detail: 'المكدّس: 1، 2، 3', say: 'وفوقه ثلاثة.' },
              { icon: 'out', label: 'pop', detail: 'يطلع 3', say: 'ولما نسوي بوب، يطلع الثلاثة لأنه آخر واحد دخل.' },
            ] },
          { type: 'list', title: 'وين تشوفه؟', say: 'وتشوف المكدّس في أشياء تستخدمها كل يوم.',
            items: [
              { icon: 'loop', label: 'زر التراجع Undo', detail: 'آخر تعديل ينشال أول', say: 'زر التراجع: آخر تعديل هو أول ما ينشال.' },
              { icon: 'link', label: 'زر الرجوع في المتصفح', detail: 'آخر صفحة ترجع لها أول', say: 'وزر الرجوع في المتصفح نفس الفكرة.' },
            ] },
        ],
        quiz: [{ q: 'سوّينا push لـ 1 ثم 2 ثم 3. وش يرجّع pop؟', options: ['1', '2', '3'], answer: 2, why: 'آخر عنصر دخل (3) هو أول من يخرج.' }],
        tf: [{ s: 'المكدّس يطلّع أقدم عنصر دخل.', answer: false, why: 'المكدّس LIFO: يطلّع أحدث عنصر.' }, { s: 'عملية push تضيف عنصرًا في قمة المكدّس.', answer: true, why: 'الإضافة والحذف كلها من القمة.' }, { s: 'زر التراجع Undo مثال على استخدام المكدّس.', answer: true, why: 'آخر تعديل هو أول ما ينشال.' }] },

      { title: 'الطابور Queue', takeaway: 'FIFO: أول من يدخل أول من يخرج',
        scenes: [
          { type: 'steps', title: 'طابور الكوفي', say: 'الطابور مثل طابور الكوفي. اللي جا أول ينخدم أول.',
            items: [
              { icon: 'in', label: 'enqueue', detail: 'تدخل من آخر الطابور', say: 'إن كيو: تدخل من آخر الطابور.' },
              { icon: 'clock', label: 'تنتظر دورك', detail: 'اللي قبلك ينخدمون', say: 'تنتظر لين يخلص اللي قبلك.' },
              { icon: 'out', label: 'dequeue', detail: 'تطلع من المقدمة', say: 'ودي كيو: تطلع من المقدمة لما يجي دورك.' },
            ] },
          { type: 'compare', title: 'المكدّس ولا الطابور؟', a: 'Stack', b: 'Queue', say: 'والفرق بينه وبين المكدّس بسيط لكنه مهم.',
            items: [
              { side: 'a', label: 'LIFO', detail: 'يطلّع الأحدث', say: 'المكدّس يطلّع آخر واحد دخل.' },
              { side: 'b', label: 'FIFO', detail: 'يطلّع الأقدم', say: 'والطابور يطلّع أول واحد دخل.' },
              { side: 'a', label: 'طرف واحد', detail: 'الدخول والخروج من القمة', say: 'المكدّس يشتغل من طرف واحد.' },
              { side: 'b', label: 'طرفين', detail: 'دخول من الخلف وخروج من الأمام', say: 'والطابور من طرفين.' },
            ] },
          { type: 'cycle', title: 'طابور الطباعة', say: 'ومثاله العملي طابور الطباعة، يدور بنفس الترتيب طول اليوم.',
            items: [
              { label: 'ترسل ملف', say: 'ترسل ملفك.' },
              { label: 'ينضم للطابور', say: 'ينضم لآخر الطابور.' },
              { label: 'ينطبع الأقدم', say: 'الطابعة تاخذ أقدم ملف.' },
              { label: 'يطلع من الطابور', say: 'ويطلع، ويجي دور اللي بعده.' },
            ] },
        ],
        quiz: [{ q: 'وش الفرق بين المكدّس والطابور؟', options: ['المكدّس LIFO والطابور FIFO', 'الطابور أسرع دايم', 'ما فيه فرق'], answer: 0, why: 'المكدّس يطلّع الأحدث، والطابور يطلّع الأقدم.' }],
        tf: [{ s: 'الطابور يشتغل بقاعدة FIFO.', answer: true, why: 'أول من يدخل أول من يخرج.' }, { s: 'عملية dequeue تضيف عنصرًا في آخر الطابور.', answer: false, why: 'dequeue تطلّع من المقدمة، والإضافة اسمها enqueue.' }, { s: 'في طابور الطباعة، آخر ملف أرسلته ينطبع أول.', answer: false, why: 'الملف اللي أُرسل أول ينطبع أول.' }] },
    ],
  };

  /* ---------- أمثلة جاهزة لتخصصات أخرى ---------- */
  const PHARMA_DECK = {
    id: 'demo-pharma', name: 'مثال صيدلة: الباراسيتامول', demo: true, note: 'محتوى تعليمي مبسّط، وليس نصيحة طبية.',
    slides: [
      { title: 'الباراسيتامول: آلية العمل', bullets: ['مسكّن وخافض حرارة', 'يثبّط إنزيمات COX في الجهاز العصبي المركزي', 'تأثيره المضاد للالتهاب ضعيف'] },
      { title: 'الحركية الدوائية والأمان', bullets: ['امتصاص سريع بعد البلع', 'استقلاب في الكبد', 'الجرعة الزائدة تضر الكبد'] },
    ],
    lessons: [
      { title: 'الباراسيتامول: آلية العمل', takeaway: 'يقلّل البروستاغلاندين في الدماغ، فيخف الألم وتنزل الحرارة',
        scenes: [
          { type: 'lab', title: 'من الحبة إلى الدم', say: 'خلّنا نتخيل رحلة الحبة كأننا في المختبر. تبلع القرص، وبعدها يبدأ الشغل.',
            items: [
              { vessel: 'pill', label: 'القرص', detail: 'جرعة تُؤخذ بالفم', say: 'نبدأ بالقرص نفسه، تاخذه عن طريق الفم.' },
              { vessel: 'beaker', label: 'المعدة والأمعاء', detail: 'يذوب ويُمتص', say: 'يذوب ويُمتص من الأمعاء بسرعة.' },
              { vessel: 'tube', label: 'الدم', detail: 'ينتقل لكل الجسم', say: 'يدخل الدم وينتقل لكل الجسم.' },
              { vessel: 'flask', label: 'الدماغ', detail: 'هنا يشتغل أساسًا', say: 'ويوصل للدماغ، وهنا يسوي أغلب شغله.' },
            ] },
          { type: 'steps', title: 'وش يسوي في الدماغ؟', say: 'طيب، وش يصير هناك بالضبط؟',
            items: [
              { icon: 'warn', label: 'إصابة أو حمّى', detail: 'الجسم يرسل إشارة', say: 'لما يصير ألم أو حرارة، الجسم يطلب مواد اسمها بروستاغلاندين.' },
              { icon: 'loop', label: 'إنزيم COX', detail: 'يصنع البروستاغلاندين', say: 'واللي يصنعها إنزيم اسمه كوكس.' },
              { icon: 'check', label: 'الدواء يثبّطه', detail: 'يقل البروستاغلاندين', say: 'الباراسيتامول يثبّط هذا الإنزيم في الجهاز العصبي المركزي، فتقل هذي المواد.' },
              { icon: 'out', label: 'النتيجة', detail: 'ألم أقل وحرارة أقل', say: 'والنتيجة: الألم يخف والحرارة تنزل.' },
            ] },
          { type: 'compare', title: 'ليش مو مضاد التهاب؟', a: 'الباراسيتامول', b: 'الإيبوبروفين', say: 'وسؤال يتكرر في الاختبارات: وش فرقه عن الإيبوبروفين؟',
            items: [
              { side: 'a', label: 'يشتغل مركزيًا', detail: 'في الدماغ والحبل الشوكي', say: 'الباراسيتامول شغله مركزي.' },
              { side: 'b', label: 'يشتغل في الأطراف', detail: 'في مكان الالتهاب نفسه', say: 'والإيبوبروفين يشتغل في مكان الالتهاب نفسه.' },
              { side: 'a', label: 'التهاب: ضعيف', detail: 'ما يُعتمد عليه للالتهاب', say: 'فتأثير الباراسيتامول على الالتهاب ضعيف.' },
              { side: 'b', label: 'التهاب: واضح', detail: 'من مضادات الالتهاب NSAIDs', say: 'والإيبوبروفين مضاد التهاب واضح.' },
            ] },
        ],
        quiz: [{ q: 'وين يشتغل الباراسيتامول أساسًا؟', options: ['في مكان الالتهاب', 'في الجهاز العصبي المركزي', 'في المعدة'], answer: 1, why: 'يثبّط COX مركزيًا، ولذلك تأثيره المضاد للالتهاب ضعيف.' }],
        tf: [{ s: 'الباراسيتامول مضاد التهاب قوي مثل الإيبوبروفين.', answer: false, why: 'تأثيره المضاد للالتهاب ضعيف.' }, { s: 'الباراسيتامول يقلّل تصنيع البروستاغلاندين مركزيًا.', answer: true, why: 'هذا أساس تسكينه للألم وخفضه للحرارة.' }] },
      { title: 'الحركية الدوائية والأمان', takeaway: 'آمن بالجرعة الصحيحة، والجرعة الزائدة خطرها على الكبد',
        scenes: [
          { type: 'line', title: 'تركيز الدواء في الدم بعد جرعة', unit: 'التركيز', approx: true, say: 'بعد ما تاخذ الجرعة، تركيزه في الدم يطلع وبعدين ينزل.',
            items: [
              { label: 'البداية', value: 0, say: 'نبدأ من صفر.' },
              { label: 'نصف ساعة', value: 70, say: 'يرتفع بسرعة.' },
              { label: 'ساعة', value: 100, say: 'ويوصل قمته تقريبًا خلال نصف ساعة إلى ساعة.' },
              { label: '3 ساعات', value: 50, say: 'وبعدها ينزل للنص تقريبًا كل ساعتين إلى ثلاث، وهذا عمر النصف.' },
              { label: '6 ساعات', value: 20, say: 'ولهذا تتكرر الجرعة كل أربع إلى ست ساعات.' },
            ] },
          { type: 'pie', title: 'وين يروح في الكبد؟', unit: 'الاستقلاب', approx: true, say: 'الكبد هو اللي يتعامل معه، ومعظمه يطلع بطريق آمن.',
            items: [
              { label: 'اقتران آمن', value: 90, say: 'أغلبه يرتبط بمواد تخليه يطلع مع البول بأمان.' },
              { label: 'مسار NAPQI السام', value: 7, say: 'وجزء صغير يتحول لمادة سامة اسمها نابكي، والجلوتاثيون يعادلها.' },
              { label: 'يطلع بدون تغيير', value: 3, say: 'وجزء بسيط يطلع كما هو.' },
            ] },
          { type: 'table', title: 'الجرعة الطبيعية والجرعة الزائدة', cols: ['جرعة علاجية', 'جرعة زائدة'], say: 'والفرق بين الجرعة العلاجية والزائدة هو كل القصة.',
            items: [
              { label: 'NAPQI', cells: ['كمية قليلة', 'كمية كبيرة'], say: 'في الجرعة الزائدة المادة السامة تزيد.' },
              { label: 'الجلوتاثيون', cells: ['يكفي لمعادلتها', 'يُستنزف'], say: 'والجلوتاثيون يخلص وما يقدر يعادلها.' },
              { label: 'الكبد', cells: ['سليم', 'خطر تلف'], say: 'فتتضرر خلايا الكبد.' },
              { label: 'العلاج', cells: ['لا يحتاج', 'N-acetylcysteine'], say: 'والترياق هو إن أسيتيل سيستئين، يعوّض الجلوتاثيون.' },
            ] },
        ],
        quiz: [{ q: 'ليش الجرعة الزائدة تضر الكبد؟', options: ['لأن الدواء يتراكم في المعدة', 'لأن NAPQI يزيد والجلوتاثيون يُستنزف', 'لأن الكلى تتوقف'], answer: 1, why: 'المادة السامة تزيد عن قدرة الجلوتاثيون على معادلتها.' }],
        tf: [{ s: 'معظم الباراسيتامول يُستقلب في الكبد بمسارات آمنة.', answer: true, why: 'الاقتران هو المسار الرئيسي.' }, { s: 'ترياق التسمم بالباراسيتامول هو N-acetylcysteine.', answer: true, why: 'لأنه يعوّض الجلوتاثيون.' }, { s: 'NAPQI مادة آمنة تمامًا.', answer: false, why: 'هي المستقلب السام، ويعادلها الجلوتاثيون.' }] },
    ],
  };

  const MATH_DECK = {
    id: 'demo-math', name: 'مثال رياضيات: المعادلة التربيعية', demo: true,
    slides: [
      { title: 'القانون العام', bullets: ['صيغة المعادلة: ax² + bx + c = 0', 'المميّز Δ = b² − 4ac', 'الحل: x = (−b ± √Δ) / 2a'] },
      { title: 'مثال محلول: x² − 5x + 6 = 0', bullets: ['نحدد a و b و c', 'نحسب المميّز', 'نوجد الجذرين'] },
    ],
    lessons: [
      { title: 'القانون العام', takeaway: 'احسب المميّز أول، وهو يقول لك كم حل عندك',
        scenes: [
          { type: 'big', title: 'الشكل العام', text: 'ax² + bx + c = 0', note: 'أي معادلة فيها x تربيع تنكتب بهذا الشكل', say: 'أي معادلة تربيعية، مهما كان شكلها، نقدر نرتبها بهذي الصيغة: إيه إكس تربيع، زائد بي إكس، زائد سي، يساوي صفر.' },
          { type: 'formula', title: 'القانون', say: 'وحلها يمشي على قانون واحد ثابت.',
            items: [
              { label: 'Δ = b² − 4ac', detail: 'المميّز', say: 'أول شي نحسب المميّز دلتا: بي تربيع ناقص أربعة إيه سي.' },
              { label: 'x = (−b ± √Δ) / 2a', detail: 'الحل', say: 'وبعدها الحل: ناقص بي، زائد أو ناقص جذر دلتا، على اثنين إيه.' },
            ] },
          { type: 'pyramid', title: 'المميّز يحدد عدد الحلول', say: 'والمميّز هو اللي يقول لك كم حل بتلقى.',
            items: [
              { label: 'Δ > 0', detail: 'حلّان مختلفان', say: 'لو موجب، عندك حلّين مختلفين.' },
              { label: 'Δ = 0', detail: 'حل واحد مكرر', say: 'لو صفر، حل واحد مكرر.' },
              { label: 'Δ < 0', detail: 'لا حل حقيقي', say: 'ولو سالب، ما فيه حل حقيقي.' },
            ] },
        ],
        quiz: [{ q: 'إذا كان المميّز سالبًا، كم حلًا حقيقيًا للمعادلة؟', options: ['حلّان', 'حل واحد', 'لا يوجد'], answer: 2, why: 'ما نقدر ناخذ جذر عدد سالب في الأعداد الحقيقية.' }],
        tf: [{ s: 'المميّز يساوي b² − 4ac.', answer: true, why: 'هذا تعريفه.' }, { s: 'إذا كان المميّز صفرًا فللمعادلة حلّان مختلفان.', answer: false, why: 'يكون لها حل واحد مكرر.' }] },
      { title: 'مثال محلول: x² − 5x + 6 = 0', takeaway: 'الحلّان: x = 2 و x = 3',
        scenes: [
          { type: 'formula', title: 'نحل خطوة خطوة', say: 'خلّنا نطبق القانون على معادلة حقيقية: إكس تربيع ناقص خمسة إكس زائد ستة يساوي صفر.',
            items: [
              { label: 'a = 1 ,  b = −5 ,  c = 6', detail: 'نحدد المعاملات', say: 'أول خطوة نحدد المعاملات: إيه واحد، بي ناقص خمسة، وسي ستة.' },
              { label: 'Δ = (−5)² − 4(1)(6)', detail: 'نعوّض', say: 'نعوّض في المميّز.' },
              { label: 'Δ = 25 − 24 = 1', detail: 'موجب: حلّان', say: 'خمسة وعشرين ناقص أربعة وعشرين يساوي واحد. موجب، يعني حلّين.' },
              { label: 'x = (5 ± 1) / 2', detail: 'نعوّض في القانون', say: 'نعوّض في القانون: خمسة زائد أو ناقص واحد، على اثنين.' },
              { label: 'x = 3   ,   x = 2', detail: 'الجواب', say: 'فالحلّين ثلاثة واثنين.' },
            ] },
          { type: 'line', title: 'نفس الحل على الرسم', unit: 'y', say: 'ولو رسمنا الدالة، الحلول هي الأماكن اللي المنحنى يلمس فيها محور إكس.',
            items: [
              { label: 'x = 0', value: 6, say: 'عند صفر القيمة ستة.' },
              { label: '1', value: 2, say: 'تنزل لاثنين.' },
              { label: '2', value: 0, say: 'وعند اثنين تلمس الصفر، وهذا أول حل.' },
              { label: '3', value: 0, say: 'وعند ثلاثة تلمس الصفر مرة ثانية، وهذا ثاني حل.' },
              { label: '4', value: 2, say: 'وبعدها ترجع تطلع.' },
              { label: '5', value: 6, say: 'بنفس الشكل المتناظر.' },
            ] },
          { type: 'list', title: 'تحقق من حلك', say: 'وآخر شي، دايم تحقق.',
            items: [
              { icon: 'check', label: 'عوّض x = 2', detail: '4 − 10 + 6 = 0', say: 'نعوّض اثنين: أربعة ناقص عشرة زائد ستة، صفر. صح.' },
              { icon: 'check', label: 'عوّض x = 3', detail: '9 − 15 + 6 = 0', say: 'ونعوّض ثلاثة: تسعة ناقص خمسة عشر زائد ستة، صفر. صح.' },
              { icon: 'warn', label: 'خطأ شائع', detail: 'نسيان إشارة b السالبة', say: 'وانتبه من أشهر خطأ: نسيان إن بي سالبة، فناقص بي تصير موجب خمسة.' },
            ] },
        ],
        quiz: [{ q: 'في المعادلة x² − 5x + 6 = 0، كم قيمة −b؟', options: ['−5', '5', '6'], answer: 1, why: 'b = −5، فـ −b = 5.' }],
        tf: [{ s: 'حلّا المعادلة x² − 5x + 6 = 0 هما 2 و 3.', answer: true, why: 'التعويض بكل منهما يعطي صفرًا.' }, { s: 'مميّز هذه المعادلة يساوي 49.', answer: false, why: 'يساوي 25 − 24 = 1.' }] },
    ],
  };
  const DEMO_DECKS = [DEMO_DECK, PHARMA_DECK, MATH_DECK];

  return { MAX_ITEMS, MAX_SCENES, TYPES, VESSELS, ICON_NAMES, DEMO_DECKS, CELL, clip, normalize, fromText, detectLang, segments, grid, fit, wrap, DEMO_DECK };
});
