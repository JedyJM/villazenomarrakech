// Audit design 2026-11-28 — static checks (no browser).
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("audit 28/11 point 5: every guest page turns off iOS phone-number detection", () => {
  const pages = fs.readdirSync(path.join(root, "guest")).filter((f) => f.endsWith(".html")).map((f) => "guest/" + f)
    .concat(fs.readdirSync(path.join(root, "guest/en")).filter((f) => f.endsWith(".html")).map((f) => "guest/en/" + f));
  for (const name of ["acces", "confirmation", "demandes", "expire", "recap"]) assert.ok(pages.includes("guest/" + name + ".html"), name);
  for (const p of pages) {
    const head = read(p).split("</head>")[0];
    assert.match(head, /<meta name="format-detection" content="telephone=no">/, p);
  }
});

test("audit 28/11 point 4: French contacts match the validated mock (no landline hint, no WhatsApp subtitle), numbers unchanged", () => {
  const shell = read("guest/js/guest-shell.js");
  const frShell = shell.slice(0, shell.indexOf("var GUEST_SHELL_EN"));
  const home = read("guest/index.html");
  const frHome = home.slice(home.indexOf('<dialog class="contacts-dialog"'), home.indexOf("</dialog>", home.indexOf('<dialog class="contacts-dialog"')));
  assert.ok(frHome.length > 1000, "home contacts sheet found");
  const numbers = ["+212 661 147 610", "+212 661 775 422", "150", "190", "177", "141", "+212 606 088 088", "+212 524 443 724", "+212 524 422 446"];
  for (const [name, fr] of [["guest-shell.js (FR)", frShell], ["guest/index.html", frHome]]) {
    assert.doesNotMatch(fr, /depuis un fixe/, name);
    assert.doesNotMatch(fr, /wa-label/, name);
    assert.doesNotMatch(fr, /has-alt|class="alt"/, name);
    assert.match(fr, />Mehdi<\/span>/, name);
    assert.match(fr, />Hicham<\/span>/, name);
    const shown = [...fr.matchAll(/<span class="num"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]);
    assert.deepEqual(shown, numbers, name);
  }
});

test("audit 28/11 point 8: service pages show MAD instead of DH, prices unchanged; € pages untouched", () => {
  const massage = read("guest/massage.html");
  const activites = read("guest/activites.html");
  for (const [name, html] of [["massage", massage], ["activites", activites], ["transfert", read("guest/transfert.html")], ["recap", read("guest/recap.html")]]) {
    assert.doesNotMatch(html, /\bDH\b/, name + ": no DH left");
  }
  const soins = [...massage.matchAll(/<small>(?:[^<]*· )?(\d+) MAD<\/small>/g)].map((m) => Number(m[1]));
  assert.deepEqual(soins, [300, 450, 450, 600, 450, 600, 500, 450, 450, 200, 250, 250, 300, 50, 150, 100, 150, 150, 100, 50, 80, 150], "massage prices unchanged");
  // Every listed price equals the data-price used for the total.
  const pairs = [...massage.matchAll(/data-price="(\d+)">\n<button[^>]*>.*?<small>(?:[^<]*· )?(\d+) MAD/g)];
  assert.equal(pairs.length, 22);
  for (const m of pairs) assert.equal(m[1], m[2]);
  const exp = [...activites.matchAll(/<span class="(?:pick|mix)-price">(\d+) MAD<\/span>/g)].map((m) => Number(m[1]));
  assert.deepEqual(exp, [300, 200, 300, 350, 200, 250], "experience prices unchanged");
  assert.match(read("guest/recap.html"), /Taux appliqué&nbsp;: 1&nbsp;€ = 10&nbsp;MAD/);
  assert.match(read("guest/transfert.html"), /Siège bébé<small class="baby-hint">50 MAD le siège<\/small>/);
  const req = read("guest/js/requests.js");
  assert.match(req, /babySeat: 50,/, "baby seat price unchanged");
  assert.match(req, /bandSmall: 350,\s*bandLarge: 450,/, "transfer prices unchanged");
});
