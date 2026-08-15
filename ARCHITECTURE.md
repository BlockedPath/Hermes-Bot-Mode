# Architecture

`plugin.js` is currently a 4000-line monolith (no bundler). This document describes the
intended modular split so future work can be done file-at-a-time without breaking the
desktop plugin loader (which today expects a single `plugin.js`).

## Target layout

```text
lib/validate.mjs      # NAME_RE, shellQuote, sanitizeTitle — already extracted
src/avatars/          # BotFace, shapeNode, avatar picker, normalize/pet logic
src/roster/           # useRoster, BotsPane, BotRow, pin/sort, unread watermarks
src/routines/         # cron wrapper, RoutineRow, RoutinesPane, schedule picker
src/cron/             # routinePrompt, scheduleLabel, composeSchedule
src/profile/          # (future) Active Profile pane — see #4
src/messaging/        # messagingProtocolSection, mention middleware
src/pet/              # PetTab, petFrameCache, gallery windowing
plugin.js             # re-exports / registers panes — thin wiring layer
```

## Migration steps

1. **Done (partially).** `lib/validate.mjs` is the single source of truth for `NAME_RE`,
   `UUID_RE`, `shellQuote`, and `sanitizeTitle`. `groups.mjs` imports it directly.
   `plugin.js` **cannot** import it yet — the desktop loader takes one flat file and the
   test suites evaluate it with `vm.runInNewContext` (a script, not a module), so a
   top-level relative import throws. `plugin.js` therefore keeps inline copies, and
   `tests/validate-parity.test.mjs` fails the build if they drift. Removing the
   duplication is blocked on step 4.
2. Next: extract `src/cron/schedule.mjs` (pure functions: `composeSchedule`, `scheduleLabel`, `scheduleSummary`) — no SDK deps.
3. Then `src/avatars/` (BotFace is pure, avatar storage is side-effectful — split accordingly).
4. Add a bundler (esbuild) that builds `src/plugin-entry.mjs` → `plugin.js` so the desktop loader still sees one file.
5. After bundler lands, `import` relative files works and the monolith can be deleted.

## Tooling

- `npm test` — `node --test tests/*.mjs` (no external runner)
- `npm run lint` — `eslint .` via `eslint.config.mjs`
- `npm run typecheck` — `tsc --noEmit --allowJs` (loose, catches obvious shape errors)

All three exit non-zero on failure and run in CI (`.github/workflows/ci.yml`). Do not
re-add `|| true` or `|| echo` fallbacks — a gate that cannot fail is not a gate.

## Shell command construction

Several code paths build `hermes ...` command strings that an agent is instructed to run
in a terminal. **Always** quote interpolated values with `shellQuote()` (POSIX
single-quote). Never use `JSON.stringify`: it produces a *double*-quoted string, and the
shell still performs command and parameter substitution inside double quotes — `$(...)`,
`` `...` ``, and `${...}` all execute. `tests/group-rooms.test.mjs` enforces this by
running generated commands through a real `/bin/sh` against a stub binary and asserting
no canary file appears.
