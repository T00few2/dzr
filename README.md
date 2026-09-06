# DZR monorepo

Canonical GitHub repo: [`T00few2/dzr`](https://github.com/T00few2/dzr). Production site: [www.dzrracingseries.com](https://www.dzrracingseries.com).

Three runtimes stay separate. Do not add npm workspaces (Vercel must keep using the root Next `package.json` only).

| Path | App | Host | Runtime |
|---|---|---|---|
| repo root | Next.js 14 site, `/admin`, `/members-zone`, `/join` | Vercel | Node 22 (`.nvmrc`) |
| `apps/api` | Flask jobs / bot HTTP API | Cloud Run (`zwiftpower`) | Python, `PORT` default `8080` |
| `apps/bot` | Discord club bot + optional DZR Coach | Render service `bot`, Oregon (`bot-tdnm.onrender.com`) | Node 22, `node bot.js` |

All three already deploy from this repo. Local secrets live in `.env.local` (site) and `apps/api/.env` / `apps/bot/.env`. Do not commit `service-account-key.json` or `.env` files.

## Website (this directory)

```powershell
npm install
npm run dev
```

Open http://localhost:3000

| Area | Path | Access |
|---|---|---|
| Public site | `/`, `/about`, `/racing`, event pages | Anyone |
| Join / onboarding | `/join` | Public flow (Discord → Zwift ID → Vipps) |
| Members zone | `/members-zone` | Discord **Verified member** via NextAuth |
| Admin | `/admin` | Discord **Admin** role |
| Strava OAuth | `/strava/connect` | Logged-in members |

Site reads `packages/shared/constants.json` through `app/lib/sharedConstants.ts`. Next webpack ignores `apps/**` so bot/API edits do not reload the site.

### Vercel

Root is a standard Next.js app. No `vercel.json` is required.

- Build: `npm run build`
- Start: `npm start`
- Node: `22`

Required site env names (set in the Vercel project; never commit values):

- Auth: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_REQUIRED_ROLE_ID`
- Coach (optional): `COACH_BOT_TOKEN`, `COACH_BOT_CLIENT_ID`, `COACH_MEMORY_KEY`
- Firebase client: `NEXT_PUBLIC_FIREBASE_*`
- Firebase admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Strava: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_CONNECT_SECRET`, `STRAVA_REDIRECT_URI`
- Strava webhook (optional): `STRAVA_WEBHOOK_VERIFY_TOKEN` — only if you register a push subscription; the callback fails closed without it
- Jobs API: `CONTENT_API_BASE_URL`, `CONTENT_API_KEY`
- Payments: `VIPPS_*` (only if membership checkout is enabled)

`NEXTAUTH_URL` is `https://www.dzrracingseries.com` in production and `http://localhost:3000` locally.

## Flask API (`apps/api`)

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Binds `0.0.0.0:$PORT` (`8080` locally). Firebase uses Application Default Credentials on Cloud Run (`apps/api/firebase.py`). Copy env names from `apps/api/.env.example`.

Cloud Run deploys `apps/api` from this repo. The service name stays `zwiftpower`. Health check is `GET /` and returns `{"service":"dzr-api",...}`. Admin UI is on the Next site, not this service.

Required API env names: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `CONTENT_API_KEY`, `ZWIFT_USERNAME`, `ZWIFT_PASSWORD`, `ZWIFTPOWER_CLUB_ID`, `FLASK_SECRET_KEY`. `DISCORD_BOT_URL` should be the Render bot origin (`https://bot-tdnm.onrender.com`) so Flask jobs can call the bot HTTP API.

## Discord bot (`apps/bot`)

```powershell
cd apps/bot
npm install
node bot.js
```

Keep-alive HTTP server listens on `0.0.0.0:$PORT` (`3000` locally) and answers `GET /` with `Bot is running!`.

Render service **`bot`** (Oregon) deploys this folder from this repo:

- Root Directory: `apps/bot`
- Build: `npm ci`
- Start: `node bot.js`
- Health check: `GET /`

[`render.yaml`](./render.yaml) documents that setup. Do not Apply it as a new Blueprint; that would create a second bot. `plan: starter` is required so the Discord gateway does not sleep.

Optional second bot **DZR Coach** (silent in channels; coaching DMs only). Create a Discord application named DZR Coach, enable Message Content, invite it to the guild with scope `bot` only, then set `COACH_BOT_TOKEN` and `COACH_BOT_CLIENT_ID` on Render and Vercel. `/coach` stays on the club bot and opens a DM from DZR Coach. Without those env vars the club bot starts and skips Coach.

Required bot env names: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`. Also set `CONTENT_API_*`, `OPENAI_API_KEY`, and `STRAVA_*` for the features that use them.

Optional: `COACH_DAILY_TOKEN_BUDGET` caps each athlete's coaching tokens per day (default 300000, `0` disables).

## Shared constants

`packages/shared/constants.json` is the source of truth for `siteOrigin`, Discord guild/role IDs, and Firestore collection names.

- Next.js imports it via `app/lib/sharedConstants.ts`
- Copies live in `apps/bot/constants.json` and `apps/api/constants.json` because Render and Cloud Run build those folders as the project root

When you change the shared file, copy it into both app trees before deploying bot or API.

## Rollback remotes

`bot-origin` → `T00few2/bot` and `api-origin` → `T00few2/zwiftpower` remain as rollback remotes. Production deploys come from `T00few2/dzr`.
