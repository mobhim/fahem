/* فاهم — قسم التسجيل: اختيار المواد ← التفضيلات ← جدول بدون تعارضات تعدّله على كيفك. */
(function () {
  'use strict';
  const { $, $$, esc, store, toast } = F;
  const S = F.Sched, I = F.Import;
  let query = '';

  const QUESTIONS = [
    { id: 'time', text: 'متى تحب محاضراتك؟', opts: [['am', 'الصباح'], ['pm', 'بعد الظهر'], ['any', 'ما تفرق']] },
    { id: 'off', text: 'ودّك بيوم أوف؟', opts: [['none', 'لا'], ['any', 'أي يوم'], [0, 'الأحد'], [1, 'الاثنين'], [2, 'الثلاثاء'], [3, 'الأربعاء'], [4, 'الخميس']] },
    { id: 'gaps', text: 'كيف تحب الفراغات بين المحاضرات؟', opts: [['tight', 'ورا بعض'], ['breaks', 'أبي فواصل راحة'], ['any', 'ما تفرق']] },
  ];
  const DEFAULT_PREFS = { time: 'any', off: 'any', gaps: 'tight', teachers: {} };

  let cat = S.buildCatalog(store.get('catalog', null) || F.DEMO_CATALOG);
  const st = Object.assign({ step: 'courses', selected: ['CS201', 'CS210', 'MATH102', 'STAT201', 'ENGL102'], prefs: DEFAULT_PREFS, alts: [], altIndex: 0, crns: [], history: [], future: [] },
    store.get('reg', {}));
  // لو الكتالوج تغيّر، نشيل أي شي ما عاد موجود
  st.selected = st.selected.filter((c) => cat.courses[c]);
  st.crns = st.crns.filter((c) => cat.sections[c]);
  if (st.step === 'editor' && !st.crns.length) st.step = 'courses';

  const save = () => store.set('reg', { step: st.step, selected: st.selected, prefs: st.prefs, alts: st.alts, altIndex: st.altIndex, crns: st.crns });
  const root = () => $('#reg-root');
  const credits = () => st.selected.reduce((n, c) => n + cat.courses[c].credits, 0);
  const colorOf = (code) => `var(--c${(cat.courses[code].order % 8) + 1})`;

  /* ---------- الخطوة ١: المواد ---------- */
  function viewCourses() {
    const cr = credits(), ok = cr >= cat.minCredits && cr <= cat.maxCredits;
    return `
      <div class="reg-head">
        <div><h2>اختر موادك</h2><p class="muted">${esc(cat.label || 'كتالوج مستورد')} · ${Object.keys(cat.courses).length} مادة${cat.label === F.DEMO_CATALOG.label ? ' · بيانات خيالية للتجربة' : ''}</p></div>
        <button type="button" class="btn ghost" data-act="import">استورد كتالوج جامعتك</button>
      </div>
      <div class="search"><label class="sr" for="course-q">ابحث عن مادة</label>
        <input id="course-q" type="search" placeholder="ابحث باسم المادة أو رمزها أو رقم الشعبة CRN أو اسم الدكتور" autocomplete="off" value="${esc(query)}">
        <span class="muted num" id="course-count"></span></div>
      <div class="course-grid" id="course-grid">
        ${Object.values(cat.courses).map((c) => {
          const on = st.selected.includes(c.code), open = S.bundles(cat, c.code).length;
          const hay = I.norm([c.name, c.code, c.code.replace(/\s+/g, '')].concat(c.lecs, c.labs, c.lecs.map((x) => cat.sections[x].instructor)).join(' '));
          return `<label class="course${on ? ' on' : ''}${open ? '' : ' full'}" style="--tone:${colorOf(c.code)}" data-hay="${esc(hay)}">
            <input type="checkbox" data-code="${esc(c.code)}" ${on ? 'checked' : ''} ${open ? '' : 'disabled'}>
            <span class="course-name">${esc(c.name)}</span>
            <span class="course-meta"><bdi>${esc(c.code)}</bdi> · ${c.credits} ساعات · ${open ? `${c.lecs.length} شعب${c.labs.length ? ' + عملي' : ''}` : 'كل الشعب مقفلة'}</span>
          </label>`;
        }).join('')}
      </div>
      <div class="reg-bar">
        <div class="credit-meter ${ok ? 'ok' : 'warn'}"><strong>${cr}</strong> ساعة <span class="muted">· المسموح من ${cat.minCredits} إلى ${cat.maxCredits}</span></div>
        <button type="button" class="btn primary" data-act="to-prefs" ${st.selected.length ? '' : 'disabled'}>التالي: تفضيلاتك</button>
      </div>`;
  }

  /** يخفي المواد اللي ما تطابق البحث (بدون إعادة رسم، عشان ما يضيع التركيز من الخانة). */
  function filterCourses() {
    const words = I.norm(query).split(' ').filter(Boolean);
    let shown = 0;
    $$('#course-grid .course').forEach((el) => {
      const hit = words.every((w) => el.dataset.hay.includes(w));
      el.hidden = !hit; if (hit) shown++;
    });
    const count = $('#course-count');
    if (count) count.textContent = words.length ? (shown ? `${shown} نتيجة` : 'ما لقينا مادة بهذا البحث') : '';
  }

  /* ---------- الخطوة ٢: التفضيلات ---------- */
  const prefChips = () => QUESTIONS.map((q) => `
    <fieldset class="qa"><legend>${q.text}</legend><div class="chips">
      ${q.opts.map(([v, label]) => `<button type="button" class="chip" data-pref="${q.id}" data-value="${v}" aria-pressed="${String(st.prefs[q.id]) === String(v)}">${label}</button>`).join('')}
    </div></fieldset>`).join('');

  /** لكل مادة: أسماء دكاترتها، والطالب يعلّم اللي يفضّلهم. */
  function teacherChips(codes) {
    const rows = codes.map((code) => ({ code, names: S.instructorsOf(cat, code) })).filter((r) => r.names.length > 1 || (st.prefs.teachers || {})[r.code]);
    if (!rows.length) return '';
    return `<fieldset class="qa"><legend>تفضّل دكتور معيّن؟</legend>
      <p class="muted">اختر بالاسم من تفضّله لكل مادة. فاهم يقدّم شعبته على باقي التفضيلات متى ما كانت متاحة وبدون تعارض.</p>
      ${rows.map((r) => `<div class="teach"><strong>${esc(cat.courses[r.code].name)}</strong><div class="chips">
        ${r.names.map((n) => `<button type="button" class="chip" data-teacher="${esc(n)}" data-code="${esc(r.code)}" aria-pressed="${((st.prefs.teachers || {})[r.code] || []).includes(n)}">${esc(n)}</button>`).join('')}
      </div></div>`).join('')}</fieldset>`;
  }

  const viewPrefs = () => `
    <div class="reg-head"><div><h2>كيف تبي جدولك؟</h2><p class="muted">ثلاث أسئلة، وبعدها نرتّب لك أفضل البدائل.</p></div></div>
    <div class="prefs">${prefChips()}${teacherChips(st.selected)}</div>
    <div class="reg-bar"><button type="button" class="btn ghost" data-act="to-courses">رجوع للمواد</button>
      <button type="button" class="btn primary" data-act="generate">رتّب جدولي</button></div>`;

  /* ---------- الخطوة ٣: المحرر ---------- */
  function timetable() {
    const meets = st.crns.flatMap((crn) => cat.sections[crn].meetings.map((m) => ({ crn, m })));
    const t0 = Math.min(8 * 60, ...meets.map((x) => Math.floor(x.m.start / 60) * 60));
    const t1 = Math.max(16 * 60, ...meets.map((x) => Math.ceil(x.m.end / 60) * 60));
    const span = t1 - t0, hours = [];
    for (let t = t0; t < t1; t += 60) hours.push(t);
    const bad = new Set(S.validate(st.crns, cat).filter((i) => i.type !== 'credits').flatMap((i) => i.crns));
    const pct = (min) => ((min - t0) / span) * 100;
    return `<div class="tt-scroll"><div class="tt" style="--rows:${hours.length}">
      <div class="tt-gutter"><span class="tt-corner"></span>${hours.map((t) => `<span class="tt-hour">${S.fmt12(t)}</span>`).join('')}</div>
      ${S.DAYS.map((day, d) => `<div class="tt-day"><span class="tt-dayname">${day}</span><div class="tt-col">
        ${meets.filter((x) => x.m.day === d).map(({ crn, m }) => {
          const sec = cat.sections[crn], c = cat.courses[sec.code];
          return `<button type="button" class="tt-card${bad.has(crn) ? ' bad' : ''}" data-crn="${crn}" style="--tone:${colorOf(c.code)};top:${pct(m.start)}%;height:${pct(m.end) - pct(m.start)}%"
            aria-label="${esc(c.name)} ${sec.kind === 'lab' ? 'عملي' : 'محاضرة'}، ${day} ${S.fmt12(m.start)}. اضغط لتغيير الشعبة">
            <b>${esc(c.name)}</b><small><bdi dir="ltr">${S.fmt(m.start)}–${S.fmt(m.end)}</bdi>${sec.kind === 'lab' ? ' · عملي' : ''}</small><small class="tt-room">${esc(sec.room)}</small></button>`;
        }).join('')}
      </div></div>`).join('')}
    </div></div>`;
  }

  function viewEditor() {
    const issues = S.validate(st.crns, cat), block = S.blocking(issues), sum = S.summarize(st.crns, cat);
    const codes = S.codesOf(st.crns, cat);
    const edited = st.alts[st.altIndex] && st.alts[st.altIndex].join() !== st.crns.join();
    return `
      <div class="reg-head">
        <div><h2>جدولك</h2><p class="muted">اضغط أي محاضرة عشان تغيّر شعبتها. فاهم يفحص التعارضات مع كل تعديل.</p></div>
        <div class="row"><button type="button" class="btn ghost" data-act="undo" ${st.history.length ? '' : 'disabled'}>تراجع</button>
          <button type="button" class="btn ghost" data-act="redo" ${st.future.length ? '' : 'disabled'}>إعادة</button></div>
      </div>
      <div class="alts" role="group" aria-label="البدائل">
        ${st.alts.map((a, i) => { const x = S.summarize(a, cat); return `<button type="button" class="alt" data-alt="${i}" aria-pressed="${i === st.altIndex}">
          <strong>بديل ${i + 1}${i === st.altIndex && edited ? ' · معدّل' : ''}</strong>
          <small>${x.offDays.length ? `أوف: ${x.offDays.join('، ')}` : 'بدون أوف'} · ${x.earliest == null ? '' : `يبدأ ${S.fmt12(x.earliest)}`}</small></button>`; }).join('')}
      </div>
      ${block.length
        ? `<ul class="issues" role="alert">${block.map((i) => `<li>${esc(i.message)}</li>`).join('')}</ul>`
        : `<p class="okbar" role="status">كل شي تمام، ما فيه تعارضات.${issues.length ? ' ' + esc(issues[0].message) : ''}</p>`}
      <div class="editor">
        ${timetable()}
        <aside class="side">
          <dl class="stats"><div><dt>الساعات</dt><dd>${sum.credits}</dd></div><div><dt>أيام الدوام</dt><dd>${sum.dayCount}</dd></div>
            <div><dt>فراغات</dt><dd>${Math.round(sum.gaps / 6) / 10} س</dd></div></dl>
          <ul class="mine">
            ${codes.length ? codes.map((code) => {
              const c = cat.courses[code], mine = st.crns.filter((x) => cat.sections[x].code === code);
              return `<li style="--tone:${colorOf(code)}"><div><strong>${esc(c.name)}</strong>
                <small><bdi>${esc(code)}</bdi> · ${esc(cat.sections[mine[0]].instructor)}${gotTeacher(code) ? ' <em class="tag ok">مفضّلك</em>' : ''}</small>
                <small>${mine.map((x) => `<button type="button" class="crn" data-copy="${x}" title="انسخ رقم الشعبة">${x}</button>`).join(' ')}</small></div>
                <button type="button" class="icon-btn" data-remove="${esc(code)}" aria-label="احذف ${esc(c.name)}">×</button></li>`;
            }).join('') : '<li class="empty">جدولك فاضي. أضف مادة.</li>'}
          </ul>
          <button type="button" class="btn ghost wide" data-act="add">أضف مادة</button>
          <button type="button" class="btn ghost wide" data-act="reprefs">غيّر تفضيلاتي</button>
        </aside>
      </div>
      <div class="reg-bar">
        <button type="button" class="btn ghost" data-act="restart">ابدأ من جديد</button>
        <div class="row">
          <button type="button" class="btn ghost" data-act="copy-all">انسخ أرقام الشعب</button>
          <button type="button" class="btn ghost" data-act="csv" ${block.length ? 'disabled' : ''}>ملف CSV</button>
          <button type="button" class="btn primary" data-act="ics" ${block.length ? 'disabled' : ''}>أضفه إلى تقويمي</button>
        </div>
      </div>`;
  }

  function render() {
    const steps = [['courses', 'المواد'], ['prefs', 'التفضيلات'], ['editor', 'الجدول']];
    const at = steps.findIndex((x) => x[0] === st.step);
    root().innerHTML = `<ol class="steps">${steps.map(([id, label], i) => `<li class="${i === at ? 'on' : i < at ? 'past' : ''}"${i === at ? ' aria-current="step"' : ''}>${label}</li>`).join('')}</ol>`
      + ({ courses: viewCourses, prefs: viewPrefs, editor: viewEditor }[st.step])();
    save();
    if (st.step === 'courses') filterCourses();
    document.dispatchEvent(new Event('fahem:schedule'));
  }

  /* ---------- تعديلات المحرر ---------- */
  function apply(next, msg) {
    st.history.push(st.crns); if (st.history.length > 40) st.history.shift();
    st.future = []; st.crns = next;
    render(); if (msg) toast(msg);
  }

  /** هل شعبة المحاضرة الحالية للمادة عند دكتور مفضّل؟ */
  function gotTeacher(code) {
    const want = (st.prefs.teachers || {})[code] || [];
    return st.crns.some((x) => cat.sections[x].code === code && cat.sections[x].kind === 'lec' && want.includes(cat.sections[x].instructor));
  }

  function generate() {
    const res = S.generate(st.selected, st.prefs, cat, 4);
    if (!res.alts.length) return toast(res.reason);
    st.alts = res.alts; st.altIndex = 0; st.crns = res.alts[0]; st.history = []; st.future = []; st.step = 'editor';
    render();
    const missed = Object.keys(st.prefs.teachers || {}).filter((code) => st.selected.includes(code) && !gotTeacher(code)).map((code) => cat.courses[code].name);
    toast(missed.length ? `رتّبنا ${res.alts.length} بدائل، لكن ما قدرنا نحقق دكتورك المفضّل في: ${missed.join('، ')}.`
      : `رتّبنا لك ${res.alts.length} ${res.alts.length > 1 ? 'بدائل' : 'بديل'} حسب تفضيلاتك.`);
  }

  function openSection(crn) {
    const sec = cat.sections[crn], c = cat.courses[sec.code];
    const body = F.sheet.open(`<h3>${esc(c.name)} · ${sec.kind === 'lab' ? 'شعب العملي' : 'شعب المحاضرة'}</h3>
      <ul class="options">${S.alternatives(st.crns, crn, cat).map((a) => {
        const x = cat.sections[a.crn], fav = ((st.prefs.teachers || {})[x.code] || []).includes(x.instructor);
        const tag = a.current ? '<em class="tag now">الحالية</em>' : !a.open ? '<em class="tag no">مقفلة</em>' : a.clash ? '<em class="tag warn">تتعارض</em>' : '<em class="tag ok">متاحة</em>';
        return `<li><button type="button" class="option" data-pick="${a.crn}" ${a.current || !a.open ? 'disabled' : ''}>
          <span><strong>${S.describe(x)}</strong>
          <small>${esc(x.instructor)}${fav ? ' (مفضّلك)' : ''} · ${esc(x.room)} · شعبة ${esc(x.label || a.crn)} · CRN ${a.crn}</small></span>${tag}</button></li>`;
      }).join('')}</ul>`);
    body.onclick = (e) => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      F.sheet.close(); apply(S.swapSection(st.crns, crn, b.dataset.pick, cat), 'تم تغيير الشعبة.');
    };
  }

  function openAdd() {
    const have = S.codesOf(st.crns, cat), rest = Object.values(cat.courses).filter((c) => !have.includes(c.code));
    const body = F.sheet.open(`<h3>أضف مادة</h3><ul class="options">${rest.length ? rest.map((c) => {
      const r = S.addCourse(st.crns, c.code, cat);
      const tag = r.none ? '<em class="tag no">مقفلة</em>' : r.clean ? '<em class="tag ok">تركب بدون تعارض</em>' : '<em class="tag warn">تتعارض</em>';
      return `<li><button type="button" class="option" data-add="${esc(c.code)}" ${r.none ? 'disabled' : ''}><span><strong>${esc(c.name)}</strong><small><bdi>${esc(c.code)}</bdi> · ${c.credits} ساعات</small></span>${tag}</button></li>`;
    }).join('') : '<li class="empty">كل مواد الكتالوج موجودة بجدولك.</li>'}</ul>`);
    body.onclick = (e) => {
      const b = e.target.closest('[data-add]'); if (!b) return;
      const r = S.addCourse(st.crns, b.dataset.add, cat);
      st.selected = [...new Set(st.selected.concat(b.dataset.add))];
      F.sheet.close(); apply(r.crns, r.clean ? 'أضفنا المادة بدون تعارض.' : 'أضفنا المادة لكنها تتعارض. غيّر شعبتها.');
    };
  }

  function openPrefs() {
    const body = F.sheet.open(`<h3>تفضيلاتك</h3><div class="prefs">${prefChips()}${teacherChips(S.codesOf(st.crns, cat))}</div>
      <div class="reg-bar"><span></span><button type="button" class="btn primary" data-act="regen">رتّب من جديد</button></div>`);
    body.onclick = (e) => {
      if (onPref(e)) return;
      if (e.target.closest('[data-act="regen"]')) { st.selected = S.codesOf(st.crns, cat); F.sheet.close(); generate(); }
    };
  }

  /* ---------- استيراد جدول الشعب الجامعي ---------- */
  const htmlRows = (html) => [...new DOMParser().parseFromString(html, 'text/html').querySelectorAll('tr')]
    .map((tr) => [...tr.children].map((td) => td.textContent));

  async function pdfRows(file) {
    if (!window.pdfjsLib) throw new Error('قارئ PDF ما تحمّل. تأكد من اتصالك وحدّث الصفحة.');
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise, rows = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const lines = new Map();
      (await (await pdf.getPage(n)).getTextContent()).items.forEach((it) => {
        if (!it.str.trim()) return;
        const y = Math.round(it.transform[5] / 3);
        if (!lines.has(y)) lines.set(y, []);
        lines.get(y).push({ x: it.transform[4], w: it.width, s: it.str });
      });
      [...lines.entries()].sort((p, q) => q[0] - p[0]).forEach(([, items]) => {
        items.sort((p, q) => p.x - q.x);
        const cells = [];
        items.forEach((it, i) => { if (i && it.x - (items[i - 1].x + items[i - 1].w) < 6) cells[cells.length - 1] += ' ' + it.s; else cells.push(it.s); });
        rows.push(cells);
      });
    }
    if (!rows.length) throw new Error('ملف الـPDF هذا صورة بدون نص. احفظ الصفحة HTML أو الصقها.');
    return rows;
  }

  async function fileDef(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'json') return JSON.parse(await file.text());
    if (ext === 'xlsx' || ext === 'xls') {
      if (!window.XLSX) throw new Error('قارئ Excel ما تحمّل. تأكد من اتصالك وحدّث الصفحة.');
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = wb.SheetNames.flatMap((n) => window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: '' }));
      return I.parseTable(rows).def;
    }
    if (ext === 'pdf') return I.parseTable(await pdfRows(file)).def;
    const text = await file.text();
    if (ext === 'html' || ext === 'htm' || /<table[\s>]/i.test(text)) return I.parseTable(htmlRows(text)).def;
    try { return I.parseTable(I.rowsFromText(text)).def; }
    catch (e) { return S.parseCatalogCSV(text); } // صيغة فاهم البسيطة
  }

  function finishImport(defs, label) {
    const def = I.merge(defs); def.label = label;
    const built = S.buildCatalog(def), n = Object.keys(built.courses).length;
    if (!n) throw new Error('ما لقينا مواد في الجدول.');
    useCatalog(def); F.sheet.close();
    toast(`حوّلنا الجدول: ${Object.keys(built.sections).length} شعبة من ${n} مادة.`);
  }

  function openImport() {
    const body = F.sheet.open(`<h3>ارفع جدول الشعب من موقع الجامعة</h3>
      <p class="muted">ارفع صفحة جدول الشعب (الجدول الأزرق) كما هي، وفاهم يحوّلها إلى مواد وشعب. تقدر ترفع أكثر من كلية مع بعض.</p>
      <label class="btn primary wide">اختر الملف: HTML أو Excel أو PDF أو CSV<input type="file" id="cat-file" accept=".html,.htm,.xlsx,.xls,.pdf,.csv,.txt,.json" multiple hidden></label>
      <p class="muted">أو افتح الصفحة في المتصفح، حدّدها كاملة (Ctrl+A)، انسخها (Ctrl+C)، والصقها هنا:</p>
      <label class="sr" for="cat-paste">الصق صفحة جدول الشعب</label>
      <textarea id="cat-paste" rows="3" dir="auto" placeholder="الصق صفحة جدول الشعب هنا"></textarea>
      <p class="issues" id="cat-error" role="alert" hidden></p>
      <p class="muted">الملف يُقرأ داخل متصفحك ولا يُرفع لأي خادم.</p>
      <div class="reg-bar"><button type="button" class="btn ghost" data-act="demo-cat">رجوع للكتالوج التجريبي</button></div>`);
    const fail = (err) => { const p = $('#cat-error', body); p.hidden = false; p.textContent = err.message || 'ما قدرنا نقرأ الجدول.'; };
    $('#cat-file', body).addEventListener('change', async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      try { finishImport(await Promise.all(files.map(fileDef)), files.map((f) => f.name.replace(/\.[^.]+$/, '')).join(' + ')); }
      catch (err) { fail(err); }
      e.target.value = '';
    });
    $('#cat-paste', body).addEventListener('paste', (e) => {
      const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain');
      e.preventDefault();
      try {
        let def;
        try { if (!html) throw new Error('no html'); def = I.parseTable(htmlRows(html)).def; }
        catch (first) { def = I.parseTable(I.rowsFromText(text)).def; }
        finishImport([def], 'جدول الشعب');
      } catch (err) { fail(err); }
    });
    body.onclick = (e) => { if (e.target.closest('[data-act="demo-cat"]')) { store.del('catalog'); useCatalog(null); F.sheet.close(); toast('رجعنا للكتالوج التجريبي.'); } };
  }
  function useCatalog(def) {
    if (def) store.set('catalog', def);
    cat = S.buildCatalog(def || F.DEMO_CATALOG);
    Object.assign(st, { step: 'courses', selected: [], alts: [], crns: [], history: [], future: [] });
    render();
  }

  function onPref(e) {
    const t = e.target.closest('[data-teacher]');
    if (t) {
      const all = Object.assign({}, st.prefs.teachers), list = (all[t.dataset.code] || []).slice(), at = list.indexOf(t.dataset.teacher);
      if (at < 0) list.push(t.dataset.teacher); else list.splice(at, 1);
      if (list.length) all[t.dataset.code] = list; else delete all[t.dataset.code];
      st.prefs = Object.assign({}, st.prefs, { teachers: all });
      t.setAttribute('aria-pressed', at < 0); save(); return true;
    }
    const b = e.target.closest('[data-pref]'); if (!b) return false;
    const v = b.dataset.value;
    st.prefs = Object.assign({}, st.prefs, { [b.dataset.pref]: /^\d$/.test(v) ? Number(v) : v });
    $$(`[data-pref="${b.dataset.pref}"]`).forEach((x) => x.setAttribute('aria-pressed', x === b));
    save(); return true;
  }

  function nextSunday() { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return d; }

  const ACTIONS = {
    import: openImport, add: openAdd, reprefs: openPrefs, generate,
    'to-prefs': () => { st.step = 'prefs'; render(); },
    'to-courses': () => { st.step = 'courses'; render(); },
    undo: () => { st.future.push(st.crns); st.crns = st.history.pop(); render(); },
    redo: () => { st.history.push(st.crns); st.crns = st.future.pop(); render(); },
    restart: () => {
      const body = F.sheet.open(`<h3>تبدأ من جديد؟</h3><p class="muted">بنرجّعك لاختيار المواد. جدولك الحالي بينحذف من هذا المتصفح.</p>
        <div class="reg-bar"><button type="button" class="btn ghost" data-no>خلّه</button><button type="button" class="btn primary" data-yes>ابدأ من جديد</button></div>`);
      body.onclick = (e) => {
        if (e.target.closest('[data-no]')) F.sheet.close();
        if (e.target.closest('[data-yes]')) { Object.assign(st, { step: 'courses', alts: [], crns: [], history: [], future: [] }); F.sheet.close(); render(); }
      };
    },
    'copy-all': () => F.copy(st.crns.join('\n'), 'تم نسخ أرقام الشعب.'),
    csv: () => F.saveFile('fahem-schedule.csv', S.toCSV(st.crns, cat), 'text/csv;charset=utf-8'),
    ics: () => F.saveFile('fahem-schedule.ics', S.toICS(st.crns, cat, nextSunday()), 'text/calendar;charset=utf-8'),
  };

  function init() {
    root().addEventListener('click', (e) => {
      if (onPref(e)) return;
      const act = e.target.closest('[data-act]');
      if (act && !act.disabled) return ACTIONS[act.dataset.act]();
      const card = e.target.closest('[data-crn]'); if (card) return openSection(card.dataset.crn);
      const alt = e.target.closest('[data-alt]');
      if (alt) { const i = Number(alt.dataset.alt); st.altIndex = i; return apply(st.alts[i], `بديل ${i + 1}`); }
      const rm = e.target.closest('[data-remove]');
      if (rm) { st.selected = st.selected.filter((c) => c !== rm.dataset.remove); return apply(S.removeCourse(st.crns, rm.dataset.remove, cat), 'حذفنا المادة.'); }
      const cp = e.target.closest('[data-copy]'); if (cp) F.copy(cp.dataset.copy, 'تم نسخ رقم الشعبة.');
    });
    root().addEventListener('input', (e) => { if (e.target.id === 'course-q') { query = e.target.value; filterCourses(); } });
    root().addEventListener('change', (e) => {
      const box = e.target.closest('[data-code]'); if (!box) return;
      st.selected = box.checked ? st.selected.concat(box.dataset.code) : st.selected.filter((c) => c !== box.dataset.code);
      render();
    });
    render();
  }

  /** أقرب محاضرة قادمة من الجدول المحفوظ، للصفحة الرئيسية. */
  function nextClass(now) {
    if (st.step !== 'editor' || !st.crns.length) return null;
    const day = now.getDay(), min = now.getHours() * 60 + now.getMinutes();
    let best = null;
    st.crns.forEach((crn) => cat.sections[crn].meetings.forEach((m) => {
      let wait = (m.day - day + 7) % 7 * 1440 + (m.start - min);
      if (wait < 0) wait += 7 * 1440;
      if (!best || wait < best.wait) best = { wait, m, sec: cat.sections[crn], course: cat.courses[cat.sections[crn].code] };
    }));
    return best;
  }

  F.Reg = { init, nextClass };
})();
