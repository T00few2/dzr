# Maintaining architecture documentation

[Architecture index](README.md) · Related: [repository instructions](../../AGENTS.md), [PR template](../../.github/pull_request_template.md), [CI](../../.github/workflows/ci.yml)

Architecture review is part of the feature change, not a separate sign-off process. The developer or coding agent changing behavior owns the affected guide update. The reviewer checks whether the described behavior and code agree. A PR can explain that no architecture update is needed when the existing explanation remains accurate.

## Review triggers

Review affected pages when changing runtime responsibilities, interfaces, dependencies, authentication/authorization, onboarding/payment rules, data ownership or flow, scheduled jobs, shared-copy mapping or deployment/build structure. Start with the [code map](code-map.md) and follow its related guides. A small implementation refactor does not need a new diagram if boundaries and behavior remain the same.

Update an existing diagram when the **same developer question** has a different answer: for example, a new callback guard, changed data owner or altered job trigger. Update the explanation and implementation links alongside it. If an arrow disappears from the code, remove it even if older docs still describe it.

Create a new diagram when a **different question or abstraction level** needs explanation, or when an existing view needs more than roughly 5–10 meaningful elements. Split behavior from structure, or consent from processing, instead of shrinking labels. Link the new diagram from its parent and the index; avoid copying an overview into every feature page.

## Diagram conventions

Apply the repository [Mermaid architecture skill](../../.agents/skills/mermaid-architecture/SKILL.md). It is the source of truth for the icon table, blue/red palette, request direction and diagram-type exceptions. Keep those conventions there instead of maintaining a second legend here.

- Give every diagram a question-based heading, one-sentence purpose and short explanation of the consequences a contributor needs to know.
- Use ordinary GitHub-compatible Mermaid: `flowchart`, `sequenceDiagram`, `stateDiagram-v2` or `erDiagram`. Use short labels, named boundaries and explicit relationship labels where direction is ambiguous.
- Prefer top-to-bottom flowcharts at GitHub's normal content width; use left-to-right when it avoids a wide fan-out. Sequence diagrams should keep participant counts small; split long lifecycles into stages. Standard Mermaid front matter can enable sequence wrapping or adjust spacing, without shrinking fonts.
- Link to implementation files or directories with relative Markdown links. Avoid line numbers that drift. Link parent/related guides next to the explanation; navigation does not depend on renderer-specific Mermaid click handlers.
- Keep the index's terminology consistent. Label uncertain or incomplete behavior explicitly; never add a working edge solely because it seems architecturally desirable.
- Keep diagrams in Markdown fences near their explanations. Generated SVG/PNG files are review artifacts and should not become another source of truth.

## Local checks

From the repository root:

```sh
npm ci --prefix scripts/architecture --ignore-scripts
npm run check:architecture
npm run check:shared
```

The [isolated tool package](../../scripts/architecture/package.json) pins Mermaid and a DOM shim for parsing. It uses no application dependencies or browser downloads. The [checker](../../scripts/architecture/check.mjs) parses every Mermaid fence in repository Markdown and checks local links/fragments in the architecture guides, Mermaid skill and root workflow instructions. Architecture diagrams also get basic checks for skill icon prefixes, the flowchart palette and request-arrow notation. It reads the icon vocabulary directly from the skill. Invalid/unclosed fences, broken references and these convention violations fail with source locations. [CI](../../.github/workflows/ci.yml) runs the same command in its own job, independently of application checks.

Syntax and notation checks do not establish that a request is drawn in the correct direction, that every external edge is colored correctly, or that GitHub runs exactly the pinned Mermaid release. Verify those against code and render changed diagrams before review. In GitHub's Markdown preview, inspect at normal width: labels should be legible without zoom, arrows should not hide labels, and a reader should follow a feature from [overview](overview.md) to the relevant implementation. For many changes, a local Mermaid browser renderer is useful; do not commit its generated output or add a second diagram source.

## Review checklist

1. Check each changed relationship against the caller, callee, route guard and data writer, not just a filename.
2. Follow the affected journey from overview → feature guide → implementation; verify every link.
3. Compare names and ownership with [data](data.md), [security](security.md) and [operations](operations.md).
4. Render changed diagrams and simplify crowded views. Run the syntax/link checker and relevant existing checks.
5. Update [findings](findings.md) if a previously uncertain path is confirmed or resolved. Explain remaining limitations in the PR.

Keep setup commands and secret-name inventories in the root README and env examples. Keep behavior explanations here. This avoids maintaining the same architecture narrative in multiple sources.
