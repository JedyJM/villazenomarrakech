# Accès villa and Contacts utiles

## Sub-features

- Accès: itineraries 1 and 2, Google Maps button (forces itinerary 1).
- Contacts utiles (bottom sheet): Mehdi with his visible WhatsApp number, Hicham, emergency numbers.

## How to get to it (user POV)

Bottom nav « Accès » and « Contacts utiles ».

## Driving it with Playwright

- `goto /guest/acces.html`; `click [data-open-contacts]`, then read `#contacts-dialog`

## Gotchas

- None known.
