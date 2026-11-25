# Séjours: create, edit, Prolonger / Désactiver

## Sub-features

- Create (nouveau.html) and edit (fiche → « Modifier » → nouveau.html?id=). The single button « Enregistrer » waits for the script, shows « Séjour enregistré. », then opens the fiche (or the e-mail page for Direct).
- Errors: Session expirée (+ Se reconnecter), Pas de réponse (+ Réessayer), refused by the server.
- Fiche: guest link, Prolonger (+7 days), Désactiver.

## How to get to it (user POV)

Séjours → « Nouvelle », or tap a stay.

## Driving it with Playwright

- `fault('save-stay', { delay: 2000 })`, then assert the URL is unchanged and the button reads « Enregistrement… » while pending
- assert `backend.stayRow(id)`

## Gotchas

- Retries reuse the same booking_id (no duplicate row).
