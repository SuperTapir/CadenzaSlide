# CLI contract

Installed CLI commands use the runtime bundled with Cadenza and the workspace discovered from `cwd`. Add `--workspace <path>` to select a workspace explicitly. Repository contributors may substitute `npm run cadenza --` for the `cadenza` executable.

- `cadenza init [path]`: create only `cadenza.config.json`, `decks/`, and a short workspace README; never overwrite an existing workspace.
- `cadenza new <deck-id> [--title=<title>]`: create a valid outline deck and deck-local `assets/`; never overwrite an existing deck.
- `cadenza list`: JSON list of deck IDs, titles, authoritative paths, and normalized workspace root.
- `cadenza open [path] [--no-browser]`: start the Deck Library for the selected workspace without requiring a deck ID. A positional path is equivalent to selecting that workspace explicitly. The default opens the deterministic URL in the system browser; use `--no-browser` for CI or automation while retaining JSON output.
- `cadenza inspect <deck-id>/slide:<slide-id>`: slide, playback position, group, notes, and applied design.
- `cadenza visuals "<intent>" [--motion=none|enter|loop|emphasis] [--limit=5] [--avoid=asset-id,...]`: query production Lucide static or Line MD motion assets with semantic match evidence, family, treatments and provenance. Motion defaults to `none`.
- `cadenza overview <deck-id>`: start high-density read-only Overview.
- `cadenza present <deck-id>`: verify and start the server-backed presentation launcher.
- `cadenza verify <deck-id> [--browser]`: deterministic file and optional browser smoke, including deck-local asset existence and path safety.
- `cadenza diff <deck-id>`: slide/group/notes/design summary from Git or current server snapshot.

There is no static `build` command in this release. The deliverable is the portable workspace content rendered by the installed server-backed runtime; static export needs a separate explicit contract.

Machine-readable success is JSON on stdout with `ok: true`. Failures are JSON on stderr with `ok: false`, stable `error.code`, and non-zero exit status.

In Studio Inspect, commit element-level requests and choose “复制给 Agent”. Paste the resulting prompt into Codex; Cadenza itself never calls AI. When the Agent updates the authoritative `deck.cadenza.json`, Studio shows an explicit reload notice. Reload only after pending notes are saved; Studio returns to the prior stable slide and fragment when they still exist.
