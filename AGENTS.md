# Contributor and coding-agent instructions

These instructions apply throughout the repository. Follow any more specific instructions in a subdirectory as well.

- The root Next.js website, `apps/bot` and `apps/api` are separate build/deployment contexts. Do not introduce npm workspaces or cross-context imports into deployed apps.
- Edit canonical sources under `packages/shared` rather than synchronized app copies. Use `npm run sync:shared`, commit affected copies, and run `npm run check:shared`; `scripts/sync-shared.js` defines the mapping.
- Review affected [architecture documentation](docs/architecture/README.md) in the same change whenever modifying system behavior, interfaces, dependencies, data flows/ownership, access rules, background jobs or build/deployment structure. Update diagrams, explanations and implementation links when their answer changes. If no update is needed, explain why in the PR checklist.
- Use the [maintenance guide](docs/architecture/maintenance.md) to decide whether to update or split a diagram. Ground relationships in code; explicitly label unknown or incomplete paths. Do not present intended behavior as implemented.
- When creating or editing Mermaid architecture diagrams, apply the repository [Mermaid architecture skill](.agents/skills/mermaid-architecture/SKILL.md). It defines the icon vocabulary, external-service colors and request-direction convention.
- For documentation checks, run `npm ci --prefix scripts/architecture --ignore-scripts`, then `npm run check:architecture`. Render changed diagrams to review readability; parsing alone is insufficient. Run existing checks relevant to the change.
- Never commit secrets, service-account keys, `.env` values or member data. Architecture examples should name configuration variables without values.

The PR author owns affected documentation updates; reviewers check their consistency with the implementation. No separate architecture approval process is required.
