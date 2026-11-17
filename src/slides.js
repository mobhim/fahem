/* فاهم — قراءة السلايدات: PDF (صورة + نص)، PPTX (نص)، وصور. كل شي يُعالج داخل المتصفح. */
(function () {
  'use strict';
  const MAX_SLIDES = 80, WIDTH = 1100;
  const clean = (s) => String(s || '').replace(/[ \t]+/g, ' ').trim();
  const hashId = (name, size) => 'd' + [...(name + size)].reduce((n, c) => (n * 33 + c.charCodeAt(0)) >>> 0, 5381).toString(36);
  const titleOf = (text, i) => clean((text.split('\n').find((l) => clean(l).length > 2) || `الشريحة ${i + 1}`)).slice(0, 70);

  async function fromPDF(file, onProgress) {
    if (!window.pdfjsLib) throw new Error('قارئ PDF ما تحمّل. تأكد من اتصالك وحدّث الصفحة.');
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const count = Math.min(pdf.numPages, MAX_SLIDES), slides = [];
    for (let n = 1; n <= count; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      const items = (await page.getTextContent()).items;
      let text = '', lastY = null;
      items.forEach((it) => {
        const y = Math.round(it.transform[5]);
        if (lastY !== null && Math.abs(y - lastY) > 4) text += '\n';
        text += it.str + (it.hasEOL ? '\n' : ' '); lastY = y;
      });
      text = text.split('\n').map(clean).filter(Boolean).join('\n');
      slides.push({ index: n - 1, title: titleOf(text, n - 1), text, image: canvas.toDataURL('image/jpeg', 0.82) });
      canvas.width = canvas.height = 0;
      onProgress && onProgress(n, count);
    }
    return { slides, cut: pdf.numPages > count };
  }

  async function fromPPTX(file, onProgress) {
    if (!window.JSZip) throw new Error('قارئ PowerPoint ما تحمّل. تأكد من اتصالك وحدّث الصفحة.');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).slice(0, MAX_SLIDES);
    if (!names.length) throw new Error('ما لقينا شرائح داخل الملف.');
    const slides = [];
    for (let i = 0; i < names.length; i++) {
      const xml = new DOMParser().parseFromString(await zip.files[names[i]].async('string'), 'application/xml');
      const paras = [...xml.getElementsByTagName('a:p')].map((p) => clean([...p.getElementsByTagName('a:t')].map((t) => t.textContent).join(''))).filter(Boolean);
      slides.push({ index: i, title: (paras[0] || `الشريحة ${i + 1}`).slice(0, 70), bullets: paras.slice(1, 9), text: paras.join('\n'), image: null });
      onProgress && onProgress(i + 1, names.length);
    }
    return { slides, cut: false };
  }

  function fromImage(file, index) {
    return new Promise((resolve, reject) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, WIDTH / img.width), canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve({ index, title: `الشريحة ${index + 1}`, text: '', image: canvas.toDataURL('image/jpeg', 0.82) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`ما قدرنا نقرأ الصورة ${file.name}.`)); };
      img.src = url;
    });
  }

  /** يحوّل الملفات المرفوعة إلى عرض واحد. */
  async function load(files, onProgress) {
    const list = [...files], first = list[0];
    const ext = (f) => (f.name.split('.').pop() || '').toLowerCase();
    let out;
    if (ext(first) === 'pdf' || first.type === 'application/pdf') out = await fromPDF(first, onProgress);
    else if (ext(first) === 'pptx') out = await fromPPTX(first, onProgress);
    else if (ext(first) === 'ppt') throw new Error('صيغة ‎.ppt القديمة غير مدعومة. احفظ الملف كـ PDF أو ‎.pptx وارفعه.');
    else if (list.every((f) => f.type.startsWith('image/'))) {
      const imgs = list.slice(0, MAX_SLIDES).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      out = { slides: [], cut: list.length > MAX_SLIDES };
      for (let i = 0; i < imgs.length; i++) { out.slides.push(await fromImage(imgs[i], i)); onProgress && onProgress(i + 1, imgs.length); }
    } else throw new Error('الصيغ المدعومة: PDF، ‎.pptx، أو صور.');
    return { id: hashId(first.name, first.size), name: first.name.replace(/\.[^.]+$/, ''), slides: out.slides, cut: out.cut, lessons: [] };
  }

  /** مثال جاهز (حاسب، صيدلة، رياضيات) يشتغل بدون رفع ملفات وبدون ذكاء اصطناعي. */
  function demo(id) {
    const en = F.ui === 'en', decks = en ? F.DEMOS_EN : F.Lesson.DEMO_DECKS;
    const d = decks.find((x) => x.id === id) || decks[0];
    return {
      id: d.id, name: d.name, demo: true, note: d.note || '',
      slides: d.slides.map((s, i) => ({ index: i, title: s.title, bullets: s.bullets, text: [s.title].concat(s.bullets).join('\n'), image: null })),
      lessons: d.lessons.map((l) => F.Lesson.normalize(l, 'demo', en ? 'en' : 'ar')),
    };
  }

  /** HTML لعرض الشريحة: صورتها إن وُجدت، وإلا بطاقة نصية. */
  function view(slide) {
    if (slide.image) return `<img class="slide-img" src="${slide.image}" alt="${F.esc(slide.title)}">`;
    return `<div class="slide-card"><h3>${F.esc(slide.title)}</h3><ul>${(slide.bullets || []).map((b) => `<li>${F.esc(b)}</li>`).join('')}</ul></div>`;
  }

  F.Slides = { load, demo, view };
})();
