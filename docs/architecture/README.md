# DZR architecture

Start here when contributing to DZR. The website, Discord bot and Flask API share data and selected logic, but run and deploy independently. Follow a feature across those boundaries before changing it.

This documentation describes implementation inspected at upstream `d7546b0` (2026-10-26). Hosting statements distinguish repository configuration from settings that require access to provider dashboards. See [findings and uncertainties](findings.md).

## First reading

1. Read the [system context and runtime overview](overview.md).
2. Use the [code map](code-map.md) to locate the feature you want to change.
3. Follow its guide below, then check the [data ownership](data.md) and [security boundaries](security.md) involved.
4. Before opening a PR, follow the [maintenance and validation guide](maintenance.md).

## Navigation by question

| Developer question | Guide |
| --- | --- |
| What does DZR integrate with? Which process calls which? | [System overview](overview.md) |
| Where should I implement a change? Which files are generated copies? | [Code map and shared modules](code-map.md) |
| How do joining, payments, verification and Discord roles interact? | [Identity and membership](identity-membership.md) |
| How do Discord events, scheduled messages and Ladder work? | [Bot and automation](bot-automation.md) |
| How does Coach connect to training data and answer a DM? | [DZR Coach](coach.md) |
| How are races published, updated and added to a member's calendar? | [Events and calendars](events.md) |
| Who writes Firestore data, and which identifiers join it? | [Data ownership and flows](data.md) |
| Where are authentication, authorization and secrets enforced? | [Security boundaries](security.md) |
| What runs in CI, what deploys, and what needs synchronization? | [Operations and delivery](operations.md) |
| What differs from older docs, or cannot be established from code? | [Findings and uncertainties](findings.md) |
| When should I update or split a diagram? How do I check it? | [Maintenance](maintenance.md) |

## Reading the diagrams

- Boxes name implemented responsibilities, external services or data stores. A boundary names a process or trust zone; it does not imply a separate package or service.
- Flowchart arrows follow the labeled action or data movement. They are not a complete network or API inventory. Sequence diagrams show time from top to bottom; dashed return arrows are responses.
- Cylinders represent persisted stores. Grouped nodes intentionally omit individual fields, endpoints or services that do not help answer the diagram's question.
- “Unresolved” and prose limitations identify incomplete paths. Planned behavior is never drawn as an implemented connection.
- Names remain consistent: **website** means the root Next.js app including its server routes; **Flask API** means `apps/api`; **club bot** and **DZR Coach** are two Discord clients in the same `apps/bot` process.

Diagrams are editable Mermaid fences in Markdown. Their headings provide stable links; code references use repository-relative paths so they follow the branch being reviewed.

[Back to repository README](../../README.md)
