# Demandes (admin) and confirmations

## Sub-features

- Real feed `action=demandes` (a test session gets the test stays' rows), filters, Changer statut (awaited, reverted on failure), Offert, Relancer (opens WhatsApp only).

## How to get to it (user POV)

Bottom nav « Demandes ».

## Driving it with Playwright

- `click [data-filter=toutes]`, `[data-open=<id>]`, `[data-statut=<id>]`, `[data-set=Confirmée]`
- assert `backend.demandes()` statut + date_confirmation

## Gotchas

- Status chips are uppercased by CSS: compare case-insensitively.
