/* فاهم — الصوت: نطق الشرح والإملاء الصوتي.
 * الترتيب: ElevenLabs بمفتاح المستخدم ← صوت Claude (داخل claude.ai) ← نطق المتصفح ← مؤقّت صامت بنفس الإيقاع. */
(function () {
  'use strict';
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const state = { muted: false, rate: 1, tts: null, ttsOff: false, audio: null, turn: -1, pitch: 1, claudeVoice: '', elevenVoice: '', run: 0, timer: null, wake: null, left: 0 };

  if (window.claude && window.claude.use) window.claude.use('tts').then((t) => { state.tts = t; }).catch(() => {});
  let arVoice = null;
  // نرتّب أصوات المتصفح العربية: الأصوات العصبية الطبيعية أولًا (مثل أصوات Edge «Natural» وأصوات Google)، ثم السعودي.
  const quality = (v) => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/^ar[-_]SA/i.test(v.lang) ? 2 : 0) + (v.localService ? 0 : 1);
  const arVoices = () => (synth ? synth.getVoices().filter((v) => /^ar/i.test(v.lang)).sort((a, b) => quality(b) - quality(a)) : []);
  const enQuality = (v) => (/natural|neural|online|premium|enhanced/i.test(v.name) ? 4 : 0) + (/google/i.test(v.name) ? 2 : 0) + (/^en[-_]US/i.test(v.lang) ? 2 : 0) + (v.localService ? 0 : 1);
  const enVoice = () => (synth ? synth.getVoices().filter((v) => /^en/i.test(v.lang)).sort((a, b) => enQuality(b) - enQuality(a))[0] || null : null);
  const pickVoice = () => {
    const list = arVoices(), saved = F.store.get('browser-voice', '');
    arVoice = list.find((v) => v.name === saved) || list[0] || null;
    document.dispatchEvent(new Event('fahem:voice'));
  };
  if (synth) { pickVoice(); synth.addEventListener && synth.addEventListener('voiceschanged', pickVoice); }

  const estimate = (text) => Math.max(1400, (text.split(/\s+/).length * 400) / state.rate);

  function silent(text, run) {
    return new Promise((resolve) => {
      state.left = estimate(text); state.wake = resolve;
      state.timer = setTimeout(() => { if (run === state.run) { state.wake = null; resolve(); } }, state.left);
    });
  }

  /** مقطع واحد بصوت واحد. */
  function utter(seg, voice, lang, run, onWord) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(seg.text);
      u.lang = voice ? voice.lang : lang; if (voice) u.voice = voice;
      u.rate = state.rate; u.pitch = state.pitch;
      let started = false;
      const done = () => { clearTimeout(guard); resolve(); };
      u.onstart = () => { started = true; };
      if (onWord) u.onboundary = (e) => { if (run === state.run && (e.name === 'word' || e.name === undefined)) onWord(seg.at + e.charIndex); };
      u.onend = done;
      u.onerror = () => (run === state.run && !started ? silent(seg.text, run).then(resolve) : done());
      // بعض المتصفحات ما تطلق أي حدث لو ما فيه صوت مثبّت؛ والأصوات الطبيعية تُحمَّل من الشبكة وتحتاج وقتًا أطول لتبدأ
      const guard = setTimeout(() => { if (!started && run === state.run) { synth.cancel(); silent(seg.text, run).then(resolve); } }, voice && !voice.localService ? 7000 : 2500);
      synth.speak(u);
    });
  }

  /** ينطق الجملة مقطعًا مقطعًا: العربي بصوت عربي والإنجليزي بصوت إنجليزي، تلقائيًا. */
  async function browser(text, run, onWord) {
    const en = enVoice();
    // الصوت العربي الطبيعي ينطق المصطلح الإنجليزي المفرد بشكل مقبول؛ الصوت الآلي يتخطاه، فنبدّل له حتى على كلمة واحدة
    const segs = en ? F.Lesson.segments(text, arVoice && quality(arVoice) >= 4 ? 3 : 1) : [{ lang: 'ar', text, at: 0 }];
    for (const seg of segs) {
      if (run !== state.run) return;
      await utter(seg, seg.lang === 'en' ? en : arVoice, seg.lang === 'en' ? 'en-US' : 'ar-SA', run, onWord);
    }
  }

  /* ---------- ElevenLabs: صوت بشري طبيعي، يُجهَّز مسبقًا لكل لقطة ---------- */
  const EL = 'https://api.elevenlabs.io/v1';
  const elevenCfg = () => ({ key: F.store.get('eleven-key', ''), voice: state.elevenVoice || F.store.get('eleven-voice', ''), model: F.store.get('eleven-model', 'eleven_multilingual_v2') });
  // داخل claude.ai الشبكة مقفولة على ElevenLabs، فنستخدم صوت Claude هناك.
  const elevenOn = () => { const c = elevenCfg(); return !F.hosted && !!(c.key && c.voice); };
  const clips = new Map();
  let elevenWarned = false;

  function elevenClip(text) {
    const c = elevenCfg(), id = [c.voice, c.model, text].join('|');
    if (clips.has(id)) return clips.get(id);
    const job = fetch(`${EL}/text-to-speech/${encodeURIComponent(c.voice)}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': c.key },
      // إعدادات تميل للإلقاء الطبيعي: ثبات متوسط يعطي تنغيمًا حيًّا بدل النبرة الواحدة
      // ما نحدد لغة: النموذج متعدد اللغات يتعرّف على العربي والإنجليزي داخل الجملة تلقائيًا
      body: JSON.stringify({ text, model_id: c.model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
    }).then(async (res) => {
      if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح ElevenLabs غير صالح.' : res.status === 429 ? 'وصلت حد الاستخدام في ElevenLabs.' : res.status === 404 || res.status === 400 ? 'الصوت أو النموذج المختار غير متاح في ElevenLabs.' : `خطأ ${res.status} من ElevenLabs.`);
      return URL.createObjectURL(await res.blob());
    });
    job.catch(() => clips.delete(id));
    clips.set(id, job);
    if (clips.size > 60) { const old = clips.keys().next().value; clips.get(old).then((u) => URL.revokeObjectURL(u)).catch(() => {}); clips.delete(old); }
    return job;
  }
  /** يجهّز صوت اللقطة القادمة والحالية تنطق، فما يصير فراغ بين اللقطات. */
  function warm(text) { if (elevenOn() && !state.muted) elevenClip(text).catch(() => {}); }

  async function eleven(text, run) {
    const url = await elevenClip(text);
    if (run !== state.run) return;
    const audio = new Audio(url);
    audio.playbackRate = state.rate; state.audio = audio;
    await new Promise((resolve, reject) => {
      state.wake = resolve; audio.onended = resolve;
      audio.onerror = () => reject(new Error('ما قدرنا نشغّل صوت ElevenLabs.'));
      audio.play().catch(reject);
    });
    if (state.audio === audio) { state.audio = null; state.wake = null; }
  }

  async function listVoices(key) {
    const res = await fetch(`${EL}/voices`, { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح ElevenLabs غير صالح.' : `خطأ ${res.status} من ElevenLabs.`);
    const arabic = (v) => /arab|عرب/i.test(JSON.stringify([v.name, v.labels, v.description, v.verified_languages, v.fine_tuning && v.fine_tuning.language]));
    return ((await res.json()).voices || []).map((v) => ({ id: v.voice_id, name: v.name, arabic: arabic(v), tags: Object.values(v.labels || {}).join('، ') }))
      .sort((a, b) => b.arabic - a.arabic);
  }
  const kind = () => (elevenOn() ? 'eleven' : state.tts && !state.ttsOff ? 'claude' : 'browser');
  /** وصف الصوت المستخدم الآن، وهل هو صوت طبيعي. */
  function describeVoice() {
    const k = kind();
    if (k === 'eleven') return { label: 'صوت ElevenLabs', natural: true };
    if (k === 'claude') return { label: 'صوت Claude' + (state.claudeVoice ? ' · ' + ({ buttery: 'دافئ', airy: 'خفيف', glassy: 'صافي', rounded: 'عميق' }[state.claudeVoice]) : ''), natural: true };
    if (F.ui === 'en') { // الواجهة إنجليزية: المهم هو الصوت الإنجليزي
      const v = enVoice();
      return v ? { label: v.name.replace(/Microsoft |Google /, '').slice(0, 34), natural: enQuality(v) >= 4 } : { label: 'لا يوجد صوت في هذا المتصفح', natural: false };
    }
    if (!arVoice) return { label: 'لا يوجد صوت عربي في هذا المتصفح', natural: false };
    return { label: arVoice.name.replace(/Microsoft |Google /, '').slice(0, 34), natural: quality(arVoice) >= 4 };
  }
  const setBrowserVoice = (name) => { F.store.set('browser-voice', name); pickVoice(); };

  /* ---------- تغيير الصوت مع كل شرح (مجاني: يدور على الأصوات المتاحة أصلًا) ---------- */
  const CLAUDE_VOICES = ['buttery', 'airy', 'glassy', 'rounded'];
  const rotating = () => F.store.get('rotate-voice', true);
  /** يُستدعى مع بداية كل شرح جديد: ينقل للصوت التالي في كل مزوّد. */
  function rotate() {
    if (!rotating()) { state.claudeVoice = ''; state.elevenVoice = ''; state.pitch = 1; pickVoice(); return; }
    const t = ++state.turn;
    state.claudeVoice = CLAUDE_VOICES[(CLAUDE_VOICES.indexOf(F.store.get('claude-voice', 'buttery')) + t) % CLAUDE_VOICES.length];
    const all = arVoices(), natural = all.filter((v) => quality(v) >= 4), pool = natural.length ? natural : all;
    if (pool.length) arVoice = pool[t % pool.length];
    // لو المتصفح فيه صوت عربي واحد فقط، نغيّر طبقته حتى يختلف من شرح لشرح
    state.pitch = pool.length > 1 ? 1 : [1, 0.82, 1.18][t % 3];
    const ids = F.store.get('eleven-voices', []);
    state.elevenVoice = ids.length ? ids[t % ids.length] : '';
    document.dispatchEvent(new Event('fahem:voice'));
  }

  /** ينطق النص وينتهي الوعد لما يخلص الكلام (أو لما يتوقف). */
  async function speak(text, onWord) {
    stop();
    const run = ++state.run;
    if (state.muted) return silent(text, run);
    if (elevenOn()) {
      try { await eleven(text, run); return; }
      catch (e) {
        if (run !== state.run) return;
        state.audio = null; state.wake = null;
        if (!elevenWarned) { elevenWarned = true; F.toast((e.message || 'تعذّر صوت ElevenLabs.') + ' كمّلنا بصوت المتصفح.'); }
      }
    }
    if (state.tts && !state.ttsOff) {
      try {
        const voice = state.claudeVoice || F.store.get('claude-voice', 'buttery'), rate = Math.min(1.5, Math.max(0.7, state.rate));
        const lines = F.Lesson.segments(text.slice(0, 1900), 3).map((seg) => ({ text: seg.text, voice, rate, language: seg.lang }));
        await (lines.length > 1 ? state.tts.speak(lines) : state.tts.speak(lines[0].text, { voice, rate, language: lines[0].language }));
        return;
      }
      catch (e) {
        if (run !== state.run) return;
        if (e && (e.code === 'not_granted' || e.code === 'capability_disabled')) state.ttsOff = true;
        if (e && e.code === 'viewer_stopped') return;
      }
    }
    if (run !== state.run) return;
    if (synth && typeof SpeechSynthesisUtterance !== 'undefined') return browser(text, run, onWord);
    return silent(text, run);
  }

  function stop() {
    state.run++;
    clearTimeout(state.timer);
    if (state.wake) { const w = state.wake; state.wake = null; w(); }
    if (state.audio) { try { state.audio.pause(); } catch (e) { /* لا شيء ينطق */ } state.audio = null; }
    try { if (state.tts) state.tts.stop(); } catch (e) { /* لا شيء ينطق */ }
    try { if (synth) synth.cancel(); } catch (e) { /* لا شيء ينطق */ }
  }
  /* ---------- الإملاء: اسأل بصوتك ---------- */
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let dictation = null;
  if (window.claude && window.claude.use) window.claude.use('dictation').then((d) => { dictation = d; document.dispatchEvent(new Event('fahem:voice')); }).catch(() => {});
  const canListen = () => !!(dictation || Rec);

  /** يبدأ الاستماع؛ onText(نص, نهائي؟). يرجّع دالة إيقاف. لازم يُستدعى من ضغطة المستخدم مباشرة. */
  function listen(onText, onEnd) {
    if (dictation) {
      let heard = '';
      const offs = [
        dictation.onPartial(({ text }) => onText((heard + ' ' + text).trim(), false)),
        dictation.onFinal(({ text }) => { heard = (heard + ' ' + text).trim(); onText(heard, true); }),
        dictation.onState(({ state: s }) => { if (s === 'idle') { offs.forEach((o) => typeof o === 'function' && o()); onEnd(); } }),
      ];
      dictation.start().catch(() => onEnd());
      return () => { dictation.stop().catch(() => {}); };
    }
    const r = new Rec();
    r.lang = 'ar-SA'; r.interimResults = true;
    r.onresult = (e) => { const res = e.results[e.results.length - 1]; onText(res[0].transcript, res.isFinal); };
    r.onend = onEnd; r.onerror = onEnd;
    r.start();
    return () => r.stop();
  }

  F.Voice = { state, estimate, isEdge: /Edg\//.test(navigator.userAgent), speak, stop, warm, rotate, kind, describeVoice, arVoices, setBrowserVoice, hasClaude: () => !!(state.tts && !state.ttsOff), listVoices, elevenCfg, resetWarning() { elevenWarned = false; }, canListen, listen };
})();
