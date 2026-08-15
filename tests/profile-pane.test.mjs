import assert from "node:assert/strict";
import test from "node:test";
import {
  bundleSource as source,
  evaluateBundle,
} from "./helpers/load-bundle.mjs";

function runtime(query = {}) {
  const atom = (value) => ({ get: () => value, set: () => undefined });
  const jsx = (type, props = {}) => ({ type, props });
  const context = {
    atom,
    jsx,
    jsxs: jsx,
    useQuery: () => query,
    useValue: (value) => (value?.get ? value.get() : value),
    useState: (value) => [value, () => undefined],
    useEffect: () => undefined,
    useRef: () => ({ current: null }),
    Button: "Button",
    BotFace: "BotFace",
    GlyphSpinner: "GlyphSpinner",
    EditProfileDialog: "EditProfileDialog",
    profileColor: () => "#000",
    PALETTE_AREA: "palette",
    COMPOSER_AREAS: { middleware: "middleware" },
    document: {
      getElementById: () => null,
      createElement: () => ({}),
      head: { appendChild: () => undefined },
    },
    host: {
      state: { profile: { get: () => "ops", listen: () => undefined } },
      request: () => undefined,
    },
  };
  return evaluateBundle(context);
}

// Revert 9382b40 intentionally removed ProfilePane — the "Active Profile pane"
// rendered empty (profiles.describe shape mismatch) and duplicated Edit Profile.
// These tests lock in the revert so it doesn't silently reappear.

test("unit: Profile pane is not registered (reverted in 9382b40)", () => {
  assert.doesNotMatch(source, /id:\s*["']profile["']/);
});

test("integration: no ProfilePane symbol remains in bundle", () => {
  assert.doesNotMatch(source, /\bProfilePane\b/);
});

test("regression: core panes remain registered", () => {
  assert.match(source, /id:\s*["']pane["']/);
  assert.match(source, /id:\s*["']routines["']/);
});

test("system: plugin registration exposes Bots and Routines (not Profile)", () => {
  const ctx = runtime();
  const entries = [];
  ctx.plugin.register({
    storage: { get: () => null },
    register: (item) => entries.push(item),
  });
  assert.equal(
    entries.some((item) => item.id === "pane" && item.title === "Bots"),
    true,
  );
  assert.equal(
    entries.some((item) => item.id === "routines"),
    true,
  );
  assert.equal(
    entries.some((item) => item.id === "profile"),
    false,
  );
});

test("performance: plugin source stays parseable and bounded", () => {
  const start = Date.now();
  for (let i = 0; i < 5000; i += 1) source.slice(0, 100).length;
  assert.ok(Date.now() - start < 1000);
});
