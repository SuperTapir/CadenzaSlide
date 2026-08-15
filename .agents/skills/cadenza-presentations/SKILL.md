---
name: cadenza-presentations
description: Create, revise, organize, verify, preview, and present CadenzaSlide decks in a Cadenza workspace. Use when the user asks to make or modify a web presentation, work by slide ID, manage outline groups or speaker notes, open Overview, or run Cadenza CLI verification. Cadenza never calls AI; the current host Agent performs the work.
---

# Cadenza Presentations

Treat `deck.cadenza.json` and registered workspace files as the source of truth. Use the host Agent's own reasoning and file tools; never request an API key or call a model from Cadenza.

## Workspace boundary

The Cadenza runtime and the user's workspace are separate. If the target folder has no `cadenza.config.json`, run `cadenza init <folder>`. Start a deck with `cadenza --workspace <folder> new <deck-id> --title=<title>`, then edit the generated public document. Keep every deck in `decks/<deck-id>/`, store local media in that deck's `assets/`, and write media references as `assets/<path>`. Never copy Cadenza source, `dist`, `node_modules`, or renderer assets into the workspace.

## Product mission

CadenzaSlide exists to make the same Skill, method, component system, Composer and Verifier produce consistently Cadenza-quality decks across different topics, structures, densities and page intents. A Demo is only a representative input, problem probe and regression fixture; its polish is evidence, never the endpoint.

For every repeatable Demo failure, complete this loop: reproduce on the real canvas → state the reusable aesthetic or behavioral contract → implement it in the Skill, component/renderer, Composer or Verifier → add a regression assertion → regenerate and check the original case plus materially different cases. Keep a change deck-local only when it truly depends on specific facts and cannot reasonably generalize. Always answer: “How will the next similar input do this correctly without a manual page patch?”

## Factory promotion gate

When generation or review discovers a reusable successful expression, evaluate it for the correct factory layer: visual units belong in the component library; recurring content structures and compositions in the scenario library; reusable transitions and element motion in the animation library; aesthetic judgment and workflow in this Skill; stable selection, composition, deformation and recovery strategies in product logic. Never leave generally useful capability trapped in one Demo or one-off code.

Promotion is selective, not archival. Before a candidate becomes public, define its applicable scenario, input contract, controlled axes, design-token roles, composition boundaries and known failure conditions. Verify it with multiple materially different content cases. Reject candidates that are over-specialized, duplicate an existing primitive, lack a stable contract or cannot retain Cadenza tone under variation.

## Choose the workflow

- For a new deck, follow [authoring-workflow.md](references/authoring-workflow.md).
- For every generation, revision, or acceptance pass, load [visual-review-contract.md](references/visual-review-contract.md). It is the canonical visual-quality gate, including the boundary between deterministic findings and Audience judgment.
- Before questioning or outlining a new deck, use [creation-guidance.md](references/creation-guidance.md) to choose the fast or guided path and present a reviewable creation contract.
- For an existing deck change, run `cadenza inspect <deck-id>/slide:<slide-id>`, edit the authoritative file directly, then verify.
- For group, ordering, notes, Overview, Gallery, CLI, or presentation commands, consult [cli-contract.md](references/cli-contract.md).
- Load [deck-schema.md](references/deck-schema.md) only when authoring or diagnosing deck JSON.
- Load [design-system.md](references/design-system.md) only when adding or changing a custom layout/component.

## Non-negotiable boundaries

- Before first creation, establish a concise creation contract covering delivery scale. Reuse supplied context, ask only high-leverage unresolved questions, and record delegated assumptions before outlining.
- Read user-provided source files in place. Do not copy, upload, rename, or mutate source material unless explicitly asked.
- Address slides by stable slide ID. Do not invent block IDs. A screenshot may supplement a slide-ID request.
- Make edits through normal workspace files and show normal Git/file diffs. Do not create an internal patch, accept/reject, undo, or revision protocol.
- Keep Design Library read-only. The Host Agent records the creation contract in its execution plan; `deck.cadenza.json` remains the only deck content source.
- Choose layouts from `master.layouts.<layout>.authoring` in the order `complete → startup → canvas`; never infer the policy from a hard-coded layout list.
- During first creation, stop after producing an outline and wait for explicit user confirmation before filling slide content. Later additions do not require that checkpoint.
- Treat a repeated visual failure as a product-system problem: fix the Skill, component/renderer, Composer or Verifier and rerender affected slides instead of patching each slide.
- Before writing a composition candidate, run `preflightCompositionCandidate`; a candidate with findings must follow its `repair | simplify | split` recommendation and must never enter `deck.cadenza.json` unchanged. Preflight is structured evidence only and cannot claim browser geometry.
- Run `cadenza verify <deck-id> --browser` after edits. Fix content coverage, region balance, empty-surface, split alignment, clipping, orphan-line, terminal-period and overflow findings yourself, then open Overview for the user's narrative and visual judgment. Tests alone do not prove the presentation is finished.
- Do not accept a deck from verifier output alone. Complete the full-size Audience review and ordered contact-sheet review in the visual contract; record unresolved manual findings instead of silently treating them as passable.
