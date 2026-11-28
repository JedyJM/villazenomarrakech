"use strict";
/* Layout checks (2026-11-27 review): two visible text runs must never be
   drawn on top of each other, nor run past the screen edge. Text node
   rectangles (Range API), compared two by two. */
async function layoutProblems(page, root) {
  return page.evaluate((sel) => {
    const scope = document.querySelector(sel) || document.body;
    const runs = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const vw = document.documentElement.clientWidth;
    const out = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest("[hidden], .visually-hidden, script, style, svg")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const r = document.createRange();
      r.selectNodeContents(n);
      // Clipped text (overflow hidden + ellipsis) is measured as drawn.
      let clip = null;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        const o = getComputedStyle(p);
        if (o.overflowX !== "visible" || o.overflowY !== "visible") { clip = p.getBoundingClientRect(); break; }
      }
      for (const raw of r.getClientRects()) {
        const b = clip ? { left: Math.max(raw.left, clip.left), right: Math.min(raw.right, clip.right), top: Math.max(raw.top, clip.top), bottom: Math.min(raw.bottom, clip.bottom) } : { left: raw.left, right: raw.right, top: raw.top, bottom: raw.bottom };
        b.width = b.right - b.left;
        b.height = b.bottom - b.top;
        if (b.width < 1 || b.height < 1) continue;
        runs.push({ t: n.textContent.trim().slice(0, 40), b, node: n });
        if (b.right > vw + 1 || b.left < -1) out.push("overflow: « " + n.textContent.trim().slice(0, 40) + " »");
      }
    }
    for (let i = 0; i < runs.length; i++) {
      for (let j = i + 1; j < runs.length; j++) {
        if (runs[i].node === runs[j].node) continue;
        const a = runs[i].b, c = runs[j].b;
        const w = Math.min(a.right, c.right) - Math.max(a.left, c.left);
        const h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
        if (w > 2 && h > Math.min(a.height, c.height) * 0.4) out.push("overlap: « " + runs[i].t + " » / « " + runs[j].t + " »");
      }
    }
    return out;
  }, root);
}
module.exports = { layoutProblems };
