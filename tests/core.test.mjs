import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../src/core/scheduler.js');
const L = require('../src/core/lesson.js');
const I = require('../src/core/import.js');
const cat = S.buildCatalog(require('../src/core/catalog-demo.js'));
const clean = (crns) => S.blocking(S.validate(crns, cat)).length === 0;

test('generate returns conflict-free alternatives covering every course', () => {
  const codes = ['CS201', 'CS210', 'MATH102', 'STAT201', 'ENGL102'];
  const { alts } = S.generate(codes, { time: 'any', off: 'any', gaps: 'tight' }, cat, 4);
  assert.ok(alts.length >= 2);
  alts.forEach((a) => { assert.ok(clean(a)); assert.deepEqual(S.codesOf(a, cat).sort(), [...codes].sort()); });
  assert.equal(new Set(alts.map((a) => [...a].sort().join())).size, alts.length);
});

test('a requested day off is honoured when possible', () => {
  const { alts } = S.generate(['CS201', 'MATH102', 'STAT201', 'ENGL102'], { time: 'any', off: 4, gaps: 'any' }, cat, 1);
  assert.equal(S.summarize(alts[0], cat).loads[4], 0);
});

test('morning preference beats afternoon sections', () => {
  const am = S.generate(['MATH102', 'STAT201'], { time: 'am', off: 'none', gaps: 'any' }, cat, 1).alts[0];
  assert.ok(S.summarize(am, cat).latest <= 13 * 60);
});

test('validate flags conflicts, closed sections and a missing lab', () => {
  const types = (crns) => S.validate(crns, cat).map((i) => i.type);
  assert.ok(types(['31001', '35001', '31101', '35101']).includes('conflict'));
  assert.ok(types(['33004']).includes('closed'));
  assert.ok(types(['31001']).includes('missing'));
  assert.ok(types(['31001', '31103']).includes('link'));
});

test('closed sections are never generated; impossible sets explain why', () => {
  const { alts } = S.generate(['MATH102'], {}, cat, 10);
  assert.ok(alts.every((a) => !a.includes('33004')));
  const two = S.buildCatalog({ courses: [
    { code: 'A', name: 'أ', credits: 3, sections: [{ crn: '1', days: [0], start: '8:00', end: '9:00' }] },
    { code: 'B', name: 'ب', credits: 3, sections: [{ crn: '2', days: [0], start: '8:30', end: '9:30' }] }] });
  const r = S.generate(['A', 'B'], {}, two);
  assert.equal(r.alts.length, 0); assert.ok(r.reason);
});

test('swapping a lecture re-picks a linked lab', () => {
  const next = S.swapSection(['31001', '31101'], '31001', '31003', cat);
  assert.deepEqual(next.sort(), ['31003', '31103']);
  assert.ok(S.blocking(S.validate(next, cat)).length === 0);
});

test('CSV catalog round-trips into a usable catalog; exports are well-formed', () => {
  const def = S.parseCatalogCSV('code,name,credits,crn,kind,days,start,end,instructor,room,seats,status,links\nX1,مادة,3,900,lec,su/tu,8:00,9:15,د. أ,R1,10,open,901\nX1,مادة,3,901,lab,th,10:00,11:50,م. ب,L1,10,open,');
  const c = S.buildCatalog(def);
  assert.deepEqual(S.bundles(c, 'X1'), [['900', '901']]);
  assert.throws(() => S.parseCatalogCSV('code,name\nX,Y'));
  const crns = S.generate(['CS201', 'MATH102'], {}, cat, 1).alts[0];
  assert.equal(S.toCSV(crns, cat).split('\r\n').length, crns.length + 1);
  const ics = S.toICS(crns, cat, new Date(2026, 10, 22));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, crns.length);
  assert.match(ics, /DTSTART;TZID=Asia\/Riyadh:20261122T/);
});

test('lessons: normalize builds scenes and beats, caps items, rejects junk; old format still loads', () => {
  assert.throws(() => L.normalize({ beats: [] }));
  assert.throws(() => L.normalize({ scenes: [{ type: 'map' }] }));
  const old = L.normalize({ title: 't', beats: [{ say: 'تمهيد' }].concat(Array.from({ length: 9 }, (_, i) => ({ say: 'جملة ' + i, node: { label: 'فرع ' + i } }))), quiz: [{ q: 'س', options: ['أ', 'ب'], answer: 5 }] });
  assert.equal(old.scenes.length, 1); assert.equal(old.scenes[0].type, 'map'); assert.equal(old.scenes[0].items.length, L.MAX_ITEMS);
  assert.equal(old.beats.length, 1 + L.MAX_ITEMS); assert.equal(old.quiz.length, 0);
  const l = L.normalize({ title: 't', scenes: [
    { type: 'bars', title: 'أ', say: 'تمهيد', items: [{ label: 'x', value: 3, say: 'واحد' }, { label: 'y', value: '7' }] },
    { type: 'bars', title: 'ب', say: 's', items: [{ label: 'x', value: 3 }, { label: 'y' }] },
    { type: 'line', title: 'ج', say: 's', items: [{ label: 'x', value: 1 }, { label: 'y', value: 2 }] },
    { type: 'compare', title: 'د', say: 's', a: 'A', b: 'B', items: [{ label: 'x', side: 'a', say: 'q' }, { label: 'y', side: 'b', say: 'w' }] },
    { type: 'pie', title: 'زائد', say: 's', items: [] }] });
  assert.deepEqual(l.scenes.map((x) => x.type), ['bars', 'list', 'list', 'compare', 'big']);
  assert.deepEqual(l.beats.map((b) => [b.scene, b.item]), [[0, -1], [0, 0], [1, -1], [2, -1], [3, -1], [3, 0], [3, 1], [4, -1]]);
  assert.equal(l.scenes[0].items[1].at, 1); assert.equal(l.scenes[0].items[1].value, 7);
  const local = L.fromText({ index: 0, title: 'المصفوفة', text: 'المصفوفة\n• عناصر متجاورة في الذاكرة\n• الوصول بالفهرس سريع' });
  assert.equal(local.source, 'local'); assert.equal(local.beats.length, 3);
  const nums = L.fromText({ index: 0, title: 'حصص السوق', text: 'حصص السوق\nأندرويد: 71%\niOS: 28%' });
  assert.equal(nums.scenes[0].type, 'bars'); assert.deepEqual(nums.scenes[0].items.map((i) => i.value), [71, 28]);
});

test('big board geometry: cells do not overlap and frames keep the board ratio', () => {
  [1, 2, 3, 4, 5, 6].forEach((n) => {
    const g = L.grid(n);
    assert.equal(g.cells.length, n);
    g.cells.forEach((a, i) => g.cells.slice(i + 1).forEach((b) => assert.ok(Math.abs(a.x - b.x) >= L.CELL.w || Math.abs(a.y - b.y) >= L.CELL.h)));
    g.cells.forEach((c) => assert.ok(c.x >= 0 && c.x + L.CELL.w <= g.w && c.y >= 0 && c.y + L.CELL.h <= g.h));
    if (n > 1) assert.ok(g.cells[0].x > g.cells[1].x); // يبدأ من اليمين
  });
  const f = L.fit(100, 100, 300, 500, 20);
  assert.ok(Math.abs(f[2] / f[3] - L.CELL.w / L.CELL.h) < 1e-9); assert.ok(f[0] <= 80 && f[1] <= 80 && f[0] + f[2] >= 420 && f[1] + f[3] >= 620);
  L.DEMO_DECKS.forEach((d) => d.lessons.forEach((raw) => { const l = L.normalize(raw, 'demo'); assert.ok(l.scenes.length >= 3); assert.ok(new Set(l.scenes.map((x) => x.type)).size >= 3);
    assert.deepEqual(l.scenes.map((x) => x.type), raw.scenes.map((x) => x.type)); assert.ok(l.quiz.length && l.tf.length >= 2 && l.cards.length >= 3); }));
});

test('university section table converts to a catalog regardless of column order or time format', () => {
  const head = ['المحاضر', 'الوقت', 'الأيام', 'الحالة', 'القاعة', 'الساعات', 'النشاط', 'الرقم المرجعي', 'الشعبة', 'اسم المقرر', 'رمز المقرر'];
  const rows = [['جامعة', 'جدول الشعب'], head,
    ['د. محمد العلي', '08:00 ص - 09:15 ص', 'ح ث', 'مفتوحة', 'A12', '3', 'نظري', '10234', '01', 'مقدمة في البرمجة', '0911 101'],
    ['', '10:00 ص - 10:50 ص', 'خ', '', 'A12', '', '', '', '', '', ''],
    ['م. سعد', '01:00 م - 02:50 م', 'الاثنين', 'مفتوحة', 'Lab3', '3', 'عملي', '10240', '51', 'مقدمة في البرمجة', '0911 101'],
    head,
    ['د. خالد الحربي', '1300 - 1415', '2 4', 'مغلقة', 'A14', '3', 'نظري', '10235', '02', 'مقدمة في البرمجة', '0911 101'],
    ['د. نورة', '9:30 - 10:45', 'U T', 'Open', 'B1', '3', 'Lecture', '20001', '01', 'Calculus', 'MATH 101'],
    ['د. نورة', '', '', 'Open', '', '3', 'Lecture', '20002', '02', 'Calculus', 'MATH 101']];
  const { def, stats } = I.parseTable(rows);
  assert.deepEqual([stats.courses, stats.sections, stats.noTime], [2, 4, 1]);
  const c = S.buildCatalog(def);
  assert.deepEqual(c.sections['10234'].meetings.map((m) => [m.day, m.start, m.end]), [[0, 480, 555], [2, 480, 555], [4, 600, 650]]);
  assert.deepEqual(c.sections['10235'].meetings.map((m) => [m.day, m.start]), [[1, 780], [3, 780]]);
  assert.equal(c.sections['10235'].status, 'closed'); assert.equal(c.sections['10240'].kind, 'lab');
  assert.deepEqual(S.bundles(c, '0911 101'), [['10234', '10240']]);
  assert.deepEqual(c.sections['20001'].meetings.map((m) => m.day), [0, 2]);
  const pasted = I.parseTable(I.rowsFromText(rows.map((r) => r.join('\t')).join('\n')));
  assert.equal(pasted.stats.sections, 4);
  assert.throws(() => I.parseTable([['a', 'b'], ['1', '2']]));
  assert.deepEqual(I.parseTimes('1:00 - 2:15'), { start: 780, end: 855 });
  assert.equal(I.merge([def, def]).courses[0].sections.length, def.courses[0].sections.length);
});

test('a preferred instructor wins over the other preferences when a clean schedule exists', () => {
  const codes = ['CS201', 'MATH102', 'STAT201'];
  const free = S.generate(codes, { time: 'am', off: 'none', gaps: 'tight' }, cat, 1).alts[0];
  const want = S.generate(codes, { time: 'am', off: 'none', gaps: 'tight', teachers: { MATH102: ['د. فهد'], STAT201: ['د. خالد'] } }, cat, 1).alts[0];
  const who = (crns, code) => cat.sections[crns.find((x) => cat.sections[x].code === code && cat.sections[x].kind === 'lec')].instructor;
  assert.equal(who(want, 'MATH102'), 'د. فهد'); assert.equal(who(want, 'STAT201'), 'د. خالد');
  assert.ok(clean(want)); assert.ok(clean(free));
  // مفضّل وقته عكس تفضيل الوقت: الاسم يغلب
  const pm = { time: 'pm', off: 'none', gaps: 'any' };
  assert.equal(who(S.generate(['MATH102'], pm, cat, 1).alts[0], 'MATH102'), 'د. فهد');
  assert.equal(who(S.generate(['MATH102'], Object.assign({ teachers: { MATH102: ['د. نورة'] } }, pm), cat, 1).alts[0], 'MATH102'), 'د. نورة');
  assert.deepEqual(S.instructorsOf(cat, 'MATH102'), ['د. فهد', 'د. نورة']);
});

test('every lesson offers flash cards, multiple choice and true/false', () => {
  const ai = L.normalize({ title: 't', beats: [{ say: 'a' }, { say: 'b', node: { label: 'x' } }], cards: [{ front: 'f', back: 'b' }, { front: 'no back' }], tf: [{ s: 'عبارة', answer: false }, { s: 'bad', answer: 'yes' }] });
  assert.equal(ai.cards.length, 1); assert.equal(ai.tf.length, 1);
  L.DEMO_DECK.lessons.forEach((raw) => { const l = L.normalize(raw, 'demo'); assert.ok(l.cards.length >= 3 && l.quiz.length >= 1 && l.tf.length >= 2); assert.ok(l.tf.some((x) => x.answer) && l.tf.some((x) => !x.answer)); });
  const sub = L.normalize({ title: 't', scenes: [{ type: 'table', title: 'x', say: 's', cols: ['أ', 'ب'], items: [{ label: 'r', cells: ['1'] }] }, { type: 'table', title: 'y', say: 's', items: [{ label: 'r', cells: ['1'] }] }, { type: 'lab', title: 'z', say: 's', items: [{ label: 'a', vessel: 'flask' }, { label: 'b', vessel: 'bucket' }] }, { type: 'formula', title: 'f', say: 's', items: [{ label: 'x = (−b ± √Δ) / 2a' }] }] });
  assert.deepEqual(sub.scenes.map((x) => x.type), ['table', 'list', 'lab', 'formula']); assert.deepEqual(sub.scenes[0].items[0].cells, ['1', '']);
  assert.deepEqual(sub.scenes[2].items.map((i) => i.vessel), ['flask', '']); assert.equal(sub.scenes[3].items[0].label, 'x = (−b ± √Δ) / 2a');
});

test('language is detected per slide and speech is split by language', () => {
  assert.equal(L.detectLang('Binary search works on sorted arrays only'), 'en');
  assert.equal(L.detectLang('المكدّس Stack آخر من يدخل أول من يخرج'), 'ar');
  assert.equal(L.detectLang(''), 'ar');
  const mixed = 'القاعدة اسمها last in first out يعني آخر صحن';
  assert.deepEqual(L.segments(mixed, 1).map((x) => [x.lang, x.text]), [['ar', 'القاعدة اسمها'], ['en', 'last in first out'], ['ar', 'يعني آخر صحن']]);
  assert.equal(mixed.slice(L.segments(mixed, 1)[1].at, L.segments(mixed, 1)[1].at + 4), 'last');
  assert.deepEqual(L.segments('عملية push تضيف عنصر', 3).map((x) => x.lang), ['ar']);
  assert.deepEqual(L.segments('عملية push تضيف عنصر', 1).map((x) => x.lang), ['ar', 'en', 'ar']);
  assert.deepEqual(L.segments('Runs in O(log n) time.', 3).map((x) => x.lang), ['en']);
  const en = L.fromText({ index: 0, title: 'Hash Tables', text: 'Hash Tables\nKey maps to a bucket by a hash function\nAverage lookup is constant time' });
  assert.equal(en.lang, 'en'); assert.match(en.beats[1].say, /^First,/);
  assert.equal(L.fromText({ index: 0, title: 'المصفوفة', text: 'المصفوفة\nعناصر متجاورة في الذاكرة' }).lang, 'ar');
});

test('local fallback keeps a short key phrase as the label and code lines keep their spacing', () => {
  const l = L.fromText({ index: 0, title: 'Security', text: 'Security\nAccess control: the prevention of unauthorized use of a resource, including the prevention of use in an unauthorized manner\nData confidentiality protects data from disclosure' });
  assert.equal(l.scenes[0].items[0].label, 'Access control');
  assert.ok(l.scenes[0].items[0].detail.endsWith('…') && l.scenes[0].items[0].detail.length <= 64);
  assert.match(l.scenes[0].items[0].say, /unauthorized manner/);
  assert.equal(l.scenes[0].items[1].label, 'Data confidentiality protects');
  const code = L.normalize({ title: 'c', scenes: [{ type: 'code', title: 'loop', say: 's', items: [{ label: 'for (let i = 0; i < n; i++) {', say: 'a' }, { label: '    total += items[i].price * items[i].quantity;', say: 'b' }] }] });
  assert.equal(code.scenes[0].type, 'code'); assert.equal(code.scenes[0].items[1].label, '    total += items[i].price * items[i].quantity;');
});

test('English demo decks mirror the Arabic ones scene for scene', () => {
  const EN = require('../src/core/demos-en.js');
  assert.equal(EN.length, L.DEMO_DECKS.length);
  EN.forEach((d, k) => {
    const ar = L.DEMO_DECKS[k];
    assert.equal(d.id, ar.id); assert.equal(d.slides.length, ar.slides.length); assert.equal(d.lessons.length, ar.lessons.length);
    d.lessons.forEach((raw, i) => {
      const a = L.normalize(ar.lessons[i], 'demo'), e = L.normalize(raw, 'demo', 'en');
      assert.deepEqual(e.scenes.map((s) => [s.type, s.items.length]), a.scenes.map((s) => [s.type, s.items.length]));
      assert.deepEqual(e.scenes.map((s) => s.items.map((x) => x.value)), a.scenes.map((s) => s.items.map((x) => x.value)));
      assert.equal(e.beats.length, a.beats.length); assert.equal(e.lang, 'en'); assert.deepEqual(e.quiz.map((q) => q.answer), a.quiz.map((q) => q.answer));
      assert.deepEqual(e.tf.map((x) => x.answer), a.tf.map((x) => x.answer));
      assert.ok(!/[؀-ۿ]/.test(JSON.stringify(raw)));
    });
  });
});
