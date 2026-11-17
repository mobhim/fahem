/* فاهم — المعلّم الذكي: يحوّل الشريحة إلى درس (سرد + خريطة + اختبار).
 * المزوّدات بالترتيب: Gemini بمفتاح المستخدم ← Claude داخل claude.ai ← شرح محلي بدون ذكاء اصطناعي. */
(function () {
  'use strict';
  const L = F.Lesson;
  let sample = null, sampleImages = false;
  if (window.claude && window.claude.use) {
    window.claude.use('sample').then(async (s) => {
      sample = s;
      try { sampleImages = !!(s && (await s.limits()).images); } catch (e) { sampleImages = false; }
      document.dispatchEvent(new Event('fahem:ai'));
    }).catch(() => {});
  }

  const cfg = () => ({ key: F.store.get('gemini-key', ''), model: F.store.get('gemini-model', 'gemini-2.5-flash') });
  // داخل claude.ai الشبكة مقفولة على Gemini، فنستخدم Claude هناك.
  const provider = () => (!F.hosted && cfg().key ? 'gemini' : sample ? 'claude' : 'local');
  const providerName = () => ({ gemini: `Gemini (${cfg().model})`, claude: 'Claude', local: 'شرح مبسّط بدون ذكاء اصطناعي' }[provider()]);

  const SHAPES_AR = `map خريطة ذهنية لمفهوم وفروعه (ضع hub)؛ steps خطوات متتابعة أو تسلسل زمني؛ cycle دورة تتكرر؛ compare مقارنة بين شيئين (ضع a و b، ولكل عنصر side)؛ bars أعمدة لمقارنة كميات؛ line خط لتغيّر كمية مع الوقت أو الحجم؛ pie نسب من كل؛ list قائمة نقاط؛ formula معادلة تُشتق أو تُحل سطرًا سطرًا (label هو السطر الرياضي بالرموز فقط بدون كلمات عربية، و detail وصف قصير للخطوة)؛ lab تجربة أو رحلة مادة عبر أوعية مختبر (لكل عنصر vessel واحد من beaker أو flask أو tube أو pill أو drop)؛ timeline خط زمني (label الحدث و detail تاريخه)؛ table جدول (ضع cols عناوين الأعمدة حتى 3، ولكل عنصر label اسم الصف و cells خلاياه)؛ pyramid مستويات من القاعدة إلى القمة؛ code كود قصير يُتتبّع سطرًا سطرًا (label هو سطر الكود كما هو حتى 55 حرفًا، و say يشرح السطر)؛ big عبارة أو رقم أو معادلة واحدة تستحق الإبراز (ضع text و note، بدون items)`;
  const SHAPES_EN = `map: a mind map of a concept and its branches (set hub); steps: sequential steps or a timeline; cycle: a repeating loop; compare: two things side by side (set a and b, and side on each item); bars: bar chart comparing quantities; line: line chart of a quantity changing over time or size; pie: shares of a whole; list: bullet points; formula: an equation derived or solved line by line (label is the maths line as-is, detail a short name for the step); lab: an experiment or a substance's journey through lab vessels (each item has a vessel: beaker, flask, tube, pill or drop); timeline: events on a time axis (label the event, detail its date); table: a table (set cols, up to 3 column headers, and on each item label as the row name and cells as its cells); pyramid: levels from base to top; code: a short snippet traced line by line (label is the code line as-is, up to 55 characters, and say explains that line); big: one statement, number or formula worth a spotlight (set text and note, no items)`;

  const SCHEMA = `Return JSON only, with no text before or after it, in this shape:
{"title":"...",
 "scenes":[{"type":"map|steps|cycle|compare|bars|line|pie|list|code|formula|lab|timeline|table|pyramid|big","title":"...","say":"...",
   "hub":"...","a":"...","b":"...","cols":["..."],"text":"...","note":"...","unit":"...","approx":false,
   "items":[{"label":"...","detail":"...","value":0,"side":"a","cells":["..."],"vessel":"...","icon":"...","say":"..."}]}],
 "takeaway":"...",
 "quiz":[{"q":"...","options":["...","...","..."],"answer":0,"why":"..."}],
 "cards":[{"front":"...","back":"..."}],
 "tf":[{"s":"...","answer":true,"why":"..."}]}`;

  const RULES = `القواعد:
- عندك سبورة كبيرة مفتوحة، ولست ملزمًا بشكل واحد. قسّم الشرح إلى 3 إلى 5 مشاهد، واختر لكل مشهد الشكل البصري الأنسب لفكرته، ونوّع بين الأشكال.
- اشرح شرحًا كاملًا كما يشرح أستاذ متمكّن، لا مجرد إعادة نقاط الشريحة: لكل فكرة قل ما هي، ولماذا تهم، وكيف تشتغل، ومثالًا عليها. لازم يكون فيه مشهد لمثال محلول أو حالة واقعية، ومشهد أخير عن خطأ شائع أو متى تُستخدم الفكرة.
- كيّف طريقة الشرح مع طبيعة المادة: الرياضيات والفيزياء والإحصاء بمعادلة تُحل سطرًا سطرًا (formula) ثم رسم بياني للعلاقة (line) ثم تحقق من الحل؛ الصيدلة والطب بآلية عمل الدواء (lab أو steps) ومنحنى تركيزه مع الوقت (line) وجدول للجرعات والآثار الجانبية والتداخلات (table)؛ الكيمياء والأحياء بتجربة أو تفاعل في أوعية المختبر (lab) ودورة أو آلية (cycle)؛ البرمجة بكود قصير يُتتبّع (code) ثم ما يحدث في الذاكرة؛ الهندسة بخطوات التصميم والأرقام (steps و bars)؛ الإدارة والاقتصاد والمحاسبة بمقارنات وأرقام وجداول (compare و bars و pie و table)؛ التاريخ بخط زمني (timeline)؛ القانون والشريعة بشروط واستثناءات ومستويات (list و pyramid و table)؛ اللغات بأمثلة صح وخطأ (compare).
- الأشكال المتاحة: ${SHAPES_AR}.
- الرسوم البيانية (bars, line, pie) تحتاج value رقمية لكل عنصر. استخدم أرقام الشريحة إن وُجدت. لو الأرقام للتوضيح فقط (مثل مقارنة نمو خوارزميتين) ضع approx:true، ولا تخترع إحصاءات تبدو حقيقية.
- كل مشهد: say تمهيد من جملة أو جملتين، ثم 2 إلى 5 عناصر، ولكل عنصر say من جملة إلى جملتين تشرحه فعلًا وتُقال وهو ينرسم. أول مشهد يبدأ بتشبيه من الحياة اليومية.
- label لا يزيد عن 4 كلمات، و detail لا يزيد عن 8 كلمات.
- كل say بالعامية السعودية الدارجة (لهجة نجدية خفيفة يفهمها الجميع) كأنك صديق يشرح لصديقه، بدون فصحى وبدون أسلوب الكتب، مكتوبة كما تُنطق: الرموز والأرقام تُكتب بالحروف، والمصطلحات التقنية تبقى بالإنجليزية.
- icon أيقونة متحركة تناسب معنى العنصر (في map و steps و list)، واحدة من: ${L.ICON_NAMES.join(', ')}.
- الشرح والعناوين والأسئلة كلها بالعربية حتى لو كانت الشريحة بلغة أخرى؛ المصطلح التقني فقط يبقى بلغته.
- اشرح الفكرة ولا تقرأ الشريحة حرفيًا. لا تخترع معلومات تخالف محتوى الشريحة.
- quiz سؤالان يقيسان الفهم لا الحفظ، و answer هو رقم الخيار الصحيح بدءًا من صفر.
- cards أربع بطاقات مراجعة Flash Cards لأهم مصطلحات الشريحة.
- tf ثلاث عبارات صح أو خطأ، بعضها صحيح وبعضها خاطئ، و answer قيمة true أو false.`;

  const RULES_EN = `Rules:
- You have one big open whiteboard and are not tied to a single layout. Split the explanation into 3 to 5 scenes, pick the visual shape that best fits each idea, and vary the shapes.
- Teach it fully, the way a strong lecturer would, not a re-read of the bullets: for each idea say what it is, why it matters, how it works, and give an example. Include one scene with a worked example or real case, and a final scene on a common mistake or when to use the idea.
- Adapt the method to the subject: maths, physics and statistics get an equation solved line by line (formula), then a chart of the relationship (line), then a check of the answer; pharmacy and medicine get the drug's mechanism (lab or steps), its concentration-time curve (line) and a table of doses, side effects and interactions (table); chemistry and biology get an experiment or reaction in lab vessels (lab) and a cycle or mechanism (cycle); programming gets a short traced snippet (code) and what happens in memory; engineering gets design steps and numbers (steps, bars); business, economics and accounting get comparisons, numbers and tables (compare, bars, pie, table); history gets a timeline (timeline); law gets conditions, exceptions and levels (list, pyramid, table); languages get right-versus-wrong examples (compare).
- Available shapes: ${SHAPES_EN}.
- Charts (bars, line, pie) need a numeric value on every item. Use the slide's numbers when it has them. If the numbers are only illustrative (for example comparing how two algorithms grow) set approx:true, and never invent statistics that look real.
- Each scene: say is a one- or two-sentence lead-in, then 2 to 5 items, each with a one- or two-sentence say that really explains it, spoken while it is drawn. The first scene opens with an everyday analogy.
- label is at most 4 words, detail at most 8 words.
- Every say is warm, plain spoken English, like a friend explaining to a friend, written the way it is spoken: spell out symbols and numbers.
- icon is an animated icon that fits the item (in map, steps and list), one of: ${L.ICON_NAMES.join(', ')}.
- Write everything in English.
- Explain the idea; do not read the slide aloud. Do not invent facts that contradict the slide.
- quiz: two questions that test understanding, not recall; answer is the zero-based index of the correct option.
- cards: four flash cards for the slide's key terms.
- tf: three true-or-false statements, some true and some false; answer is true or false.`;

  const SHORT_AR = (r) => r.replace('قسّم الشرح إلى 3 إلى 5 مشاهد', 'جاوب في مشهد أو مشهدين').replace(' لازم يكون فيه مشهد لمثال محلول أو حالة واقعية، ومشهد أخير عن خطأ شائع أو متى تُستخدم الفكرة.', '').replace('أول مشهد يبدأ بتشبيه من الحياة اليومية.', 'أول مشهد يجاوب السؤال مباشرة.').replace('quiz سؤالان', 'quiz سؤال واحد').replace('cards أربع بطاقات', 'cards بطاقتان').replace('tf ثلاث عبارات', 'tf عبارتان');
  const SHORT_EN = (r) => r.replace('Split the explanation into 3 to 5 scenes', 'Answer in one or two scenes').replace(' Include one scene with a worked example or real case, and a final scene on a common mistake or when to use the idea.', '').replace('The first scene opens with an everyday analogy.', 'The first scene answers the question directly.').replace('quiz: two questions', 'quiz: one question').replace('cards: four flash cards', 'cards: two flash cards').replace('tf: three', 'tf: two');

  /* تخصص الطالب ومستوى الشرح يدخلان في التعليمات، فالأمثلة والعمق يتغيّران معهما */
  const MAJORS = [['general', 'كل التخصصات', ''], ['health', 'طب وصيدلة وتمريض', 'medicine, pharmacy and nursing'], ['science', 'علوم: كيمياء وأحياء وفيزياء', 'chemistry, biology and physics'],
    ['math', 'رياضيات وإحصاء', 'mathematics and statistics'], ['eng', 'هندسة', 'engineering'], ['cs', 'حاسب وبرمجة', 'computing and programming'],
    ['biz', 'إدارة واقتصاد ومحاسبة', 'business, economics and accounting'], ['law', 'قانون وشريعة', 'law and sharia'], ['arts', 'لغات وآداب وتربية', 'languages, humanities and education']];
  const LEVELS = {
    easy: ['افترض أن الطالب يسمع الموضوع لأول مرة: كلمات سهلة، تشبيهات كثيرة، ولا تفترض أي معرفة سابقة.', 'Assume the student is hearing this for the first time: easy words, plenty of analogies, no assumed background.'],
    mid: ['', ''],
    deep: ['اشرح بعمق يناسب التحضير للاختبار: التفاصيل الدقيقة، الاستثناءات، وكيف يجي السؤال في الاختبار.', 'Go deep enough for exam revision: fine details, exceptions, and how it tends to be examined.'],
  };
  const styleKey = () => `${F.store.get('major', 'general')}|${F.store.get('level', 'mid')}`;
  function styleLines(lang) {
    const en = lang === 'en', m = MAJORS.find((x) => x[0] === F.store.get('major', 'general')) || MAJORS[0], lv = LEVELS[F.store.get('level', 'mid')] || LEVELS.mid;
    const out = [];
    if (m[0] !== 'general') out.push(en ? `- The student studies ${m[2]}: draw examples, cases and analogies from that field.` : `- تخصص الطالب: ${m[1]}. خذ الأمثلة والحالات والتشبيهات من عالم هذا التخصص.`);
    if (lv[en ? 1 : 0]) out.push('- ' + lv[en ? 1 : 0]);
    return out.length ? out.join('\n') + '\n' : '';
  }

  /** لغة الشرح: من الإعدادات، أو تلقائيًا حسب لغة الشريحة. */
  function langFor(slide) {
    const pick = F.store.get('lang', 'auto');
    return pick === 'auto' ? L.detectLang(slide.text) : pick;
  }

  function slidePrompt(deck, slide, lang) {
    const earlier = deck.slides.slice(Math.max(0, slide.index - 3), slide.index).map((s) => s.title).filter(Boolean);
    if (lang === 'en') {
      return `You are "Fahem", a private tutor explaining to a university student on a big whiteboard: you talk while you draw diagrams and charts step by step.
Course: ${deck.name}
Slide ${slide.index + 1} of ${deck.slides.length}${earlier.length ? `\nAlready covered: ${earlier.join(' -> ')}` : ''}
Slide text:
"""
${(slide.text || '(no extracted text; rely on the slide image if provided)').slice(0, 3500)}
"""
${RULES_EN}
${styleLines('en')}${SCHEMA}`;
    }
    return `أنت «فاهم»، معلّم خصوصي يشرح لطالب جامعي على سبورة كبيرة: يتكلم وهو يرسم مخططات ورسومًا بيانية خطوة بخطوة.
المادة: ${deck.name}
الشريحة ${slide.index + 1} من ${deck.slides.length}${earlier.length ? `\nما سبق شرحه: ${earlier.join(' ← ')}` : ''}
نص الشريحة:
"""
${(slide.text || '(لا يوجد نص مستخرج، اعتمد على صورة الشريحة إن وُجدت)').slice(0, 3500)}
"""
${RULES}
${styleLines('ar')}${SCHEMA}`;
  }

  function askPrompt(deck, slide, lesson, question) {
    if (L.detectLang(question) === 'en') {
      return `You are "Fahem", a private tutor. The student is studying the slide "${lesson.title}" from "${deck.name}" and asked a follow-up question.
Slide text:
"""
${(slide.text || '').slice(0, 2500)}
"""
Student's question: ${question.slice(0, 600)}
Answer it directly on a fresh board. If it is off-topic, answer briefly and steer back.
${SHORT_EN(RULES_EN)}
${SCHEMA}`;
    }
    return `أنت «فاهم»، معلّم خصوصي. الطالب يذاكر شريحة «${lesson.title}» من مادة «${deck.name}» وسأل سؤال متابعة.
نص الشريحة:
"""
${(slide.text || '').slice(0, 2500)}
"""
سؤال الطالب: ${question.slice(0, 600)}
جاوب على سؤاله مباشرة على سبورة جديدة. لو السؤال خارج المادة جاوب باختصار ورجّعه للموضوع.
${SHORT_AR(RULES)}
${SCHEMA}`;
  }

  function parseJSON(text) {
    const s = String(text), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('ما رجع النموذج JSON صالح.');
    return JSON.parse(s.slice(a, b + 1));
  }
  const dataURLBlob = (url) => {
    const [head, b64] = url.split(','), bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg' });
  };

  async function viaGemini(prompt, image) {
    const { key, model } = cfg();
    const parts = [{ text: prompt }];
    if (image) parts.push({ inline_data: { mime_type: 'image/jpeg', data: image.split(',')[1] } });
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.6 } }),
    });
    if (!res.ok) {
      const why = res.status === 400 || res.status === 403 ? 'مفتاح Gemini غير صالح أو النموذج غير متاح.' : res.status === 429 ? 'وصلت حد الاستخدام في Gemini، جرّب بعد شوي.' : `خطأ ${res.status} من Gemini.`;
      throw new Error(why);
    }
    const body = await res.json();
    const text = (((body.candidates || [])[0] || {}).content || {}).parts;
    if (!text || !text[0] || !text[0].text) throw new Error('Gemini ما رجّع شرح لهذي الشريحة.');
    return parseJSON(text[0].text);
  }

  async function viaClaude(prompt, image) {
    const opts = { cache: true };
    if (image && sampleImages) { try { opts.images = [dataURLBlob(image)]; } catch (e) { /* يكمل بالنص */ } }
    try { return await sample.json(prompt, opts); }
    catch (e) {
      if (e && e.code === 'invalid_json' && e.text) return parseJSON(e.text);
      const msg = { not_granted: 'ما سمحت للصفحة تسأل Claude. اسمح لها أو أضف مفتاح Gemini من الإعدادات.', rate_limited: 'طلبات كثيرة، جرّب بعد شوي.', refused: 'Claude ما قدر يشرح هذي الشريحة.' }[e && e.code];
      throw new Error(msg || 'تعذّر الوصول إلى Claude الحين.');
    }
  }

  async function run(prompt, image) {
    return provider() === 'gemini' ? viaGemini(prompt, image) : viaClaude(prompt, image);
  }

  /** يشرح شريحة. يرجّع درسًا جاهزًا للسبورة؛ ولو فشل الذكاء الاصطناعي يرجّع الشرح المحلي مع سبب الفشل. */
  async function explain(deck, slide) {
    const lang = langFor(slide);
    if (provider() === 'local') return { lesson: L.fromText(slide, lang), note: '' };
    try { const lesson = L.normalize(await run(slidePrompt(deck, slide, lang), slide.image), 'ai', lang); lesson.style = styleKey(); return { lesson, note: '' }; }
    catch (e) { return { lesson: L.fromText(slide, lang), note: e.message || 'تعذّر الشرح الذكي.' }; }
  }

  async function ask(deck, slide, lesson, question) {
    if (provider() === 'local') throw new Error('أسئلة المتابعة تحتاج ذكاء اصطناعي. أضف مفتاح Gemini من الإعدادات.');
    return L.normalize(await run(askPrompt(deck, slide, lesson, question), null), 'ai', L.detectLang(question));
  }

  F.AI = { provider, providerName, explain, ask, langFor, styleKey, MAJORS, cfg, slidePrompt, parseJSON };
})();
