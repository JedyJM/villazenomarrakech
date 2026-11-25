# Provider « Confirmer » link

## Sub-features

- `/c/<id>-<token>` (Vercel rewrite) or `/c/?r=&k=` (GitHub Pages via 404.html).
- First open: « Demande confirmée » + summary. Next opens: « Demande déjà confirmée » + « Confirmée le … à HH:MM ».
- Rendered on our domain from `action=confirm&format=json`. With script v18 (HTML, no CORS) it falls back to the old redirect.

## How to get to it (user POV)

The provider taps « Confirmer » in the guest's WhatsApp message.

## Driving it with Playwright

- `phone(pages.origin, b)`, `goto /c/<id>-<token>`, wait for `body[data-confirm-state=confirmed]`; open it again, then `already`

## Gotchas

- Lock contention returns `busy` (a branded retry page), never a Google error.
