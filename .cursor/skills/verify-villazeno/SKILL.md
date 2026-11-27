---
name: verify-villazeno
description: End-to-end verification of the Villa Zen'O guest portal and admin (static site + Google Apps Script). Use before every preview hand-off and every release, and whenever a change touches guest/, admin/, c/, js/vz-*.js or the Apps Script. Runs the full guest journey, the full admin journey and the admin↔guest link on iPhone 15 WebKit with the Apps Script /exec mocked by the real script logic (Code.v21.gs candidate + the shared field model). Never calls the live /exec, WhatsApp or Gmail.
---

# verify-villazeno

The site is static: `guest/` (portal), `admin/` (Mehdi), `c/` (provider « Confirmer » links), and shared `js/vz-fields.js` (field model) + `js/vz-api.js` (the one Apps Script client). The backend is a Google Apps Script web app. The public repo copy `guest/apps-script/Code.gs` is an old version (no secrets). Live is v20; the candidate under test is `/workspace/sec/Code.v21.gs` (also in the private repo villa-zeno-os, `projects/villa-zenO/apps-script/Code.gs`), never published from here.

## Launch

```bash
cd <repo>                      # e.g. /workspace/vzwork/vz
npm install                    # playwright only (devDependency)
npx playwright install webkit  # add --with-deps when you are root
npm run verify                 # everything; prints pass/fail per group and TOTAL
```

- Readiness: each browser test starts its own local static server on `127.0.0.1:<random>`, served as `http://localhost:<port>`. `localhost` is the host where the admin « Mode test » exists. The server prints nothing; a test is ready when its first `page.goto` resolves.
- Apps Script under test: `VZ_GAS_CODE` (default `/workspace/sec/Code.v21.gs`). If the file is missing, the run stops with exit code 2.
- Fast loop (script only, about 1 s): `npm run verify:gas`.
- A single journey: `node --test --test-concurrency=1 tests/verify/admin.e2e.test.js`.
- Teardown: automatic. Each file closes its contexts, its servers (`after`) and the browser. Nothing keeps running.

## Functional items of 2026-11-27

- `tests/verify/func.test.js` (script, harness with the production Sheet shape): Gmail import button (create / update / cancel, no duplicate), free stay 0 €, stay edit, 3 meal counters + breakfast extras in the Arabic staff WhatsApp (no price), staging switch, Famille Démo, /exec per environment.
- `tests/verify/func.e2e.test.js` (browser): admin freshness (cache then refresh, « Actualiser », no stacked reads), import button, free stay, stay edit, restauration, home, demo stay. `createBackend({ realShape: true, latency: [min, max] })` = full Réservations headers, Demandes grid of 1000 rows, 60 demandes of other stays, Apps Script latency; `b.inflightMax(action)`.

## Level 2 (staging, TESTS-E2E.md)

`npm run e2e` runs `tests/e2e/staging.e2e.test.js` (G1–G12, A1–A12, S1–S5) on iPhone 16 size then iPhone SE, one screenshot per step in `E2E_SHOTS/<device>/`. Local by default (mocked /exec). Against staging: `E2E_BASE_URL` (Vercel preview), `E2E_EXEC_URL` (staging /exec; production is refused), `E2E_ADMIN_TOKEN`, optional `E2E_GUEST_K`. Environment only, never committed.

## Doctor (is this instance worth driving?)

`node .cursor/skills/verify-villazeno/scripts/doctor.js`. It is read-only and checks:
1. the node and playwright versions, and that WebKit is installed;
2. `VZ_GAS_CODE` exists and its `VZ_FIELDS` block equals `js/vz-fields.js` (otherwise the mock would not be faithful);
3. the `?v=` cache-bust is identical on every guest and admin HTML page (otherwise you would test stale JS);
4. no HTML points at an asset that does not exist.

If 2 fails, rebuild v19: `node /workspace/vzwork/tooling/make-v19.js`.

## Drive (harness recipe)

`tests/verify/helpers.js`:
- `startServer("vercel")` copies `vercel.json` (`/c/:code` → `/c/index.html`). `startServer("pages")` copies GitHub Pages (unknown path → `404.html`, which forwards `/c/<id>-<token>` to `/c/?r=&k=`).
- `phone(origin, backend)` opens an iPhone 15 WebKit context, `fr-FR`, Africa/Casablanca. Network rules:
  - `https://script.google.com/macros/**` goes to the mock (`backend.route`);
  - `https://wa.me/**` is captured in `P.wa`, and nothing opens;
  - every other external request is aborted.
- `createBackend()` (`tests/verify/backend.js`) loads Code.v19.gs in `tests/gas-harness.js` and swaps its `VZ_FIELDS` block for the one in `js/vz-fields.js`. It sets `ADMIN_TEST_MODE = true` and seeds one test stay: `LEA2611BX`, « Léa Bernard », arrival yesterday, departure +7 days, origine `test`, pool heating 3 × 60 €. The guest link is `/guest/?stay=LEA2611BX&k=<backend.key>`.
  - The real HMAC uses a fake secret. WhatsApp Graph calls are captured in `backend.whatsapp`, never sent.
  - Fault injection: `backend.fault(action | fn, { delay, abort, status, body, json, sticky })`. Actions: `list`, `demande` (guest POST), `save-stay`, `stay-link`, `set-demande`, `demandes`, `stays`, `confirm`…
- Real selectors (stable data attributes):
  - **Guest.** Request forms: `[data-transfer-form] [data-transfer-submit]`, `[data-city-form]`, `[data-rental-form]`, `[data-meal-form]`, `[data-menage-form]`, `[data-pool-form]`, `[data-activity-form]`, `[data-massage-form]`. After submit: `[data-confirm-list]` and `[data-send-status].is-ok` / `.is-error [data-retry]`. Welcome card: `.stay-card[data-stay-ready] h1`. Mes demandes: `[data-demand-list] li`, `[data-demand-state][data-state=loading|updating|error|invalid|expired|ok]`, `[data-demand-empty]`. Récap: `[data-bill]`, `[data-settled]`. Contacts: `[data-open-contacts]` → `#contacts-dialog`. Stay context: `window.GuestStay.snapshot().state === "ok"`.
  - **Admin.** Gate: `[data-test]` (Mode test). « Jeu de test »: Réglages `[data-jeu-test]` (needed to see origine-test stays). Form: `[name=nom]`, `[data-source=Airbnb]`, `[name=room]`, `[data-save]`, `[data-error]` / `.form-ok`. Fiche: `[data-edit-link]`, `[data-prolong]`, `[data-stop]`, `[data-link-error]`. Demandes: `[data-filter=toutes]`, `[data-open=<id>]`, `[data-statut=<id>]`, `[data-set=Confirmée]`, `[data-req-error]`. Encaisser: `[data-pay]`, `[data-pay-confirm]`. Page-level read error: `[data-load-error] [data-retry]`.
  - **Confirmer page.** `body[data-confirm-state=confirmed|already|cancelled|invalid|busy]`, `[data-summary]`, `[data-note]`.
- Set date and time inputs with `setField(page, selector, "YYYY-MM-DD" | "HH:MM")`: it fires input and change events (WebKit date pickers cannot be typed into).

## Evidence

Screenshots go to `VZ_SHOTS` (default `/workspace/shots/bugfix/`): `guest-home.png`, `admin-stay-saved.png`, `wa-text-real-name.png`, `mes-demandes-reload-1..3.png`, `mes-demandes-error.png`, `deja-confirmee.png`, `recap-after-encaissement.png`.

Side effects are asserted on the mock, never on the UI alone:
- `backend.demandes()`: the rows the script wrote (`nom_client`, details, statut, date_confirmation);
- `backend.stayRow(id)`: encaisse_*, lien_*;
- `backend.whatsapp`: the staff templates (real name, HH:MM, no price);
- `P.wa`: the guest wa.me texts (real name, time, Confirmer link).

## Cleanup

Each test file closes only what it started: its contexts, servers and browser. Screenshots stay in `VZ_SHOTS` after cleanup. The script never writes outside the in-memory harness.

## Rules

- Never weaken a journey to make it pass: fix the code, or report it.
- Never point a test at the live /exec, WhatsApp or Gmail, and never print secrets (the harness uses placeholders).
- `installRecapTrigger` is never called.
- Feature map: `features/README.md`.
