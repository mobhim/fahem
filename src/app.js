/* فاهم — التشغيل: التنقل بين الأقسام، المشهد ثلاثي الأبعاد، الإعدادات، والوضع الليلي. */
(function () {
  'use strict';
  const { $, $$, esc, store, toast } = F;
  const VIEWS = ['home', 'study', 'register'];
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function route() {
    const name = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    if (name !== 'study') document.dispatchEvent(new Event('fahem:leave-study'));
    VIEWS.forEach((v) => { $('#view-' + v).hidden = v !== name; });
    $$('[data-nav]').forEach((a) => (a.dataset.nav === name ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    window.scrollTo(0, 0);
    if (name === 'study') document.dispatchEvent(new Event('fahem:enter-study'));
  }

  /* المشهد: الألواح تميل مع المؤشر وتنفرد مع التمرير */
  function scene() {
    const sc = $('#scene');
    if (calm) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = sc.getBoundingClientRect(), vh = window.innerHeight || 1;
      sc.style.setProperty('--s', Math.max(0, Math.min(1, (vh * 0.35 - r.top) / (vh * 0.9))).toFixed(3));
    };
    window.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      sc.style.setProperty('--px', ((e.clientX / window.innerWidth - 0.5) * 2).toFixed(3));
      sc.style.setProperty('--py', ((e.clientY / window.innerHeight - 0.5) * 2).toFixed(3));
    }, { passive: true });
    $$('[data-tilt]').forEach((t) => {
      t.addEventListener('pointermove', (e) => {
        const r = t.getBoundingClientRect();
        t.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(3));
        t.style.setProperty('--ty', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(3));
      });
      t.addEventListener('pointerleave', () => { t.style.setProperty('--tx', 0); t.style.setProperty('--ty', 0); });
    });
    update();
  }

  /* سبورة الواجهة: درس المكدّس يرسم نفسه بصمت ويعيد */
  function heroBoard() {
    const lesson = F.ui === 'en' ? F.Lesson.normalize(F.DEMOS_EN[0].lessons[2], 'demo', 'en') : F.Lesson.normalize(F.Lesson.DEMO_DECK.lessons[2], 'demo');
    const board = F.Board.create($('#hero-board'));
    board.load(lesson);
    const last = lesson.beats.length - 1;
    board.show(last, false); board.setAlive(true);
    $('#hero-caption').textContent = lesson.beats[1].say;
    if (calm) return;
    let i = 0;
    const tick = () => {
      if (!$('#view-home').hidden && !document.hidden) {
        board.show(i, true); $('#hero-caption').textContent = lesson.beats[i].say;
        i = i === last ? 0 : i + 1;
      }
      setTimeout(tick, i === 0 ? 5200 : 3000);
    };
    setTimeout(tick, 2600);
  }

  function nextClass() {
    const box = $('#next-class'), n = F.Reg.nextClass(new Date());
    box.hidden = !n; if (!n) return;
    const h = Math.floor(n.wait / 60), when = n.wait < 60 ? `بعد ${n.wait} دقيقة` : h < 24 ? `بعد ${h} ساعة` : `يوم ${F.Sched.DAYS[n.m.day]}`;
    box.innerHTML = `<div class="next"><div><p class="eyebrow">محاضرتك القادمة · ${when}</p>
      <h2>${esc(n.course.name)}${n.sec.kind === 'lab' ? ' (عملي)' : ''}</h2>
      <p class="muted">${F.Sched.DAYS[n.m.day]} ${F.Sched.fmt12(n.m.start)} · ${esc(n.sec.room)} · ${esc(n.sec.instructor)}</p></div>
      <div class="row"><a class="btn primary" href="#study">ذاكر قبلها</a><a class="btn ghost" href="#register">جدولي</a></div></div>`;
  }

  function settings() {
    const c = F.AI.cfg(), v = F.Voice.elevenCfg(), savedName = store.get('eleven-voice-name', '');
    const body = F.sheet.open(`<h3>الإعدادات</h3>` + (F.hosted
      ? `<p class="muted">هنا الشرح الذكي يشتغل عبر Claude والصوت بصوته الطبيعي، بدون أي مفاتيح. أول شرح يطلب إذنك مرة واحدة.</p>
         <div class="form"><label for="set-lang">لغة الشرح</label>
          <select id="set-lang">${[['auto', 'تلقائي: حسب لغة الشريحة'], ['ar', 'عربي دائمًا'], ['en', 'English always']].map(([id, n]) => `<option value="${id}" ${store.get('lang', 'auto') === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <p class="muted">الصوت يبدّل تلقائيًا بين صوت عربي وصوت إنجليزي داخل الجملة نفسها.</p>
          <p class="muted">الصوت تلقائي: فاهم يختار أفضل صوت متاح ويغيّره مع كل شرح، وما تحتاج تضبط شي.</p>
          <details class="adv"><summary>خيارات الصوت المتقدمة (اختياري)</summary><div class="form">
          <label for="cl-voice">صوت الشرح</label>
           <select id="cl-voice">${[['buttery', 'دافئ'], ['airy', 'خفيف'], ['glassy', 'صافي'], ['rounded', 'عميق']].map(([id, n]) => `<option value="${id}" ${store.get('claude-voice', 'buttery') === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
           <button type="button" class="btn ghost" id="voice-test">جرّب الصوت</button>
           <label class="check"><input type="checkbox" id="rot-voice" ${store.get('rotate-voice', true) ? 'checked' : ''}> غيّر الصوت مع كل شرح</label></div></details></div>
         <p class="muted">الصوت هنا مجاني ضمن حسابك في Claude. مع تفعيل التغيير يدور فاهم على الأصوات الأربعة، صوت لكل شرح.</p>
         <p class="muted">النسخة المستقلة من فاهم تشتغل على Gemini للشرح و ElevenLabs للصوت بمفاتيحك الخاصة.</p>`
      : `<form id="set-form" class="form">
          <label for="set-lang">لغة الشرح</label>
          <select id="set-lang">${[['auto', 'تلقائي: حسب لغة الشريحة'], ['ar', 'عربي دائمًا'], ['en', 'English always']].map(([id, n]) => `<option value="${id}" ${store.get('lang', 'auto') === id ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <p class="muted">الصوت يبدّل تلقائيًا بين صوت عربي وصوت إنجليزي داخل الجملة نفسها.</p>
          <h4>الشرح: Gemini</h4>
          <label for="set-key">مفتاح Gemini API</label>
          <input id="set-key" type="password" dir="ltr" autocomplete="off" value="${esc(c.key)}" placeholder="AIza…">
          <label for="set-model">النموذج</label>
          <input id="set-model" type="text" dir="ltr" value="${esc(c.model)}">
          <p class="muted">الصوت تلقائي: فاهم يختار أفضل صوت متاح ويغيّره مع كل شرح، وما تحتاج تضبط شي.</p>
          <details class="adv"><summary>خيارات الصوت المتقدمة (اختياري)</summary><div class="form">
          <label class="check"><input type="checkbox" id="gem-voice" ${store.get('gemini-voice', true) ? 'checked' : ''}> استخدم صوت Gemini الطبيعي مع مفتاح Gemini (يشتغل في كل المتصفحات)</label>
          <label for="gem-tts">نموذج صوت Gemini</label>
          <input id="gem-tts" type="text" dir="ltr" value="${esc(store.get('gemini-tts-model', 'gemini-2.5-flash-preview-tts'))}">
          <h4>الصوت: ElevenLabs (اختياري ومدفوع)</h4>
          <label for="el-key">مفتاح ElevenLabs API</label>
          <div class="row"><input id="el-key" class="grow" type="password" dir="ltr" autocomplete="off" value="${esc(v.key)}" placeholder="sk_…">
            <button type="button" class="btn ghost" id="el-load">حمّل أصواتي</button></div>
          <label for="el-voice">الصوت</label>
          <select id="el-voice">${v.voice ? `<option value="${esc(v.voice)}">${esc(savedName || v.voice)}</option>` : '<option value="">أدخل المفتاح ثم اضغط «حمّل أصواتي»</option>'}</select>
          <label for="el-model">نموذج الصوت</label>
          <input id="el-model" type="text" dir="ltr" list="el-models" value="${esc(v.model)}">
          <p class="muted">كل النماذج المقترحة تنطق العربية. الأصوات العربية في حسابك تظهر أول القائمة، وأي صوت آخر ينطق العربية أيضًا لكن بلكنته.</p>
          <datalist id="el-models"><option value="eleven_multilingual_v2"></option><option value="eleven_flash_v2_5"></option><option value="eleven_turbo_v2_5"></option><option value="eleven_v3"></option></datalist>
          <button type="button" class="btn ghost" id="el-test">جرّب الصوت</button>
          <h4>صوت المتصفح: مجاني دائمًا</h4>
          <label class="check"><input type="checkbox" id="rot-voice" ${store.get('rotate-voice', true) ? 'checked' : ''}> غيّر الصوت مع كل شرح</label>
          <label for="br-voice">الصوت العربي</label>
          <select id="br-voice">${F.Voice.arVoices().map((x) => `<option value="${esc(x.name)}">${esc(x.name)}</option>`).join('') || '<option value="">لا يوجد صوت عربي مثبّت في هذا المتصفح</option>'}</select>
          <p class="muted">هذا الخيار لا يحتاج مفتاحًا ولا رصيدًا. للصوت الطبيعي مجانًا افتح فاهم في Microsoft Edge، ففيه أصوات عربية اسمها ينتهي بـ Natural وفاهم يدور عليها. في المتصفحات الأخرى الأصوات آلية، ولو كان فيها صوت عربي واحد يغيّر فاهم طبقته من شرح لشرح.</p>
          </div></details>
          <p class="muted">المفاتيح تنحفظ في هذا المتصفح فقط وتُرسل مباشرة إلى Google و ElevenLabs. بدون مفتاح Gemini يعطيك فاهم شرحًا مبسّطًا، وبدون ElevenLabs ينطق بصوت المتصفح.</p>
          <div class="reg-bar"><button type="button" class="btn ghost" id="set-clear">احذف المفاتيح</button><button type="submit" class="btn primary">حفظ</button></div>
        </form>`));
    const sample = F.ui === 'en' ? 'Hi! I am Fahem, and this is the voice I will explain your slides in.' : 'هلا! أنا فاهم، وبهذا الصوت راح أشرح لك سلايداتك.';
    $('#set-lang', body).addEventListener('change', (e) => { store.set('lang', e.target.value); toast('تم. الشروح الجديدة بتطلع بهذي اللغة.'); });
    $('#rot-voice', body).addEventListener('change', (e) => { store.set('rotate-voice', e.target.checked); F.Voice.rotate(); });
    const clv = $('#cl-voice', body);
    if (clv) {
      clv.addEventListener('change', () => store.set('claude-voice', clv.value));
      $('#voice-test', body).addEventListener('click', () => F.Voice.speak(sample));
    }
    const form = $('#set-form', body); if (!form) return;
    const sel = $('#el-voice', body), brv = $('#br-voice', body);
    if (F.Voice.describeVoice().label && brv.value) brv.value = (F.Voice.arVoices().find((x) => x.name === store.get('browser-voice', '')) || F.Voice.arVoices()[0]).name;
    brv.addEventListener('change', () => { F.Voice.setBrowserVoice(brv.value); if (!sel.value) F.Voice.speak(sample); });
    const persist = () => {
      store.set('gemini-key', $('#set-key').value.trim()); store.set('gemini-model', $('#set-model').value.trim() || 'gemini-2.5-flash');
      store.set('gemini-voice', $('#gem-voice').checked); store.set('gemini-tts-model', $('#gem-tts').value.trim() || 'gemini-2.5-flash-preview-tts');
      store.set('eleven-key', $('#el-key').value.trim()); store.set('eleven-voice', sel.value);
      store.set('eleven-voice-name', sel.value ? sel.options[sel.selectedIndex].textContent : '');
      store.set('eleven-model', $('#el-model').value.trim() || 'eleven_multilingual_v2');
      F.Voice.resetWarning(); F.Study.refreshProvider();
    };
    $('#el-load', body).addEventListener('click', async () => {
      const key = $('#el-key').value.trim();
      if (!key) return toast('أدخل مفتاح ElevenLabs أول.');
      try {
        const voices = await F.Voice.listVoices(key), keep = sel.value;
        if (!voices.length) return toast('ما لقينا أصوات في حسابك.');
        const ar = voices.filter((x) => x.arabic);
        store.set('eleven-voices', (ar.length ? ar : voices).slice(0, 12).map((x) => x.id));
        sel.innerHTML = voices.map((x) => `<option value="${esc(x.id)}">${x.arabic ? 'عربي · ' : ''}${esc(x.name)}${x.tags ? ' · ' + esc(x.tags) : ''}</option>`).join('');
        if (voices.some((x) => x.id === keep)) sel.value = keep;
        toast(`حمّلنا ${voices.length} صوت. اختر واحد واضغط «جرّب الصوت».`);
      } catch (e) { toast(e.message || 'ما قدرنا نحمّل الأصوات.'); }
    });
    $('#el-test', body).addEventListener('click', () => {
      if (!$('#el-key').value.trim() || !sel.value) return toast('أدخل المفتاح واختر صوت أول.');
      persist(); F.Voice.speak(sample);
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); persist(); F.sheet.close(); toast('تم حفظ الإعدادات.'); });
    $('#set-clear', body).addEventListener('click', () => {
      ['gemini-key', 'eleven-key', 'eleven-voice', 'eleven-voice-name', 'eleven-voices'].forEach((k) => store.del(k));
      F.sheet.close(); F.Study.refreshProvider(); toast('حذفنا المفاتيح.');
    });
  }

  function theme() {
    const saved = store.get('theme', null);
    if (saved) document.documentElement.dataset.theme = saved;
    $('#theme').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next; store.set('theme', next);
    });
  }

  function start() {
    F.I18n.start();
    const lb = $('#lang'); lb.textContent = F.ui === 'ar' ? 'EN' : 'ع'; lb.setAttribute('aria-label', F.ui === 'ar' ? 'English' : 'العربية'); lb.dataset.keep = '';
    lb.addEventListener('click', () => F.I18n.setLang(F.ui === 'ar' ? 'en' : 'ar'));
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    theme();
    $('#settings').addEventListener('click', settings);
    $('#sheet-x').addEventListener('click', F.sheet.close);
    $('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') F.sheet.close(); });
    document.addEventListener('fahem:schedule', nextClass);
    F.Study.init(); F.Reg.init();
    heroBoard(); scene(); nextClass();
    window.addEventListener('hashchange', route); route();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
