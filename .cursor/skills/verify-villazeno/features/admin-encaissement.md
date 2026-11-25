# Encaisser

## Sub-features

- Bill: heating, Terminée meals, Booking tax; Offert toggles; modes €, DH, PayPal. « Marquer comme payé » → Confirmer (awaited).

## How to get to it (user POV)

Fiche → « Encaisser ».

## Driving it with Playwright

- `click [data-pay]`, `click [data-pay-confirm]`, then assert `stayRow().encaisse_le` and the guest récap « Réglé »

## Gotchas

- The paid state comes from the Sheet (`encaisse_le`), the local copy only as a fallback.
