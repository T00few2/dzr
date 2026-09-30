# DZR Coach

The Strava integration was removed. DZR Coach reads and writes training through intervals.icu.

Connect flow: `/intervals/connect`. OAuth callback: `/api/intervals/callback`. Tokens live in `intervals_connections` and are encrypted with `COACH_CONNECT_SECRET` (or `COACH_TOKEN_KEY` when that is set). Coach memory stays on `dzr-coach-memory:` so an unchanged secret still decrypts existing profiles.

Activities whose intervals.icu source is the Strava API are stubs and are skipped. Athletes connect Zwift (and a head unit for outdoor rides) inside intervals.icu, or import original files. There is no Strava API fallback.

See `README.md` for the OAuth app and environment variables.
