# Massage et soins

## Sub-features

- Treatment categories `.care-cat` (details), `.soin-pick` toggles, people per treatment.
- The guest's WhatsApp goes to « Massages & soins » with the Confirmer link.

## How to get to it (user POV)

Accueil → tile « Massage ».

## Driving it with Playwright

- open the first `.care-cat` (`d.open = true`), click `.soin-pick`, set date and time, submit
- assert the wa.me text: real name and `Heure : HH:MM`

## Gotchas

- None known.
