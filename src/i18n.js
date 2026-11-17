/* فاهم — لغة الواجهة: عربي أو إنجليزي.
 * النصوص في الكود عربية وهي المفاتيح. في الوضع الإنجليزي مترجم يمرّ على الصفحة (وعلى كل ما يُضاف لها لاحقًا)
 * ويبدّل النص العربي بترجمته من القاموس. محتوى الدروس والسلايدات وبيانات المستخدم لا يُمسّ. */
(function () {
  'use strict';
  const F = window.F;
  const AR = /[؀-ۿ]/;
  F.ui = F.store.get('ui', null) || ((navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en');
  const D = F.I18N_EN || { exact: {}, patterns: [], fragments: [] };
  const missing = (F.i18nMissing = new Set());
  // مناطق محتواها ليس واجهة: درس، شريحة، شرح مكتوب
  const KEEP = '#board, #hero-board, #caption, #hero-caption, #script-body, #slide-stage, #strip, #deck-name, [data-keep]';

  /** ترجمة نص واحد. يرجّع النص نفسه لو الواجهة عربية أو ما له ترجمة. */
  function t(s) {
    if (F.ui === 'ar' || typeof s !== 'string' || !AR.test(s)) return s;
    const lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], key = s.replace(/\s+/g, ' ').trim();
    if (D.exact[key] !== undefined) return lead + D.exact[key] + tail;
    for (const [re, fn] of D.patterns) { const m = key.match(re); if (m) return lead + fn(m, t) + tail; }
    let out = key;
    for (const [re, to] of D.fragments) out = out.replace(re, to);
    if (!AR.test(out)) return lead + out + tail;
    missing.add(key);
    return s;
  }

  function node(n) {
    if (!n.isConnected) return;
    if (n.nodeType === 3) {
      if (!AR.test(n.nodeValue) || !n.parentElement || n.parentElement.closest(KEEP) || /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) return;
      const v = t(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v;
    } else if (n.nodeType === 1) {
      if (n.closest(KEEP)) return;
      ['placeholder', 'aria-label', 'title'].forEach((a) => { const v = n.getAttribute(a); if (v && AR.test(v)) { const x = t(v); if (x !== v) n.setAttribute(a, x); } });
    }
  }
  function tree(root) {
    if (root.nodeType === 3) return node(root);
    if (root.nodeType !== 1) return;
    node(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    while (w.nextNode()) node(w.currentNode);
  }

  /** يُستدعى مرة عند التشغيل: يضبط اتجاه الصفحة ويبدأ الترجمة الحيّة. */
  function start() {
    document.documentElement.lang = F.ui; document.documentElement.dir = F.ui === 'ar' ? 'rtl' : 'ltr';
    if (F.ui === 'ar') return;
    document.title = 'Fahem';
    tree(document.body);
    new MutationObserver((list) => list.forEach((m) => {
      if (m.type === 'characterData') node(m.target);
      else if (m.type === 'attributes') node(m.target);
      else m.addedNodes.forEach(tree);
    })).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  }
  const setLang = (lang) => { F.store.set('ui', lang); location.reload(); };

  F.t = t; F.I18n = { start, setLang };
})();
