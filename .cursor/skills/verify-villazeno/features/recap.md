# Récapitulatif

## Sub-features

- In euros (1 € = 10 DH shown): heating, Terminée meals, Booking tourist tax; already paid to providers; Cash / PayPal (+4.4 % + 0.35 €).
- When the admin marks the stay paid (Encaisser), the card « Réglé à la villa » replaces the bill.

## How to get to it (user POV)

Mes demandes → « Récapitulatif de séjour ».

## Driving it with Playwright

- after the admin Encaisser: `goto /guest/recap.html`, then `[data-settled]:not([hidden])`

## Gotchas

- The settled state needs `encaisse_*` in the public stay (Code.v19 stayRecord_ via vzfPublicStay_).
