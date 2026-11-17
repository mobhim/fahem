/* فاهم — الصوت: نطق الشرح والإملاء الصوتي.
 * الترتيب: ElevenLabs بمفتاح المستخدم ← صوت Claude (داخل claude.ai) ← نطق المتصفح ← مؤقّت صامت بنفس الإيقاع. */
(function () {
  'use strict';
  const synth = typeof speechSynthesis !== 'undefined' ? speechSynthesis : null;
  const state = { muted: false, rate: 1, tts: null, ttsOff: false, audio: null, unlocked: false, geminiOff: false, geminiVoice: '', turn: -1, pitch: 1, claudeVoice: '', elevenVoice: '', run: 0, timer: null, wake: null, left: 0 };

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

  /* ---------- تشغيل الصوت عبر WebAudio ----------
   * Safari و Chrome يمنعان أي صوت يبدأ بعد انتظار شبكة ما لم يُفتح الصوت داخل ضغطة المستخدم.
   * نفتح سياق الصوت (ونطق المتصفح) مع أول ضغطة، وبعدها كل المقاطع تشتغل منه بدون منع. */
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function unlock() {
    try {
      if (AC) { actx = actx || new AC(); if (actx.state === 'suspended') actx.resume(); }
      if (synth && !state.unlocked) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); }
      state.unlocked = true;
    } catch (e) { /* المتصفح ما يدعم */ }
  }
  ['pointerdown', 'keydown', 'touchend'].forEach((t) => document.addEventListener(t, unlock, { capture: true, passive: true }));
  // Safari يحمّل قائمة الأصوات متأخرًا وأحيانًا بدون حدث: نعيد المحاولة كم مرة
  if (synth) [300, 1000, 2500].forEach((ms) => setTimeout(() => { if (!arVoice || !enVoice()) pickVoice(); }, ms));

  function playBuffer(buffer, run) {
    return new Promise((resolve) => {
      const src = actx.createBufferSource();
      src.buffer = buffer; src.playbackRate.value = state.rate; src.connect(actx.destination);
      state.audio = src; state.wake = resolve;
      src.onended = () => { if (state.audio === src) { state.audio = null; state.wake = null; } resolve(); };
      if (run !== state.run) return resolve();
      src.start();
    });
  }
  const clips = new Map(); // مفتاح → وعد بمقطع جاهز (AudioBuffer)
  function cached(id, make) {
    if (clips.has(id)) return clips.get(id);
    const job = make(); job.catch(() => clips.delete(id));
    clips.set(id, job);
    if (clips.size > 80) clips.delete(clips.keys().next().value);
    return job;
  }

  /* ---------- صوت Gemini: طبيعي ويشتغل في كل المتصفحات، بنفس مفتاح الشرح أو عبر خادم الموقع ---------- */
  const GEMINI_VOICES = ['Kore', 'Puck', 'Aoede', 'Charon', 'Leda', 'Orus'];
  const geminiOn = () => !!AC && !state.geminiOff && F.store.get('gemini-voice', true) && !F.hosted && !!(F.PROXY || F.store.get('gemini-key', ''));
  function geminiClip(text) {
    const voice = state.geminiVoice || GEMINI_VOICES[0], model = F.store.get('gemini-tts-model', 'gemini-2.5-flash-preview-tts');
    return cached(['g', voice, model, text].join('|'), async () => {
      const headers = { 'Content-Type': 'application/json' };
      if (!F.PROXY) headers['x-goog-api-key'] = F.store.get('gemini-key', '');
      const res = await fetch(`${F.PROXY || 'https://generativelanguage.googleapis.com'}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers,
        body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } }),
      });
      if (!res.ok) throw Object.assign(new Error(`خطأ ${res.status} من Gemini.`), { fatal: res.status !== 429 && res.status < 500 });
      const part = ((((await res.json()).candidates || [])[0] || {}).content || { parts: [] }).parts.find((p) => p.inlineData || p.inline_data);
      const data = part && (part.inlineData || part.inline_data);
      if (!data || !data.data) throw new Error('Gemini ما رجّع صوتًا.');
      // الرد: عيّنات PCM خام 16-بت قناة واحدة
      const rate = Number(((data.mimeType || data.mime_type || '').match(/rate=(\d+)/) || [])[1]) || 24000;
      const bin = atob(data.data), n = bin.length >> 1, buf = actx.createBuffer(1, n, rate), ch = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { const v = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8); ch[i] = (v >= 32768 ? v - 65536 : v) / 32768; }
      return buf;
    });
  }

  /* ---------- ElevenLabs: اختياري ---------- */
  const EL = 'https://api.elevenlabs.io/v1';
  const elevenCfg = () => ({ key: F.store.get('eleven-key', ''), voice: state.elevenVoice || F.store.get('eleven-voice', ''), model: F.store.get('eleven-model', 'eleven_multilingual_v2') });
  // داخل claude.ai الشبكة مقفولة على ElevenLabs، فنستخدم صوت Claude هناك.
  const elevenOn = () => { const c = elevenCfg(); return !!AC && !F.hosted && !!(c.key && c.voice); };
  let elevenWarned = false;
  function elevenClip(text) {
    const c = elevenCfg();
    return cached(['e', c.voice, c.model, text].join('|'), async () => {
      const res = await fetch(`${EL}/text-to-speech/${encodeURIComponent(c.voice)}?output_format=mp3_44100_128`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'xi-api-key': c.key },
        // إعدادات تميل للإلقاء الطبيعي؛ وما نحدد لغة لأن النموذج يتعرّف على العربي والإنجليزي داخل الجملة تلقائيًا
        body: JSON.stringify({ text, model_id: c.model, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true } }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح ElevenLabs غير صالح.' : res.status === 429 ? 'وصلت حد الاستخدام في ElevenLabs.' : res.status === 404 || res.status === 400 ? 'الصوت أو النموذج المختار غير متاح في ElevenLabs.' : `خطأ ${res.status} من ElevenLabs.`);
      const bytes = await res.arrayBuffer();
      return new Promise((ok, bad) => actx.decodeAudioData(bytes, ok, () => bad(new Error('ما قدرنا نشغّل صوت ElevenLabs.'))));
    });
  }
  /** يجهّز صوت اللقطة القادمة والحالية تنطق، فما يصير فراغ بين اللقطات. */
  function warm(text) {
    if (state.muted || !actx) return;
    if (elevenOn()) elevenClip(text).catch(() => {}); else if (geminiOn()) geminiClip(text).catch(() => {});
  }

  async function listVoices(key) {
    const res = await fetch(`${EL}/voices`, { headers: { 'xi-api-key': key } });
    if (!res.ok) throw new Error(res.status === 401 ? 'مفتاح ElevenLabs غير صالح.' : `خطأ ${res.status} من ElevenLabs.`);
    const arabic = (v) => /arab|عرب/i.test(JSON.stringify([v.name, v.labels, v.description, v.verified_languages, v.fine_tuning && v.fine_tuning.language]));
    return ((await res.json()).voices || []).map((v) => ({ id: v.voice_id, name: v.name, arabic: arabic(v), tags: Object.values(v.labels || {}).join('، ') }))
      .sort((a, b) => b.arabic - a.arabic);
  }
  const kind = () => (elevenOn() ? 'eleven' : geminiOn() ? 'gemini' : state.tts && !state.ttsOff ? 'claude' : 'browser');
  /** وصف الصوت المستخدم الآن، وهل هو صوت طبيعي. */
  function describeVoice() {
    const k = kind();
    if (k === 'eleven') return { label: 'صوت ElevenLabs', natural: true };
    if (k === 'gemini') return { label: 'صوت Gemini', natural: true };
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
    if (!rotating()) { state.claudeVoice = ''; state.elevenVoice = ''; state.geminiVoice = ''; state.pitch = 1; pickVoice(); return; }
    const t = ++state.turn;
    state.claudeVoice = CLAUDE_VOICES[(CLAUDE_VOICES.indexOf(F.store.get('claude-voice', 'buttery')) + t) % CLAUDE_VOICES.length];
    const all = arVoices(), natural = all.filter((v) => quality(v) >= 4), pool = natural.length ? natural : all;
    if (pool.length) arVoice = pool[t % pool.length];
    // لو المتصفح فيه صوت عربي واحد فقط، نغيّر طبقته حتى يختلف من شرح لشرح
    state.pitch = pool.length > 1 ? 1 : [1, 0.82, 1.18][t % 3];
    state.geminiVoice = GEMINI_VOICES[t % GEMINI_VOICES.length];
    const ids = F.store.get('eleven-voices', []);
    state.elevenVoice = ids.length ? ids[t % ids.length] : '';
    document.dispatchEvent(new Event('fahem:voice'));
  }

  /** ينطق النص وينتهي الوعد لما يخلص الكلام (أو لما يتوقف). */
  async function speak(text, onWord) {
    stop();
    const run = ++state.run;
    if (state.muted) return silent(text, run);
    if (!actx) unlock();
    if (elevenOn()) {
      try { const buf = await elevenClip(text); if (run !== state.run) return; await playBuffer(buf, run); return; }
      catch (e) {
        if (run !== state.run) return;
        if (!elevenWarned) { elevenWarned = true; F.toast((e.message || 'تعذّر صوت ElevenLabs.') + ' كمّلنا بصوت المتصفح.'); }
      }
    } else if (geminiOn()) {
      try { const buf = await geminiClip(text); if (run !== state.run) return; await playBuffer(buf, run); return; }
      catch (e) {
        if (run !== state.run) return;
        if (e && e.fatal) state.geminiOff = true; // النموذج غير متاح لهذا المفتاح: ما نعيد المحاولة كل لقطة
        document.dispatchEvent(new Event('fahem:voice'));
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
    if (state.audio) { const src = state.audio; state.audio = null; try { src.onended = null; src.stop(); } catch (e) { /* لا شيء ينطق */ } }
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

  F.Voice = { state, estimate, unlock, audio: () => actx, isEdge: /Edg\//.test(navigator.userAgent), speak, stop, warm, rotate, kind, describeVoice, arVoices, setBrowserVoice, hasClaude: () => !!(state.tts && !state.ttsOff), listVoices, elevenCfg, resetWarning() { elevenWarned = false; state.geminiOff = false; }, canListen, listen };
})();
