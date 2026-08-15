# Architecture

The Hermes desktop loader expects one flat ESM file named `plugin.js`. Source code lives
under `src/`; esbuild bundles it into the committed `plugin.js` artifact.

**Do not edit `plugin.js` directly.** Edit `src/` or `lib/`, run `npm run build`, and
commit both source and artifact. CI runs `npm run build:check` and fails if they drift.

## Current layout

```text
src/plugin-entry.mjs  # plugin source entry; still the main monolith for now
lib/validate.mjs      # NAME_RE, UUID_RE, shellQuote, sanitizeTitle
groups.mjs            # standalone file-backed group-room library
build.mjs              # deterministic esbuild build/check
plugin.js              # GENERATED committed artifact consumed by desktop loader
tests/helpers/          # vm harness for evaluating the generated ESM bundle
```

The desktop host provides these modules at runtime, so esbuild marks them external and
preserves their imports in `plugin.js`:

- `@hermes/plugin-sdk`
- `react`
- `react/jsx-runtime`

They are declared as optional peer dependencies rather than bundled dependencies.

## Target modules

```text
src/avatars/          # BotFace, shapeNode, avatar picker, normalize/pet logic
src/roster/           # useRoster, BotsPane, BotRow, pin/sort, unread watermarks
src/routines/         # cron wrapper, RoutineRow, RoutinesPane, schedule picker
src/cron/             # routinePrompt, scheduleLabel, composeSchedule
src/profile/          # (future) Active Profile pane — see #4
src/messaging/        # messagingProtocolSection, mention middleware
src/pet/              # PetTab, petFrameCache, gallery windowing
src/plugin-entry.mjs  # thin registration/wiring entry after extraction
```

## Migration status

1. **Done.** `lib/validate.mjs` is the single source of truth for `NAME_RE`, `UUID_RE`,
   `shellQuote`, and `sanitizeTitle`. Both `groups.mjs` and `src/plugin-entry.mjs` import
   it. The former inline duplication and parity workaround are gone.
2. **Done.** esbuild bundles `src/plugin-entry.mjs` into the committed `plugin.js`
   artifact. `npm run build:check` and CI enforce freshness.
3. Next: extract `src/cron/schedule.mjs` (pure functions: `composeSchedule`,
   `scheduleLabel`, `scheduleSummary`) — no SDK dependencies.
4. Then extract `src/avatars/` (BotFace is pure; avatar storage is side-effectful —
   split accordingly).
5. Continue extracting roster, messaging, routines, and pet modules until
   `src/plugin-entry.mjs` is thin wiring rather than a monolith.

## Tooling

- `npm run build` — bundle `src/plugin-entry.mjs` → `plugin.js`
- `npm run build:check` — compare an in-memory build with committed `plugin.js`
- `npm test` — `node --test tests/*.mjs` (no external runner)
- `npm run lint` — lint source/config/tests; generated `plugin.js` is ignored
- `npm run typecheck` — typecheck `src/`, `lib/`, `groups.mjs`, and `build.mjs`
- `npm run check` — build freshness, lint, typecheck, then tests

All gates exit non-zero on failure and run in CI (`.github/workflows/ci.yml`). Do not
re-add `|| true` or `|| echo` fallbacks — a gate that cannot fail is not a gate.

## Shell command construction

Several code paths build `hermes ...` command strings that an agent is instructed to run
in a terminal. **Always** quote interpolated values with `shellQuote()` (POSIX
single-quote). Never use `JSON.stringify`: it produces a *double*-quoted string, and the
shell still performs command and parameter substitution inside double quotes — `$(...)`,
`` `...` ``, and `${...}` all execute. `tests/group-rooms.test.mjs` enforces this by
running generated commands through a real `/bin/sh` against a stub binary and asserting
no canary file appears.
