# Maintaining architecture documentation

[Architecture index](README.md) · Related: [Mermaid skill](../../.agents/skills/mermaid-architecture/SKILL.md), [operations](operations.md)

Architecture review is part of the feature change, not a separate sign-off process. The developer or coding agent changing behavior owns the affected guide update. The reviewer checks whether the described behavior and code agree. A PR can explain that no architecture update is needed when the existing explanation remains accurate.

## Review triggers

Review affected pages when changing runtime responsibilities, interfaces, dependencies, authentication/authorization, onboarding/payment rules, data ownership or flow, scheduled jobs, shared-copy mapping or deployment/build structure. Start with the [code map](code-map.md) and follow its related guides. A small implementation refactor does not need a new diagram if boundaries and behavior remain the same.

Update an existing diagram when the **same developer question** has a different answer: for example, a new callback guard, changed data owner or altered job trigger. Update the explanation and implementation links alongside it. If an arrow disappears from the code, remove it even if older docs still describe it.

Create a new diagram when a **different question or abstraction level** needs explanation, or when an existing view needs more than roughly 5–10 meaningful elements. Split behavior from structure, or consent from processing, instead of shrinking labels. Link the new diagram from its parent and the index; avoid copying an overview into every feature page.

## Diagram conventions

Apply the repository [Mermaid architecture skill](../../.agents/skills/mermaid-architecture/SKILL.md). It is the source of truth for the icon table, provider colors, request direction and diagram-type exceptions. Keep those conventions there instead of maintaining a second legend here.

- Give every diagram a question-based heading, one-sentence purpose and short explanation of the consequences a contributor needs to know.
- Use ordinary GitHub-compatible Mermaid: `flowchart`, `sequenceDiagram`, `stateDiagram-v2` or `erDiagram`. Use short labels, named boundaries and explicit relationship labels where direction is ambiguous.
- Prefer top-to-bottom flowcharts at GitHub's normal content width; use left-to-right when it avoids a wide fan-out. Sequence diagrams should keep participant counts small; split long lifecycles into stages. Standard Mermaid front matter can enable sequence wrapping or adjust spacing, without shrinking fonts.
- Link to implementation files or directories with relative Markdown links. Avoid line numbers that drift. Link parent/related guides next to the explanation; navigation does not depend on renderer-specific Mermaid click handlers.
- Keep the index's terminology consistent. Label uncertain or incomplete behavior explicitly; never add a working edge solely because it seems architecturally desirable.
- Keep diagrams in Markdown fences near their explanations. Generated SVG previews are derived artifacts; edit their Mermaid source and regenerate them instead of editing SVGs manually.

## Previewing diagrams

The optional [local renderer](../../scripts/architecture/render.mjs) reproduces the checked-in previews. Its isolated [package](../../scripts/architecture/package.json) pins Mermaid and Playwright Core; the lockfile keeps dependency versions reproducible. It uses an existing Chromium installation rather than downloading a browser. From the repository root:

```sh
npm ci --prefix scripts/architecture --ignore-scripts
npm run render --prefix scripts/architecture
```

Rendering needs Chromium (`/usr/bin/chromium` by default; set `ARCHITECTURE_CHROMIUM` for another executable). It parses and renders the Mermaid sources, adds an opaque white canvas, and verifies that sequence lifelines render at 0.5 px and message labels at 12 px. Commit changed SVGs with their Mermaid sources. Ordinary prose edits do not require regeneration. This helper is not part of application builds or CI, and there is no root architecture-check command.

GitHub displays the generated SVG preview on an opaque white canvas; expand the adjacent source section to edit or inspect the canonical Mermaid. Sequence sources use a plain-text fence and a code-copy button for Mermaid Live; copy only its contents, without Markdown backticks. Native Mermaid's scoped theme CSS does not reliably style the root SVG background. The generated preview covers the complete viewBox, including the margins outside the outermost boundary.

Successful rendering does not establish that a request is drawn in the correct direction, that every external edge is colored correctly, or that GitHub runs exactly the pinned Mermaid release. Verify those against code. Inspect previews at normal width in light and dark mode: labels should be legible without zoom, arrows should not hide labels, and a reader should follow a feature from [overview](overview.md) to the relevant implementation. Follow changed file links and heading anchors manually; there is no automated documentation-link gate.

## Review checklist

1. Check each changed relationship against the caller, callee, route guard and data writer, not just a filename.
2. Follow the affected journey from overview → feature guide → implementation; verify every link.
3. Compare names and ownership with [data](data.md), [security](security.md) and [operations](operations.md).
4. Render changed diagrams and simplify crowded views. Check the skill's styling rules, especially sequence lane thickness, message-label size and the white canvas.
5. Update [findings](findings.md) if a previously uncertain path is confirmed or resolved. Explain remaining limitations in the PR.

Keep setup commands and secret-name inventories in the root README and env examples. Keep behavior explanations here. This avoids maintaining the same architecture narrative in multiple sources.
