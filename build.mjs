// يجمع src/ في ملفين: dist/index.html (صفحة مستقلة تُستضاف في أي مكان) و dist/fahem.artifact.html (محتوى الصفحة بدون هيكل).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const read = (p) => readFileSync(new URL('./src/' + p, import.meta.url), 'utf8');
const SCRIPTS = ['util.js', 'i18n-en.js', 'i18n.js', 'core/scheduler.js', 'core/import.js', 'core/catalog-demo.js', 'core/lesson.js', 'core/demos-en.js', 'board.js', 'voice.js', 'sfx.js', 'ai.js', 'slides.js', 'study.js', 'register.js', 'app.js'];
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs';
const head = `<title>فاهم</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="فاهم: ارفع سلايداتك وخذ شرحًا صوتًا وصورة، ورتّب جدولك الجامعي بدون تعارضات.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playpen+Sans+Arabic:wght@400;600;700&display=swap">
<style>
${read('styles.css')}</style>`;
const body = `${read('body.html')}
<script src="${CDN}/pdf.js/3.11.174/pdf.min.js"></script>
<script src="${CDN}/pdf.js/3.11.174/pdf.worker.min.js"></script>
<script src="${CDN}/jszip/3.10.1/jszip.min.js"></script>
<script src="${CDN}/xlsx/0.18.5/xlsx.full.min.js"></script>
<script>
${SCRIPTS.map((s) => read(s).replace(/<\/script/g, '<\\/script')).join('\n')}</script>`;
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/fahem.artifact.html', import.meta.url), head + '\n' + body + '\n');
writeFileSync(new URL('./dist/index.html', import.meta.url),
  `<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n</body>\n</html>\n`);
// docs/ هو ما ينشره GitHub Pages (Settings → Pages → Branch: main, Folder: /docs)
mkdirSync(new URL('./docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('./docs/index.html', import.meta.url), readFileSync(new URL('./dist/index.html', import.meta.url)));
writeFileSync(new URL('./docs/.nojekyll', import.meta.url), '');
console.log('built dist/index.html + dist/fahem.artifact.html + docs/index.html');
