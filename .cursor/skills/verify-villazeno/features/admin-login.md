# Admin login

## Sub-features

- Google sign-in (allowlist), « Mode test » only on localhost / *.vercel.app.

## How to get to it (user POV)

`/admin/index.html`.

## Driving it with Playwright

- `click [data-test]` → aujourdhui.html; then Réglages `click [data-jeu-test]` to see the origine-test stays

## Gotchas

- The Google login cannot be driven offline (real Google account): verify it by hand on the preview.
