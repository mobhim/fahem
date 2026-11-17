/* فاهم — قسم الدراسة: رفع السلايدات، تشغيل الشرح صوتًا ورسمًا، أسئلة المتابعة، والاختبار. */
(function () {
  'use strict';
  const { $, $$, esc, store, toast } = F;
  const V = F.Voice;
  const s = { deck: null, ix: 0, lesson: null, followUp: false, beat: 0, playing: false, run: 0, auto: store.get('auto-next', false), busy: false };
  let board, stopListening = null;

  const cacheKey = () => 'lessons:' + s.deck.id;
  const progressKey = () => 'done:' + s.deck.id;
  const done = () => store.get(progressKey(), []);

  function setDeck(deck) {
    stop();
    s.deck = deck; s.ix = 0;
    if (!deck.demo) {
      const saved = store.get(cacheKey(), {});
      Object.keys(saved).forEach((k) => { try { deck.lessons[k] = F.Lesson.normalize(saved[k], saved[k].source); } catch (e) { /* نسخة قديمة */ } });
    }
    $('#deck-name').textContent = deck.name;
    $('#deck-tag').hidden = !deck.demo;
    $('#deck-tag').textContent = deck.note ? 'مثال جاهز · ' + deck.note : 'مثال جاهز';
    $$('#demo-picks .chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.demo === deck.id));
    renderStrip(); select(0);
  }

  function renderStrip() {
    const d = done();
    $('#strip').innerHTML = s.deck.slides.map((sl, i) => `
      <button type="button" class="thumb${i === s.ix ? ' on' : ''}${d.includes(i) ? ' done' : ''}" data-ix="${i}" aria-label="الشريحة ${i + 1}: ${esc(sl.title)}" aria-current="${i === s.ix}">
        ${sl.image ? `<img src="${sl.image}" alt="" loading="lazy">` : `<span class="thumb-text">${esc(sl.title)}</span>`}
        <b>${i + 1}</b>
      </button>`).join('');
    const pct = Math.round((d.length / s.deck.slides.length) * 100);
    $('#deck-progress').style.setProperty('--p', pct + '%');
    $('#deck-progress-label').textContent = `فهمت ${d.length} من ${s.deck.slides.length}`;
  }

  function select(i) {
    stop();
    s.ix = Math.max(0, Math.min(s.deck.slides.length - 1, i));
    const slide = s.deck.slides[s.ix];
    $('#slide-stage').innerHTML = F.Slides.view(slide);
    $('#slide-count').textContent = `${s.ix + 1} / ${s.deck.slides.length}`;
    $$('#strip .thumb').forEach((t, k) => { t.classList.toggle('on', k === s.ix); t.setAttribute('aria-current', k === s.ix); });
    const on = $('#strip .thumb.on'), strip = $('#strip');
    if (on) strip.scrollLeft += on.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - on.offsetWidth) / 2;
    $('#quiz').hidden = true;
    setLesson(s.deck.lessons[s.ix] || null, false);
  }

  function setLesson(lesson, followUp) {
    s.lesson = lesson; s.followUp = !!followUp; s.beat = 0;
    $('#board-empty').hidden = !!lesson;
    $('#board').hidden = !lesson;
    $('#player').classList.toggle('off', !lesson);
    $('#back-to-slide').hidden = !followUp;
    $('#quiz-btn').hidden = !lesson || !(lesson.quiz.length + lesson.cards.length + lesson.tf.length);
    $('#script').hidden = !lesson;
    const tip = $('#ai-tip'); tip.hidden = !lesson || lesson.source !== 'local';
    if (!lesson) { $('#caption').textContent = F.t('اضغط «اشرح لي» وفاهم يرسم الشرح ويحكيه لك.'); $('#dots').innerHTML = ''; return; }
    if (lesson.source === 'local') tip.textContent = F.hosted
      ? 'هذا شرح مبسّط يقرأ نقاط الشريحة فقط، لأن الصفحة ما أخذت الإذن تسأل Claude. اسمح لها من نافذة الإذن ثم اضغط «اشرح لي» مرة ثانية للشرح الكامل.'
      : 'هذا شرح مبسّط يقرأ نقاط الشريحة فقط، لأن الذكاء الاصطناعي غير مفعّل. للشرح الكامل المكيّف مع المادة: ضع مفتاح Gemini (من Google AI Studio) في الإعدادات، أو افتح فاهم من رابط claude.ai.';
    // الشرح كاملًا مكتوبًا: تمهيد كل مشهد ثم جمل عناصره، للقراءة والمراجعة
    $('#script-body').innerHTML = lesson.scenes.map((sc) => `<h4>${esc(sc.title || sc.text || lesson.title)}</h4><p>${esc([sc.say].concat(sc.items.map((it) => it.say).filter(Boolean)).join(' '))}</p>`).join('')
      + (lesson.takeaway ? `<h4>${lesson.lang === 'en' ? 'Takeaway' : 'الخلاصة'}</h4><p>${esc(lesson.takeaway)}</p>` : '');
    board.load(lesson);
    // في وضع الراحة السبورة كاملة مرسومة، والتشغيل يبدأ الرسم من أوله.
    showBeat(lesson.beats.length - 1, false);
    $('#source-chip').textContent = { demo: 'شرح جاهز للمثال', ai: `شرح ${F.AI.providerName()}`, local: 'شرح مبسّط بدون ذكاء اصطناعي' }[lesson.source] || '';
  }

  function showBeat(i, animate) {
    s.beat = i;
    board.show(i, animate);
    $('#caption').innerHTML = s.lesson.beats[i].say.split(' ').map((w) => `<span class="w">${esc(w)}</span>`).join(' ');
    $('#caption').classList.remove('live');
    $('#dots').innerHTML = s.lesson.beats.map((_, k) => `<button type="button" class="dot${k === i ? ' on' : k < i ? ' past' : ''}" data-beat="${k}" aria-label="اللقطة ${k + 1}"></button>`).join('');
  }

  function setPlaying(on) {
    s.playing = on;
    $('#play').setAttribute('aria-pressed', on);
    $('#play').setAttribute('aria-label', on ? 'إيقاف مؤقت' : 'تشغيل');
    $('#player').classList.toggle('playing', on);
    board.setAlive(on);
  }

  async function play(from) {
    if (!s.lesson) return;
    const run = ++s.run; setPlaying(true);
    for (let i = from; i < s.lesson.beats.length; i++) {
      showBeat(i, true);
      if (s.lesson.beats[i].item >= 0) setTimeout(() => { if (run === s.run) F.Sfx.pop(); }, 380);
      if (s.lesson.beats[i + 1]) V.warm(s.lesson.beats[i + 1].say);
      await Promise.all([V.speak(s.lesson.beats[i].say, karaoke(run, s.lesson.beats[i].say)), new Promise((r) => setTimeout(r, s.lesson.beats[i].item >= 0 ? 1700 : 1500))]);
      if (run !== s.run) return;
      await new Promise((r) => setTimeout(r, 350));
      if (run !== s.run) return;
    }
    setPlaying(false);
    F.Sfx.done(); confetti();
    if (!s.followUp) {
      const d = done(); if (!d.includes(s.ix)) { d.push(s.ix); store.set(progressKey(), d); renderStrip(); award(10); }
      if (s.auto && s.ix < s.deck.slides.length - 1) { select(s.ix + 1); explain(); }
    }
  }
  /** يلوّن كلمات الجملة مع النطق: بتوقيت تقديري، أو بإشارات المتصفح لو وفّرها الصوت. */
  function karaoke(run, text) {
    const words = $$('#caption .w'), starts = []; let at = 0, synced = false;
    text.split(' ').forEach((w) => { starts.push(at); at += w.length + 1; });
    const mark = (k) => words.forEach((el, n) => { el.classList.toggle('said', n <= k); el.classList.toggle('cur', n === k); });
    $('#caption').classList.add('live'); mark(0);
    const step = V.estimate(text) / words.length; let k = 0;
    const timer = setInterval(() => {
      if (run !== s.run || k >= words.length - 1) return clearInterval(timer);
      if (!synced) mark(++k);
    }, step);
    return (charIndex) => { synced = true; let n = 0; while (n < starts.length - 1 && starts[n + 1] <= charIndex) n++; k = n; mark(n); };
  }
  /* ---------- المتعة: نقاط ومستوى وأيام متتالية واحتفال عند الإنجاز ---------- */
  function renderXp() {
    const xp = store.get('xp', 0), streak = store.get('streak', { day: '', n: 0 });
    $('#xp').textContent = xp ? `المستوى ${Math.floor(xp / 100) + 1} · ${xp} نقطة${streak.n > 1 ? ` · ${streak.n} أيام متتالية` : ''}` : '';
  }
  function award(points) {
    store.set('xp', store.get('xp', 0) + points);
    const today = new Date().toISOString().slice(0, 10), st = store.get('streak', { day: '', n: 0 });
    if (st.day !== today) {
      const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
      store.set('streak', { day: today, n: st.day === y ? st.n + 1 : 1 });
    }
    renderXp();
  }
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const box = document.createElement('div'); box.className = 'confetti';
    const tones = ['var(--ink-a)', 'var(--ink-b)', 'var(--ink-c)', 'var(--ink-d)', 'var(--hub)'];
    for (let k = 0; k < 38; k++) { const i = document.createElement('i'); i.style.cssText = `left:${Math.random() * 100}%;background:${tones[k % 5]};animation-delay:${Math.random() * 0.5}s;transform:rotate(${Math.random() * 180}deg)`; box.appendChild(i); }
    $('.board-frame').appendChild(box); setTimeout(() => box.remove(), 2900);
  }
  function stop() { s.run++; V.stop(); setPlaying(false); }

  function togglePlay() {
    if (!s.lesson) return explain();
    if (s.playing) { V.stop(); s.run++; setPlaying(false); return; }
    play(s.beat >= s.lesson.beats.length - 1 ? 0 : s.beat);
  }
  function jump(i) {
    if (!s.lesson) return;
    const was = s.playing; stop();
    i = Math.max(0, Math.min(s.lesson.beats.length - 1, i));
    if (was) play(i); else showBeat(i, true);
  }

  function busy(on, label) {
    s.busy = on;
    $('#explain').disabled = on; $('#ask-send').disabled = on;
    $('#thinking').hidden = !on;
    if (label) $('#thinking-label').textContent = label;
  }

  async function explain() {
    if (s.busy) return;
    const ix = s.ix, deck = s.deck;
    const want = F.AI.langFor(deck.slides[ix]);
    const cur = deck.lessons[ix];
    // تغيّرت اللغة أو التخصص أو المستوى: نطلب شرحًا جديدًا
    if (!cur || (!deck.demo && (cur.lang !== want || (cur.source === 'ai' && cur.style !== F.AI.styleKey())))) {
      busy(true, 'فاهم يقرأ الشريحة ويجهّز الشرح…');
      const { lesson, note } = await F.AI.explain(deck, deck.slides[ix]);
      busy(false);
      if (deck !== s.deck || ix !== s.ix) return;
      deck.lessons[ix] = lesson;
      if (note) toast(note + ' عرضنا شرح مبسّط بداله.');
      else if (lesson.source === 'ai') {
        const saved = store.get(cacheKey(), {}); saved[ix] = lesson; store.set(cacheKey(), saved);
      }
    }
    V.rotate();
    setLesson(deck.lessons[ix], false);
    play(0);
  }

  async function ask(question) {
    question = question.trim();
    if (!question || s.busy) return;
    if (!s.deck.lessons[s.ix]) return toast('اشرح الشريحة أول، وبعدها اسأل عنها.');
    stop(); busy(true, 'فاهم يفكّر في سؤالك…');
    try {
      const lesson = await F.AI.ask(s.deck, s.deck.slides[s.ix], s.deck.lessons[s.ix], question);
      busy(false); $('#ask-input').value = '';
      V.rotate(); setLesson(lesson, true); play(0);
    } catch (e) { busy(false); toast(e.message || 'ما قدرنا نجاوب الحين.'); }
  }

  /* ---------- الاختبار: الطالب يختار طريقة أو أكثر ---------- */
  const MODES = [['cards', 'بطاقات Flash Cards', (l) => l.cards.length], ['mcq', 'اختيار من متعدد', (l) => l.quiz.length], ['tf', 'صح أو خطأ', (l) => l.tf.length]];
  const qz = { modes: store.get('quiz-modes', ['mcq']), card: 0, flipped: false, right: 0, answered: 0, total: 0 };

  function renderQuiz() {
    const q = $('#quiz'), l = s.lesson;
    q.hidden = false;
    q.innerHTML = `<h3>اختبر فهمك</h3><p class="muted">اختر طريقة الاختبار، وتقدر تختار أكثر من طريقة:</p>
      <div class="chips">${MODES.map(([id, label, count]) => `<button type="button" class="chip" data-mode="${id}" aria-pressed="${qz.modes.includes(id) && count(l) > 0}" ${count(l) ? '' : 'disabled'}>${label} · ${count(l)}</button>`).join('')}</div>
      <div><button type="button" class="btn primary" data-quiz="start">ابدأ الاختبار</button></div>`;
    q.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function cardHTML() {
    const l = s.lesson, c = l.cards[qz.card];
    return `<button type="button" class="flash${qz.flipped ? ' flipped' : ''}" data-quiz="flip" aria-label="اقلب البطاقة">
        <small>${qz.flipped ? 'الجواب' : 'اضغط عشان تشوف الجواب'}</small><strong data-keep>${esc(qz.flipped ? c.back : c.front)}</strong></button>
      <div class="row"><button type="button" class="btn ghost" data-quiz="card-prev" ${qz.card ? '' : 'disabled'}>السابقة</button>
        <span class="num muted">${qz.card + 1} / ${l.cards.length}</span>
        <button type="button" class="btn ghost" data-quiz="card-next" ${qz.card < l.cards.length - 1 ? '' : 'disabled'}>التالية</button></div>`;
  }

  function startQuiz() {
    const l = s.lesson, on = MODES.filter(([id, , count]) => qz.modes.includes(id) && count(l)).map(([id]) => id);
    if (!on.length) return toast('اختر طريقة اختبار وحدة على الأقل.');
    Object.assign(qz, { card: 0, flipped: false, right: 0, answered: 0, total: (on.includes('mcq') ? l.quiz.length : 0) + (on.includes('tf') ? l.tf.length : 0) });
    const parts = [];
    if (on.includes('cards')) parts.push(`<section class="qsec"><h4>بطاقات المراجعة</h4><div id="flash-box">${cardHTML()}</div></section>`);
    if (on.includes('mcq')) parts.push(`<section class="qsec"><h4>اختيار من متعدد</h4>${l.quiz.map((item, n) => `
      <fieldset class="q" data-kind="mcq" data-q="${n}"><legend data-keep>${esc(item.q)}</legend>
        ${item.options.map((o, k) => `<button type="button" class="opt" data-opt="${k}" data-keep>${esc(o)}</button>`).join('')}<p class="why" hidden></p></fieldset>`).join('')}</section>`);
    if (on.includes('tf')) parts.push(`<section class="qsec"><h4>صح أو خطأ</h4>${l.tf.map((item, n) => `
      <fieldset class="q" data-kind="tf" data-q="${n}"><legend data-keep>${esc(item.s)}</legend>
        <div class="row"><button type="button" class="opt" data-opt="true">صح</button><button type="button" class="opt" data-opt="false">خطأ</button></div><p class="why" hidden></p></fieldset>`).join('')}</section>`);
    $('#quiz').innerHTML = `<div class="reg-bar"><h3>اختبر فهمك</h3><button type="button" class="btn ghost" data-quiz="modes">غيّر الطريقة</button></div>
      ${parts.join('')}<p class="score" id="score" ${qz.total ? '' : 'hidden'}>جاوب على الأسئلة وتطلع نتيجتك هنا.</p>`;
  }

  function onQuiz(e) {
    const mode = e.target.closest('[data-mode]');
    if (mode) {
      const id = mode.dataset.mode, at = qz.modes.indexOf(id);
      if (at < 0) qz.modes.push(id); else qz.modes.splice(at, 1);
      mode.setAttribute('aria-pressed', at < 0); store.set('quiz-modes', qz.modes); return;
    }
    const act = e.target.closest('[data-quiz]');
    if (act) {
      const a = act.dataset.quiz;
      if (a === 'start') return startQuiz();
      if (a === 'modes') return renderQuiz();
      if (a === 'flip') qz.flipped = !qz.flipped;
      if (a === 'card-prev') { qz.card--; qz.flipped = false; }
      if (a === 'card-next') { qz.card++; qz.flipped = false; }
      $('#flash-box').innerHTML = cardHTML();
      const focus = $(`#flash-box [data-quiz="${a}"]:not(:disabled)`) || $('#flash-box .flash'); focus.focus();
      return;
    }
    const b = e.target.closest('.opt'); if (!b) return;
    const set = b.closest('.q'), tf = set.dataset.kind === 'tf';
    const item = (tf ? s.lesson.tf : s.lesson.quiz)[Number(set.dataset.q)];
    const pick = tf ? b.dataset.opt === 'true' : Number(b.dataset.opt), ok = pick === item.answer;
    $$('.opt', set).forEach((o) => {
      const v = tf ? o.dataset.opt === 'true' : Number(o.dataset.opt);
      o.disabled = true; o.classList.toggle('right', v === item.answer); o.classList.toggle('wrong', v === pick && !ok);
    });
    const why = $('.why', set); why.hidden = false;
    why.textContent = (ok ? 'صح! ' : 'مو هذي. ') + (item.why || '');
    qz.answered++; if (ok) { qz.right++; award(5); F.Sfx.right(); } else F.Sfx.wrong();
    $('#score').textContent = qz.answered < qz.total ? `نتيجتك حتى الآن: ${qz.right} من ${qz.answered}`
      : `خلصت! نتيجتك ${qz.right} من ${qz.total}. ${qz.right === qz.total ? 'ممتاز، فاهم الشريحة.' : 'راجع الشرح وجرّب مرة ثانية.'}`;
  }

  async function upload(files) {
    if (!files || !files.length) return;
    stop(); busy(true, 'نقرأ السلايدات…');
    try {
      const deck = await F.Slides.load(files, (n, total) => { $('#thinking-label').textContent = `نقرأ السلايدات… ${n} من ${total}`; });
      busy(false); setDeck(deck);
      toast(deck.cut ? `حمّلنا أول ${deck.slides.length} شريحة فقط.` : `جاهز: ${deck.slides.length} شريحة. اضغط «اشرح لي».`);
    } catch (e) { busy(false); toast(e.message || 'ما قدرنا نقرأ الملف.'); }
    $('#file').value = '';
  }

  function refreshProvider() {
    const p = F.AI.provider();
    $('#provider').textContent = p === 'local' ? 'بدون ذكاء اصطناعي' : F.AI.providerName();
    $('#provider').classList.toggle('warn', p === 'local');
    $('#mic').hidden = !V.canListen();
    const voice = V.describeVoice();
    $('#voice-chip').textContent = voice.label + (voice.natural ? '' : ' · آلي');
    $('#voice-chip').classList.toggle('warn', !voice.natural);
    const tip = $('#voice-tip');
    tip.hidden = voice.natural;
    if (!voice.natural && F.ui === 'en') tip.textContent = 'الصوت الحالي آلي. افتح هذي الصفحة في Microsoft Edge للصوت الطبيعي المجاني، أو افتح فاهم من رابط claude.ai بصوت Claude الطبيعي.';
    else if (!voice.natural) tip.innerHTML = (V.isEdge
      ? 'الصوت الحالي آلي لأن Edge ما حمّل أصواته العربية الطبيعية. تأكد من اتصال الإنترنت وحدّث الصفحة، ثم اختر من الإعدادات صوتًا اسمه ينتهي بـ Natural.'
      : 'الصوت الحالي آلي لأن هذا المتصفح ما فيه أصوات عربية طبيعية. افتح هذا الملف في Microsoft Edge للصوت الطبيعي المجاني.')
      + ' أو افتح فاهم من رابط claude.ai بصوت Claude الطبيعي.';
  }

  function init() {
    board = F.Board.create($('#board'));
    $('#file').addEventListener('change', (e) => upload(e.target.files));
    const drop = $('#study-drop');
    ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => upload(e.dataTransfer.files));

    $('#strip').addEventListener('click', (e) => { const t = e.target.closest('.thumb'); if (t) select(Number(t.dataset.ix)); });
    $('#slide-prev').addEventListener('click', () => select(s.ix - 1));
    $('#slide-next').addEventListener('click', () => select(s.ix + 1));
    $('#explain').addEventListener('click', explain);
    $('#play').addEventListener('click', togglePlay);
    $('#beat-prev').addEventListener('click', () => jump(s.beat - 1));
    $('#beat-next').addEventListener('click', () => jump(s.beat + 1));
    $('#dots').addEventListener('click', (e) => { const d = e.target.closest('.dot'); if (d) jump(Number(d.dataset.beat)); });
    $('#back-to-slide').addEventListener('click', () => { stop(); setLesson(s.deck.lessons[s.ix], false); });

    const speed = $('#speed');
    speed.value = String(store.get('rate', 1)); V.state.rate = Number(speed.value);
    speed.addEventListener('change', () => { V.state.rate = Number(speed.value); store.set('rate', V.state.rate); });
    const mute = $('#mute');
    V.state.muted = store.get('muted', false); mute.setAttribute('aria-pressed', V.state.muted);
    mute.addEventListener('click', () => {
      V.state.muted = !V.state.muted; store.set('muted', V.state.muted); mute.setAttribute('aria-pressed', V.state.muted);
      if (s.playing) { const at = s.beat; stop(); play(at); }
    });
    const auto = $('#auto');
    auto.checked = s.auto;
    auto.addEventListener('change', () => { s.auto = auto.checked; store.set('auto-next', s.auto); });

    $('#ask-form').addEventListener('submit', (e) => { e.preventDefault(); ask($('#ask-input').value); });
    $('#mic').addEventListener('click', () => {
      if (stopListening) { stopListening(); return; }
      $('#mic').setAttribute('aria-pressed', 'true');
      stopListening = V.listen((text) => { $('#ask-input').value = text; }, () => { stopListening = null; $('#mic').setAttribute('aria-pressed', 'false'); });
    });
    $('#quiz-btn').addEventListener('click', () => { stop(); renderQuiz(); });
    $('#cinema').addEventListener('click', () => {
      const box = $('.col-board');
      if (document.fullscreenElement) return document.exitFullscreen();
      if (!box.requestFullscreen) return toast('ملء الشاشة غير متاح في هذا المتصفح.');
      box.requestFullscreen().then(() => { if (!s.playing) togglePlay(); }).catch(() => toast('ملء الشاشة غير متاح هنا.'));
    });
    $('#quiz').addEventListener('click', onQuiz);

    document.addEventListener('keydown', (e) => {
      if ($('#view-study').hidden || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || $('#sheet').open) return;
      if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      const fwd = F.ui === 'ar' ? 'ArrowLeft' : 'ArrowRight', back = F.ui === 'ar' ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === fwd) jump(s.beat + 1);
      if (e.key === back) jump(s.beat - 1);
    });
    document.addEventListener('fahem:ai', refreshProvider);
    document.addEventListener('fahem:voice', refreshProvider);
    setTimeout(refreshProvider, 1500);
    document.addEventListener('fahem:leave-study', stop);
    // السبورة تقيس عرض النصوص، والقياس يحتاج أن تكون ظاهرة والخط محمّلًا: نعيد الرسم عند الدخول وبعد تحميل الخط
    const redraw = () => { if (s.lesson && !s.playing && !$('#view-study').hidden) { board.load(s.lesson); showBeat(s.lesson.beats.length - 1, false); } };
    document.addEventListener('fahem:enter-study', redraw);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(redraw);
    refreshProvider();
    // أمثلة جاهزة من تخصصات مختلفة
    const SHORT = { demo: 'حاسب: هياكل البيانات', 'demo-pharma': 'صيدلة: الباراسيتامول', 'demo-math': 'رياضيات: المعادلة التربيعية' };
    $('#demo-picks').innerHTML = F.Lesson.DEMO_DECKS.map((d) => `<button type="button" class="chip" data-demo="${d.id}" aria-pressed="false">${SHORT[d.id] || esc(d.name)}</button>`).join('');
    $('#demo-picks').addEventListener('click', (e) => { const c = e.target.closest('[data-demo]'); if (c) setDeck(F.Slides.demo(c.dataset.demo)); });
    const major = $('#major'), level = $('#level');
    major.innerHTML = F.AI.MAJORS.map((m) => `<option value="${m[0]}">${m[0] === 'general' ? 'تخصصك: الكل' : m[1]}</option>`).join('');
    major.value = store.get('major', 'general'); level.value = store.get('level', 'mid');
    [[major, 'major'], [level, 'level']].forEach(([el, key]) => el.addEventListener('change', () => {
      store.set(key, el.value);
      toast(F.AI.provider() === 'local' ? 'تم. هذا الخيار يأثر على الشرح الذكي فقط.' : 'تم. اضغط «اشرح لي» وبيطلع الشرح بالأسلوب الجديد.');
    }));
    renderXp();
    setDeck(F.Slides.demo());
  }

  F.Study = { init, refreshProvider };
})();
