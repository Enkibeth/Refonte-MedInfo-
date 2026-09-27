// Instrumentation injectée AVANT l'app (banc local uniquement) : mesure, n'altère rien.
(() => {
  const B = (window.__bench = {
    start: 0, firstStatus: null, firstStop: null, firstText: null, doneAt: null,
    closedMoves: [], leaks: [], footnoteIssues: [], samples: 0, scroll: [], shifts: [], lcp: [], events: [],
    footnotes: [], maxClosed: 0, assistantCount: 0, textLen: 0,
  });
  const LEAKS = [/SRC\d/, /\[1\]\s*\+/, /<!--/, /\]\(https?:/, /\*\*/, /#{2,}\s/, /\|-{3}/, /```/];
  const positions = new WeakMap();
  let lastSeq = [];
  let lastMsg = null;
  function sample() {
    const now = performance.now();
    const thread = document.querySelector('[data-testid="chat-thread"]');
    const status = document.querySelector('[role=status]');
    const stop = document.querySelector('[aria-label="Arrêter la génération"]');
    const msgs = document.querySelectorAll('[data-testid="assistant-message"]');
    const msg = msgs[msgs.length - 1] || null;
    B.assistantCount = msgs.length;
    if (B.start) {
      if (status && B.firstStatus === null) B.firstStatus = now - B.start;
      if (stop && B.firstStop === null) B.firstStop = now - B.start;
      if (msg && msg.textContent.trim() && B.firstText === null) B.firstText = now - B.start;
    }
    const done = !!document.querySelector('[aria-label="Régénérer la réponse"], [aria-label="Copier la réponse"]');
    if (msg) {
      if (msg !== lastMsg) { lastSeq = []; lastMsg = msg; }
      const text = msg.textContent;
      B.textLen = text.length;
      for (const re of LEAKS) if (re.test(text) && B.leaks.length < 20) B.leaks.push({ t: Math.round(now - B.start), re: String(re), tail: text.slice(-120) });
      const seq = [...msg.querySelectorAll('[aria-label^="Source "]')].map((e) => e.getAttribute('aria-label')).filter((l) => /^Source \d+$/.test(l)).map((l) => Number(l.slice(7)));
      let max = 0;
      for (const n of seq) { if (n > max + 1 && B.footnoteIssues.length < 20) B.footnoteIssues.push({ kind: 'gap', seq }); max = Math.max(max, n); }
      if (lastSeq.some((n, i) => seq[i] !== n) && B.footnoteIssues.length < 20) B.footnoteIssues.push({ kind: 'renumbered', before: lastSeq, after: seq });
      lastSeq = seq;
      B.footnotes = seq;
      const top = thread ? thread.scrollTop : 0;
      msg.querySelectorAll('[data-testid="completed-answer-block"]').forEach((e) => {
        const r = e.getBoundingClientRect();
        const y = r.y + top, h = r.height;
        const prev = positions.get(e);
        if (prev && (Math.abs(prev.y - y) > 0.5 || Math.abs(prev.h - h) > 0.5) && B.closedMoves.length < 30) B.closedMoves.push({ t: Math.round(now - B.start), dy: +(y - prev.y).toFixed(1), dh: +(h - prev.h).toFixed(1), done, text: e.textContent.slice(0, 50) });
        positions.set(e, { y, h });
      });
      B.maxClosed = Math.max(B.maxClosed, msg.querySelectorAll('[data-testid="completed-answer-block"]').length);
    }
    if (thread && B.start) {
      const scroller = thread.scrollHeight > thread.clientHeight ? thread : thread.firstElementChild;
      const el = thread;
      B.scroll.push({ t: Math.round(now - B.start), top: Math.round(el.scrollTop), dist: Math.round(el.scrollHeight - el.clientHeight - el.scrollTop), h: el.scrollHeight });
      if (B.scroll.length > 4000) B.scroll.shift();
    }
    if (done && B.start && B.doneAt === null) B.doneAt = now - B.start;
    B.samples++;
  }
  let scheduled = false;
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(() => { scheduled = false; sample(); }); } };
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('[aria-label="Envoyer le message"]') && !B.start) { B.start = performance.now(); schedule(); } }, true);
  new MutationObserver(schedule).observe(document, { childList: true, subtree: true, characterData: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) B.shifts.push({ t: e.startTime, v: e.value, input: e.hadRecentInput }); }).observe({ type: 'layout-shift', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) B.lcp.push({ t: e.startTime, size: e.size, el: e.element ? e.element.tagName + (e.element.textContent || '').slice(0, 40) : null }); }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) B.events.push({ name: e.name, d: e.duration, id: e.interactionId }); }).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch {}
  window.__benchSample = sample;
})();
