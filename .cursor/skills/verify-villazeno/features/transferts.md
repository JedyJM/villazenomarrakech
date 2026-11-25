# Transferts (aéroport, ville) and Location

## Sub-features

- Airport transfer: arrival or departure, flight time / pickup time, passengers, vehicles, baby seats, price 350 / 450 DH.
- In-town ride (Hicham): passengers, date, time, destination, no price.
- Car rental (Massillya): start / end dates and times, car type, delivery, usage.

## How to get to it (user POV)

Accueil → tile « Transferts », then the segments `[data-show=airport|city|rental]`.

## Driving it with Playwright

- submit, then read the captured wa.me text `waText(P.wa.at(-1))`
- assert `Nom : <real name>`, the time, and `Confirmer :\n<origin>/c/<id>-<token>`
- assert `[data-send-status].is-ok`

## Gotchas

- The guest WhatsApp opens BEFORE the POST (iOS tap rule). The POST answer then shows on the received panel.
- Submit is refused while the stay name is still loading (never « Invité » in a message).
