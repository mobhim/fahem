/* فاهم — تحويل جدول الشعب الجامعي (الصفحة الزرقاء من موقع الجامعة) إلى كتالوج.
 * يستقبل صفوفًا من أي مصدر (HTML، لصق، Excel، CSV، PDF) ويتعرّف على الأعمدة من عناوينها،
 * فلا يعتمد على ترتيب أعمدة ثابت. بدون DOM، فيشتغل تحت `node --test`. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.F = root.F || {}).Import = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const norm = (s) => String(s == null ? '' : s).replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\s+/g, ' ').trim().toLowerCase();

  const FIELDS = {
    crn: ['الرقم المرجعي', 'رقم مرجعي', 'المرجعي', 'crn', 'reference'],
    code: ['رمز المقرر', 'رقم المقرر', 'رمز الماده', 'رقم الماده', 'المقرر', 'الماده', 'course code', 'course no', 'course', 'subject', 'code'],
    name: ['اسم المقرر', 'اسم الماده', 'عنوان المقرر', 'مسمي المقرر', 'course title', 'course name', 'title', 'name'],
    section: ['رقم الشعبه', 'الشعبه', 'شعبه', 'section', 'sec'],
    credits: ['الساعات المعتمده', 'عدد الساعات', 'الساعات', 'س.م', 'الوحدات', 'credits', 'credit', 'hours', 'hrs', 'cr'],
    kind: ['نوع النشاط', 'النشاط', 'نمط الدراسه', 'النوع', 'activity', 'schedule type', 'type'],
    days: ['الايام', 'ايام', 'اليوم', 'days', 'day'],
    time: ['الوقت', 'التوقيت', 'الفتره', 'الزمن', 'time'],
    start: ['وقت البدايه', 'البدايه', 'بدايه', 'من', 'start', 'begin', 'from'],
    end: ['وقت النهايه', 'النهايه', 'نهايه', 'الي', 'end', 'to'],
    room: ['القاعه', 'قاعه', 'المكان', 'المبني', 'room', 'location', 'bldg', 'building'],
    instructor: ['عضو هيئه التدريس', 'اسم المحاضر', 'استاذ المقرر', 'استاذ الماده', 'المحاضر', 'المدرس', 'الاستاذ', 'instructor', 'lecturer', 'teacher'],
    status: ['حاله الشعبه', 'الحاله', 'status'],
    seats: ['المقاعد المتاحه', 'المتاح', 'المتبقي', 'available', 'remaining', 'seats'],
  };
  const LABELS = { crn: 'الرقم المرجعي', code: 'رمز المقرر', name: 'اسم المقرر', section: 'الشعبة', credits: 'الساعات', kind: 'النشاط', days: 'الأيام', time: 'الوقت', start: 'البداية', end: 'النهاية', room: 'القاعة', instructor: 'المحاضر', status: 'الحالة', seats: 'المقاعد' };

  /** يطابق خلايا صف مع الحقول؛ كل عمود يأخذ أطول مرادف ينطبق عليه. */
  function mapHeader(row) {
    const picks = [];
    row.forEach((cell, col) => {
      const h = norm(cell); if (!h || h.length > 40) return;
      let best = null;
      for (const field in FIELDS) for (const syn of FIELDS[field]) {
        const hit = h === syn ? syn.length + 100 : (syn.length > 2 && h.includes(syn)) ? syn.length : 0;
        if (hit && (!best || hit > best.hit)) best = { field, hit, col };
      }
      if (best) picks.push(best);
    });
    const map = {};
    picks.sort((a, b) => b.hit - a.hit).forEach((p) => { if (map[p.field] === undefined) map[p.field] = p.col; });
    return map;
  }
  const usable = (m) => m.code !== undefined && m.days !== undefined && (m.time !== undefined || m.start !== undefined);

  const DAY_NAMES = [['احد', 0], ['اثنين', 1], ['ثلاثاء', 2], ['اربعاء', 3], ['خميس', 4], ['sun', 0], ['mon', 1], ['tue', 2], ['wed', 3], ['thu', 4]];
  const DAY_CHARS = { 'ح': 0, 'ن': 1, 'ث': 2, 'ر': 3, 'خ': 4, u: 0, m: 1, t: 2, w: 3, r: 4, 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
  function parseDays(cell) {
    const s = norm(cell).replace(/\d{1,2}[:.]\d{2}.*/, '').trim();
    const named = DAY_NAMES.filter(([n]) => s.includes(n)).map(([, d]) => d);
    if (named.length) return [...new Set(named)].sort();
    const out = new Set();
    for (const tok of s.split(/[\s,،\/|\-–]+/).filter(Boolean)) {
      if (tok.length > 5) return [];
      for (const ch of tok) { if (DAY_CHARS[ch] === undefined) return []; out.add(DAY_CHARS[ch]); }
    }
    return [...out].sort();
  }

  /** يقرأ أول وقتين في النص (بداية ونهاية) بأي صيغة شائعة ويرجّعهما بالدقائق. */
  function parseTimes(cell) {
    const s = norm(cell), found = [];
    const re = /(\d{1,2})\s*[:.]\s*(\d{2})\s*(ص|م|am|pm|a\.m|p\.m)?|(?:^|[^\d])(\d{2})(\d{2})(?=$|[^\d])\s*(ص|م|am|pm)?/g;
    let m;
    while ((m = re.exec(s)) && found.length < 2) {
      const h = Number(m[1] !== undefined ? m[1] : m[4]), min = Number(m[2] !== undefined ? m[2] : m[5]), mark = m[3] || m[6] || '';
      if (h > 23 || min > 59) continue;
      found.push({ h, min, pm: /م|p/.test(mark), am: /ص|a/.test(mark), marked: !!mark });
    }
    if (found.length < 2) return null;
    const [a, b] = found.map((t) => {
      let h = t.h;
      if (t.pm && h < 12) h += 12; else if (t.am && h === 12) h = 0; else if (!t.marked && h < 7) h += 12;
      return h * 60 + t.min;
    });
    const end = b <= a && b < 12 * 60 ? b + 12 * 60 : b;
    return end > a ? { start: a, end } : null;
  }

  const num = (cell) => { const m = norm(cell).match(/\d+(\.\d+)?/); return m ? Number(m[0]) : null; };
  const text = (cell) => String(cell == null ? '' : cell).replace(/\s+/g, ' ').trim();

  /** rows: مصفوفة صفوف، كل صف مصفوفة خلايا نصية. يرجّع {def, stats} أو يرمي خطأ مفهومًا. */
  function parseTable(rows) {
    rows = rows.map((r) => r.map(text)).filter((r) => r.some(Boolean));
    let head = -1, map = null;
    rows.slice(0, 400).forEach((r, i) => {
      const m = mapHeader(r);
      if (usable(m) && (!map || Object.keys(m).length > Object.keys(map).length)) { map = m; head = i; }
    });
    if (!map) throw new Error('ما لقينا عناوين أعمدة جدول الشعب (رمز المقرر، الأيام، الوقت…). تأكد إنها صفحة جدول الشعب من موقع الجامعة.');

    const courses = new Map(), sections = new Map();
    const stats = { rows: 0, sections: 0, courses: 0, noTime: 0, columns: Object.keys(map).map((k) => LABELS[k]) };
    const get = (r, f) => (map[f] === undefined ? '' : r[map[f]] || '');
    let last = null;

    for (const r of rows.slice(head + 1)) {
      if (norm(get(r, 'code')) === norm(rows[head][map.code])) continue; // عنوان مكرر في صفحة جديدة
      let code = get(r, 'code').replace(/\s+/g, ' ');
      const timeCell = map.time !== undefined ? get(r, 'time') : `${get(r, 'start')} - ${get(r, 'end')}`;
      const days = parseDays(get(r, 'days')), times = parseTimes(timeCell) || parseTimes(get(r, 'days'));
      if (!code) { // صف تكملة لنفس الشعبة (موعد إضافي)
        if (last && days.length && times) { days.forEach((day) => last.meetings.push({ day, start: times.start, end: times.end })); }
        continue;
      }
      if (!/[\dA-Za-zء-ي]/.test(code) || code.length > 24) continue;
      stats.rows++;
      const secNo = get(r, 'section'), crn = (get(r, 'crn') || `${code}-${secNo || stats.rows}`).replace(/\s+/g, '');
      if (!courses.has(code)) courses.set(code, { code, name: get(r, 'name') || code, credits: num(get(r, 'credits')) || 0, sections: [] });
      const course = courses.get(code);
      if (!course.credits) course.credits = num(get(r, 'credits')) || 0;
      let sec = sections.get(crn);
      if (!sec) {
        const seats = map.seats === undefined ? null : num(get(r, 'seats'));
        const closed = /مغلق|مقفل|ممتل|closed|full/.test(norm(get(r, 'status'))) || seats === 0;
        sec = {
          crn, label: secNo, kind: /عمل|معمل|مختبر|تمار|lab|practical|tutorial/.test(norm(get(r, 'kind'))) ? 'lab' : 'lec',
          meetings: [], instructor: get(r, 'instructor'), room: get(r, 'room'), seats: seats == null ? 20 : seats, status: closed ? 'closed' : 'open',
        };
        sections.set(crn, sec); course.sections.push(sec);
      }
      if (days.length && times) days.forEach((day) => {
        if (!sec.meetings.some((m) => m.day === day && m.start === times.start)) sec.meetings.push({ day, start: times.start, end: times.end });
      });
      last = sec;
    }

    const out = [];
    courses.forEach((c) => {
      const timed = c.sections.filter((s) => s.meetings.length);
      stats.noTime += c.sections.length - timed.length;
      if (timed.length) { out.push(Object.assign({}, c, { sections: timed })); stats.sections += timed.length; }
    });
    stats.courses = out.length;
    if (!out.length) throw new Error('قرأنا الأعمدة لكن ما لقينا شعبًا لها أيام وأوقات. تأكد إن الجدول فيه عمودي الأيام والوقت.');
    return { def: { courses: out }, stats };
  }

  /** نص ملصوق أو CSV → صفوف. */
  function rowsFromText(str) {
    const lines = String(str).replace(/^﻿/, '').split(/\r?\n/);
    const tabs = lines.filter((l) => l.includes('\t')).length;
    const split = tabs > lines.length / 4 ? (l) => l.split('\t') : lines.some((l) => (l.match(/,/g) || []).length >= 3)
      ? (l) => (l.match(/("([^"]|"")*"|[^,]*)(,|$)/g) || []).map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'))
      : (l) => l.split(/\s{2,}/);
    return lines.map(split);
  }

  /** يدمج أكثر من جدول (مثلاً أكثر من كلية) في كتالوج واحد. */
  function merge(defs) {
    const byCode = new Map();
    defs.forEach((d) => d.courses.forEach((c) => {
      if (!byCode.has(c.code)) return byCode.set(c.code, Object.assign({}, c, { sections: c.sections.slice() }));
      const have = byCode.get(c.code), ids = new Set(have.sections.map((s) => s.crn));
      c.sections.forEach((s) => { if (!ids.has(s.crn)) have.sections.push(s); });
    }));
    return { courses: [...byCode.values()] };
  }

  return { norm, mapHeader, parseDays, parseTimes, parseTable, rowsFromText, merge };
});
