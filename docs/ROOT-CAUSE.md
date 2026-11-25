# Root cause: bugs of 25 Nov 2026

Branch `fix/admin-stay-save`, before the fixes (tip a7220ed). Script = live v18 (`guest/apps-script/Code.gs`, identical to `/workspace/sec/Code.v18.gs`).

## The four root causes

**RC1. No shared field model between the site and the script.** One fact is stored under different keys depending on the service. Each reader picks its own subset.
- Time: restauration/ménage/piscine/activités/massage write `time` (+ `time_label`), transfert writes `flight_arrival_time` or `pickup_time`, course writes `pickup_time`, location writes `start_date` + `pickup_time` (`guest/js/requests.js:418-450, 737-748, 827-841`). The readers only check `time_label || time`: `listDemandes_` (Code.gs:369), `adminDemandes_` (Code.gs:880), `confirmLine_` (Code.gs:633), `pastGrace_` via `shownStatus_` (Code.gs:552) and `waHoraire_` (Code.gs:1860). The admin then fills the gap with midnight: `raw.time || "0:0"` (`admin/js/demandes.js:125`).
- Name: the site sends `nom_client` = `"Invité"` while the stay is not loaded (`requests.js:298`). `stayRecord_` returns only `prenom`, never `nom` (Code.gs:482). For an `origine=test` stay it returns no name at all (`guestFromRows_`, Code.gs:437).
- Stay record: `stayRecord_` (Code.gs:452-485) does not return `encaisse_le / encaisse_mode / encaisse_total_eur / offerts`. So the guest récap can never show « Réglé » after an Encaisser (`guest/js/stay-board.js:showSettled` reads `stay.encaisse_le`; outside test mode nothing ever sets it). `STAY_HEADERS` (Code.gs:11-19) has no `chauffage_*` columns, so `saveStay_` cannot write heating into a sheet that lacks them.
- The confirmation date (`date_confirmation`, column 10) is never sent by `listDemandes_` or `adminDemandes_`.

**RC2. No shared Apps Script client. Calls are fire-and-forget or have their errors swallowed.** Every page wrote its own `fetch`, with no timeout, no error state and no retry:
- Guest request: `postToSheet` uses `mode: "no-cors"` + `.catch(function(){})` (`requests.js:94-103`). The answer cannot be read, so « forbidden », « rate_limited » or a network failure stays invisible: the guest sees « Demande envoyée » anyway.
- Guest list: `listDemandes` (`requests.js:2008-2025`) has no timeout. A rejection becomes `items: []` (`stay-board.js:303-306`). Nothing is painted until the answer arrives (`stay-board.js:517`).
- Admin: on main, `postScript` was fire-and-forget (`main:admin/js/stays.js:191-200`), followed by navigation (`main:…:864`), and the Save button was relabelled « Préparer l’e-mail de confirmation » (`main:…:673`). The branch fixed `postScript` only for stays. `set-demande` (`admin/js/demandes.js:228-232`) and `save-reglages` (`admin/js/reglages.js:72-81`) are still `.catch(function(){})`. Encaissement and Demandes GETs end in `.catch → start(null)` / an empty list. An expired Google token (about 1 h) answers `forbidden`, which nobody displays.

**RC3. No single stay context.** Guest side: each page derives the stay on its own. `stayId()` / `stayKey()` re-read the URL or localStorage (`requests.js:115-132`). The name comes from a cache (`WELCOME_CACHE`) that only the *first `action=list` answer* fills (`requests.js:155-191`). Each page starts **two** list calls (`applyStayGate`, `requests.js:2167`, and `stay-board.js:303`). Either one can wipe the stored stay (`forgetStay`, `requests.js:134`). A WhatsApp message built before the answer arrives therefore says « Invité ». Admin side: the hard-coded constant `TEST_MODE = true` (`admin/js/shell.js:5`) is also used as « show sample data » (`admin/js/demandes.js:104, 370`; `aujourdhui.js:24`). The sample source is empty (`admin/js/sample.js:11`). Result: admin Demandes and Aujourd’hui are **always empty, even in production**, so a confirmation never shows on the admin side.

**RC4. The Confirmer link leaves our site for a Google page.** `c/index.html:25` does `location.replace("https://script.google.com/.../exec?action=confirm…")`. The page the provider sees is an HtmlService page served by Google (Code.gs:639-666). Its rendering depends on Google’s session and account handling, not on our code. Server side, `doGet` takes `lock.waitLock(15000)` (Code.gs:122), which **throws** on contention: Google then shows its own error page. A repeat open returns the same title « Demande confirmée » (Code.gs:137) with no confirmation time. The summary has no time for transfert, location or massage (RC1).

## Bug × root cause

| Bug | RC1 fields | RC2 client | RC3 context | RC4 redirect |
| --- | :-: | :-: | :-: | :-: |
| 1. Admin stay save (fire-and-forget, label, navigation, silent forbidden) | | ✔ | | |
| 2. « Invité » in WhatsApp texts / Mes demandes / templates | ✔ | | ✔ | |
| 3. 00:00 times, no confirmation time | ✔ | | | |
| 4. Mes demandes flaky (blank / list / blank) | | ✔ | ✔ | |
| 5. Confirmer opened twice → Google « Impossible d’ouvrir le fichier » | ✔ (summary) | | | ✔ |
| Admin↔guest link (Encaisser → récap; confirmations on both sides) | ✔ | ✔ | ✔ | |

## Bug 4: what reproduces offline

On iPhone 15 WebKit, with `action=list` mocked:
- A slow answer (Apps Script cold start, 3 to 12 s) gives exactly « title + Récapitulatif button only » for the whole wait. There is no loading state and no timeout.
- A failed answer (HTTP error, abort, or an HTML body from a Google error) gives the empty state « Vous n’avez encore envoyé aucune demande », which is wrong.
- An `ok:false` answer from one of the two concurrent calls makes `forgetStay()` erase the stored link. The next reload, without `?stay=`, then finds no stay.

A warm vs cold script explains why the result alternates from one reload to the next.

## Bug 5: what is and is not determinable offline

In the harness, `doGet` repeat open works for all four types: it returns the branded page, with no exception. So the Google « Impossible d’ouvrir le fichier » page does **not** come from our script code on a normal repeat open. It is Google’s error for a `script.google.com` URL. Likely triggers: several Google accounts signed in on the phone (`/macros/u/N/` redirect), the web-app access setting, a reused googleusercontent URL, or the `waitLock` exception under contention.

Which one applies cannot be decided without the deployment settings (Execute as / Who has access) and the exact screen. The fix removes the dependency instead of guessing: the Confirmer page stays on our domain. `c/` calls `action=confirm&format=json` through the shared client and renders the branded page itself, including « Demande déjà confirmée » and « Confirmée le … à HH:MM ». Before v19 is published, it falls back to the old redirect.

## Structural fix (step 3)

1. `js/vz-fields.js`: the one field model (time and date per service, name, confirmation date, public stay, list item, confirm summary). It is used by the guest pages, the admin and the test mock. It is copied verbatim into `Code.v19.gs` between `BEGIN/END VZ_FIELDS`, and a test asserts that both copies are identical.
2. `js/vz-api.js`: the one Apps Script client. Every call is awaited, with a timeout, retries for reads, and `{ok, kind: session|network|server|invalid_link|expired|busy}`. A shared error box has a « Réessayer » button. Every call site in guest, admin and `c/` goes through it.
3. `guest/js/guest-stay.js`: the one stay context. The stay is resolved once from the URL (or from storage, together with its key), with a single in-flight `action=list` per page and a stale-while-revalidate cache keyed by id+k. Name, dates, Mes demandes, récap and WhatsApp texts all read it.
4. Admin: sample data only with `?demo=`. Real feeds otherwise, including the test session against the test rows.
