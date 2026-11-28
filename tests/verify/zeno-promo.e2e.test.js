// Hidden ZENO2027 pop-up (?zeno=1 only) on the FR and EN homes.
// WebKit, iPhone 16 (390×844) and iPhone SE (375×667), local static server,
// wa.me intercepted, every other outside request aborted (no network: Google
// Fonts fall back to the CSS stacks in the screenshots).
// Screenshots: VZ_ZENO_SHOTS (default /workspace/vzwork/shots/zeno-popup).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { devices } = require("playwright");
const { startServer, browser, waText, ROOT } = require("./helpers");

const SHOTS = process.env.VZ_ZENO_SHOTS || (fs.existsSync("/workspace/vzwork") ? "/workspace/vzwork/shots/zeno-popup" : path.join(__dirname, "out", "zeno-popup"));
fs.mkdirSync(SHOTS, { recursive: true });

const PHONES = {
  "iphone16": Object.assign({}, devices["iPhone 16"], { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } }),
  "iphone-se": Object.assign({}, devices["iPhone SE"], { viewport: { width: 375, height: 667 }, screen: { width: 375, height: 667 } }),
};

const TEXTS = {
  fr: {
    path: "/",
    lines: [
      "Zen'O se cache encore…",
      "Le petit-déjeuner est offert à tout le groupe.",
      "Réservez jusqu'au 31 décembre 2026 pour un séjour entre le 1er janvier et le 28 février 2027.",
      "En direct, sur Airbnb ou sur Booking.com : envoyez-nous votre code sur WhatsApp.",
      "Votre code : ZENO2027",
      "Réservations jusqu'au 31/12/2026, séjours du 01/01 au 28/02/2027.",
      "Réserver sur WhatsApp",
    ],
    title: "Zen'O se cache encore…",
    cta: "Réserver sur WhatsApp",
    close: "Fermer",
    copied: "Copié",
    message: "Bonjour Villa Zen'O, j'ai le code ZENO2027. Mes dates : … Nombre de personnes : …",
    accept: "Accepter",
    refuse: "Refuser",
  },
  en: {
    path: "/en/",
    lines: [
      "You found Zen'O… almost.",
      "Breakfast is on us, for your whole group.",
      "Book by 31 December 2026 for a stay between 1 January and 28 February 2027.",
      "Direct, Airbnb or Booking.com: just send your code to us on WhatsApp.",
      "Your code: ZENO2027",
      "Bookings made by 31/12/2026, stays from 01/01 to 28/02/2027.",
      "Book on WhatsApp",
    ],
    title: "You found Zen'O… almost.",
    cta: "Book on WhatsApp",
    close: "Close",
    copied: "Copied",
    message: "Hello Villa Zen'O, I have the code ZENO2027. My dates: … Number of people: …",
    accept: "Accept",
    refuse: "Decline",
  },
};

let srv;
test.before(async () => { srv = await startServer("vercel"); });
test.after(async () => { if (srv) await srv.close(); (await browser()).close(); });

async function open(device, opts) {
  opts = opts || {};
  const b = await browser();
  const ctx = await b.newContext(Object.assign({}, PHONES[device], { locale: opts.lang === "en" ? "en-GB" : "fr-FR", timezoneId: "Africa/Casablanca" }));
  const wa = [];
  const errors = [];
  await ctx.route("**/*", async (route) => {
    const url = route.request().url();
    if (url.startsWith(srv.origin)) return route.continue();
    if (url.startsWith("https://wa.me/") || url.startsWith("https://api.whatsapp.com/")) {
      wa.push(url);
      return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>wa.me (test)</body></html>" });
    }
    return route.abort();
  });
  if (opts.consent !== false) {
    // Cookie choice already made: no banner over the layout.
    await ctx.addInitScript(() => { try { localStorage.setItem("vz_consent_v1", JSON.stringify({ ads: false, t: Date.now() })); } catch (e) {} });
  }
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e && e.message || e)));
  return { ctx, page, wa, errors };
}

async function goto(page, url) {
  await page.goto(srv.origin + url, { waitUntil: "domcontentloaded" }); // the promo script is synchronous at the end of <body>
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
}

// Layout facts for the open pop-up: overflow, smallest text, smallest target.
async function layout(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const d = document.getElementById("zeno-promo");
    const inner = d.querySelector(".zeno-promo-inner");
    const r = d.getBoundingClientRect();
    const out = [];
    for (const n of d.querySelectorAll("*")) {
      const b = n.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      if (b.left < r.left - 0.5 || b.right > r.right + 0.5 || b.left < -0.5 || b.right > vw + 0.5 || b.top < -0.5 || b.bottom > vh + 0.5) out.push(n.tagName + "." + n.className + " " + JSON.stringify([b.left, b.top, b.right, b.bottom]));
    }
    let minFont = Infinity, minFontEl = "";
    for (const n of d.querySelectorAll("*")) {
      if (![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
      const f = parseFloat(getComputedStyle(n).fontSize);
      if (f < minFont) { minFont = f; minFontEl = n.tagName + "." + n.className; }
    }
    const targets = [...d.querySelectorAll("button, a[href]")].map((n) => { const b = n.getBoundingClientRect(); return { el: n.className, w: b.width, h: b.height }; });
    function lines(el) {
      if (!el) return 0;
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = [];
      for (const r of range.getClientRects()) {
        if (!r.width && !r.height) continue;
        const t = Math.round(r.top);
        if (!tops.some((x) => Math.abs(x - t) <= 1)) tops.push(t);
      }
      return tops.length;
    }
    return {
      vw, vh,
      docScrollW: document.documentElement.scrollWidth,
      dialog: [r.left, r.top, r.right, r.bottom],
      innerScrollW: inner.scrollWidth, innerClientW: inner.clientWidth,
      innerScrollH: inner.scrollHeight, innerClientH: inner.clientHeight,
      outside: out, minFont, minFontEl, targets,
      titleLines: lines(d.querySelector("#zeno-promo-title")),
      leadLines: lines(d.querySelector(".zeno-promo-lead")),
    };
  });
}

async function promoState(page) {
  return page.evaluate(() => {
    const d = document.getElementById("zeno-promo");
    return {
      exists: !!d,
      open: !!(d && d.open),
      visible: !!(d && d.open && d.getBoundingClientRect().height > 0),
      style: !!document.getElementById("zeno-promo-style"),
      anyPromo: document.querySelectorAll(".zeno-promo, [class*='zeno-promo']").length,
      dialogs: document.querySelectorAll("dialog").length,
      openDialogs: document.querySelectorAll("dialog[open]").length,
      href: location.href,
    };
  });
}

for (const lang of ["fr", "en"]) {
  for (const device of ["iphone16", "iphone-se"]) {
    test(`${lang.toUpperCase()} ${device}: ?zeno=1 opens the pop-up with the exact texts, no overflow, WhatsApp link, URL cleaned, closes`, async () => {
      const L = TEXTS[lang];
      const P = await open(device, { lang });
      const page = P.page;
      try {
        await goto(page, L.path + "?zeno=1");
        const dlg = page.locator("#zeno-promo");
        await dlg.waitFor({ state: "visible" });
        const st = await promoState(page);
        assert.ok(st.open, "dialog open (showModal)");
        assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "zeno-promo-title", "focus inside the modal, on its title");

        // 1. Exact texts.
        // textContent (not innerText): the buttons are uppercased by CSS only.
        const text = await dlg.evaluate((d) => [...d.querySelectorAll("h2, p, .zeno-promo-code-text, a, button")].map((n) => n.textContent).join("\n"));
        for (const line of L.lines) assert.ok(text.includes(line), `missing text: ${line}\n--- got:\n${text}`);
        assert.ok(text.includes("ZENO2027") && !text.includes("☕"));
        assert.ok(!text.includes("..."), "typographic ellipsis only");
        assert.equal(await page.locator("#zeno-promo-title").innerText(), L.title);
        assert.equal(await dlg.getAttribute("aria-labelledby"), "zeno-promo-title");
        assert.equal(await page.locator("#zeno-promo .zeno-promo-close").getAttribute("aria-label"), L.close);
        assert.equal(await page.evaluate(() => document.documentElement.lang.slice(0, 2)), lang);

        // 3. WhatsApp link.
        const href = await page.locator("#zeno-promo .zeno-promo-cta").getAttribute("href");
        const u = new URL(href);
        assert.equal(u.origin + u.pathname, "https://wa.me/212661147610");
        assert.equal(waText(href), L.message);
        assert.ok(L.message.includes("…") && !L.message.includes("..."));

        // 6. ?zeno=1 removed from the address bar.
        assert.equal(new URL(page.url()).searchParams.get("zeno"), null);
        assert.equal(new URL(page.url()).pathname, L.path);

        // 5. Layout.
        const lay = await layout(page);
        assert.ok(lay.docScrollW <= lay.vw, `document scrolls sideways: ${lay.docScrollW} > ${lay.vw}`);
        assert.ok(lay.innerScrollW <= lay.innerClientW, `dialog scrolls sideways: ${lay.innerScrollW} > ${lay.innerClientW}`);
        assert.ok(lay.innerScrollH <= lay.innerClientH + 1, `dialog content taller than the dialog: ${lay.innerScrollH} > ${lay.innerClientH}`);
        assert.ok(lay.dialog[0] >= 0 && lay.dialog[1] >= 0 && lay.dialog[2] <= lay.vw && lay.dialog[3] <= lay.vh, "dialog inside viewport " + JSON.stringify(lay.dialog));
        assert.deepEqual(lay.outside, [], "elements outside the dialog / viewport");
        assert.ok(lay.minFont >= 12, `smallest text ${lay.minFont}px (${lay.minFontEl})`);
        for (const t of lay.targets) assert.ok(t.w >= 44 && t.h >= 44, `target too small: ${JSON.stringify(t)}`);
        assert.equal(lay.targets.length, 3, "close, copy, WhatsApp");
        assert.equal(lay.titleLines, 1, "title must fit on one line, got " + lay.titleLines);
        assert.equal(lay.leadLines, 1, "subtitle must fit on one line, got " + lay.leadLines);

        await shot(page, `${lang}-${device}-open.png`);

        // WhatsApp button opens wa.me with the exact pre-filled text.
        const [popup] = await Promise.all([page.context().waitForEvent("page"), page.locator("#zeno-promo .zeno-promo-cta").click()]);
        await popup.waitForLoadState().catch(() => {});
        await popup.close();
        assert.equal(P.wa.length, 1, "one wa.me request");
        assert.equal(new URL(P.wa[0]).pathname, "/212661147610");
        assert.equal(waText(P.wa[0]), L.message);

        // 4. Close: button on iPhone 16, Escape on iPhone SE.
        await page.bringToFront();
        if (device === "iphone16") await page.locator("#zeno-promo .zeno-promo-close").click();
        else { await page.locator("#zeno-promo .zeno-promo-close").focus(); await page.keyboard.press("Escape"); }
        await page.waitForFunction(() => !document.getElementById("zeno-promo"));
        const after = await promoState(page);
        assert.ok(!after.visible && !after.exists && !after.style, "pop-up gone after close");
        assert.equal(after.openDialogs, 0);
        if (device === "iphone16") await shot(page, `${lang}-${device}-closed.png`);

        // The rest of the page still works: the services dialog opens and closes.
        await page.locator(".svc-detail-trigger[data-service-dialog='transfers']").scrollIntoViewIfNeeded();
        await page.locator(".svc-detail-trigger[data-service-dialog='transfers']").click();
        await page.waitForFunction(() => document.getElementById("service-dialog").open);
        await page.locator("#service-dialog .service-dialog-close").click();
        await page.waitForFunction(() => !document.getElementById("service-dialog").open);

        // Reload = normal page.
        await page.reload({ waitUntil: "domcontentloaded" });
        assert.equal((await promoState(page)).exists, false, "no pop-up after reload");
        assert.deepEqual(P.errors, []);
      } finally { await P.ctx.close(); }
    });
  }
}

test("no ?zeno=1 → no pop-up, page untouched (FR / EN, several look-alike params)", async () => {
  const P = await open("iphone16");
  try {
    const cases = ["/", "/?zeno=true", "/?foo=1", "/?zeno=0", "/?zeno=", "/?Zeno=1", "/#zeno=1", "/?zenO=1", "/en/", "/en/?zeno=true", "/en/?foo=1", "/en/#zeno=1",
      "/mentions-legales.html?zeno=1", "/en/legal-notice.html?zeno=1"];
    for (const c of cases) {
      // A fresh tab per case: WebKit treats "/#…" after "/" as a same-document jump.
      const page = await P.ctx.newPage();
      page.on("pageerror", (e) => P.errors.push(c + ": " + String(e && e.message || e)));
      await goto(page, c);
      await page.waitForTimeout(150);
      const st = await promoState(page);
      assert.equal(st.exists, false, c + ": dialog injected");
      assert.equal(st.style, false, c + ": style injected");
      assert.equal(st.anyPromo, 0, c + ": promo markup");
      assert.equal(st.openDialogs, 0, c + ": a dialog is open");
      assert.equal(st.href, srv.origin + c, c + ": URL changed");
      if (c === "/") await shot(page, "fr-iphone16-no-param.png");
      await page.close();
    }
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});

test("served HTML: only the script tag, on the two homes only (SEO unchanged)", () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  for (const [f, src] of [["index.html", "js/zeno-promo.js?v="], ["en/index.html", "../js/zeno-promo.js?v="]]) {
    const html = read(f);
    const hits = html.match(/zeno-promo|ZENO2027/g) || [];
    assert.equal(hits.length, 1, f + ": only the script tag mentions the promo");
    assert.ok(html.includes('<script src="' + src), f + ": cache-busted script tag");
    assert.ok(html.indexOf("zeno-promo.js") > html.indexOf("config.js"), f + ": loaded after config.js");
  }
  for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith(".html")).concat(fs.readdirSync(path.join(ROOT, "en")).filter((x) => x.endsWith(".html")).map((x) => "en/" + x))) {
    if (f === "index.html" || f === "en/index.html") continue;
    assert.ok(!/zeno-promo/.test(read(f)), f + " must not load the promo");
  }
  // The site's WhatsApp CTAs keep their config.js messages.
  const cfg = read("js/config.js");
  assert.ok(!/ZENO2027/.test(cfg) && !/ZENO2027/.test(read("js/main.js")));
});

test("other params and hash are kept when ?zeno=1 is removed", async () => {
  const P = await open("iphone16");
  const page = P.page;
  try {
    await goto(page, "/?utm_source=ig&zeno=1&x=a%20b#services");
    await page.locator("#zeno-promo").waitFor({ state: "visible" });
    const u = new URL(page.url());
    assert.equal(u.search, "?utm_source=ig&x=a%20b");
    assert.equal(u.hash, "#services");
    // Backdrop click closes, like the services dialog.
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => !document.getElementById("zeno-promo"));
    await goto(page, "/en/index.html?zeno=1");
    await page.locator("#zeno-promo").waitFor({ state: "visible" });
    assert.equal(await page.locator("#zeno-promo-title").innerText(), TEXTS.en.title);
    assert.equal(new URL(page.url()).search, "");
    assert.deepEqual(P.errors, []);
  } finally { await P.ctx.close(); }
});

test("copy button: copies ZENO2027 and says Copié / Copied", async () => {
  for (const lang of ["fr", "en"]) {
    const P = await open("iphone16", { lang });
    const page = P.page;
    try {
      await page.addInitScript(() => {
        window.__copied = [];
        try { Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { window.__copied.push(t); return Promise.resolve(); } } }); } catch (e) {}
      });
      await goto(page, TEXTS[lang].path + "?zeno=1");
      const btn = page.locator("#zeno-promo .zeno-promo-copy");
      await btn.click();
      await page.waitForFunction((t) => document.querySelector("#zeno-promo .zeno-promo-copy").textContent === t, TEXTS[lang].copied);
      assert.deepEqual(await page.evaluate(() => window.__copied), ["ZENO2027"]);
      assert.deepEqual(P.errors, []);
    } finally { await P.ctx.close(); }
  }
});

for (const lang of ["fr", "en"]) {
  test(`${lang.toUpperCase()}: cookie banner still works with ?zeno=1 (shown without consent, ${lang === "fr" ? "Accepter" : "Decline"} works after closing the pop-up)`, async () => {
    const L = TEXTS[lang];
    const P = await open("iphone-se", { lang, consent: false });
    const page = P.page;
    try {
      await goto(page, L.path + "?zeno=1");
      await page.locator("#zeno-promo").waitFor({ state: "visible" });
      await page.locator(".vz-cookie").waitFor({ state: "attached" });
      // The modal sits above the banner while open (top layer).
      const top = await page.evaluate(() => { const c = document.querySelector(".vz-cookie .vz-accept").getBoundingClientRect(); const e = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2); return !!(e && e.closest("#zeno-promo")) || !(e && e.closest(".vz-cookie")); });
      assert.ok(top, "pop-up above the cookie banner");
      if (lang === "fr") await shot(page, "fr-iphone-se-open-with-cookies.png");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("zeno-promo"));
      const banner = page.locator(".vz-cookie");
      assert.ok(await banner.isVisible(), "cookie banner visible after closing");
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".vz-cookie")).zIndex), "9999");
      await page.getByRole("button", { name: lang === "fr" ? L.accept : L.refuse, exact: true }).click();
      await banner.waitFor({ state: "hidden" });
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vz_consent_v1")));
      assert.equal(saved.ads, lang === "fr");
      assert.deepEqual(P.errors, []);
    } finally { await P.ctx.close(); }
  });
}
