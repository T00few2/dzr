---
name: mermaid-architecture
description: Create and maintain DZR architecture diagrams with consistent icons, external-service colors, request direction and GitHub-compatible Mermaid.
---

# DZR Mermaid architecture skill

Use this skill when creating or editing Mermaid architecture diagrams in this repository. Read the affected implementation and the [architecture index](../../../docs/architecture/README.md) first. Keep diagrams in Markdown beside their explanations.

## Model one question

Give each diagram a question-based heading and one-sentence purpose. Aim for 5–10 meaningful entities; split by purpose, abstraction level or execution zone when a diagram becomes crowded. Link the parent overview, related detail and implementation. Use native GitHub Mermaid and normal-sized text. Review at roughly 860 px content width.

Flowcharts normally use front-matter `flowchart` settings `padding: 15`, `nodeSpacing: 35` and `rankSpacing: 40`; adjust spacing or direction when it prevents crowding. Shorten or wrap labels with `<br/>` before adding layout complexity. Keep fonts at their normal size.

## Icon vocabulary

Prefix every visible entity, participant, state and boundary label with an icon from this table. Keep ordinary text after it: icons supplement names and are not the only way to recognize an entity. Mermaid's built-in start/end pseudostates and ER attribute names do not need icons. This vocabulary does not assert that every listed human role exists as an implemented authorization rule.

| Icon | Meaning | Kind |
| --- | --- | --- |
| ⧉ | Render hosting | Machine / infrastructure |
| ▲ | Vercel hosting | Machine / infrastructure |
| 🌙 | Flask API | Machine / application |
| 🎮 | Discord platform or identity | Machine / external service |
| 🧡 | Zwift | Machine / external service |
| 🩵 | Zwift Companion App | Machine / external service |
| ⏱️ | ZwiftPower | Machine / external service |
| 🪜 | Ladder | Machine / external service |
| 🇩🇰 | DCU | Machine / external service |
| 💓 | intervals.icu | Machine / external service |
| 🔵 | Vipps MobilePay | Machine / external service |
| ❋ | OpenAI | Machine / external service |
| ⭐ | Paid club member | Human |
| ✅ | Verified member | Human |
| 👤 | Member or person, without asserting a specific role | Human |
| 🐣 | Visitor or new member | Human |
| 🥸 | Holdkaptajn / team captain | Human |
| 🔰 | Road captain | Human |
| 💻 | Browser or browser-side software | Machine / client |
| 🤖 | DZR club bot or Coach client | Machine / application |
| ⏩ | Google Cloud Run hosting | Machine / infrastructure |
| 🔥 | Firebase, Firestore, Auth, Storage or stored documents | Machine / data service |
| 🔁 | Scheduled job or recurring automation | Machine / application |
| 🌐 | DZR website or the DZR system | Machine / application |
| 🛠️ | Continuous integration | Machine / development |
| 🚀 | Continuous delivery or deployment | Machine / development |
| 🔑 | Role, access check or authorization policy | Machine / policy |
| 📊 | ZwiftRacing | Machine / external service |
| 📋 | Google Sheets | Machine / external service |
| 📦 | Source module, package or checked-in configuration | Machine / code |
| 🐍 | Python language or Python implementation module | Machine / technology |
| ⬡ | Node.js runtime | Machine / technology |
| ⚙️ | Generic machine, subsystem or purpose-based external group | Machine |
| 🛡️ | Administrator | Human |
| 🐙 | GitHub repository | Machine / development |

Use a human icon for people, and the relevant machine icon for systems. In overviews, separate human and machine boundaries explicitly. Use hosting icons on hosting boundaries and application icons on the runtime inside. A single label may name both, such as `▲ Website on Vercel`, when the diagram intentionally collapses them.

## Colors

| Meaning | Outline / line | Light fill |
| --- | --- | --- |
| DZR-owned application, code, data, human or workflow entity | Blue `#1d4ed8` | `#eff6ff` |
| Third-party API, external service or external-purpose group | Red `#b91c1c` | `#fff1f2` |

Color every entity outline and connection line. Color a connection red when either endpoint is an external service. Managed hosting boundaries describe DZR's deployed code; they remain blue. Firebase services configured for DZR's project (Auth, Firestore and Storage) remain blue; a third-party API such as Discord remains red. Use text labels as well as color so the meaning survives monochrome display and theme differences.

For flowcharts, use these native styles, assign `external` to the relevant IDs, and color the corresponding zero-based links red with `linkStyle`. Keep external links together and comment their indices when useful. Recheck indices after changing edges. Style subgraph boundaries explicitly with the same palette.

```text
classDef default fill:#eff6ff,stroke:#1d4ed8,stroke-width:2px,color:#1f2328
classDef external fill:#fff1f2,stroke:#b91c1c,stroke-width:2px,color:#1f2328
linkStyle default stroke:#1d4ed8,stroke-width:2px
class discord external
linkStyle 0 stroke:#b91c1c,stroke-width:2px
```

For sequence, state and ER diagrams, use `theme: base` and blue `primaryBorderColor` / `lineColor` in Mermaid front matter. Sequence diagrams also set blue `actorBorder`, `actorLineColor` and `signalColor`. Keep `actorMargin: 20`, `width: 120` and `wrap: true` unless the rendered view needs another layout.

Keep light label backgrounds with the fixed palette: flowcharts use `theme: base` and `edgeLabelBackground: '#ffffff'`. Sequence diagrams wrap their message area in a native `rect rgb(255, 255, 255)` block so dark text stays readable on a dark GitHub page; this is a visual panel, not a trust boundary or transaction.

Sequence diagrams use native front-matter `themeCSS` to color external actors and their messages: select `rect.actor[name="D"]` for the participant outline and `[data-from="D"], [data-to="D"]` for message lines. The display label must also name the external service. Verify the emitted SVG and screenshot after changing these selectors; renderer differences must not make color the only indicator of an external system.

## Connection direction

Runtime flowcharts and sequences use **initiator → recipient**: an HTTP client points to the API receiving its request, even when reading data. Use one arrowhead, at the receiving end. Never use a bidirectional arrow to mean a request plus its response.

- Label requests with actions: `Read rider statistics`, `Update event course`, `Write membership`, `Import module` or `Post message`.
- Provider callbacks and gateway event deliveries are separate messages initiated by that provider, so they point toward DZR. Do not draw one merely because a connection could theoretically carry it.
- Put returned data, redirects and outcomes in sequence notes or prose. A response is not another request in the opposite direction.
- For static ownership, containment, build contexts or workflow-stage associations, use **arrowless** `---` connections with explicit labels. These are not API calls or data-flow arrows. Use a state diagram for ordered lifecycle transitions.
- State transitions show lifecycle changes, and ER crow's-foot notation shows cardinality. Neither is a request arrow. Explain that perspective in the diagram's purpose.

## External groups

The overview groups external parties by purpose: **External Zwift sources**, **External Zwift integrations** and **External tools**. “Zwift” here names the club's cycling ecosystem, not ownership by Zwift. A service may appear in both the read-source and write-integration lists. List the actual providers and their read/write responsibilities in text below the chart. Keep these lists aligned with actual call sites.

## Validate and maintain

1. Check each request direction against its caller and recipient; check each write against the implementation and access guard.
2. Follow [maintenance guidance](../../../docs/architecture/maintenance.md) to update an existing view or create a focused detail.
3. Run `npm ci --prefix scripts/architecture --ignore-scripts`, then `npm run check:architecture`. Basic prefix checks read the icon vocabulary from this file; request semantics, external classification and layout still require review.
4. Render every changed diagram. Check normal-width text, icons, red external outlines/lines, arrowheads, crossing labels and dark/light theme legibility. Parsing alone cannot verify semantics or layout.
5. Update navigation and code references in the same change. Generated preview images remain review artifacts, not a second source of truth.

## Layer and provider refinements

Abbreviate External as **Ext.** and spell out **Google Cloud Run**. Group multi-layer views into Client, DZR-controlled server deployments (Vercel, Render Cloud and Google Cloud Run), and Ext. integrations. Layer boundaries use light gray fill on white and neutral gray outlines. Hosting names refer to our controlled deployments, not ownership of the provider.

Use one box per technology in stack inventories. Split inventories into focused provider views when necessary; keep enough boundary padding for their contents.

| Entity | Outline and outgoing request line |
| --- | --- |
| People | #6B7280 |
| Google Cloud Run | #4285F4 |
| Render Cloud | #8A05FF |
| Vercel | #111111 |
| GitHub | #0FBF3E |
| Client | #f59e0b |
| Ext. integration | #b91c1c |

These colors supersede the earlier two-color palette. Keep white chart backgrounds in light and dark mode. Opposing requests use two separately labeled directed lines. Show implemented callbacks separately; distinguish server webhooks, gateway deliveries and browser-mediated OAuth redirects.
