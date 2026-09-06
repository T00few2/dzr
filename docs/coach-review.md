# DZR Coach — review and execution plan

_Reviewed against `06fe73d`; prerequisites run and decisions locked 2026-09-06._

---

## Status: implemented

Every stage below has been implemented on `claude/dzr-coach-review-h5ke6j`. The document is kept
as the record of why each change was made — the reasoning is the part worth preserving.

| Stage | Status | Notes |
|---|---|---|
| Prereqs | Done | Backup restore-tested; no Strava subscription; no split key |
| 0 — webhook | Done | Case A: POST handler and its dead lookup deleted, GET kept |
| 1 — data loss | Done | Transactions, merge-only stamps, trim fix, fail-closed crypto, canary |
| 2 — measurable | Done | 87 unit tests, CI (typecheck, both lints, sync, prompt structure), 10-scenario golden set |
| 3 — de-duplication | Done | `tokenCrypto`, `coachProfile`, `coachChatNotes`, `isPaidClubMember` all shared; `keyId` added |
| 4 — latency & cost | Done | Auth N+1 removed, follow-up window widened, daily budget, pending goals persisted |
| 5 — streams | Done | Mean-max power, NP, IF/TSS, decoupling, intervals; irregular sampling handled |
| 6a — load trend | Done | Weekly rollups, throttled nightly backfill |
| 6b — the sport | Done | `## Sport` section, `get_club_races` |
| 6c — summaries | Done | Extraction moved to session close, summaries stored, privacy copy updated |
| 6d — advice loop | Done | Recommendations saved as `plan` notes, check-in follows up on them |
| 6e — workouts | Done | `.zwo` generated and attached with per-member install steps |
| 6f — quality signal | Done | 👍/👎 on coach DMs, surfaced on the admin dashboard |
| 7 — prompt | Partly | Reply contract, `language: null`, pre-loaded context, illness section. **Negation pruning deliberately left** — it needs measurement against the golden set, one at a time |

**Deploy notes.** Nothing here requires a member to reconnect Strava. Two optional env vars are
new: `COACH_DAILY_TOKEN_BUDGET` (default 300000), and `STRAVA_WEBHOOK_VERIFY_TOKEN` has moved to
the root `.env.example`. The bot now refuses to start if `COACH_MEMORY_KEY` does not match the key
existing coach memory was encrypted with — that is intended, and P3 confirmed the keys agree.

**Still open.** Stage 7's negation pruning, and the findings listed near the end of this document
as deferred by decision (OAuth `state` binding, `howItWorksSentAt` reset disagreement, raw error
messages to clients, unpinned Python dependencies, `raceSignups` rules).

Rewritten to be executable. Corrections from the `9bccb30` verification are applied **in place**;
there is no longer a separate appendix contradicting the body. Findings detail is at the end as
reference while implementing.

Review baseline: `06fe73d`. Verified still current against `9bccb30` (docs + Render config only —
no coach logic changed).

---

## Prerequisites — status after the 2026-09-06 run

| # | Status | Result |
|---|---|---|
| P1 | ✅ Done, restore-tested | 17 profiles, 10 connections, 14 notes (14/14 `noteEnc`, all decrypting). Safety net is `backups/p1b-firestore-2026-09-06T18-06-01-021Z/` — the only remaining folder. **Restore verified, not assumed; do not re-block Stage 1 on it.** |
| P2 | ✅ Done | `200 []` — no live subscription. **Stage 0 is Case A.** `STRAVA_WEBHOOK_VERIFY_TOKEN` unset locally and absent on Vercel, exactly as the GET handler's fail-closed path predicted. |
| P3 | ✅ Done — no split | 17/17 `memoryEnc` decrypt with the explicit `COACH_MEMORY_KEY`; 0/17 with the fallback. 8 profiles carrying bot-written `lastAthleteMessageAt` decrypt with that same key, so **Render and Vercel agree**. |

### P1b — subcollection traversal (resolved)

The first pass returned 4 `coach_chat_notes` docs holding only `discordId` and `updatedAt` — the
**parent stub**, not the data. Notes live at `coach_chat_notes/{discordId}/notes/{autoId}`, and
the parent is written as exactly `{discordId, updatedAt}` by design (`firebase.js:132`), so a
plain `collection().get()` silently captured nothing. `listCollections()` per parent recovered
14 notes, all encrypted and all decrypting.

**Keep this as a standing rule:** any future backup, migration or admin export of coach data must
recurse into subcollections, or it will look successful while containing none of the notes.

### Housekeeping from the backup run

- ✅ **`/backups/` is gitignored** (`7da61a7`), and the `.vercel` duplicates were cleaned up in the
  follow-up `6337433`. `.env*.local` remains covered by the earlier block — no regression.
- ✅ **Superseded parent-only export deleted.** Only
  `backups/p1b-firestore-2026-09-06T18-06-01-021Z/` remains.
- ✅ **Restore tested.** On-disk dump re-counted (17/17 `memoryEnc`, 14/14 `noteEnc`, 10/10 token
  enc); one bot-stamped profile written to `_p1b_restore_test`, read back, `memoryEnc` decrypted
  with `COACH_MEMORY_KEY`, yielding a normal coach object; scratch doc deleted. **The safety net
  is verified, not assumed.**
- ✅ **`strava_connections/271709901724581888` deleted.** That member was already treated as
  disconnected; ciphertext remains in the dump if ever needed.

### Also worth acting on

- **No plaintext anywhere.** All 17 profiles carry `memoryEnc`; all 10 connections carry
  `accessTokenEnc`/`refreshTokenEnc`. The plaintext-fallback finding is real in the *code* but
  **not realised in production** — so the "re-encrypt keyless docs" task in Stage 1 is unnecessary.
- **The one undecryptable connection has been deleted** (`strava_connections/271709901724581888`);
  its ciphertext survives in the P1b dump. It had already been failing safe — `getConnection`
  caught the decrypt error and returned null (`stravaService.js:56-59`), so `isStravaConnected`
  was false and that member saw the reconnect prompt. **Keep it as evidence, not as a live row:**
  with no key identifier stored, a rotated-key document was indistinguishable from a corrupt one,
  which is exactly why `keyId` is worth doing.
- `STRAVA_TOKEN_KEY` is unset on both, so tokens use the
  `dzr-strava-tokens:$STRAVA_CONNECT_SECRET` fallback consistently. Fine, but it means rotating
  `STRAVA_CONNECT_SECRET` silently breaks every stored token — see `keyId` in **Stage 3**.

---

## Stage 0 — close the webhook (ship alone, first)

**Problem:** `app/api/strava/webhook/route.ts:25-45` POST authenticates nothing and calls
`wipeCoachStravaForDiscordId`, deleting a member's coach profile, every chat note and their
Strava connection, keyed only on `owner_id` — a public Strava athlete ID.

**P2 settled this: Case A.** `push_subscriptions` returned `[]`, and
`STRAVA_WEBHOOK_VERIFY_TOKEN` is unset on Vercel — so the GET handler's `!expected` guard (`:18`)
would have 403'd every registration attempt. Strava has never POSTed to this endpoint. Every
request it has ever received was unsolicited.

### Locked decision — Case A, no auto-wipe

**Rationale (owner's call, and it corrects an error in the earlier draft):** hooking the wipe to
`needs_reconnect` conflated two different things. `needs_reconnect` means *the token is dead, ask
them to reauthorise* — often transient — not *consent was withdrawn*. Wiping coach memory on a
refresh failure would destroy data on a recoverable condition. **Explicit disconnect on the site
remains the only wipe path.**

Scope:

1. **Delete the POST handler** (`app/api/strava/webhook/route.ts:25-45`).
2. **Keep the GET handler** — it already 403s without a verify token, and it leaves the door open
   to registering a subscription later.
3. **Delete `findDiscordIdByStravaAthleteId`** (`wipeCoachStrava.ts:50-66`). Verified: the POST
   handler is its only caller, so it becomes dead code. Its `.limit(2)`-then-`docs[0]` ambiguity
   bug is deleted along with it — which is why the separate fix is dropped.
4. **Keep `wipeCoachStravaForDiscordId`** — still used by `disconnect/route.ts:17`.
5. **Move `STRAVA_WEBHOOK_VERIFY_TOKEN`** from `apps/bot/.env.example:23` to the root
   `.env.example` and the README's Vercel list. It is read only by the GET handler
   (`webhook/route.ts:8`), which is being kept, so it stays live — and the misfiling is why it was
   never set.

**Dropped** (they only matter if something is still allowed to wipe automatically): soft-delete
with purge, wipe logging, athlete-id ambiguity fix.

**Verify:** POST the forged deauth body at a preview deploy → 405/404. `grep -r` confirms no
remaining reference to `findDiscordIdByStravaAthleteId`. Explicit disconnect on the site still
wipes correctly.

---

## Stage 1 — stop losing data

**Safety net in place and verified:** the P1b export (17 profiles, 10 connections, 14 notes, all
decrypting), with a successful restore already proven. Nothing here is blocked on further backup
work.

| Fix | Where |
|---|---|
| Move `lastAthleteMessageAt` / `lastFollowUpAt` / `howItWorksSentAt` to `{merge:true}` field-only updates, so `markCoachAthleteMessage` / `markCoachFollowUpSent` stop rewriting the whole doc | `apps/bot/services/firebase.js:483-513`. Already outside the ciphertext (`tokenCrypto.ts:253-273`), so this is nearly free |
| Wrap profile PUT and the notes goal-cap check in `runTransaction` | `app/api/coach/profile/route.ts:61-76`, `app/api/coach/notes/route.ts:84-86` |
| Replace the four positional `slice(-(MAX_CONVERSATION_LENGTH))` trims with a helper that cuts back to a `user` boundary and never orphans a `tool` message from its `tool_calls` parent | `aiChatHandler.js:2013, 2076, 2151, 2244` |
| Fail closed when no encryption key: throw at write time, plus a boot assertion | `tokenCrypto` both copies. P3 cleared this as safe to ship. **Scope it honestly: this proves "we will never write plaintext." It does not detect drift** — Vercel and Render can both have a key set and have *different* keys, which is the actual P3 failure mode, and `if (!process.env.COACH_MEMORY_KEY) throw` would sail straight past it |
| Drift detection, **bot side** — canary decrypt at startup | In `bot.js` only. Render is one long-lived process, so decrypt a **dedicated `_coach_key_canary` doc** — a tiny known ciphertext written once at deploy/setup — and crash on failure. **Never a real member's profile**: deleting that athlete would take the bot down. **Never in `tokenCrypto` module scope** — on Vercel that read would fire on every cold start of every coach route, and one Firestore blip would 500 the members zone |
| Drift detection, **Next side** — surface decrypt failures on the admin dashboard | The bot's canary proves *the bot's* key works; it cannot see Vercel using a different one. `admin/coach/route.ts` already decrypts all 17 profiles on load, so once the Stage 1 try/catch degrades instead of throwing, count the failures and show "N profiles failed to decrypt". Free — no new reads, no per-request cost — and a human checking the dashboard after a deploy is the drift signal |
| ~~`keyId` here~~ → **defer to Stage 3** | It is a persist-format change that would be written twice (JS + TS) and then thrown away when Stage 3 consolidates. Do it once, in the shared module. **Whenever it lands: additive and optional on read — never fail a read on a missing `keyId`**, or all 17 profiles + 14 notes + 9 connections break at once |
| ~~One-off re-encrypt pass for keyless docs~~ **Not needed** | P1 confirmed everything is already encrypted. The plaintext-fallback path is a real code defect, never exercised in production |
| **`defaultProfile()` seeds `language: "da"`** — change to `null` | `coachProfile.js:246`. `ensureDefaultCoachProfile` writes it during `/coach` before the first message, so the prompt's "otherwise match the chat" branch never runs and English speakers get Danish. One line, no evals needed — this is a data bug, not a prompt rewrite. UI already supports null (`CoachMemoryEditor.tsx:620`) |
| **Reply contract** in the coach system prompt | `buildCoachSystemPrompt` (`aiChatHandler.js:1652-1659`). `style.length` defaults to null so `formatStyle` emits nothing, leaving only "keep replies concise" against `COACH_MAX_TOKENS = 16000` — `safeReplyChunks` exists because replies overrun. Specify: direct answer first, ≤3 bullets of evidence with real dates/numbers, one recommendation, ≤1 question. Cheap and reversible; re-measure once the Stage 2 golden set exists, since its effect is the hardest here to judge by eye |
| Turning notes off deletes them **before** the profile PUT | `CoachMemoryEditor.tsx:243-248`. A failed PUT loses the notes with the toggle still on. Reorder: save first, delete after success |
| Weekly-slot delete by array index | `profile/route.ts:116-119`. `sanitizeWeekly` may drop rows and shift indices, so the wrong row is deleted. Use the row id |
| try/catch around `unwrapCoachMemoryDoc`, mirroring `app/lib/coachChatNotes.ts:20-33`; add `.limit()` to the four unbounded scans | `app/api/admin/coach/route.ts:43-48` |
| Cap note count on the web path; prune expired goals | `app/api/coach/notes/route.ts` |

**Priority note:** the trim bug is *derived from reading the code, not observed*. Grep Render logs
for OpenAI 400s mentioning `tool_calls` before spending time on it; no hits in months ⇒ demote.

**Verify:** concurrent PUT + `markCoachAthleteMessage`, assert neither write is lost. Unit test the
trim helper against a recorded conversation containing tool calls.

---

## Stage 2 — make quality measurable

**Testable as-is** (no side effects on import): `coachChatNotes.js`, `coachProfile.js`,
`tokenCrypto.js`. That covers `sanitizeEventDate`, `activeGoalNotes`, `retrieveRelevantNotes`,
`searchNotes`, `formatCoachToday`, `formatNoteAge`, `parseExtractedNotes`, `isNearDuplicate`,
`shouldSkipExtract`, `publicFields`, `formatCoachProfileForPrompt`, `sanitizeWeekly`, and an
encrypt→decrypt round-trip including the plaintext-passthrough path.

**Not testable as-is — correction to the earlier draft:** `isFollowUpDue` cannot be imported.
`coachFollowUp.js:13` requires `./firebase`, which calls `admin.initializeApp()` at module load
(`firebase.js:31`), so the import crashes without credentials. Extract the pure follow-up logic
into its own module first. Same trap for anything transitively importing `firebase.js`.

- Runner: `node --test` (built into Node 22, no new dependency).
- Freeze `formatCoachToday` against fixed dates spanning a DST boundary and a Sunday.
- **Lint correction:** do *not* simply drop `"ignorePatterns": ["apps/**"]` —
  `next/core-web-vitals` is a React config and produces noise against a CommonJS bot. Give
  `apps/bot` its own config with a node/commonjs env.
- CI: `.github/workflows/ci.yml` running lint, `tsc --noEmit`, `node --test`.

**Golden-set eval** (~25 fixtures: profile + notes + tool results + athlete message → real model).
Assertions must be **structural or judge-based, never exact-match**, or it will flap and be
ignored. Run on demand, not in CI — it costs tokens. Assert: goal only called saved after Ja;
never claims to have saved a *setting*; refuses to prescribe through an active injury; cites only
numbers present in tool results; answers "what are my settings?" from the block; resolves "this
week" to the right Monday–Sunday.

**Verify:** break `sanitizeEventDate` deliberately, confirm CI catches it.

---

## Stage 3 — de-duplicate the JS/TS copies

`tokenCrypto`, `coachProfile`, `coachChatNotes` and `isPaidClubMember` exist twice, line-for-line,
in JS and TS. They must stay byte-compatible or coach memory becomes unreadable.

**The original "import from `packages/shared`" design is dead — confirmed, not suspected.**
`render.yaml` (added in `9bccb30`) pins `rootDir: apps/bot`, and the README restates that
`constants.json` is copied into the app trees "because Render and Cloud Run build those folders as
the project root". `require("../../packages/shared/...")` cannot resolve from the bot.

**Use copy-sync instead**, extending the pattern already documented for `constants.json` —
**but to `apps/bot` only, never `apps/api`.** The Flask app has no `tokenCrypto`, `coachProfile`,
`coachChatNotes` or `isPaidClubMember`, Cloud Run cannot run that JS, and a third copy would be a
third place to drift. `constants.json` is copied there because it is language-neutral data; this
is not.

- Source of truth in `packages/shared/coach/` — CommonJS + JSDoc.
- A sync script copies it into `apps/bot/` as part of the release step. Next imports the source
  directly.
- Land `keyId` here (deferred from Stage 1) so the persist-format change is written once —
  additive, optional on read.
- **`render.yaml`'s `buildFilter` only fires on `apps/bot/**`** (ignoring `apps/api/**`, `app/**`,
  `components/**`), so an edit to `packages/shared/**` does not even rebuild the bot. The sync
  output must land inside `apps/bot/` to deploy at all, and **CI must fail when the copies drift
  from the source** — otherwise the failure is silent.
- Next imports the source directly via the `@/*` alias. Note it degrades to `any` under
  `strict: true` unless `checkJs` is enabled; that is a real cost on the side that currently has
  types.
- Delete the vestigial `profile.goals` throughout.

Do this **after** Stage 2. Re-export the Firestore backup (P1) first — this stage moves the
encryption code between runtimes.

**Verify:** Stage 2 tests pass against the shared module from both runtimes; decrypt a document
written by the *old* bot code using the *new* module.

---

## Stage 4 — latency and cost

- Resolve membership + profile **once per turn**, thread through `executeToolCalls`. Currently
  `isPaidClubMember` (a doc get **plus** a `payments` query) runs in `handleChatMessage` *and* in
  every tool call (`aiChatHandler.js:1257, 1273, 1316, 1382`) — ~8 Firestore ops of pure auth per
  turn, on the latency path.
- **Daily token budget — correction:** it cannot read `coach_usage`. That doc is cumulative
  (`recordCoachUsage` increments forever; only `firstUsedAt`/`lastUsedAt`). Needs a new per-day
  doc or a date-range query over `coach_usage_events`.
- Widen the follow-up window: `coachFollowUp.js:240` fires only when `hour===8 && minute===0`, so
  one missed tick skips the day. Change to first tick at or after 08:00, guarded by `lastRunDate`.
- Persist `pendingGoals` (`coachGoalConfirm.js:6`) with a TTL so a deploy doesn't silently expire
  a pending Ja.

---

## Stage 5 — activity streams

No streams call exists anywhere in the repo; the bot uses five endpoints only. This is an
implementation gap, not a Strava limit. `activity:read_all` is already in `STRAVA_SCOPES`
(`stravaAuth.ts:5`), so **no member has to reconnect**.

Fetch `/activities/{id}/streams`, **compute in code, return a small summary** — streams never
enter the model context (a 2h ride is ~7,200 points per stream).

Compute: mean-max power at 5s/15s/30s/1m/5m/8m/12m/20m/60m; normalized power; IF/TSS when FTP
known; aerobic decoupling; time-in-zone against `/athlete/zones`; detected work intervals.

Three traps:

1. **Streams are not uniformly sampled.** Smart recording is irregular — that is what the `time`
   stream is for. Naive array windowing assumes 1 Hz and yields *silently wrong* power curves.
   Resample against `time`, and respect `moving` for paused segments.
2. **Gate on `device_watts`** (already kept by `compactActivityDetails`). False ⇒ power is
   estimated from speed/grade and a curve off it is fiction. Refuse rather than emit it.
3. **Rate limit** is per-app, shared across the whole club. On-demand only, for the one activity
   asked about, cached in Firestore by activity id. Never in the 08:00 follow-up loop.

Sequence after Stage 2 (so the metric functions land with coverage) and Stage 4.

---

## Stage 6 — coaching quality

**6a — longitudinal load.** `getRecentActivities` clamps to 1–28 days (`stravaService.js:320`), so
the coach cannot see trend and cannot periodise. Nightly rollup via the existing scheduler storing
weekly aggregates; feed 12–26 weeks as a compact table. **The risk is the first backfill, not the
nightly job** — ~6 months of paginated history per athlete against a shared rate limit needs a
throttled one-off job.

**6b — it does not know the sport.** "Zwift" appears in the coach prompt only in the club's name
and one tool description. The *club* bot prompt says "virtual racing in Zwift" outright (`:1537`);
the coach does not. Consequences: no coasting indoors, so `moving_time ≈ elapsed_time` and load is
systematically underestimated; Zwift races are decided in the first two minutes; w/kg racing with
hard category boundaries makes weight advice competitively loaded (note `propose_coach_goal`'s own
example is *"tabe 3 kg"*, against a single "no extreme restriction" bullet); Danish winters move
everyone indoors Oct–Mar. **The signal already arrives** — `compactActivity` returns `sport_type`
and `trainer`, and Zwift writes `VirtualRide`. Add a `## Sport` section. Also expose the race
calendar: `getDZRTeamsAndSeries` returns `rideTime` and the club bot uses it, but it is absent from
`coachToolDefinitions`.

**6c — session summaries; move extraction to session close.** Do *not* persist raw turns — that
contradicts `coachHowItWorks.js` ("samtalen gemmes ikke"). Today extraction runs **per message**
(`aiChatHandler.js:2257-2264`), a separate call per exchange, so each sees one exchange with no arc
and emits fragmentary overlapping notes — which is why `isNearDuplicate` had to exist. Move it to
the existing 30-minute idle boundary (`:1487-1501`) and emit notes **plus** a 1–3 sentence summary
in one call. Cross-day continuity, no transcript, and fewer calls. Flush on idle timer **or** N
turns — the timer is in-memory and a deploy would otherwise lose every summary. Raise the 400-token
budget for session-level extraction. Update the "gemmes ikke" copy to say what *is* kept.

**6d — close the advice loop.** `plan` is already a note kind: persist recommendations as dated
`plan` notes and have `coachFollowUp.js` compare them to what was ridden.

**6e — workout files.** Generate `.zwo` and attach to the coach DM (decided). Mechanics are proven
(`commandHandlers.js:237-239`, `quizService.js:263-277`); `sendNoEmbeds` (`coachDm.js:22`) and
`safeReplyChunks` (`aiChatHandler.js:745`) are string-only and need a couple of lines each, while
`safeReply` already passes objects through. `.zwo` targets are FTP-relative, so the file is correct
even if the FTP estimate is not. **Ship install instructions with it** — Zwift reads only
`Documents/Zwift/Workouts/<zwift-id>/` on PC/Mac; iPad and Apple TV have no accessible folder, so
say so rather than leaving those riders assuming it is broken. `getUserZwiftId` lets you name the
exact folder. **Verify the folder path on a real install first** — wrong once is wrong for every
member. Render a profile PNG alongside (`chartjs-node-canvas` is already a dependency).

**6f — quality signal.** 👍/👎 on coach DMs, logged beside the per-turn `coach_usage` write. Then
test raising `reasoning_effort` above `"low"` on the final synthesis turn only.

**Caution:** `parseExtractedNotes` is a second model deciding what to remember, unreviewed;
mis-extracted facts steer coaching silently. Surface recent notes occasionally so they can be
corrected.

---

## Stage 7 — the prompt (after Stage 2)

Of eight sections in `buildCoachSystemPrompt` (`:1606-1663`), five are memory bookkeeping and one
is coaching. ~18 accumulated negations, several now enforced in code anyway (`:1975` filters the
note tools when `notesOptIn` is false).

**Moved to Stage 1** (they do not need evals): the `language: null` seed, and the **reply
contract** — direct answer first, ≤3 bullets of evidence with real dates/numbers, one
recommendation, ≤1 question. Both are cheap and reversible. Worth re-measuring the reply contract
once the golden set exists, since its effect is the hardest of the two to judge by eye.

Remaining here, because they want measurement behind them:

1. **Pre-load `## Current context`** — currently just the username. Weight, FTP, ZP category are
   cheap and stable and today cost a tool round-trip.
2. **Interim honesty line** until Stage 5 lands: summary metrics and laps only, not power curves.
3. Move bookkeeping into tool `description` fields; promote illness/injury to its own section with
   a decision rule; prune negations one at a time against the golden set.

---

## Suggested order

`0` → `1` → `2` → `4` → then `5`, `6a`, `6b`, `6c` → `3` and `7` once tests exist → `6d–6f` as
capacity allows.

**Stage 4 now precedes 5 and 6a**, resolving a contradiction in the earlier draft (the Stage 5
body said "after 2 and 4" while the order listed 5 first). After 4 is correct: both 5 and 6a add
Strava calls against a per-app quota shared by the whole club, and Stage 4 cuts the existing
per-turn load first.

**If only three:** `0`, `1` (at minimum the merge/transaction half), `2`.

6a is *not* in that three, correcting the earlier draft. The lost-write race discards member
settings today; adding a rate-limited historical backfill on top of an unfixed write path is the
wrong order regardless of how much 6a improves the coaching. (Precisely: rollups land in a new
collection rather than `coach_profiles`, so 6a does not itself widen the race — but shipping a
load-bearing feature while a known silent data-loss bug is live is still the wrong call.) Demote
6a until the timestamp stamps cannot be clobbered.

Effort estimates deliberately omitted — the ordering is the durable part.

---

## Findings reference

Detail behind the stages above, for use while implementing.

**P0** — `webhook/route.ts:25-45` POST unauthenticated; `wipeCoachStrava.ts:15,35,41` deletes
profile + all notes + connection and DMs the member.

**P1** — Profile writes are read→mutate→full `.set()` on both sides
(`firebase.js:483-513`, `profile/route.ts:61-76`): a DM landing mid-save silently discards the save;
the reverse order drops `lastAthleteMessageAt` and breaks follow-up scheduling. — Conversation trim
is positional and can orphan a `tool` message from its `tool_calls` parent, 400ing mid-turn. —
`encryptSecret` returns plaintext when no key is set (`tokenCrypto.ts:92-98`) yet
`encryptedTokenFields` still writes it to `...Enc` and stamps `tokenEncVersion: 1`; contradicts
`StravaPrivacyContent.tsx:40` and `CoachMemoryEditor.tsx:435`. No key id ⇒ rotation impossible.

**P2** — One undecryptable doc 500s the admin dashboard (`admin/coach/route.ts:43-48`), which also
runs four unbounded scans including all of `users` → *Stage 1*. — Membership N+1 → *Stage 4*. — No
note cap on the web path; `activeGoalNotes` counts only future goals so expired ones never prune,
and past 200 notes `limit(200)` silently drops goals from the prompt → *Stage 1*.

**P3** — In-memory state dies on restart (`userConversations`, `conversationTimers`,
`pendingGoals`) and breaks entirely on >1 instance → *Stage 4 / 6c*. — `getActivityDetails` only
checks ownership when `conn.athleteId` is set (`stravaService.js:345`), populated only as a side
effect of `getAthleteStats`; the web callback already stores it, so backfill on connect →
*Stage 4*. — Notes-off delete ordering and weekly-slot delete by index → **moved into Stage 1**.

### Explicitly deferred — not in any stage, by decision

- **OAuth `state` is an unbound bearer token** (`stravaAuth.ts:27-52`) — no cookie/nonce/PKCE, so
  whoever holds a connect link can bind their own Strava and `callback/route.ts:88` full-`.set()`s
  it. Real, but requires a DM connect link to leak first, and the fix is a nonce cookie plus
  callback changes — not cheap. Revisit if links are ever shared outside DMs.
- **`howItWorksSentAt` reset disagreement** (`profile/route.ts:130` keeps it,
  `clearCoachData.ts:37-49` nulls it) — cosmetic: reconnect re-sends the intro DM, in-app reset
  does not.
- **Raw `err.message` returned to clients** across coach routes — information disclosure, low
  value to an authenticated member.
- **`apps/api/requirements.txt` pins no versions**, `openai` included — a Cloud Run rebuild can
  take a breaking major. Outside the coach stack.
- **`raceSignups` is `allow read, write: if true`** (`firestore.rules:22-27`) — same database,
  outside the coach stack, but worth its own ticket.

---

## Decisions log — do not re-propose

- **Shared code cannot be imported from `packages/shared`.** `rootDir: apps/bot` in `render.yaml`.
  Copy-sync only.
- **Do not persist raw conversation turns.** Summaries only; the privacy copy promises it.
- **`.zwo` ships as a DM attachment**, not a hosted link — decided, despite the PC/Mac-only
  install constraint.
- **Deploy source is settled.** All three runtimes build from `T00few2/dzr` as of `9bccb30`; the
  old remotes are rollback-only.
- **Stage 0 is Case A.** No Strava subscription exists (`[]`, 2026-09-06); delete the POST
  handler. Do not build the secret-URL / `subscription_id` variant.
- **No automatic wipe, ever.** Explicit disconnect on the site is the only path that erases coach
  data. Do **not** revive wiping on `needs_reconnect` — that signal means "token dead, ask them to
  reauthorise," which is often transient, not "consent withdrawn." An earlier draft proposed it;
  it was wrong.
- **Copy-sync targets `apps/bot` only.** Never `apps/api` — the Flask app has none of these
  modules and Cloud Run cannot run the JS. A third copy is a third place to drift.
- **`keyId` must be additive and optional on read.** Failing a read on a missing `keyId` breaks
  every existing document at once.
- **No split encryption key.** Render and Vercel both use the explicit `COACH_MEMORY_KEY`
  (17/17 decrypt; fallback 0/17). Fail-closed is safe to ship.
- **No plaintext in production.** Every profile and connection is encrypted; no migration pass
  needed.
- **A naive `collection().get()` export misses chat notes.** They are a subcollection under
  `coach_chat_notes/{discordId}/notes`. Any backup must recurse.

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

_Earlier long-form review prose (full findings detail and prompt critique) is preserved in git at `91b058c`._
