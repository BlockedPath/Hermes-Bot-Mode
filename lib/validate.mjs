/**
 * Shared validation helpers — the single source of truth for the identifier
 * regexes and shell quoting used by groups.mjs and plugin.js.
 *
 * NOTE: plugin.js cannot `import` this file yet — the desktop loader takes one
 * flat plugin.js and the tests evaluate it with vm.runInNewContext (script, not
 * module), so top-level imports of relative files would throw. plugin.js keeps
 * inline copies of NAME_RE and shellQuote; tests/validate-parity.test.mjs fails
 * the build if those copies drift from this file. Step 4 of ARCHITECTURE.md
 * (esbuild) removes the duplication for real.
 */

export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidName(name) {
  return typeof name === "string" && NAME_RE.test(name);
}

export function assertValidName(name) {
  if (!isValidName(name))
    throw new Error(`Invalid name "${name}" — must match ${NAME_RE.source}`);
}

/**
 * Quote a single argument for POSIX `sh`.
 *
 * Single quotes are the only shell construct with NO interior expansion, so
 * $(...), `...`, ${...}, \, and " are all inert. The embedded-quote dance
 * closes the string, emits an escaped quote, and reopens it.
 *
 * DO NOT replace this with JSON.stringify: that produces a DOUBLE-quoted
 * string, and the shell still performs command and parameter substitution
 * inside double quotes. See tests/group-rooms.test.mjs.
 */
export function shellQuote(arg) {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

/**
 * Strip characters that are dangerous once a string is embedded in prose that
 * an LLM is told to paste into a terminal. Belt-and-braces on top of
 * shellQuote for human-facing labels.
 */
export function sanitizeTitle(title, max = 80) {
  return (
    String(title || "")
      // eslint-disable-next-line no-control-regex -- stripping control chars is the point
      .replace(/[\0-\x1f\x7f"'`$\\]/g, "")
      .slice(0, max)
      .trim()
  );
}
