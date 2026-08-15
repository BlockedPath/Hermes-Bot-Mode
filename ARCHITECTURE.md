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

1. `lib/validate.mjs` exists and is tested via `groups.mjs` (already shares `NAME_RE`).
2. Next: extract `src/cron/schedule.mjs` (pure functions: `composeSchedule`, `scheduleLabel`, `scheduleSummary`) — no SDK deps.
3. Then `src/avatars/` (BotFace is pure, avatar storage is side-effectful — split accordingly).
4. Add a bundler (esbuild) that builds `src/plugin-entry.mjs` → `plugin.js` so the desktop loader still sees one file.
5. After bundler lands, `import` relative files works and the monolith can be deleted.

## Tooling

- `npm test` — `node --test tests/*.mjs` (no external runner)
- `npm run lint` — `eslint .` via `eslint.config.mjs`
- `npm run typecheck` — `tsc --noEmit --allowJs` (loose, catches obvious shape errors)
