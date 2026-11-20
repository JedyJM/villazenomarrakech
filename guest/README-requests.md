# Demandes invités

The guest portal does not send these requests anywhere yet. Each one is stored in `localStorage` under `villazeno.demandes`. A later connection can POST the same JSON to `GuestRequests.config.endpoint` when `enabled` is set to true. Until then `enabled` stays false, and this page never calls the network.

WhatsApp buttons only open the guest’s own WhatsApp. The page does not send those messages.

## Sheet tab: Demandes

One row per request. Amounts are in MAD. The French pages display the same amounts as DH.

| Column | JSON | Notes |
| --- | --- | --- |
| id | `id` | |
| created_at | `created_at` | ISO time |
| service | `service` | `transfert`, `course`, or `location_voiture` |
| status | `status` | `nouvelle` when the guest saves it |
| guest_name | `guest.name` | Example for now |
| guest_phone | `guest.phone` | Example for now |
| guest_villa | `guest.villa` | |
| trip_type | `fields.trip_type` | `arrival` or `departure` for a transfer |
| date | `fields.date` | Transfer date |
| flight_arrival_time | `fields.flight_arrival_time` | Arrival trips only |
| pickup_time | `fields.pickup_time` | Departure trips only |
| passengers | `fields.passengers` | Max 8. Above that, no price |
| luggage | `fields.luggage` | |
| flight_number | `fields.flight_number` | |
| arrival_villa | `fields.arrival_villa` | Destination villa |
| pickup_villa | `fields.pickup_villa` | Departure villa |
| baby_seat | `fields.baby_seat` | |
| baby_seat_qty | `fields.baby_seat_qty` | 0, 1, or 2 |
| comment | `fields.comment` | |
| price_base | `price_base` | 350 for 1–4 passengers, 450 for 5–8. Empty for a city ride or a rental |
| supplement_baby_seat | `supplements[].amount_mad` where `code` is `baby_seat` | 50 MAD per seat |
| total | `total` | `price_base` plus supplements |
| currency | `currency` | `MAD` |
| course_message | `fields.message` | City ride, service `course` |
| rental_start | `fields.start_date` | Service `location_voiture` |
| rental_end | `fields.end_date` | |
| car_type | `fields.car_type` | `citadine`, `suv`, `monospace`, `other` |
| rental_people | `fields.people` | |
| delivery_to_villa | `fields.delivery` | `yes` or `no` |
| rental_agency | `fields.agency` | Massillya |
| rental_contact | `fields.contact` | Papa |
| rental_message | `fields.message` | Text the guest opens in WhatsApp |

Sales KPIs can sum `price_base`, `supplement_baby_seat`, and `total` where `service` is `transfert` and `status` is not cancelled.
