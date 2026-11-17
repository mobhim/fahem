/* فاهم — مؤثرات صوتية خفيفة جدًا تعطي إحساسًا بالإيقاع: نقرة مع كل عنصر ينرسم، ونغمة عند الإنجاز. تسكت مع زر الكتم. */
(function () {
  'use strict';
  let ctx = null;
  const on = () => !F.Voice.state.muted && F.store.get('sfx', true);
  function tone(freq, dur, at, gain) {
    try {
      ctx = F.Voice.audio() || ctx || new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + (at || 0);
      o.type = 'sine'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain || 0.04, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch (e) { /* المتصفح ما يدعم الصوت أو ما سمح به بعد */ }
  }
  F.Sfx = {
    pop() { if (on()) { tone(720, 0.07, 0, 0.035); tone(1080, 0.06, 0.05, 0.02); } },
    done() { if (on()) [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, i * 0.09, 0.05)); },
    right() { if (on()) { tone(880, 0.1, 0, 0.05); tone(1320, 0.16, 0.08, 0.05); } },
    wrong() { if (on()) tone(210, 0.2, 0, 0.05); },
  };
})();
