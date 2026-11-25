// Point 3: Mode test button per host (WebKit, iPhone). Serves the repo
// files for simulated hosts through page.route; no network.
// Run: NODE_PATH=<dir with node_modules/playwright> node tests/admin-test-mode.webkit.js
const { webkit, devices } = require("playwright");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

async function check(browser, origin, expectButton) {
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await ctx.newPage();
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  const res = {};
  // 1. Gate page: button visible?
  await page.goto(origin + "/admin/index.html");
  await page.waitForTimeout(300);
  res.buttonVisible = await page.locator("[data-test]").isVisible().catch(() => false);
  res.buttonInDom = (await page.locator("[data-test]").count()) > 0;
  // 2. ?test=1 on an inner page: test session or gate?
  await page.goto(origin + "/admin/aujourdhui.html?test=1");
  await page.waitForTimeout(300);
  res.session = await page.evaluate(() => sessionStorage.getItem("vz.admin") || "");
  res.locked = await page.evaluate(() => document.body.classList.contains("is-locked"));
  res.lockedButton = await page.locator("[data-gate] [data-test]").count();
  // 3. A stored test session is dropped on hosts without test mode.
  await page.evaluate(() => sessionStorage.setItem("vz.admin", "test"));
  await page.goto(origin + "/admin/aujourdhui.html");
  await page.waitForTimeout(300);
  res.sessionAfterReload = await page.evaluate(() => sessionStorage.getItem("vz.admin") || "");
  await ctx.close();
  const ok = expectButton
    ? res.buttonVisible && res.session === "test" && !res.locked && res.sessionAfterReload === "test"
    : !res.buttonVisible && !res.buttonInDom && res.session === "" && res.locked && res.lockedButton === 0 && res.sessionAfterReload === "";
  console.log((ok ? "PASS " : "FAIL ") + origin + " " + JSON.stringify(res));
  return ok;
}

(async () => {
  const browser = await webkit.launch();
  let all = true;
  for (const [origin, expect] of [
    ["https://villazenomarrakech.com", false],
    ["https://www.villazenomarrakech.com", false],
    ["https://villazenomarrakech-git-x.vercel.app", true],
    ["http://localhost:8080", true],
    ["http://127.0.0.1:8080", true],
    ["https://evil-vercel.app.example.com", false],
  ]) all = (await check(browser, origin, expect)) && all;
  await browser.close();
  process.exit(all ? 0 : 1);
})();
