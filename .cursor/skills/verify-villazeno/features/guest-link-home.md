# Guest private link and home

## Sub-features

- Private link `/guest/?stay=<id>&k=<key>` (key = HMAC, 16 hex characters). The URL wins and is stored with its key; internal links carry neither.
- Welcome card « Marhaba <prénom>, » with the real stay dates. The « Exemple » card shows only without a link, or when the link is refused.
- Expired / disabled link → `expire.html`. From the departure day on, the service tiles are replaced by « Voir mon récapitulatif ».

## How to get to it (user POV)

Mehdi sends the link from the admin fiche (« Envoyer par WhatsApp »). The guest opens it and lands on Accueil.

## Driving it with Playwright

- `page.goto(origin + '/guest/?stay=' + b.STAY_ID + '&k=' + b.key)`
- wait for `GuestStay.snapshot().state === 'ok'`, then `.stay-card[data-stay-ready] h1`
- assert `.stay-range time[datetime]` = the stay arrival / departure

## Gotchas

- One `action=list` per page (guest-stay.js). Never add a second list fetch.
- The stay-pack cache (`villazeno.stayPack`) is keyed by id AND k; it is dropped on invalid_link / expired.
