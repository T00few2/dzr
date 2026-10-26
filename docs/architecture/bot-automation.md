# Bot and automation

[Architecture index](README.md) · Parent: [runtime overview](overview.md#runtime-collaboration-what-actually-calls-what) · Related: [Coach](coach.md), [roles](identity-membership.md), [operations](operations.md)

## Discord event handling: which subsystem receives an event?

Purpose: trace the club bot's dispatch paths rather than treating every service as a separate bot.

![Architecture diagram](generated/bot-automation-1.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
---
config:
  theme: base
  themeVariables:
    edgeLabelBackground: '#ffffff'
  themeCSS: |
    .edgeLabel, .edgeLabel p { font-size: 12px !important; }
    :is(&) { background: #ffffff; }
  flowchart:
    rankSpacing: 60
    padding: 5
---
flowchart LR
    gateway["🎮 Discord gateway"] -->|Deliver events| entry["🤖 Club client"]
    entry -->|Interactions| interactions["🤖 Interactions"]
    entry -->|Member changes| members["🤖 Member events"]
    entry -->|Messages| messages["🤖 Zwift ID and AI"]
    entry -->|Activity| stats["🤖 Activity"]
    entry -->|Reactions| reactions["🤖 Signups / approvals"]
    classDef default fill:#eff6ff,stroke:#1d4ed8,color:#1f2328
    classDef external fill:#fff1f2,stroke:#b91c1c,color:#1f2328
    linkStyle default stroke:#1d4ed8
    class gateway external
    linkStyle 0 stroke:#b91c1c
    linkStyle 0 stroke:#b91c1c
```

</details>

[bot.js](../../apps/bot/bot.js) registers slash commands, attaches gateway handlers and starts the scheduler when ready. [interactionHandler](../../apps/bot/handlers/interactionHandler.js) routes slash commands and component IDs; changes to a command often require both a [declaration](../../apps/bot/commands/slashCommands.js) and its handler. Multiple listeners can observe one event: activity tracking is not an exclusive dispatch branch.

Member events trigger welcome/role messages, verification and New Member role maintenance. Role-panel prerequisites and captain/admin approval live in [roleService](../../apps/bot/services/roleService.js) and [approvalService](../../apps/bot/services/approvalService.js), as expanded in [membership](identity-membership.md#team-roles-how-does-approval-differ-from-verification).

The [club assistant](../../apps/bot/handlers/aiChatHandler.js) responds to mentions, replies to the bot and DMs. It routes coaching intent toward `/coach`; the optional [Coach client](../../apps/bot/services/coachBot.js) handles coaching DMs separately in the same process. Both use the stateless [Responses adapter](../../apps/bot/services/coachLlm.js), with independent model settings. The [helper agent service](../../apps/bot/services/helperAgent.js) supplies read-only research when a specialized tool cannot answer.

Activity is buffered and aggregated by [statsCollector](../../apps/bot/services/statsCollector.js) into `server_activity`; it is not a persistent raw message archive. Shutdown attempts to flush activity and Coach session notes, with a bounded grace period. Sudden termination can still lose in-memory work.

## Scheduled messages: who decides what is due?

Purpose: show the split between Flask scheduling decisions and bot delivery.

![Architecture diagram](generated/bot-automation-2.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
---
config:
  theme: base
  themeVariables:
    primaryColor: '#eff6ff'
    primaryTextColor: '#1f2328'
    primaryBorderColor: '#1d4ed8'
    lineColor: '#1d4ed8'
    actorBkg: '#eff6ff'
    actorBorder: '#1d4ed8'
    actorLineColor: '#1d4ed8'
    signalColor: '#1d4ed8'
  sequence:
    messageFontSize: 12
    actorMargin: 20
    width: 120
    wrap: true
  themeCSS: |
    .actor-line { stroke-width: 0.5px !important; }
    .messageText { font-size: 12px !important; }
    :is(&) { background: #ffffff; }
    rect.actor[name="D"] { stroke: #b91c1c !important; fill: #fff1f2 !important; }
    .actor-line[name="D"] { stroke: #b91c1c !important; }
    [data-from="D"], [data-to="D"] { stroke: #b91c1c !important; }
---
sequenceDiagram
    participant T as 🔁 Bot minute scheduler
    participant A as 🌙 Flask content API
    participant F as 🔥 Firestore
    participant D as 🎮 Discord
    rect rgb(255, 255, 255)
    T->>A: GET schedules/due with bearer key
    A->>F: Read schedules and evaluate due times
    Note over A,T: Due messages
    T->>D: Send content and optional embed/buttons
    T->>A: POST schedules/id/sent after successful send
    A->>F: Update delivery state and next run
    T->>A: Daily probability-check when eligible
    A->>F: Read settings and select eligible content
    Note over A,T: Selected messages, if any
    end
```

</details>

Sources: [scheduler](../../apps/bot/services/scheduler.js), [contentApi](../../apps/bot/services/contentApi.js), [Flask schedule endpoints](../../apps/api/main.py). The network acknowledgment follows the Discord send. A crash or acknowledgment failure between them can permit a repeated post; this is not an exactly-once queue.

## Scheduler: which work runs on a tick?

`startScheduler` checks immediately and then every 60 seconds. Each job supplies its own time window and state guards. Much of the sweep is sequential; it is not a durable job runner and a slow sweep can overlap a later tick. Ladder and Coach follow-ups add their own in-process overlap guards.

| Responsibility | Timing and state | Implementation |
| --- | --- | --- |
| Fixed and probability-based posts | Minute checks; probability selection daily | [scheduler](../../apps/bot/services/scheduler.js), [content API](../../apps/bot/services/contentApi.js) |
| New Member role and KMS status | Hourly member sweep; recurring status refresh | [newMemberService](../../apps/bot/services/newMemberService.js), [scheduler](../../apps/bot/services/scheduler.js) |
| Companion and ZwiftPower rosters | Daily configured minute, default 04:00 Europe/Paris; `bot_state` date markers | [contentApi](../../apps/bot/services/contentApi.js), [Flask roster jobs](../../apps/api/main.py) |
| ZwiftPower pace roles | Daily configured minute, default 07:00 Europe/Paris; **add-only**, old pace roles remain | [config](../../apps/bot/config/config.js), [zpRoleSync](../../apps/bot/services/zpRoleSync.js) |
| Weekly routes and Fifty results | Half-hour checks; route updates through the website, result fixes through Flask | [events guide](events.md#weekly-race-application-who-updates-the-live-event) |
| Route quiz | Configured daily probability check | [quizService](../../apps/bot/services/quizService.js) |
| Coach follow-ups | Opt-in cadence; catch-up window 08:00–11:00 Europe/Copenhagen | [follow-up service](../../apps/bot/services/coachFollowUp.js), [schedule rules](../../apps/bot/services/coachFollowUpSchedule.js) |
| Ladder previews and reminders | Internal ten-minute throttle; persisted posted IDs | [ladderJobs](../../apps/bot/services/ladder/ladderJobs.js) |

Exact-minute jobs can be missed during downtime. Follow-ups have a catch-up window; do not assume every job does. Host scheduling and any external callers of job endpoints are [operational uncertainties](findings.md#what-the-repository-cannot-establish).

## Ladder: how is a match preview built?

Purpose: locate fixture acquisition, rider enrichment, rendering and restart state.

![Architecture diagram](generated/bot-automation-3.svg)

<details>
<summary>Editable Mermaid source</summary>

```mermaid
---
config:
  theme: base
  themeVariables:
    edgeLabelBackground: '#ffffff'
  themeCSS: |
    .edgeLabel, .edgeLabel p { font-size: 12px !important; }
    :is(&) { background: #ffffff; }
  flowchart:
    padding: 5
    nodeSpacing: 35
    rankSpacing: 60
---
flowchart TB
    trigger["🔁 Command handler or<br/>Ladder job"] -->|Load fixtures| fixtures["🤖 ladderClient and parser"]
    fixtures -->|Bearer-key requests| api["🌙 Flask read-only broker"]
    fixtures -->|Build preview| preview["🤖 Analysis, chart and<br/>embed"]
    preview -->|Request geometry| route["🌐 Route-profile API"]
    trigger -->|Read and persist state| state[("🔥 ladder_bot")]
    api -->|Read allowed pages| ladder["🪜 Ladder website"]
    api -->|Read power and scores| racing["⏱️ ZwiftPower and 🧡 Zwift"]
    preview -->|Post image and embed| discord["🎮 Discord"]
    classDef default fill:#eff6ff,stroke:#1d4ed8,color:#1f2328
    classDef external fill:#fff1f2,stroke:#b91c1c,color:#1f2328
    linkStyle default stroke:#1d4ed8
    class ladder,racing,discord external
    linkStyle 5,6,7 stroke:#b91c1c
```

</details>

`/ladder_link` registers teams; preview/analysis commands and [jobs](../../apps/bot/services/ladder/ladderJobs.js) reuse the [Ladder services](../../apps/bot/services/ladder/). The bot has no Ladder or Zwift login password. Flask's [`/ladder_page`](../../apps/api/main.py) accepts only allow-listed paths from [ladder.py](../../apps/api/ladder.py). Rider enrichment uses `/rider_data/{id}` and `/zwift_profile/{id}`; route geometry comes from the website [route-profile route](../../app/api/route-profile/route.ts).

Defaults: preview inside 65 minutes before start, match-day reminder from noon Copenhagen time. [ladderStore](../../apps/bot/services/ladder/ladderStore.js) loads documents into memory and serializes whole-document writes; this is restart persistence, not a multi-instance locking protocol. Post/send and marking state are separate operations. `/ladder_ai` adds OpenAI tactics analysis with per-user daily runs and a short-lived result cache; it shares the OpenAI integration but is not a Coach conversation.
