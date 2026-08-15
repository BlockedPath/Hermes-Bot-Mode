/**
 * Build src/plugin-entry.mjs -> plugin.js
 *
 * The Hermes desktop loader takes ONE flat file, so plugin.js is a committed
 * build artifact rather than a source file. Edit src/ and run `npm run build`;
 * CI fails if the checked-in plugin.js does not match a fresh build.
 *
 * `--check` builds to memory and compares against the committed plugin.js
 * without touching the working tree.
 */
import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const OUTFILE = join(root, "plugin.js");

const BANNER = `// GENERATED FILE - DO NOT EDIT.
// Built from src/plugin-entry.mjs by build.mjs (esbuild).
// Edit the source in src/ and run: npm run build
`;

/** Modules the desktop host injects at load time; they must stay as bare
 *  imports in the output, not be bundled. */
const EXTERNALS = ["@hermes/plugin-sdk", "react", "react/jsx-runtime"];

/** @type {import("esbuild").BuildOptions} */
const options = {
 entryPoints: [join(root, "src", "plugin-entry.mjs")],
 bundle: true,
 format: "esm",
 target: "es2022",
 platform: "browser",
 external: EXTERNALS,
 banner: { js: BANNER },
 // Keep the emoji and typographic punctuation as real UTF-8 rather than
 // \u escapes, so the artifact stays diffable and greppable.
 charset: "utf8",
 // Readability over bytes: this is a committed artifact that people review.
 minify: false,
 legalComments: "none",
 logLevel: "warning",
};

const check = process.argv.includes("--check");

const result = await build({ ...options, write: false });
const built = result.outputFiles[0].text;

if (check) {
 let current = "";
 try {
  current = await readFile(OUTFILE, "utf8");
 } catch {
  // Missing artifact is a mismatch, reported below.
 }
 if (current !== built) {
  console.error(
   "plugin.js is out of date with src/.\nRun `npm run build` and commit the result.",
  );
  process.exit(1);
 }
 console.log("plugin.js is up to date with src/.");
} else {
 await writeFile(OUTFILE, built, "utf8");
 console.log(`built plugin.js (${(built.length / 1024).toFixed(1)}kb)`);
}
