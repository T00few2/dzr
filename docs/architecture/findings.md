# Findings and uncertainties

[Architecture index](README.md) · Related: [operations](operations.md), [security](security.md)

These findings are grounded in upstream `d7546b0`, inspected on 2026-10-26. They explain where older descriptions or names could lead a new contributor in the wrong direction. They are not proposed architecture or claims about an inspected production environment.

## Documentation and naming drift

| Prior description or misleading name | Current evidence | Contributor implication |
| --- | --- | --- |
| Root README called the website Next.js 14 | [package.json](../../package.json) declares Next.js `^16.4.2`, React 19; [Next config](../../next.config.mjs) has current framework settings | README runtime label is corrected in this change; use package/lockfile versions |
| Root join table said Discord → Zwift ID → Vipps | [Discord callback](../../app/api/onboarding/discord/callback/route.ts) redirects to payment; [Zwift ID handler](../../app/api/onboarding/zwift-id/route.ts) requires payment | README order is corrected; [onboarding](identity-membership.md#joining-lifecycle-what-must-a-new-member-complete) is a public session flow |
| Some legacy Flask docs describe a web admin/OAuth UI | [login_required](../../apps/api/main.py) and legacy auth routes return `410`; [Next admin](../../app/admin/) is active | Start web admin changes under root `app`, not Flask HTML/session handlers |
| Bot config comment calls content API a Cloud Function | [canonical notes](../../apps/api/CANONICAL.md) identify Cloud Run service `zwiftpower` | `CONTENT_API_BASE_URL` means the Flask service origin |
| `fetchZPdata.ts` sounds like a ZwiftPower adapter | [implementation](../../app/utils/fetchZPdata.ts) calls ZwiftRacing | Daily `club_stats` and fresh Flask ZwiftPower reads have different provenance |
| `hasClubMemberRole` sounds like a Discord role test | [site helper](../../app/lib/intervalsAuth.ts), [bot helper](../../apps/bot/services/intervalsService.js) delegate to paid-membership data | Do not replace current-year payment checks with role presence |
| README described manually copying shared constants | [sync script](../../scripts/sync-shared.js) maps constants and selected JS; CI checks byte equality | README now points to sync/check commands; edit canonical shared sources |

## Incomplete and legacy paths

- **Flask → bot posting:** [commentary jobs](../../apps/api/main.py) call `DISCORD_BOT_URL` through [zwiftcommentator](../../apps/api/zwiftcommentator.py), but the Render [HTTP server](../../apps/bot/services/server.js) only implements `GET /`. There is no matching message-ingestion route in this checkout. The README's claim of a bot HTTP API is clarified. Whether deployment supplies an alternate URL or adapter is unknown.
- **Deferred role delivery:** [website role synchronization](../../app/utils/discordRoleSync.ts) writes failures to `role_updates`; repository search found producers and no consumer. This is recorded as unresolved, not drawn as a working bot queue. Direct synchronization, bot event verification and admin reconciliation are distinct existing paths.
- **Route guards differ:** several legacy effectful website routes lack explicit authentication, and the two payment callback families differ. See the concrete [security limitations](security.md#existing-boundaries-and-limitations). Application behavior was not changed as part of documenting them.
- **Legacy rider-score queue:** Flask still exposes initialization/processing routes, but its comments say the queue is no longer needed for the Discord member view. Current snapshots use ZwiftRacing `zrs.score`; do not read remaining queue code as the primary ingestion design.
- **Multiple schedule models:** `series_schedules`, `event_series`, `group_ride_schedules`, personal calendar entries and signup boards are intentionally shown separately because their code and ownership differ. A universal calendar or automatic subscription between them is not implemented.

## What the repository cannot establish

| Unknown | Why it remains open / where to verify |
| --- | --- |
| Actual Vercel/Cloud Run source linkage, branches, scaling and deployment gates | No checked-in project linkage or Cloud Run deployment workflow; inspect provider settings with authorized access |
| Who periodically invokes club-stat ingestion, commentary or other external job endpoints | Handler presence does not identify its caller; inspect external scheduler configuration and logs |
| Active production secrets, Discord permissions and event-editor identity | Env-name examples and guards describe requirements, not deployed values |
| Live Firestore rules, indexes, TTL cleanup and historical data shape | [firebase.json](../../firebase.json), [rules](../../firestore.rules) and [indexes](../../firestore.indexes.json) are declarative inputs; inspect deployed configuration separately |
| Automatic replay of queued role updates | No consumer found; inspect any out-of-repository automation before claiming delivery |
| Runtime success of OAuth, payments, AI calls or live job schedules | No production calls or deployments were performed during documentation validation |

When a future change resolves one of these, update the owning feature guide and remove or rewrite this entry in the same PR. Keep uncertainty next to the affected diagram as well; this page should not be the only warning against relying on an incomplete path.
