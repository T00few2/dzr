# DZR monorepo

Canonical GitHub repo: `T00few2/dzr`.

Three runtimes stay separate. Do not add npm workspaces (Vercel must keep using the root Next `package.json` only).

| Path | App | Host |
|---|---|---|
| repo root | Next.js site + `/admin` + members zone | Vercel |
| `apps/api` | Flask jobs / bot HTTP API | Cloud Run (`zwiftpower`) |
| `apps/bot` | Discord bot | Render |

## Website (this directory)

```powershell
npm install
npm run dev
```

Open http://localhost:3000

Admin UI is `/admin` (Discord **Admin** role). Members zone is `/members-zone`.

## Flask API (`apps/api`)

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

Cloud Run continuous deploy currently still tracks `T00few2/zwiftpower`. After this repo is pushed, retarget CD to `T00few2/dzr` with source directory `apps/api`. Keep the existing service URL.

## Discord bot (`apps/bot`)

```powershell
cd apps/bot
npm install
node bot.js
```

Render currently tracks `T00few2/bot`. After this repo is pushed, change Source to `T00few2/dzr`, Root Directory `apps/bot`, keep Build `npm install` and Start `node bot.js`.

Optional second bot **DZR Coach** (silent in channels; coaching DMs only). Create a Discord application named DZR Coach, enable Message Content, invite it to the guild with scope `bot` only, then set `COACH_BOT_TOKEN` and `COACH_BOT_CLIENT_ID` on Render and Vercel. `/coach` stays on the club bot and opens a DM from DZR Coach. Without those env vars the club bot starts and skips Coach.

## Shared constants

`packages/shared/constants.json` is the source of truth for Discord role IDs and Firestore collection names. Copies live in `apps/bot/constants.json` and `apps/api/constants.json` because Render and Cloud Run build those folders as the project root.

## Old remotes

`T00few2/bot` and `T00few2/zwiftpower` stay as rollback remotes until Cloud Run and Render have each deployed from this repo. Do not archive them on the first green deploy.

Do not commit `service-account-key.json` or `.env` files.
