# DZR Coach — review and improvement proposal

_Point-in-time review, September 2026, against commit 06fe73d._

## Context

You asked for an honest view of the DZR Coach setup and suggestions to improve it. This is a
review plus a sequenced proposal — **no code changes**, per your choice. Weighted toward the
three areas you flagged: correctness/data loss, coaching quality & evals, and
architecture/duplication.

Scope read: `apps/bot/handlers/aiChatHandler.js`, `apps/bot/services/coach*.js`,
`stravaService.js`, `tokenCrypto.js`, `firebase.js`, `scheduler.js`; `app/api/coach/*`,
`app/api/strava/*`, `app/api/admin/coach`, `app/lib/coach*.ts`, `app/lib/tokenCrypto.ts`,
`app/lib/stravaAuth.ts`, `firestore.rules`, the members-zone and admin UI, and `apps/api`.

---

## Summary of proposed changes

| # | Change | Why | Rough effort |
|---|---|---|---|
| **0** | Authenticate `POST /api/strava/webhook` | Anyone can wipe a named member's coach data today | Hours |
| **1** | **Back up Firestore first**, then: transactions on profile writes; fix conversation trim; fail closed when no encryption key; try/catch in admin route; cap web-written notes | Silent data loss and a mid-turn crash class | ~1 day |
| **2** | `node --test` on the already-pure helpers + CI + lint/typecheck `apps/**`; then a ~25-case prompt golden set | Nothing currently catches a regression | ~2 days |
| **3** | Extract `tokenCrypto` / `coachProfile` / `coachChatNotes` / `isPaidClubMember` into `packages/shared` | Two hand-synced copies of the crypto; drift = unreadable memory | ~1 day, after 2 |
| **4** | Resolve membership + profile once per turn; widen follow-up window; persist pending goals; daily token budget | 8 Firestore ops of pure auth per turn; follow-ups skip on a missed minute | ~half day |
| **5** | Fetch activity streams → compute mean-max power, NP, IF/TSS, decoupling, intervals in code | It can't answer "was that interval session good?" | ~2 days |
| **6a** | Weekly load rollups (12–26 weeks) via the existing scheduler | Can't see past 28 days, so can't periodise | ~1 day |
| **6b** | `## Sport` section + expose race calendar/phenotype | It doesn't know its riders are indoors on Zwift | ~half day |
| **6c** | Move note extraction to session close; emit notes **+** a conversation summary | Per-message extraction is N calls and worse notes | ~1 day |
| **6d** | Save recommendations as `plan` notes; check them in the follow-up | Advice is never followed up | ~half day |
| **6e** | Generate `.zwo` and attach it to the coach DM, with install instructions + profile PNG | Turns prose into an executable session | ~1–2 days |
| **6f** | 👍/👎 on coach DMs; test higher reasoning effort on the synthesis turn | No quality signal at all today | ~half day |
| **7** | Rebalance the prompt: reply contract, `language: null` default, pre-loaded context, illness section, prune negations | Five of eight sections are storage policy; one is coaching | ~1 day, after 2 |

**Suggested order:** 0 alone and immediately → 1 → 2 → then 5, 6a, 6b, 6c in whatever order
appeals (these are the coaching-quality wins) → 3 and 7 once the tests exist to prove nothing
broke → 4, 6d–6f as capacity allows.

**If you only do three:** 0 (security), 2 (tests), 6a (longitudinal load). The first stops a
live risk, the second makes everything after it safe to change, the third is the largest single
jump in how good the coaching actually is.

> **Read "Before you start" at the end of this document first.** It corrects three errors in
> the stages below, lists the assumptions that could invalidate them, and adds the backup step
> this plan originally lacked.

---

## Honest assessment

**This is a genuinely good build.** It is well past hobby-project quality and several of the
hard parts are done properly:

- **The trust model is right.** Coaching lives in a separate silent bot that only ever speaks
  in DMs (`coachBot.js:44`, `aiChatHandler.js:1880`), gated on *paid* membership plus a Strava
  connection before a single token is spent (`aiChatHandler.js:1953-1964`). The club bot
  actively refuses to coach and redirects to `/coach` (`aiChatHandler.js:1920`). That
  separation is a deliberate design decision and it's the correct one.
- **The memory model is the best thing here.** The three-way split — standing *settings* (web
  only), silent dated *episode notes*, and *goals* that require an explicit Ja button
  (`coachGoalConfirm.js`) — is a real insight about how coaching memory should work. Notes
  carry `at` dates and are aged in the prompt (`formatNoteAge`), so the model is told a
  two-week-old "tired" note is stale. Most people building this would have dumped an
  undifferentiated memory blob into the context.
- **Privacy hygiene is above average for a club project.** Opt-in notes, AES-256-GCM at rest
  with domain-separated keys (`tokenCrypto.ts:9-25`), coach collections denied to the client
  SDK in `firestore.rules:33-62` (including the `notes` subcollection, which is easy to miss),
  admins can see usage but never note *content* (`app/api/admin/_lib/collections.ts:4-9`), and
  a working delete path.
- **Timezone handling is careful.** `formatCoachToday` pins Europe/Copenhagen and ISO Monday
  weeks and puts them in the prompt (`coachChatNotes.js:68-98`). This is exactly the bug class
  that makes an LLM coach feel broken, and you pre-empted it.
- **The prompts are disciplined.** "Never invent numbers that were not returned by a tool",
  the injury hard-constraint line, the settings-are-read-only framing. These read like they
  were written by someone who watched the model fail and fixed it.

**Where it's weak** — three structural things, in order:

1. **The whole coach is untested and unchecked.** No CI, no tests, and `apps/**` is excluded
   from *both* ESLint (`.eslintrc.json`) and tsconfig (`tsconfig.json` `exclude`). A typo in
   the 2,296-line `aiChatHandler.js` first surfaces in a DM with a real athlete. For a product
   whose behaviour *is* a large prompt with intricate rules, having zero regression signal is
   the biggest single risk to coaching quality.
2. **Read-modify-write everywhere, no transactions.** Coach profile writes are full-document
   `.set()` on both sides. This silently loses data (see below).
3. **The JS/TS duplication is load-bearing.** `tokenCrypto`, `coachProfile`, `isPaidClubMember`
   and `constants.json` exist twice, line-for-line, in JavaScript and TypeScript. These two
   copies must stay byte-compatible or coach memory becomes undecryptable — and nothing
   enforces that.

---

## Findings, by severity

### P0 — `POST /api/strava/webhook` is unauthenticated and destructive

`app/api/strava/webhook/route.ts:25-45`. The `GET` handler checks `hub.verify_token`. The
`POST` handler checks **nothing**:

```ts
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  if (objectType === 'athlete' && aspect === 'update' && authorized === 'false') {
    const discordId = await findDiscordIdByStravaAthleteId(ownerId)
    if (discordId) await wipeCoachStravaForDiscordId(discordId, {...})
```

`wipeCoachStravaForDiscordId` (`app/lib/wipeCoachStrava.ts:15,35,41`) deletes the coach
profile, **every chat note**, and the Strava connection, then DMs the athlete. The only input
is `owner_id` — a Strava athlete ID, which is public in every Strava profile URL. Anyone can
POST that JSON and irreversibly wipe a named member's coaching history, or spam DMs.

Strava does not sign webhooks, so the fix is defence in depth: compare `body.subscription_id`
against the stored subscription ID, require a secret path segment or header, and reject
anything else. Also `STRAVA_WEBHOOK_VERIFY_TOKEN` is missing from the root `.env.example`
(it's only in `apps/bot/.env.example`).

### P1 — Coach profile saves can be silently wiped by an incoming DM

Both sides do read → mutate → **full `.set()`**, no transaction, no merge:

- Bot: `markCoachAthleteMessage` / `markCoachFollowUpSent` (`apps/bot/services/firebase.js:483-513`)
  read the whole profile, then `writeCoachProfileDoc` → `coachProfileRef(id).set(...)`.
- Web: `PUT /api/coach/profile` (`app/api/coach/profile/route.ts:61-76`) does the same.

Concrete failure: a member is editing rides/week on *Mine sider* and hits save. In that
window a DM arrives, `markCoachAthleteMessage` fires, reads the pre-save profile and writes it
back whole — the save is gone, with no error shown. The reverse order silently drops the
`lastAthleteMessageAt` stamp, which then breaks follow-up scheduling.

Fix: `runTransaction`, or split the timestamps out of the encrypted blob so they can be a
plain `{merge:true}` field update. The timestamps are already stored outside the ciphertext
(`tokenCrypto.ts:253-273`), so the second option is close to free.

### P1 — Conversation trimming can produce a request OpenAI rejects

`aiChatHandler.js:2013-2018`, `:2076-2081`, `:2151-2156`, `:2244-2249` all do:

```js
conversation = [conversation[0], ...conversation.slice(-(MAX_CONVERSATION_LENGTH))]
```

The slice is positional. If the cut lands such that a `role:"tool"` message is kept but the
`assistant` message carrying its `tool_calls` is dropped, the next request 400s
(*"messages with role 'tool' must be a response to a preceding message with tool_calls"*).
A coach turn with 4 tool iterations pushes many tool messages, so this is reachable — and the
`:2151` trim runs *mid-turn*, so the athlete sees the generic error reply. Trim must move the
cut back to a `user` boundary and never orphan a tool message.

### P1 — "Encrypted" fields can silently hold plaintext

`encryptSecret` returns plaintext unchanged when no key is set (`app/lib/tokenCrypto.ts:92-98`),
and `encryptedTokenFields` still writes it into `accessTokenEnc`/`refreshTokenEnc` **and stamps
`tokenEncVersion: 1`**. With no key, `app/api/strava/callback/route.ts:82-87` puts Strava
tokens in Firestore in cleartext across four fields, two of them named `...Enc`. The only
signal is a `console.warn`.

This contradicts what members are told: *"Strava-tokens (krypteret)"*
(`components/StravaPrivacyContent.tsx:40`), *"Det gemmes krypteret"*
(`CoachMemoryEditor.tsx:435`). Fix: fail closed — refuse to boot or refuse to write when
`canEncryptTokens()` / `canEncryptCoachMemory()` is false. Related: there is no key ID stored,
only `EncVersion: 1`, so **key rotation is impossible** — rotating `COACH_MEMORY_KEY` bricks
every existing doc.

### P2 — OAuth `state` is an unbound bearer token

`app/lib/stravaAuth.ts:27-52`. `state` carries the *victim's* discordId, HMAC-signed, 20-min
TTL, with no cookie/nonce/PKCE binding to the browser. Whoever holds a connect link can
complete the flow with their own Strava account, and `callback/route.ts:88` does a full `.set()`
— so their rides become the victim's coaching data. Needs the DM link to leak first, so real
risk is low, but a nonce cookie is a small fix.

### P2 — One bad doc bricks the admin dashboard

`app/api/admin/coach/route.ts:43-48` calls `unwrapCoachMemoryDoc` in a `forEach` with no
try/catch, and the handler has none either. `unwrapCoachMemoryDoc` throws on a missing key
(`tokenCrypto.ts:54`) or malformed JSON. One undecryptable profile → unhandled 500 for the
whole page. `app/lib/coachChatNotes.ts:20-33` already does this correctly; copy that. The same
route also runs four unbounded collection scans per load, including all of `users`.

### P2 — Membership check is an N+1 on every coach turn

`hasClubMemberRole` → `isPaidClubMember` does a doc get **plus a `payments` collection query**
(`apps/bot/services/firebase.js:367-399`). It runs once in `handleChatMessage` *and again
inside every single tool call* (`aiChatHandler.js:1257`, `:1273`, `:1316`, `:1382`). A turn
with three parallel Strava tools is ~8 Firestore ops of pure auth, on the latency path. Resolve
once per turn and pass it down. `getCoachProfile` is likewise fetched and decrypted 2-3× per
turn.

### P2 — No cap on notes written via the web

The bot prunes to `MAX_NOTES_PER_ATHLETE = 200` (`coachChatNotes.js:4`,
`firebase.js:pruneCoachChatNotes`). `POST /api/coach/notes` has no cap. And `activeGoalNotes`
only counts *future* goals, so expired ones never prune. The privacy page's *"højst 200 noter"*
is only true of bot-written notes. Once past 200, `listCoachChatNotes`' `limit(200)` means
goals start silently disappearing from the prompt.

### P3 — smaller things worth a sweep

- Follow-ups only fire in a **one-minute window** (`coachFollowUp.js:240`: `hour===8 && minute===0`).
  A slow tick or a Render restart at 08:00 skips the whole day. The `bot_state` guard already
  makes it idempotent — just widen to "any tick at or after 08:00, once per day".
- All in-memory state dies on restart: `userConversations`, `conversationTimers`,
  and `pendingGoals` (`coachGoalConfirm.js:6`) — a pending Ja/Nej silently expires on deploy,
  and the button then says "udløbet". Also breaks if Render ever runs >1 instance.
- `getActivityDetails` only verifies ownership when `conn.athleteId` is set
  (`stravaService.js:345`), and `athleteId` is only populated as a side effect of
  `getAthleteStats`. The web callback already stores it — backfill on connect.
- Turning notes off deletes the notes **before** the profile PUT
  (`CoachMemoryEditor.tsx:243-248`); if the PUT fails the notes are gone but the toggle is
  still on.
- Deleting a weekly slot by array index (`profile/route.ts:116-119`) is unsafe because
  `sanitizeWeekly` may drop rows and shift indices. Use the row id.
- Two reset paths disagree on `howItWorksSentAt` (`profile/route.ts:130` keeps it,
  `clearCoachData.ts:37-49` nulls it), so reconnecting re-sends the intro DM but an in-app
  reset doesn't.
- 500 responses return raw `err.message` to clients across all coach routes.
- `profile.goals` is permanently `[]` on both sides — vestigial, delete it.
- `apps/api/requirements.txt` pins **no versions at all**, including `openai`. A Cloud Run
  rebuild can pick up a breaking major.
- Legacy Firestore rules: `raceSignups` is `allow read, write: if true`
  (`firestore.rules:22-27`). Out of coach scope but it's the same database.

---

## Proposal

Five stages, each independently shippable and independently verifiable. Stage 0 should go out
on its own.

### Stage 0 — close the webhook (do this first, alone)

- `app/api/strava/webhook/route.ts`: verify `body.subscription_id` against a new
  `STRAVA_WEBHOOK_SUBSCRIPTION_ID` env var; reject with 200-but-no-op on mismatch (Strava
  retries on non-2xx). Add the shared secret to the path or a header.
- Constant-time compare in the GET handler (reuse `safeEqual` from `stravaAuth.ts:20-25`).
- Log every wipe attempt with `owner_id` and outcome.
- Document `STRAVA_WEBHOOK_VERIFY_TOKEN` + the new var in the root `.env.example`.

*Verify:* `curl -X POST` the forged deauth body against a preview deployment with a real
athlete ID → expect no-op; then replay a genuine Strava payload → expect the wipe.

### Stage 1 — stop losing data

> **Step 0, before any code: export `coach_profiles`, `coach_chat_notes` and
> `strava_connections` from Firestore.** This stage changes encryption behaviour on live member
> data and there is no staging environment — Render, Vercel and Cloud Run all serve real members
> directly. Every other item in this plan is recoverable from git; corrupted or unreadable coach
> memory is not.

- Move `lastAthleteMessageAt` / `lastFollowUpAt` / `howItWorksSentAt` to `{merge: true}`
  field-only updates. They already live outside the ciphertext
  (`tokenCrypto.ts:253-273`), so `markCoachAthleteMessage` and `markCoachFollowUpSent`
  (`apps/bot/services/firebase.js:483-513`) stop rewriting the whole document.
- Wrap `PUT /api/coach/profile` (`route.ts:61-76`) and the notes POST goal-cap check
  (`app/api/coach/notes/route.ts:84-86`) in `runTransaction`.
- Fix the conversation trim: replace the four `slice(-(MAX_CONVERSATION_LENGTH))` sites in
  `aiChatHandler.js` with a helper that walks back to a safe `user` boundary and never keeps a
  `tool` message whose parent `assistant` was dropped.
- Fail closed on missing keys: `canEncryptTokens()` / `canEncryptCoachMemory()` false should
  throw at write time, not warn. Add a boot-time assertion in both runtimes.
- Add a `keyId` alongside `EncVersion` so rotation becomes possible later.
- Wrap `unwrapCoachMemoryDoc` in try/catch in `app/api/admin/coach/route.ts:43-48`, mirroring
  `app/lib/coachChatNotes.ts:20-33`; add `.limit()` to the four scans.
- Cap note count in `POST /api/coach/notes` and prune expired goals on both paths.

*Verify:* a script that PUTs a profile while firing `markCoachAthleteMessage` concurrently, and
asserts neither write is lost; a unit test for the trim helper against a recorded coach
conversation containing tool calls.

### Stage 2 — make quality measurable (the highest-leverage change)

This is what turns prompt tuning from guesswork into engineering.

- Add a test runner. Node 22 has `node:test` built in — no new dependency, `node --test`.
- Extract the pure logic that already exists and test it directly. It is *already* pure and
  exported, which is why this is cheap:
  - `coachChatNotes.js`: `sanitizeEventDate`, `activeGoalNotes`, `retrieveRelevantNotes`,
    `searchNotes`, `formatCoachToday`, `formatNoteAge`, `parseExtractedNotes`,
    `isNearDuplicate`, `shouldSkipExtract`.
  - `coachProfile.js`: `publicFields`, `formatCoachProfileForPrompt`, `sanitizeWeekly`.
  - `tokenCrypto.js`: encrypt → decrypt round-trip, and the plaintext-passthrough path.
  - `coachFollowUp.js`: `isFollowUpDue`.
  - Freeze `formatCoachToday` against fixed dates spanning a DST boundary and a Sunday —
    that's the ISO-week bug class you already guarded against in the prompt.
- Add a **golden-set eval** for the prompt itself: ~20-30 recorded scenarios as JSON fixtures
  (fake profile + notes + Strava tool results + athlete message), run through
  `buildCoachSystemPrompt` and the real model, asserting behaviours you already encoded as
  rules:
  - names a goal as saved *only* after Ja;
  - never claims to have saved a *setting*;
  - refuses to prescribe through an active injury;
  - cites only numbers present in the tool results;
  - answers "what are my settings?" from the block instead of claiming it can't see them;
  - resolves "this week" to the right Monday–Sunday range.
  Run on demand, not per-commit, since it costs tokens.
- Add `.github/workflows/ci.yml`: `npm run lint`, `tsc --noEmit`, `node --test apps/bot`.
- Drop `"ignorePatterns": ["apps/**"]` from `.eslintrc.json` and add a `apps/bot/jsconfig.json`
  with `checkJs` so the bot gets at least loose type checking. Expect a cleanup pass.

*Verify:* CI green on a PR; deliberately break `sanitizeEventDate` and confirm CI catches it.

### Stage 3 — kill the duplication

Order matters: don't move code until Stage 2 tests exist to prove behaviour is unchanged.
**Take the same Firestore export as Stage 1 first** — this stage moves the encryption code
between runtimes, and a decrypt mismatch is not recoverable from git.

- Create `packages/shared/coach/` as plain CommonJS-compatible JS with JSDoc types (not TS —
  Render and Cloud Run build `apps/*` as their own project root, and you've deliberately
  avoided npm workspaces per the README).
- Move, in this order, running the Stage 2 tests against both old copies first to confirm they
  agree: `tokenCrypto` → `coachProfile` sanitisers → `coachChatNotes` → `isPaidClubMember`.
- Have the Next side import via the existing `@/*` path alias, and keep the bot's
  copy-into-`apps/bot` step for `constants.json` extended to the new shared dir — same pattern
  the README already documents.
- Delete `profile.goals` throughout while you're in there.

*Verify:* the Stage 2 unit tests pass against the shared module from both runtimes; decrypt a
document written by the *old* bot code with the *new* shared module.

### Stage 4 — coaching quality and cost

You deprioritised cost, so this is last, but two items pay for themselves:

- Resolve membership and profile **once per turn** and thread them through `executeToolCalls`
  instead of re-querying per tool (`aiChatHandler.js:1257,1273,1316,1382`). Pure latency and
  Firestore-spend win, no behaviour change.
- Add a simple per-user daily token budget checked against the `coach_usage` doc you already
  maintain — you're recording everything and enforcing nothing.
- Widen the follow-up window in `coachFollowUp.js:240` to "first tick at or after 08:00 local,
  once per `lastRunDate`".
- Persist `pendingGoals` to Firestore with a TTL so a deploy doesn't silently expire a pending
  Ja.
- Optional, once evals exist: the note-extraction call (`extractCoachChatNotes`) fires on
  nearly every turn and roughly doubles per-turn cost. With a golden set you can measure
  whether folding it into the main call as a tool loses anything.

---

### Stage 5 — activity streams: the real coaching-quality upgrade

The bot calls five Strava endpoints (`stravaService.js`): `/athlete`, `/athletes/{id}/stats`,
`/athlete/zones`, `/athlete/activities`, `/activities/{id}`. **No streams call exists anywhere
in the repo.** This is an implementation gap, not a Strava limitation.

`GET /activities/{id}/streams` returns per-second `watts`, `heartrate`, `cadence`,
`velocity_smooth`, `altitude`, `distance`, `grade_smooth`, `moving`, `time`. Note Strava has
**no power-curve endpoint** — mean-max power is derived by rolling-max over the watts stream,
in your own code.

**No re-consent needed.** `STRAVA_SCOPES` is already `read,activity:read_all,profile:read_all`
(`stravaAuth.ts:5`); `activity:read_all` is what streams on private activities require. Existing
members do not have to reconnect.

**Hard design constraint: streams never enter the model context.** A 2-hour ride at 1 Hz is
~7,200 points per stream. `compactToolResult` would mangle it and the token budget would go
immediately. Shape must be fetch → compute in code → return a small summary:

- mean-max power at 5s / 15s / 30s / 1m / 5m / 8m / 12m / 20m / 60m
- normalized power; IF/TSS when FTP is known (already available via `/athlete` or ZwiftPower)
- aerobic decoupling (first-half vs second-half power:HR ratio)
- time in zone, computed against the boundaries `/athlete/zones` already returns
- detected work intervals (contiguous blocks above threshold) with duration and average

~150 lines of pure array-in/numbers-out functions — squarely the kind of code Stage 2 covers,
and the kind you do not want untested.

Two gates:

1. **Check `device_watts`** (already kept by `compactActivityDetails`). When false, power is
   Strava's estimate from speed and grade and a power curve off it is fiction. Refuse to
   compute rather than emit a confident-looking curve.
2. **Rate limits.** One request per activity, against a per-app quota shared by all members
   (default tier is roughly ~100 / 15 min and ~1,000 / day — confirm the app's actual quota).
   On-demand only, for the single activity asked about, cached in Firestore by activity id.
   Not across a 14-day window, and never inside the 08:00 follow-up job that already loops up
   to 25 athletes.

Sequence this after Stage 2 (tests) so the metric functions land with coverage, and after
Stage 4 (the per-turn membership/profile resolution) so the extra call isn't stacked on top of
the existing N+1.

### Stage 6 — coaching quality beyond the prompt

Ordered by expected impact. The first three outweigh any prompt edit.

**6.1 Longitudinal load (the periodisation gap).** `getRecentActivities` clamps to 1–28 days
(`stravaService.js:320`); the coach sees nothing earlier, so it cannot reason about trend and
cannot periodise — only report. Add a nightly rollup to the existing scheduler storing
per-athlete weekly aggregates (hours, load proxy, session count, intensity distribution), and
feed 12–26 weeks into the prompt as a compact table. A few hundred tokens buys ramp rate,
monotony and "four weeks without a rest week". Cheaper than widening the activity fetch, and it
is the difference between a log reader and a coach. Pairs naturally with Stage 5 (real TSS once
streams exist).

**6.2 The coach does not know the sport it is coaching.**

"Zwift" appears in the coach prompt twice: in the club's name (`aiChatHandler.js:1606`) and in
the `get_zwiftpower_context` tool description. **Nothing states that these are indoor riders on
a virtual platform.** The *club* bot prompt says it outright — "a cycling club focused on
virtual racing in Zwift" (`:1537`) — so the stats bot knows and the coach does not.

This changes the advice, not just the flavour:

- **No coasting indoors.** Continuous pedalling, no freewheeling descents: two hours on Zwift
  is materially more stress than two hours outdoors, and `moving_time ≈ elapsed_time` reads as
  an implausibly consistent ride. A coach unaware of this systematically underestimates load.
- **Zwift races are decided in the first two minutes** — an all-out effort well above threshold
  from the gun. Generic endurance advice prescribes a steady warm-up and misses the event.
- **w/kg racing with hard category boundaries** (ZP A/B/C/D, vELO — already fetched by
  `getZwiftPowerContext`). This makes weight advice competitively loaded; note
  `propose_coach_goal`'s own example goal is *"tabe 3 kg"*. Against a single "no extreme
  restriction" bullet, this is where the missing context has a safety edge, not just a quality
  one.
- **ERG vs free ride** changes what a session is — relevant as soon as 6.5 generates `.zwo`.
- **Danish winters** move everyone indoors Oct–Mar; a January indoor block is not detraining.

**The signal already arrives.** `compactActivity` (`stravaService.js:195-217`) returns
`sport_type` and `trainer: !!a.trainer`; Zwift writes `VirtualRide`. The model receives the
indoor/outdoor flag on every activity and has never been told what it means — a two-line fix on
data already paid for.

Full version is a `## Sport` section: indoor virtual riders; `VirtualRide`/`trainer:true` means
Zwift; treat duration as continuous load; racing is w/kg by category with an explosive start;
club series are ZRL, TTT, DRS, Club Ladder, DZR After Party; members speak in routes (Alpe du
Zwift, Epic KOM), already catalogued under `public/`.

**Plus the race calendar you already hold.** `getDZRTeamsAndSeries` returns series, division
and `rideTime` and the club bot uses it, but it is absent from `coachToolDefinitions` — so the
coach cannot say "you race ZRL Tuesday 19:30, so Monday is easy". Expose the role-panel data
and the athlete's team roles. Likewise phenotype is fetched and never acted on: one paragraph
mapping phenotype to race-week needs. Together this is what makes it DZR's coach rather than a
generic one.

**6.3 Session summaries, and move note extraction to session close.**

*Do not persist raw turns.* Storing a transcript would contradict the promise in
`coachHowItWorks.js` — *"Chatten er privat, og samtalen gemmes ikke."* Continuity should come
from summaries, not messages.

Today, extraction is **per message, not per session**. Two paths write notes:
the `save_chat_notes` tool (model-invoked mid-turn, present only when `notesOptIn` —
filtered at `aiChatHandler.js:1975`), and an automatic extractor at `:2257-2264` that fires
after *every* exchange as a separate fire-and-forget OpenAI call (`extractCoachChatNotes`,
400 tokens, low effort). It is skipped when the model already saved that turn, and
`shouldSkipExtract` drops sub-10-character or bare "ja/nej/ok/tak" messages
(`coachChatNotes.js:336-344`). Otherwise a five-message conversation costs five extraction
calls.

That granularity hurts quality more than cost: each call sees one exchange with no arc, so it
emits fragmentary overlapping notes — which is exactly why `isNearDuplicate` and the
"Deduplicate against recent notes" prompt rule had to exist. A session-level extract sees the
whole conversation and writes one good note where per-message writes four mediocre ones.

**Change:** move extraction to the existing session boundary — `resetConversationTimeout`
already clears the conversation after 30 minutes idle (`:62`, `:1487-1501`). On close, make
*one* call emitting both the episode notes **and** a 1–3 sentence conversation summary. Store
summaries as their own note kind, keep the last ~10, and inject them into the prompt as a short
"tidligere samtaler" block.

This gives cross-day continuity with no transcript, makes the 30-minute timeout a non-issue
(so it can stay as-is), and *reduces* cost from N calls per conversation to one.

Wrinkle: the timer is an in-memory `setTimeout`, so a Render restart means it never fires and
that session's summary is lost. Flush on idle timer **or** N turns, whichever comes first —
losing an occasional summary is acceptable, losing every one across a deploy is not. Update the
"samtalen gemmes ikke" copy to state what *is* kept.

**6.4 Close the advice loop.** Advice is given and never checked. `plan` is already a note kind:
persist concrete recommendations as dated `plan` notes, then have `coachFollowUp.js` compare
them against what was actually ridden ("Tuesday was meant to be easy — it was 250 W for an
hour; how did it feel?"). Following up on its own advice is most of what distinguishes a coach
from an advice vending machine.

**6.5 Prescribe workouts — delivery matters more than generation.**

Sending is easy and already proven here: `AttachmentBuilder` → `{ files: [...] }` is used at
`commandHandlers.js:237-239` (rider-stat PNGs) and `quizService.js:263-277`. DMs take
attachments identically — no permission (a guild construct) and no intent involved — and the
coach already holds an open DM channel (`coachDm.js:67-68`, `coachFollowUp.js:186-188`).
`MessageFlags.SuppressEmbeds`, used throughout to kill link previews, does not suppress
attachments, so an image still renders inline.

Two helpers are string-only and need a couple of lines each: `sendNoEmbeds` (`coachDm.js:22`,
used by the intro DM and follow-up) and `safeReplyChunks` (`aiChatHandler.js:745`, the coach's
main reply path via `replyFn` at `:1979`). `safeReply` (`:720`) already passes an object
through, so `safeReply(message, { content, files, flags })` works today unchanged.

`public/in-the-zone-2/*.zwo` gives two working file structures to copy.
Useful property: `.zwo` power targets are **FTP-relative** (`Power="1.05"` = 105% FTP, seconds
for duration), so a generated file is correct even when the FTP estimate is not — Zwift scales
against the rider's own setting.

**Decision: send the `.zwo` as a DM attachment.** Build it in memory and attach it to the coach
DM alongside the reply — no hosting, no third party, works with what is already deployed.

Because the file is the deliverable, the DM must carry install instructions or most members
will download it and stall. Zwift reads custom workouts from
`Documents/Zwift/Workouts/<zwift-id>/` on Windows and macOS — the folder name is the numeric
Zwift ID, and Zwift needs a restart to pick up a new file. `getUserZwiftId` is already
available, so the DM can name that member's exact folder rather than a generic path. State
plainly that installing needs a PC or Mac: iPad, iPhone and Apple TV have no user-accessible
workout folder, and riders on those devices should be told to install from a computer rather
than left assuming it is broken.

Also render a profile PNG next to the file — a few lines with `chartjs-node-canvas`, and it
lets the athlete read the session at a glance in the DM without opening anything.

Optional later, not required for this: a hosted copy in the members zone (root `package.json`
already has `@aws-sdk/client-s3`) would make workouts re-downloadable and give a **history of
prescriptions**, which is what 6.4's follow-up loop needs to compare intent against what was
actually ridden. A sync partner such as intervals.icu is the only route that reaches Apple
TV/iPad directly, at the cost of a one-time per-member connect.

**6.6 Get a real quality signal.** Add 👍/👎 reactions on coach DMs, logged alongside the
per-turn `coach_usage` write. Combined with the Stage 2 golden set this gives automated
regression detection *and* member sentiment; today there is neither, so every prompt change is
a guess. Once measurable, test raising `reasoning_effort` from `"low"` on the final synthesis
turn only — low is right for tool routing, probably wrong where the coaching judgement happens.

**Caution on the note extractor.** `parseExtractedNotes` is a second model deciding what to
remember, unreviewed, and mis-extracted "facts" then steer future coaching silently — the
athlete only discovers them on Mine sider. Surface recent notes occasionally (in the follow-up
DM, or a light "I noted you were ill Tuesday — correct?") so bad data is caught before it
compounds.

## The prompt itself — and how the bot will feel

Separate from the code. `buildCoachSystemPrompt` (`aiChatHandler.js:1606-1663`).

### Diagnosis

**The budget is misallocated.** Of eight sections, five are about memory bookkeeping (settings
vs. notes vs. goals, what goes where, where each is edited, what not to claim about each). One
section — eight bullets — is about coaching. The prompt is a policy document about its own
storage model that also mentions training. The *club* bot prompt (`:1537`) carries more voice
guidance than the coach does, which is inverted: the coach is the one people have a
relationship with.

**~18 negations, competing.** "Do not guess the date", "Never invent", "Do not say you cannot
see", "Never say you saved", "Do not refuse to help", "Never put a goal in save_chat_notes"…
Each is scar tissue from an observed failure — honest engineering — but nothing was ever
removed, and several are now enforced in code regardless: `:1975` filters the note tools out
entirely when `notesOptIn` is false, so the model cannot invent a note call.

**Expected feel:** competent, cautious, slightly bureaucratic. Strong on dates and volume,
good at citing real sessions; prone to meta-commentary about goals and settings when the
athlete just asked how their week went. And **reactive rather than curious** — nothing tells
it to ask anything. `coachFollowUp.js:136` explicitly says "one question"; the chat prompt
does not, so the scheduled 08:00 DM will feel warmer than a live conversation.

### Four concrete fixes

1. **Danish by default, even to English speakers.** `defaultProfile()` (`coachProfile.js:246`)
   seeds `language: "da"`, written by `ensureDefaultCoachProfile` during `/coach` before the
   first message. `formatStyle` therefore always emits "always reply in Danish", and the
   prompt's "otherwise match the chat" branch never runs until the athlete finds Mine sider and
   selects "default". Seed `language: null`; the UI already supports it
   (`CoachMemoryEditor.tsx:620`).
2. **Say what it cannot see** — until Stage 5 below lands. `compactActivity` returns averages
   (avg/weighted/max watts, avg HR) plus laps when present. Asked "was that interval session
   good?", it has an average and no instruction to admit it. Interim line: *"You see summary
   metrics and laps only, not power curves or intervals. Say so rather than inferring interval
   quality from an average."* This is the fastest credibility loss with strong riders — and the
   real fix is to close the gap, not document it.
3. **Give it a reply contract.** `length` defaults to `null` so `formatStyle` emits nothing;
   the only bound is "Keep replies concise (Discord)" against `COACH_MAX_TOKENS = 16000`.
   `safeReplyChunks` is the symptom. Specify: direct answer first, ≤3 bullets of evidence with
   real dates/numbers, one recommendation, ≤1 question. Probably the highest-yield single edit.
4. **Pre-load `## Current context`.** It is currently just the username. Weight, FTP and ZP
   category are cheap, stable, and today cost a tool round-trip; inline them so the model
   reasons in W/kg from the first token.

### Structural

- Move the bookkeeping rules into the tool `description` fields — read at decision time, and
  several are already duplicated there — and spend the reclaimed prompt on coaching craft.
- Promote illness/injury from one bullet to its own section with a decision rule. The notes
  system is *designed* to record "syg"/"træt" and reason over them; one line of guardrail is
  thin for that.
- Once the Stage 2 golden set exists, remove negations one at a time and measure. Treat the
  prompt as versioned code with a regression suite, not as an append-only log of past bugs.

## Notes on what I'd leave alone

- The three-way settings/notes/goals split. It's the best idea in the codebase.
- `gpt-5-mini` with `reasoning_effort: "low"`. Right call for Discord latency.
- The separate coach bot identity. Worth the extra process.
- The Danish-first copy and the `noEmbedUrl` treatment. Small, but it's why it feels finished.

---

## Before you start — corrections and assumptions to verify

Added after a critical re-read of this plan. The first two items can waste days if skipped.

### Errors in the proposal above

1. **`isFollowUpDue` is not unit-testable as Stage 2 lists it.** `coachFollowUp.js:13` requires
   `./firebase`, which calls `admin.initializeApp()` at module load (`firebase.js:31`), so any
   test importing it crashes without credentials — the same trap for anything transitively
   importing `firebase.js`. Only `coachChatNotes.js`, `coachProfile.js` and `tokenCrypto.js` are
   importable as-is. Extract the pure follow-up logic first.
2. **The Stage 4 daily token budget cannot read `coach_usage`.** That doc is cumulative —
   `recordCoachUsage` increments `totalTokens` forever with only `firstUsedAt` / `lastUsedAt`,
   no daily bucket. A daily cap needs a new per-day doc or a date-range query over
   `coach_usage_events`.
3. **Dropping `ignorePatterns: ["apps/**"]` applies the wrong linter.**
   `next/core-web-vitals` is a React config; against a CommonJS Node bot it yields noise, not
   signal. Give `apps/bot` its own config with a node/commonjs env.

### Verify before starting, by blast radius

- **Which repo actually deploys.** The README says Cloud Run "currently still tracks
  `T00few2/zwiftpower`" and Render "currently tracks `T00few2/bot`", and this repo contains **no
  deploy config at all** — no `render.yaml`, `vercel.json`, `Dockerfile` or `cloudbuild`. If the
  services still build from the old repos, merged changes silently do not ship, or are reverted
  by the next old-repo deploy. Check this first; it is cheap and invalidates everything else.
- **Stage 3 may be structurally impossible as written.** If Render's root directory is
  `apps/bot`, `require("../../packages/shared/...")` will not resolve — those files are outside
  the build context. That is exactly why `constants.json` is *copied* into `apps/bot/` and
  `apps/api/` today. Stage 3 must therefore keep a copy-sync script, publish a private package,
  or change the deploy root. Confirm the root-directory setting before writing any of it.
- **Fail-closed encryption could take production down.** Confirm `STRAVA_CONNECT_SECRET` (or the
  dedicated keys) is set on **both** Render and Vercel first. It also does not repair existing
  damage: `unwrapCoachMemoryDoc` reads plaintext transparently and never rewrites it encrypted,
  so any keyless-written doc stays plaintext forever. `needsTokenMigration` covers Strava
  tokens; there is no coach-memory equivalent. Plan a one-off re-encrypt pass.
- **Strava streams are not uniformly sampled** (Stage 5). Smart recording produces irregular
  intervals — that is what the `time` stream is for. Naive array windowing assumes 1 Hz and
  produces *silently wrong* mean-max power; `moving` must also be respected for paused
  segments. Confidently-wrong power numbers are the worst failure mode available to a coach.
- **6a's backfill, not its nightly job, is the risk.** Steady-state rollups are cheap; the first
  run needs ~6 months of paginated history per athlete against a per-app rate limit shared
  across the club. Throttled one-off backfill, not a synchronous job.
- **Verify the Zwift workouts folder path** (`Documents/Zwift/Workouts/<zwift-id>/`) on a real
  install before DMing it to the club — wrong naming is wrong for every member at once.
- **Webhook re-registration** (Stage 0). Adding a secret path segment requires deleting and
  recreating the Strava subscription via their API. Miss it and deauth events stop arriving
  silently, so revoked users keep their data — worse than today. Also check the subscription
  exists at all: if `STRAVA_WEBHOOK_VERIFY_TOKEN` was never set on Vercel, validation failed and
  there may be none, in which case deleting the POST handler outright is the safer fix.
- **The trim bug is derived, not observed.** Grep Render logs for OpenAI 400s mentioning
  `tool_calls` before spending time on it. No hits in months → lower its priority.

### Missing from the original plan

**Take a backup.** Stages 1 and 3 touch encryption and write paths on live member data, and
there is no staging environment — Render, Vercel and Cloud Run all serve real members directly.
Export `coach_profiles`, `coach_chat_notes` and `strava_connections` from Firestore before
either stage. This is the difference between a bug and an unrecoverable incident.

### On the effort estimates

They are relative sizing, not commitments, and assume familiarity with the code. Treat the
ordering as the durable part of this plan; treat the day counts as a sketch.
