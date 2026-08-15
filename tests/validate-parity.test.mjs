/**
 * Drift guard for the deliberate duplication between lib/validate.mjs and the
 * inline copies in plugin.js.
 *
 * plugin.js cannot import lib/validate.mjs yet: the desktop loader takes one
 * flat file, and the other test suites evaluate plugin.js with
 * vm.runInNewContext (a script, not a module), where a top-level relative
 * import throws. Until step 4 of ARCHITECTURE.md (esbuild) lands, these tests
 * fail the build the moment the two copies disagree — so a security fix in one
 * cannot silently miss the other.
 */
import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { NAME_RE, shellQuote, sanitizeTitle } from "../lib/validate.mjs";

const pluginSource = readFileSync(
  new URL("../plugin.js", import.meta.url),
  "utf8",
);

/** Pull a top-level `function name(...) { ... }` out of plugin.js and evaluate
 *  it in isolation, so we exercise the real inline copy rather than a rewrite. */
function extractFunction(name) {
  const start = pluginSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `plugin.js should define ${name}()`);

  // Brace-match from the first { after the signature.
  const open = pluginSource.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < pluginSource.length; i++) {
    const ch = pluginSource[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.notEqual(end, -1, `could not brace-match ${name}() in plugin.js`);

  const context = {};
  vm.runInNewContext(
    `${pluginSource.slice(start, end)}\nthis.fn = ${name};`,
    context,
    { filename: `plugin.js#${name}` },
  );
  return context.fn;
}

/** Inputs chosen to cover every shell expansion form plus quoting edge cases. */
const CORPUS = [
  "",
  "plain",
  "with space",
  "$(id)",
  "`id`",
  "${HOME}",
  "$HOME",
  "it's",
  "'; touch x; echo '",
  '"; touch x; echo "',
  "back\\slash",
  "new\nline",
  "tab\tchar",
  "null\0byte",
  "emoji \u{1F916}",
  "a".repeat(200),
];

test("parity: plugin.js NAME_RE matches lib/validate.mjs", () => {
  const match = /const NAME_RE = (\/.*\/[gimsuy]*);/.exec(pluginSource);
  assert.ok(match, "plugin.js should declare NAME_RE as a regex literal");
  assert.equal(
    match[1],
    NAME_RE.toString(),
    "plugin.js NAME_RE drifted from lib/validate.mjs",
  );
});

test("parity: plugin.js shellQuote behaves identically to lib/validate.mjs", () => {
  const inline = extractFunction("shellQuote");
  for (const input of CORPUS) {
    assert.equal(
      inline(input),
      shellQuote(input),
      `shellQuote drifted for input: ${JSON.stringify(input)}`,
    );
  }
});

test("parity: plugin.js sanitizeTitle behaves identically to lib/validate.mjs", () => {
  const inline = extractFunction("sanitizeTitle");
  for (const input of CORPUS) {
    assert.equal(
      inline(input),
      sanitizeTitle(input),
      `sanitizeTitle drifted for input: ${JSON.stringify(input)}`,
    );
    assert.equal(inline(input, 12), sanitizeTitle(input, 12));
  }
});

test("security: plugin.js has no JSON.stringify-as-shell-quoting left", () => {
  // JSON.stringify inside a string that also contains a CLI flag is the
  // signature of the original bug. Catches reintroduction in new call sites.
  const offenders = pluginSource
    .split("\n")
    .map((line, i) => [i + 1, line])
    .filter(
      ([, line]) =>
        /JSON\.stringify/.test(line) && /\s-[a-zA-Z]\s|hermes -p/.test(line),
    );
  assert.deepEqual(
    offenders,
    [],
    `JSON.stringify used to quote a CLI argument:\n${offenders
      .map(([n, l]) => `  plugin.js:${n}: ${l.trim()}`)
      .join("\n")}`,
  );
});
