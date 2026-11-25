# Ménage, Piscine, Activités

## Sub-features

- Ménage: scope (maison / chambres), date, time.
- Piscine / jacuzzi / jardin: one or more `[data-clean]` chips.
- Activités: quad / dromadaire counters (`[data-count=quad1]`…), horse riding by number of riders.

## How to get to it (user POV)

Accueil → tiles « Ménage », « Piscine », « Activités ».

## Driving it with Playwright

- fill date and time with `setField`, submit, then wait for `[data-send-status].is-ok` (the POST is awaited)
- assert the row and the staff template in `backend.whatsapp` (real name, HH:MM, no price)

## Gotchas

- The activity radios are visually hidden: use `.check({ force: true })`.
