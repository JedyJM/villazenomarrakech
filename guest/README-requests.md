# Demandes invités

The guest portal does not send these requests anywhere yet. Each one is stored in `localStorage` under `villazeno.demandes`. A later connection can POST the same JSON to `GuestRequests.config.endpoint` when `enabled` is set to true. Until then `enabled` stays false, and this page never calls the network.

WhatsApp buttons only open the guest’s own WhatsApp. The page does not send those messages.

Request buttons (city ride and car rental) are in test mode. `TEST_MODE` and `TEST_WHATSAPP` live at the top of `guest/js/requests.js`. While `TEST_MODE` is true, those buttons open Mehdi on `212661147610` (the owner number in Contacts utiles). The real numbers stay in `RECIPIENTS`: Hicham `212661775422`, Massillya `212616172974`. Set `TEST_MODE` to false to use them again. Button labels do not change. The saved row still names the real recipient.

## Sheet tab: Demandes

One row per request. Amounts are in MAD. The French pages display the same amounts as DH.

| Column | JSON | Notes |
| --- | --- | --- |
| id | `id` | |
| created_at | `created_at` | ISO time |
| service | `service` | `transfert`, `course`, or `location_voiture` |
| status | `status` | `nouvelle` when the guest saves it |
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
| arrival_villa | `fields.arrival_villa` | Destination villa |
| pickup_villa | `fields.pickup_villa` | Departure villa |
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
| rental_start | `fields.start_date` | Service `location_voiture` |
| rental_end | `fields.end_date` | |
| car_type | `fields.car_type` | `citadine` or `4x4` |
| rental_people | `fields.people` | |
| delivery | `fields.delivery` | `villa` or `airport` |
| usage | `fields.usage` | `marrakech` or `excursion` |
| rental_agency | `fields.agency` | Massillya |
| rental_contact | `fields.contact` | Papa |
| rental_message | `fields.message` | Text the guest opens in WhatsApp |

Sales KPIs can sum `price_base`, `supplement_baby_seat`, and `total` where `service` is `transfert` and `status` is not cancelled.
