# Restauration (breakfast, lunch, dinner)

## Sub-features

- Meal tabs `[data-meal]`, date (tomorrow at the earliest), time `<select name=time>`.
- Breakfast before 09:00: +10 € per table (100 DH), not per person (`MEAL_PRICES.earlyBreakfast`).
- Adults and children steppers, children's ages, eggs (breakfast), salads, dishes.
- Auto service: posted to the script, staff WhatsApp sent by the script (Arabic, no price). No guest WhatsApp.

## How to get to it (user POV)

Accueil → tile « Restauration ».

## Driving it with Playwright

- `click [data-meal=breakfast]`, `setField [name=date]` to tomorrow, `selectOption [name=time] '08:00'`, `click [data-people-kind=adults][data-dir='1']` ×3, submit
- assert `[data-confirm-list]` contains « Supplément … 10 € » and « Total 3 personnes · 40 € »
- assert `backend.demandes()` last row: `nom_client` = real name, `details.resume` without €/DH

## Gotchas

- Adults start at 0.
- Totals are in euros for restauration (total_dh holds euros for this service only).
