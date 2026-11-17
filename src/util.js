/* فاهم — أدوات مشتركة صغيرة. */
(function () {
  'use strict';
  const F = (window.F = window.F || {});

  F.$ = (sel, root) => (root || document).querySelector(sel);
  F.$$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
  F.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // التخزين المحلي ممكن يكون مقفول (تصفح خاص، معاينة)؛ الصفحة لازم تشتغل بدونه.
  F.store = {
    get(key, fallback) { try { const v = localStorage.getItem('fahem:' + key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(key, value) { try { localStorage.setItem('fahem:' + key, JSON.stringify(value)); } catch (e) { /* يكمل بدون حفظ */ } },
    del(key) { try { localStorage.removeItem('fahem:' + key); } catch (e) { /* يكمل */ } },
  };

  let toastTimer;
  F.toast = (text) => {
    const t = F.$('#toast');
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  };

  // داخل claude.ai التنزيل يمر عبر صلاحية downloads؛ في أي استضافة عادية رابط تنزيل مباشر.
  let downloads = null;
  F.hosted = !!(window.claude && window.claude.use);
  if (F.hosted) window.claude.use('downloads').then((d) => { downloads = d; }).catch(() => {});
  F.saveFile = async (filename, data, mime) => {
    if (downloads) {
      try { await downloads.save({ filename, data }); F.toast(`تم حفظ ${filename}`); }
      catch (e) { F.toast(e && e.code === 'declined' ? 'ألغيت الحفظ.' : 'ما قدرنا نحفظ الملف هنا.'); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: mime }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    F.toast(`تم تنزيل ${filename}`);
  };

  F.copy = async (text, okMsg) => {
    try { await navigator.clipboard.writeText(text); F.toast(okMsg || 'تم النسخ'); }
    catch (e) { F.toast('النسخ غير متاح هنا: ' + text); }
  };

  /* نافذة سفلية/وسطية واحدة لكل التطبيق */
  F.sheet = {
    open(html, cls) {
      const d = F.$('#sheet');
      F.$('#sheet-body').innerHTML = html;
      d.className = 'sheet ' + (cls || '');
      if (!d.open) d.showModal();
      return F.$('#sheet-body');
    },
    close() { const d = F.$('#sheet'); if (d.open) d.close(); },
  };
})();
