# Stats and Aujourd'hui

## Sub-features

- Stats by property, month and year (gross / net, occupancy…). Aujourd'hui: arrivals and departures, alerts « à confirmer », today's services (real feed).

## How to get to it (user POV)

Bottom nav « Stats » / « Aujourd'hui ».

## Driving it with Playwright

- assert there is no `[data-load-error]` and the page has content; inject `fault('demandes', { abort: true })` ×3 to see the error + Réessayer

## Gotchas

- A test session gets `stays-stats: []` by design.
