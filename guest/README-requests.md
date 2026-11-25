# Demandes invités

Every request (transfert, course en ville, location, restauration, ménage, piscine, activités, massage) is sent to the Google Apps Script web app and added as a row on the tab Demandes of the Sheet “Villa Zen'O – Bookings”. A copy is also stored in the browser’s `localStorage` under `villazeno.demandes`. The old `GuestRequests.config.endpoint` / `enabled` settings are unused (still empty / false): sending goes through `APPS_SCRIPT_URL` only.

WhatsApp buttons only open the guest’s own WhatsApp. The page does not send those messages.

Restauration, ménage, piscine and activités no longer open any WhatsApp: the request is posted to the Sheet and Apps Script sends the staff WhatsApp (template `nouvelle_demande`, Arabic, no prices), so staff get one message. Massages, transfers (airport and city) and car rental (Massillya) still open the guest WhatsApp in French. Request buttons are in test mode. `TEST_MODE` and `TEST_WHATSAPP` live at the top of `guest/js/requests.js`. While `TEST_MODE` is true, those buttons, the guest WhatsApp in the bar and the villa line in Contacts utiles open `212661147610` (the Hicham line in Contacts utiles is a direct `wa.me` link and ignores `TEST_MODE`). Rows are still sent to the Sheet in test mode. Guests always reach Mehdi on `MEHDI_WHATSAPP` `212661147610`. `VILLA_WHATSAPP` `212661552597` is reserved for future automated staff messages and no guest button opens it. The real staff numbers stay in `RECIPIENTS`: Hicham `212661775422`, Massillya `212616172974`, Fouzia `212767202011` (restauration), Nadera `212639474843` (ménage), Khalid `212630415956` (piscine, jardin, jacuzzi, activités), Massages & soins `212661614469`. PayPal uses `PAYPAL_EMAIL` (`Mr.moums@gmail.com`); in test mode the recap button does not open it. Set `TEST_MODE` to false to use the real numbers and the PayPal link. Button labels do not change. The saved row still names the real recipient.

`APPS_SCRIPT_URL` is at the top of `guest/js/requests.js` and is filled in with the deployed `/exec` URL (the same URL is in `c/index.html` and in `admin/js/shell.js` as `SCRIPT_URL`). Each send adds a row on the tab Demandes, and the WhatsApp message ends with a one-tap confirmation link `/c?r=<id>&k=<token>`. `c/index.html` forwards it to the Apps Script (`action=confirm`), which sets the row to Confirmée. Mes demandes and the recap read `?action=list&stay=<booking_id>&k=<key>`: only rows whose `details_json.booking_id` matches the stay are listed. Deploy and update steps are in `guest/apps-script/DEPLOY.md`.

## Sheet tab: Demandes

One row per request, written by `doPost` in `guest/apps-script/Code.gs`.

| Column | Content |
| --- | --- |
| id | Request id (8 characters) |
| date_creation | ISO time |
| service | `transfert`, `course`, `location_voiture`, `restauration`, `menage`, `piscine`, `activites` or `massage` |
| sous_type | e.g. `arrivée` / `départ`, `en ville`, `citadine` / `4x4`, meal, `maison` / `chambres`, activity, treatment ids |
| nom_client | `Invité` while `getGuestFromStay()` is a placeholder |
| details_json | The form `fields` below (without `message`), plus `token` (confirmation key), `resume` (summary lines) and `booking_id` (stay id from `?stay=`) |
| total_dh | Total. In DH, except `restauration`, where it is in euros. Empty when there is no price |
| destinataire | Real recipient name (Hicham, Massillya, Fouzia, Nadera, Khalid, Massages & soins), even in test mode |
| statut | `Envoyée` on arrival; then `Confirmée` (Confirmer link or admin), `Terminée` (2 h after the planned time, by `installDemandesTrigger`) or `Annulée` |
| date_confirmation | Set when the Confirmer link is opened |
| offert | Checkbox |

## Local record (`localStorage`) for transfers, city rides and rentals

The browser copy keeps the full record. Amounts are in MAD; the French pages display them as DH. Inside the Sheet, the `fields.*` values are in `details_json`.

| Name | JSON | Notes |
| --- | --- | --- |
| id | `id` | |
| created_at | `created_at` | ISO time |
| service | `service` | `transfert`, `course`, or `location_voiture` |
| status | `status` | Always `nouvelle` in the local copy. The real status lives in the Sheet column `statut` |
| guest_name | `guest.name` | Looked up from the Google Sheet “Villa Zen'O – Bookings”, tab Réservations, by booking id. Not typed by the guest. `getGuestFromStay()` is the placeholder until that lookup exists |
| guest_phone | `guest.phone` | Same booking lookup as the name. Not typed by the guest |
| guest_villa | `guest.villa` | |
| trip_type | `fields.trip_type` | `arrival` or `departure` for a transfer |
| date | `fields.date` | Transfer date |
| flight_arrival_time | `fields.flight_arrival_time` | Arrival trips only |
| pickup_time | `fields.pickup_time` | Departure trips only |
| passengers | `fields.passengers` | Up to 8 per vehicle |
| vehicles | `fields.vehicles` | 1 or 2. Two vehicles split the passengers evenly |
| luggage | `fields.luggage` | |
| flight_number | `fields.flight_number` | |
| origin_city | `fields.origin_city` | City the guest is coming from, free text |
| arrival_villa | `fields.arrival_villa` | Kept empty. The stay villa comes from `getGuestFromStay()` |
| pickup_villa | `fields.pickup_villa` | Kept empty. The stay villa comes from `getGuestFromStay()` |
| baby_seat | `fields.baby_seat` | True when a seat is requested |
| baby_seats | `fields.baby_seats` | 0, 1, 2, or 3. Each seat is 50 MAD |
| comment | `fields.comment` | |
| price_base | `price_base` | 350 for 1–4 passengers, 450 for 5–8. Empty for a city ride or a rental |
| supplement_baby_seat | `supplements[].amount_mad` where `code` is `baby_seat` | 50 MAD per seat |
| total | `total` | `price_base` plus supplements |
| currency | `currency` | `MAD` |
| course_passengers | `fields.passengers` | City ride, 1 to 8. No price |
| course_date | `fields.date` | City ride pickup date |
| course_pickup_time | `fields.pickup_time` | City ride, 24-hour pickup time |
| course_destination | `fields.destination` | City ride |
| course_message | `fields.message` | City ride text opened in WhatsApp. Includes the guest name and villa from `getGuestFromStay()` |
| rental_start | `fields.start_date` | Pick-up date |
| rental_start_time | `fields.pickup_time` | Pick-up time, 24-hour |
| rental_end | `fields.end_date` | Return date |
| rental_end_time | `fields.return_time` | Return time, 24-hour |
| car_type | `fields.car_type` | `citadine` or `4x4` |
| delivery | `fields.delivery` | `villa` or `airport` |
| usage | `fields.usage` | `marrakech` or `excursion` |
| rental_agency | `fields.agency` | Agence Massillya |
| rental_message | `fields.message` | Text the guest opens in WhatsApp |

Sales KPIs can sum `total_dh` on the tab Demandes where `service` is `transfert` and `statut` is not `Annulée` (`price_base` and the baby-seat supplement are only in the local copy; `details_json` keeps `baby_seats`).

## Guest link key (`k`)

The guest link is `https://villazenomarrakech.com/guest/?stay=<booking_id>&k=<key>`. The stay id alone is guessable, so the script also wants `k`:

- `k` = first 16 hex characters of HMAC-SHA256(stay id, `LINK_SECRET`). `LINK_SECRET` is a Script property; if it is missing, `Code.gs` creates a random one on first use and stores it there (nothing is written in the Sheet). Changing or deleting `LINK_SECRET` breaks every guest link already sent.
- `action=list` and every guest POST (`stay` + `k` in the body) need a valid key. Otherwise the answer is always `{ ok: false, error: "invalid_link" }`, with no name and no dates, whether the id is unknown, the key wrong or missing. No row, no e-mail, no staff WhatsApp.
- The portal keeps `stay` and `k` from the arrival page in `localStorage` (`villazeno.stay`, `villazeno.stayKey`) for the whole visit (internal links, `en/`, recap, confirmation) and sends `k` with every call. The welcome-card cache (`villazeno.stayCard`) is only reused for the same id and key. On `invalid_link` the portal forgets the stored link and shows the neutral example card.
- Admin: `action=stays` and `action=stay` add `k` to each stay for a signed-in Google admin (the test session only gets it for `origine=test` rows, the only ones it sees). Séjours › fiche shows, copies and sends by WhatsApp the full link with `&k=`; the confirmation e-mail uses it too. Public answers never contain a key.
- Transition: the Script property `LINK_LEGACY_OPEN` (comma-separated ids, e.g. `FAM-SK-2611`) keeps the old links without `k` working for those ids only. Every other id is strict. Once the guest has the new link with `&k=`, remove the id from the property (or delete the property).
