/* فاهم — محرك الجداول: كتالوج، فحص تعارضات، توليد بدائل، تصدير.
 * بدون أي اعتماد على DOM، فيشتغل في المتصفح وتحت `node --test`. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.F = root.F || {}).Sched = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
  const ICS_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH'];
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  const fmt = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  const fmt12 = (m) => { const h = Math.floor(m / 60); return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'ص' : 'م'}`; };

  /** def: {minCredits,maxCredits,courses:[{code,name,credits,sections:[{crn,kind,days,start,end,instructor,room,seats,status,links}]}]} */
  function buildCatalog(def) {
    const courses = {}, sections = {};
    (def.courses || []).forEach((c, order) => {
      const course = { code: c.code, name: c.name, credits: Number(c.credits) || 0, order, lecs: [], labs: [] };
      courses[c.code] = course;
      (c.sections || []).forEach((s) => {
        const mins = (t) => (typeof t === 'number' ? t : toMin(t));
        const sec = {
          crn: String(s.crn), code: c.code, kind: s.kind === 'lab' ? 'lab' : 'lec', label: s.label || '',
          // إما أيام بوقت واحد (days/start/end) أو مواعيد مفصّلة لكل يوم (meetings)
          meetings: s.meetings ? s.meetings.map((m) => ({ day: m.day, start: mins(m.start), end: mins(m.end) }))
            : (s.days || []).map((day) => ({ day, start: mins(s.start), end: mins(s.end) })),
          instructor: s.instructor || 'يحدد لاحقًا', room: s.room || '', links: (s.links || []).map(String),
          seats: s.seats === undefined ? 20 : Number(s.seats), status: s.status === 'closed' ? 'closed' : 'open',
        };
        sections[sec.crn] = sec;
        (sec.kind === 'lab' ? course.labs : course.lecs).push(sec.crn);
      });
    });
    return { courses, sections, minCredits: def.minCredits || 12, maxCredits: def.maxCredits || 18, label: def.label || '' };
  }

  /** يجمع مواعيد الشعبة حسب الوقت: [{days:[..], start, end}] */
  function slots(sec) {
    const groups = [];
    sec.meetings.slice().sort((a, b) => a.day - b.day).forEach((m) => {
      const g = groups.find((x) => x.start === m.start && x.end === m.end);
      if (g) g.days.push(m.day); else groups.push({ days: [m.day], start: m.start, end: m.end });
    });
    return groups;
  }
  const describe = (sec) => slots(sec).map((g) => `${g.days.map((d) => DAYS[d]).join(' / ')} · من ${fmt12(g.start)} إلى ${fmt12(g.end)}`).join('، ');

  const overlap = (a, b) => a.day === b.day && a.start < b.end && b.start < a.end;
  const sectionsConflict = (a, b) => a.meetings.some((x) => b.meetings.some((y) => overlap(x, y)));
  const isOpen = (s) => s.status === 'open' && s.seats > 0;
  const codesOf = (crns, cat) => [...new Set(crns.filter((c) => cat.sections[c]).map((c) => cat.sections[c].code))];
  const creditsOf = (crns, cat) => codesOf(crns, cat).reduce((n, code) => n + cat.courses[code].credits, 0);

  /** كل طرق تسجيل المادة: [محاضرة] أو [محاضرة، عملي مرتبط]. */
  function bundles(cat, code, openOnly = true) {
    const c = cat.courses[code];
    if (!c) return [];
    const ok = (crn) => !openOnly || isOpen(cat.sections[crn]);
    const out = [];
    c.lecs.filter(ok).forEach((lec) => {
      if (!c.labs.length) return out.push([lec]);
      const links = cat.sections[lec].links.length ? cat.sections[lec].links : c.labs;
      links.filter((l) => cat.sections[l] && ok(l) && !sectionsConflict(cat.sections[lec], cat.sections[l]))
        .forEach((lab) => out.push([lec, lab]));
    });
    return out;
  }

  function validate(crns, cat) {
    const issues = [];
    const add = (type, message, involved) => issues.push({ type, message, crns: involved });
    const known = crns.filter((c) => cat.sections[c]);
    const name = (crn) => cat.courses[cat.sections[crn].code].name;

    known.forEach((crn) => {
      const s = cat.sections[crn];
      if (!isOpen(s)) add('closed', `شعبة ${crn} من «${name(crn)}» مقفلة. اختر شعبة متاحة.`, [crn]);
    });
    for (let i = 0; i < known.length; i++) for (let j = i + 1; j < known.length; j++) {
      const a = cat.sections[known[i]], b = cat.sections[known[j]];
      const clash = a.meetings.find((x) => b.meetings.some((y) => overlap(x, y)));
      if (clash) add('conflict', `«${name(a.crn)}» تتعارض مع «${name(b.crn)}» يوم ${DAYS[clash.day]}.`, [a.crn, b.crn]);
    }
    codesOf(known, cat).forEach((code) => {
      const c = cat.courses[code], mine = known.filter((x) => cat.sections[x].code === code);
      const lecs = mine.filter((x) => cat.sections[x].kind === 'lec'), labs = mine.filter((x) => cat.sections[x].kind === 'lab');
      if (!lecs.length) add('missing', `«${c.name}» ناقصها شعبة المحاضرة.`, mine);
      if (c.labs.length && !labs.length) add('missing', `«${c.name}» تحتاج شعبة عملي.`, mine);
      if (lecs.length > 1 || labs.length > 1) add('duplicate', `«${c.name}» مسجّلة بأكثر من شعبة.`, mine);
      if (lecs.length === 1 && labs.length === 1) {
        const links = cat.sections[lecs[0]].links;
        if (links.length && !links.includes(labs[0])) add('link', `عملي «${c.name}» ما يتبع شعبة المحاضرة المختارة.`, mine);
      }
    });
    const credits = creditsOf(known, cat);
    if (known.length && credits < cat.minCredits) add('credits', `ساعاتك ${credits}، والحد الأدنى ${cat.minCredits}.`, []);
    if (credits > cat.maxCredits) add('credits', `ساعاتك ${credits}، والحد الأعلى ${cat.maxCredits}.`, []);
    return issues;
  }
  /** المشاكل اللي تمنع اعتماد الجدول (نقص الساعات مجرد تنبيه). */
  const blocking = (issues) => issues.filter((i) => i.type !== 'credits');

  function summarize(crns, cat) {
    const byDay = DAYS.map(() => []);
    crns.forEach((crn) => cat.sections[crn] && cat.sections[crn].meetings.forEach((m) => byDay[m.day].push(m)));
    let gaps = 0, earliest = Infinity, latest = -Infinity, backToBack = 0;
    byDay.forEach((list) => {
      list.sort((a, b) => a.start - b.start);
      list.forEach((m, i) => {
        earliest = Math.min(earliest, m.start); latest = Math.max(latest, m.end);
        if (i) { const g = m.start - list[i - 1].end; gaps += Math.max(0, g); if (g < 15) backToBack++; }
      });
    });
    return {
      credits: creditsOf(crns, cat), gaps, backToBack,
      earliest: isFinite(earliest) ? earliest : null, latest: isFinite(latest) ? latest : null,
      offDays: DAYS.filter((_, d) => !byDay[d].length), dayCount: byDay.filter((l) => l.length).length,
      loads: byDay.map((l) => l.reduce((n, m) => n + m.end - m.start, 0)),
    };
  }

  /** prefs: {time:'am'|'pm'|'any', off:'none'|'any'|0..4, gaps:'tight'|'breaks'|'any'} — الأعلى أفضل. */
  function score(crns, prefs, cat) {
    const p = prefs || {}, s = summarize(crns, cat);
    let pts = 0;
    crns.forEach((crn) => cat.sections[crn].meetings.forEach((m) => {
      if (p.time === 'am' && m.end > 13 * 60) pts -= (m.end - 13 * 60) / 6;
      if (p.time === 'pm' && m.start < 12 * 60) pts -= (12 * 60 - m.start) / 6;
    }));
    if (typeof p.off === 'number') pts -= s.loads[p.off] ? 400 : 0;
    else if (p.off === 'any') pts += s.offDays.length * 150;
    // تفضيل الدكتور بالاسم له الأولوية على باقي التفضيلات
    const teachers = p.teachers || {};
    crns.forEach((crn) => {
      const s = cat.sections[crn], want = teachers[s.code];
      if (s.kind === 'lec' && want && want.length && want.includes(s.instructor)) pts += 1000;
    });
    if (p.gaps === 'tight') pts -= s.gaps / 4;
    else if (p.gaps === 'breaks') pts -= s.backToBack * 40 + Math.max(0, s.gaps - 240) / 4;
    else pts -= s.gaps / 12;
    return pts;
  }

  /** يرجّع أفضل `limit` جداول بدون تعارض للمواد المطلوبة. */
  function generate(codes, prefs, cat, limit = 4, budget = 200000) {
    const domains = codes.map((code) => ({ code, options: bundles(cat, code) }));
    const empty = domains.find((d) => !d.options.length);
    if (empty) return { alts: [], reason: `ما فيه شعب متاحة لمادة «${cat.courses[empty.code] ? cat.courses[empty.code].name : empty.code}».` };
    domains.sort((a, b) => a.options.length - b.options.length);
    const best = []; let nodes = 0;
    const chosen = [];
    (function dfs(i) {
      if (nodes++ > budget) return;
      if (i === domains.length) {
        const crns = chosen.flat(), sc = score(crns, prefs, cat);
        if (best.length < limit || sc > best[best.length - 1].sc) {
          best.push({ crns, sc }); best.sort((a, b) => b.sc - a.sc); if (best.length > limit) best.pop();
        }
        return;
      }
      for (const opt of domains[i].options) {
        const clash = opt.some((crn) => chosen.some((b) => b.some((x) => sectionsConflict(cat.sections[crn], cat.sections[x]))));
        if (clash) continue;
        chosen.push(opt); dfs(i + 1); chosen.pop();
      }
    })(0);
    if (!best.length) return { alts: [], reason: 'ما قدرنا نجمع كل موادك في جدول واحد بدون تعارض. جرّب تشيل مادة أو تبدّلها.' };
    return { alts: best.map((b) => b.crns), reason: '' };
  }

  /** بدائل شعبة معيّنة مع حالة كل بديل مقابل باقي الجدول. */
  function alternatives(crns, crn, cat) {
    const cur = cat.sections[crn], c = cat.courses[cur.code];
    const pool = cur.kind === 'lab' ? c.labs : c.lecs;
    const others = crns.filter((x) => cat.sections[x] && cat.sections[x].code !== cur.code);
    return pool.map((id) => {
      const s = cat.sections[id];
      const next = swapSection(crns, crn, id, cat);
      const clash = next.filter((x) => cat.sections[x].code === cur.code)
        .some((x) => others.some((o) => sectionsConflict(cat.sections[x], cat.sections[o])));
      return { crn: id, current: id === crn, open: isOpen(s), clash, next };
    });
  }

  /** يبدّل شعبة، ولو المحاضرة الجديدة لها عملي مرتبط مختلف يختار عملي مناسب تلقائيًا. */
  function swapSection(crns, oldCrn, newCrn, cat) {
    const s = cat.sections[newCrn];
    let next = crns.map((x) => (x === oldCrn ? newCrn : x));
    if (s.kind !== 'lec' || !cat.courses[s.code].labs.length) return next;
    const lab = next.find((x) => cat.sections[x].code === s.code && cat.sections[x].kind === 'lab');
    const links = s.links.length ? s.links : cat.courses[s.code].labs;
    if (lab && links.includes(lab)) return next;
    const rest = next.filter((x) => x !== lab);
    const pick = links.filter((l) => isOpen(cat.sections[l]))
      .find((l) => !rest.some((x) => sectionsConflict(cat.sections[l], cat.sections[x]))) || links[0];
    next = rest; if (pick) next.push(pick);
    return next;
  }

  function addCourse(crns, code, cat) {
    const opts = bundles(cat, code);
    const free = opts.find((b) => !b.some((crn) => crns.some((x) => sectionsConflict(cat.sections[crn], cat.sections[x]))));
    const pick = free || opts[0];
    return pick ? { crns: crns.concat(pick), clean: !!free } : { crns, clean: false, none: true };
  }
  const removeCourse = (crns, code, cat) => crns.filter((x) => cat.sections[x] && cat.sections[x].code !== code);

  const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
  function toCSV(crns, cat) {
    const rows = [['رقم الشعبة', 'رمز المادة', 'اسم المادة', 'النوع', 'الأيام', 'الوقت', 'المحاضر', 'القاعة', 'الساعات']];
    crns.forEach((crn) => {
      const s = cat.sections[crn], c = cat.courses[s.code], g = slots(s);
      rows.push([crn, c.code, c.name, s.kind === 'lab' ? 'عملي' : 'محاضرة', g.map((x) => x.days.map((d) => DAYS[d]).join(' / ')).join(' ; '),
        g.map((x) => `${fmt(x.start)}-${fmt(x.end)}`).join(' ; '), s.instructor, s.room, s.kind === 'lab' ? '' : c.credits]);
    });
    return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  }

  /** ملف تقويم أسبوعي (يستورده Google Calendar مباشرة). firstSunday: Date لأول أحد في الفصل. */
  function toICS(crns, cat, firstSunday, weeks = 15) {
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = (d, min) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
    const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Fahem//Schedule//AR', 'CALSCALE:GREGORIAN'];
    crns.forEach((crn) => {
      const s = cat.sections[crn], c = cat.courses[s.code];
      slots(s).forEach((g) => {
        const day = new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + g.days[0]);
        out.push('BEGIN:VEVENT', `UID:${crn}-${stamp(day, g.start)}@fahem`, `DTSTAMP:${stamp(firstSunday, 0)}Z`,
          `DTSTART;TZID=Asia/Riyadh:${stamp(day, g.start)}`, `DTEND;TZID=Asia/Riyadh:${stamp(day, g.end)}`,
          `RRULE:FREQ=WEEKLY;COUNT=${weeks * g.days.length};BYDAY=${g.days.map((d) => ICS_DAYS[d]).join(',')}`,
          `SUMMARY:${c.name}${s.kind === 'lab' ? ' (عملي)' : ''}`, `LOCATION:${s.room}`,
          `DESCRIPTION:${c.code} · شعبة ${crn} · ${s.instructor}`, 'END:VEVENT');
      });
    });
    out.push('END:VCALENDAR');
    return out.join('\r\n');
  }

  /** يقرأ كتالوج CSV: code,name,credits,crn,kind,days,start,end,instructor,room,seats,status,links */
  function parseCatalogCSV(text) {
    const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const head = lines.shift().split(',').map((h) => h.trim().toLowerCase());
    const need = ['code', 'name', 'credits', 'crn', 'days', 'start', 'end'];
    const miss = need.filter((n) => !head.includes(n));
    if (miss.length) throw new Error(`أعمدة ناقصة: ${miss.join(', ')}`);
    const dayIx = { su: 0, mo: 1, tu: 2, we: 3, th: 4, 'ح': 0, 'ن': 1, 'ث': 2, 'ر': 3, 'خ': 4 };
    const map = new Map();
    lines.forEach((line, n) => {
      const cells = line.split(',').map((c) => c.trim()), r = {};
      head.forEach((h, i) => { r[h] = cells[i] || ''; });
      const days = r.days.split(/[\s/|;-]+/).filter(Boolean).map((d) => (/^\d$/.test(d) ? Number(d) : dayIx[d.toLowerCase().slice(0, 2)] ?? dayIx[d[0]]));
      if (!r.code || !r.crn || days.some((d) => d === undefined || d > 4) || !/^\d{1,2}:\d{2}$/.test(r.start) || !/^\d{1,2}:\d{2}$/.test(r.end)) {
        throw new Error(`السطر ${n + 2} غير صالح.`);
      }
      if (!map.has(r.code)) map.set(r.code, { code: r.code, name: r.name || r.code, credits: Number(r.credits) || 0, sections: [] });
      map.get(r.code).sections.push({
        crn: r.crn, kind: /lab|عملي/i.test(r.kind || '') ? 'lab' : 'lec', days, start: r.start, end: r.end,
        instructor: r.instructor, room: r.room, seats: r.seats === '' || r.seats === undefined ? 20 : Number(r.seats),
        status: /closed|مقفل/i.test(r.status || '') ? 'closed' : 'open', links: (r.links || '').split(/[\s/|;]+/).filter(Boolean),
      });
    });
    return { courses: [...map.values()] };
  }

  /** أسماء محاضري شعب المحاضرة المتاحة لمادة، بدون تكرار. */
  function instructorsOf(cat, code) {
    const c = cat.courses[code];
    return c ? [...new Set(c.lecs.map((x) => cat.sections[x]).filter(isOpen).map((s) => s.instructor).filter((n) => n && n !== 'يحدد لاحقًا'))] : [];
  }

  return { DAYS, toMin, fmt, fmt12, slots, describe, instructorsOf, buildCatalog, overlap, sectionsConflict, isOpen, codesOf, creditsOf, bundles, validate, blocking,
    summarize, score, generate, alternatives, swapSection, addCourse, removeCourse, toCSV, toICS, parseCatalogCSV };
});
