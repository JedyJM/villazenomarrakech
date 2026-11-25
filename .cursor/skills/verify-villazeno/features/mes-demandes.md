# Mes demandes

## Sub-features

- List of the stay's demandes with status (Envoyée / Confirmée / Terminée / Annulée), requested day and time, and « Confirmée le … à HH:MM ».
- States: loading (first paint), updating (cached list shown), error + « Réessayer », invalid / expired message, empty only after a successful empty answer.

## How to get to it (user POV)

Bottom nav « Mes demandes ».

## Driving it with Playwright

- reload several times and assert exactly one visible state, never « title + button only »
- faults: `backend.fault('list', { delay: 3000 } | { abort: true } ×3 | { status: 500 } | { body: '<html>' } | { json: { ok: false, error: 'invalid_link' } })`

## Gotchas

- GET retries twice before showing the error: inject 3 faults for a visible error.
- Times come from the shared field model (transfert: flight_arrival_time / pickup_time; location: start_date + pickup_time). Never 00:00.
