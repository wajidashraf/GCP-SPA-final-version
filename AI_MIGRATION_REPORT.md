# AI migration report: Claude to a unified assistant system

**Audit date:** 2026-07-24  
**Scope:** repository files, hidden project metadata, current Git history, and
the current Windows user's Claude project-memory location  
**Result:** create one canonical `AGENTS.md`, keep thin vendor adapters, and
separate durable instructions from architecture context and dated operations.

## Outcome

Before this migration, Claude was the only assistant with a repository-native
instruction entry point. Its durable context was concentrated in `CLAUDE.md`,
while business requirements, mappings, rollout decisions, and operational notes
were scattered across unrelated files.

The repository now uses:

```text
AGENTS.md                         canonical behavioral instructions
├── CLAUDE.md                    Claude imports AGENTS.md
├── .github/copilot-instructions.md
│                                Copilot adapter
└── .cursor/rules/project.mdc    always-on Cursor adapter

PROJECT_CONTEXT_REPORT.md        architecture, decisions, onboarding, caveats
AI_MIGRATION_REPORT.md           audit evidence and file disposition
```

This prevents each assistant's file from becoming an independent, drifting copy
of project rules.

## 1. What project context Claude depended on

### Automatically loaded or client-enforced

| File/state | What Claude received | Importance |
|---|---|---|
| `CLAUDE.md` | Project rules, schema constraints, form/choice/icon conventions, deployment instructions, environment IDs, auth migration, dated production issues | Critical |
| `.claude/settings.json` | Shared allow-list for Power Pages Microsoft Learn MCP search/fetch tools | Tool configuration, not project knowledge |
| `.claude/settings.local.json` | Machine-local command allow-list, including deploy/git commands and a stale absolute path | Local permissions, not portable knowledge |
| Claude auto memory | No repository or current-user project memory was found | Unavailable |

Claude Code officially treats `CLAUDE.md` as project instructions and stores
auto memory outside the repository under the user's Claude project directory.
It also documents importing `AGENTS.md` from `CLAUDE.md`, which is the pattern
adopted here:
[Claude Code memory and project instructions](https://code.claude.com/docs/en/memory).

### Context available only when Claude opened or followed it

| File | Context |
|---|---|
| `contex.md` | Historical BRD, objectives, roles, scope, requirements, user stories, lifecycle, screen/field expectations |
| `mapping.md` | Detailed parent/child/grandchild Dataverse mapping for all matter forms |
| `userguide.md` | Current-looking end-user request lifecycle, statuses, decisions, and actions |
| `docs/edit-request-mode-plan.md` | Locked architecture and safety rules for RS editing |
| `docs/edit-mode-rollout.md` | Completed edit coverage and per-type quirks |
| `server-logic/README.md` | Signatory migration rationale, security model, deployment, smoke test, rollback |
| `api/README.md` | Azure Function setup, but with stale MSAL user-auth documentation |
| `docs/permissions-audit*.html` | Point-in-time table-permission audits |
| Git history | Fifteen visible commits documenting permission, role, edit-mode, server-logic, and production-deployment work |

The old `CLAUDE.md` linked some of these sources, but there was no explicit
document hierarchy. That allowed historical and dated facts to be mistaken for
permanent rules.

## 2. Files that stored Claude instructions

### Direct instruction/config files found

- `CLAUDE.md` — tracked project instructions.
- `.claude/settings.json` — tracked Claude project tool permissions.
- `.claude/settings.local.json` — tracked machine-local tool permissions.

### Claude instruction facilities not found

- No `.claude/CLAUDE.md`.
- No `.claude/rules/`.
- No `CLAUDE.local.md`.
- No Claude commands, agents, skills, hooks, or workflow definitions under
  `.claude/`.
- No repository `MEMORY.md`.
- No Claude auto-memory directory for this repository under the current user's
  `C:\Users\Administrator\.claude`; only `.claude\ide` exists.

The tracked local settings refer to a different historical path under
`C:\Users\WajidAshraf\...`. Auto memory on that original user/machine, if it
existed, is not in this repository and was not available to audit. Any facts
that existed only in past Claude conversations or that machine's auto memory
cannot be recovered from the current checkout.

## 3. Other assistant instructions and workflows found before migration

| Facility | Before migration |
|---|---|
| Root `AGENTS.md` | Absent |
| Nested `AGENTS.md` | Absent |
| `.github/copilot-instructions.md` | Absent |
| `.github/instructions/*.instructions.md` | Absent |
| `.github/workflows/` | Absent; no repository CI |
| `.cursor/rules/` | Absent |
| `.cursorrules` | Absent |
| Copilot/Cursor memories | Absent |
| Generic AI instruction file | Absent |

The `.vscode/` folder contains Azure Functions tasks/settings, not assistant
instructions. `.playwright-mcp/` contains generated browser captures, not
workflows.

## 4. Essential historical instructions

### Keep as always-on rules

- Dataverse is pre-existing and externally owned; do not invent or modify
  schema.
- Preserve fixed choice integers and reuse `src/data/*Choices.ts`.
- Use shared form components and multi-step abstractions.
- Keep Dataverse calls in the central Power Pages API/service layer.
- Use Lucide for UI iconography.
- Preserve requestor/company identity in edit mode.
- RS edits stay RS.
- Function calls use portal tokens, not the retired MSAL iframe flow.
- Signatory operations use same-origin Power Pages Server Logic.
- PAC upload must use the freshly built `dist` via `--compiledPath` and the
  `gcp-nexus` site name.
- Development deployment and verification precede production.
- UI role gates are not a replacement for Dataverse/server-side authorization.

These were consolidated into `AGENTS.md`.

### Keep as on-demand project context

- Business objectives, scope, roles, user stories, and lifecycle.
- The complete form/Dataverse mapping.
- Per-matter edit-mode mapping and quirks.
- Server-logic design and smoke-test steps.
- Environment IDs and hosts.
- Security audit history.

These belong in `PROJECT_CONTEXT_REPORT.md` or the linked detailed documents,
not in every assistant prompt.

### Keep only as dated status pending revalidation

- The 2026-06-06 production schema gap for email-template and signatory tables.
- The production implicit-grant certificate gap.
- Production `/slots` error `9004010A`.
- "Signatory pilot deployed only to development."
- June permissions-audit findings.

Later July production-deploy commits make these unsafe to present as current
facts. They are retained as items to verify.

## 5. Instruction and documentation drift found

| Finding | Evidence | Migration treatment |
|---|---|---|
| `api/README.md` describes MSAL bearer tokens | Current `portalToken.ts`, `validateToken.ts`, and `uploadConfig.ts` use portal tokens | Added a warning; full README rewrite recommended |
| Old `CLAUDE.md` points to missing `src/forms/FormFieldsExample.tsx` | File does not exist | Removed from canonical instructions |
| Old shared-field inventory is incomplete | `src/forms/index.ts` exports many additional field/editor components | Canonical rule points to the live index |
| UI strings still request `VITE_MSAL_*` settings | `UserRoleManagement.tsx` and `SignatoryManagement.tsx` | Modify in a focused follow-up |
| `@azure/msal-browser` is still a direct dependency | No authored source import found | Confirm and remove separately |
| Signatory docs say development pilot | Server logic is packaged and later prod-deploy commits exist | Mark external deployment status unverified |
| June permission audit has fixed and unfixed findings | Current request-write YAML exists; broad engagement/child access remains | Treat HTML as a dated snapshot |
| Detailed inner errors remain enabled | `Webapi/error/innererror` is `true` | Security-sensitive production follow-up |
| Historical BRD is malformed and misspelled | `contex.md` starts with `content = """` and has no normal Markdown title | Preserve now; clean/rename later |
| Local/generated files are tracked | `.env.local`, `.claude/settings.local.json`, `.playwright-mcp/*.yml` | Ignore future copies; untrack after maintainer confirmation |

## 6. Changes required for Codex to behave consistently with Claude

1. Add root `AGENTS.md` containing the durable rules Codex automatically needs.
2. Move architecture, decisions, caveats, and onboarding detail into a linked
   project-context document.
3. Make `CLAUDE.md` import `AGENTS.md` rather than maintaining a second rule set.
4. Add Copilot and Cursor adapters for clients that do not consistently load
   `AGENTS.md` in every surface.
5. Define source precedence so dated docs do not override current code/schema.
6. Add explicit safety around deployment, Git push, schema changes, permissions,
   secrets, and pre-existing worktree changes.
7. Record the absence of tests so assistants do not claim false validation.

OpenAI documents `AGENTS.md` as the durable repository-guidance surface for
Codex:
[Codex customization and AGENTS guidance](https://developers.openai.com/codex/concepts/customization#agents-guidance).

## 7. Should AGENTS.md be created?

Yes. It is the best canonical file for this repository because:

- Codex reads it as repository guidance.
- GitHub Copilot supports agent instructions using `AGENTS.md` in several
  surfaces, while `.github/copilot-instructions.md` remains the widest
  repository-wide compatibility file:
  [GitHub custom instruction support](https://docs.github.com/en/copilot/reference/custom-instructions-support).
- Claude Code can officially import it from `CLAUDE.md`.
- It is vendor-neutral Markdown, visible to humans and future assistants.
- Nested `AGENTS.md` files can be added later if `api/` or
  `.powerpages-site/server-logic/` needs genuinely different local rules.

The root file should stay below roughly 200 lines and link to deeper context
rather than absorb the entire BRD or field map.

## 8. Cross-assistant compatibility design

| Assistant | Discovery file | Strategy |
|---|---|---|
| Claude Code | `CLAUDE.md` | Native `@AGENTS.md` import |
| Codex | `AGENTS.md` | Canonical instructions |
| GitHub Copilot | `.github/copilot-instructions.md` plus supported `AGENTS.md` surfaces | Thin adapter tells Copilot to read canonical file/context |
| Cursor | `.cursor/rules/project.mdc` | Always-on project rule references `@AGENTS.md` and context |
| Future assistants | `AGENTS.md` and repository reports | Vendor-neutral entry point and explicit document map |

GitHub documents `.github/copilot-instructions.md` as the repository-wide file
and `AGENTS.md` as an agent instruction source:
[Adding repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions).

Cursor documents version-controlled project rules under `.cursor/rules/` and
marks `.cursorrules` as legacy:
[Cursor project rules](https://docs.cursor.com/context/rules).

## 9. File disposition

### Added by this migration

- `AGENTS.md` — canonical durable instructions.
- `PROJECT_CONTEXT_REPORT.md` — living architecture/onboarding context.
- `AI_MIGRATION_REPORT.md` — this audit and migration record.
- `.github/copilot-instructions.md` — Copilot compatibility adapter.
- `.cursor/rules/project.mdc` — Cursor compatibility adapter.

### Modified by this migration

- `CLAUDE.md` — replaced duplicated rules with an `@AGENTS.md` import and a
  context pointer.
- `.gitignore` — added local assistant, environment, and browser-capture
  exclusions.
- `api/README.md` — added a warning that its MSAL caller-auth sections are
  historical.

### Keep and maintain

- `.claude/settings.json` — shared Claude tool configuration, if the team still
  uses the Power Pages documentation MCP.
- `mapping.md` — essential Dataverse/form mapping.
- `docs/edit-request-mode-plan.md` — locked design record.
- `docs/edit-mode-rollout.md` — completion record and per-type quirks.
- `server-logic/README.md` — signatory design and smoke test.
- `userguide.md` — user-facing workflow reference.
- `.powerpages-site/` — deployable Power Pages source/metadata.

### Deprecate or clean up after maintainer confirmation

- `.claude/settings.local.json` — untrack; machine-specific permissions and stale
  absolute path. Keep local copies ignored.
- `.env.local` — untrack; environment-specific browser configuration. Keep
  `.env.example`.
- `.playwright-mcp/*.yml` — untrack unless they are intentionally maintained
  fixtures; they currently look like generated captures.
- `contex.md` — supersede with a correctly named `BUSINESS_REQUIREMENTS.md`
  after cleaning the malformed wrapper and checking links/history.
- `api/README.md` MSAL setup sections — replace with portal-token setup.
- Legacy `VITE_MSAL_*` declarations/messages and the unused
  `@azure/msal-browser` dependency — remove after confirming no deployment
  fallback relies on them.
- Duplicated `Request-Admin-Engagement-Access` versus
  `Request-Admin-Global-Access` permissions — security-review before
  consolidation; do not delete speculatively.
- Older `docs/permissions-audit.html` — retain as history or move to a dated
  archive; never treat it as the latest audit.

### Not changed automatically

No files were removed from the Git index, no dependency was removed, no
permission was broadened/narrowed, and no deployment, restart, commit, or push
was performed. Those changes need focused validation or explicit external-action
authorization.

## 10. Maintenance rule

When a future change establishes a durable project rule:

1. Update `AGENTS.md` if every contributor/assistant must follow it.
2. Update `PROJECT_CONTEXT_REPORT.md` if it changes architecture or onboarding.
3. Update the most specific mapping/decision/runbook document.
4. Do not copy the rule into vendor adapters.
5. Mark obsolete dated facts as resolved or superseded; do not erase history.
