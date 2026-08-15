/**
 * Shared harness for evaluating the built plugin.js inside a vm sandbox.
 *
 * plugin.js is an esbuild artifact, so the shape the tests have to cope with is
 * the bundler's, not the author's:
 *
 *   - host modules stay as bare ESM imports (they are marked external), and
 *     esbuild prints them multi-line, so the strippers must span lines;
 *   - `export default {...}` becomes
 *     `var plugin_entry_default = {...}; export { plugin_entry_default as default };`
 *     so a naive `.replace("export default {", ...)` silently matches nothing
 *     and the test then fails on an undefined global rather than on the thing
 *     it meant to assert.
 *
 * vm.runInNewContext evaluates a script, not a module, so every import/export
 * statement has to be removed before evaluation.
 */
import vm from "node:vm";
import { readFileSync } from "node:fs";

export const BUNDLE_PATH = new URL("../../plugin.js", import.meta.url);

export const bundleSource = readFileSync(BUNDLE_PATH, "utf8");

/** Strip ESM syntax and expose the default export as `globalThis.plugin`. */
export function toScript(source = bundleSource) {
 const withoutImports = source
  // Multi-line named imports from the host-provided modules.
  .replace(
   /^import\s*\{[\s\S]*?\}\s*from\s*["'](?:@hermes\/plugin-sdk|react|react\/jsx-runtime)["'];?[ \t]*\r?\n/gm,
   "",
  )
  // Any remaining single-line import form (default, namespace, bare).
  .replace(/^import\s+[^\n]*?from\s*["'][^"']+["'];?[ \t]*\r?\n/gm, "")
  .replace(/^import\s*["'][^"']+["'];?[ \t]*\r?\n/gm, "");

 // esbuild's hoisted default export.
 const exportBlock =
  /export\s*\{\s*([A-Za-z_$][\w$]*)\s+as\s+default\s*,?\s*\};?/;
 const match = exportBlock.exec(withoutImports);
 if (match) {
  return withoutImports.replace(
   exportBlock,
   `globalThis.plugin = ${match[1]};`,
  );
 }

 // Unbundled fallback, so the harness still works if plugin.js is ever built
 // differently or read straight from src.
 if (withoutImports.includes("export default {")) {
  return withoutImports.replace("export default {", "globalThis.plugin = {");
 }

 throw new Error(
  "load-bundle: could not find a default export in plugin.js — the build " +
   "output shape changed and this harness needs updating.",
 );
}

/**
 * Evaluate the bundle in a fresh sandbox.
 *
 * @param {object} context  Globals the bundle expects (SDK symbols, host, ...).
 * @param {string} [epilogue]  Extra source appended after the bundle, used to
 *   lift internal functions onto the sandbox for direct unit testing.
 */
export function evaluateBundle(context, epilogue = "") {
 const script = toScript() + (epilogue ? `\n${epilogue}\n` : "");
 // esbuild renames duplicate external imports (e.g. `atom` imported in both
 // plugin-entry and GroupsSection) to `atom2`, `host2`, `jsx2`, etc. to avoid
 // collisions. The vm sandbox only provides the base names, so alias any
 // `name2` binding that the bundle actually uses. This keeps the harness
 // robust as more modules import from the same externals.
 for (const key of Object.keys(context)) {
  const alias = `${key}2`;
  if (!context[alias] && new RegExp(`\\b${alias}\\b`).test(script)) {
   context[alias] = context[key];
  }
 }
 // React's `useState`/`jsx` are also aliased as `useState2`/`jsx2` when
 // imported from multiple chunks; handle the lower-cased `jsx` -> `jsx2`
 // already covered, but also ensure `jsxs` alias if present.
 if (context.jsx && !context.jsx2 && /\bjsx2\b/.test(script)) {
  context.jsx2 = context.jsx;
 }
 if (context.jsxs && !context.jsxs2 && /\bjsxs2\b/.test(script)) {
  context.jsxs2 = context.jsxs;
 }
 vm.runInNewContext(script, context, { filename: "plugin.js" });
 return context;
}
