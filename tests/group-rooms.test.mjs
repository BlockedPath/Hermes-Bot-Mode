import assert from "node:assert/strict";
import test from "node:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GroupManager } from "../groups.mjs";

function tmpManager() {
  const dir = mkdtempSync(join(tmpdir(), "hermes-groups-test-"));
  const mgr = new GroupManager(dir);
  return {
    dir,
    mgr,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Execute a generated cliCommand in a REAL POSIX shell against a stub `hermes`
 * that records its argv, and return the argv the binary actually received.
 *
 * This is the only honest way to test shell quoting: string inspection cannot
 * tell you whether `$(...)` would have expanded. The stub writes one argument
 * per line to argvFile, so any substitution shows up as changed argv.
 */
function runInShell(cliCommand, dir) {
  const binDir = join(dir, "bin");
  mkdirSync(binDir, { recursive: true });
  const argvFile = join(dir, "argv.txt");
  const hermesStub = join(binDir, "hermes");
  writeFileSync(
    hermesStub,
    `#!/bin/sh\n: > "${argvFile}"\nfor a in "$@"; do printf '%s\\n' "$a" >> "${argvFile}"; done\n`,
    "utf8",
  );
  chmodSync(hermesStub, 0o755);

  execFileSync("/bin/sh", ["-c", cliCommand], {
    env: { PATH: `${binDir}:/usr/bin:/bin`, HOME: dir },
    cwd: dir,
    stdio: "pipe",
  });

  return readFileSync(argvFile, "utf8").split("\n").slice(0, -1);
}

test("unit: createGroup metadata structure is valid", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const group = mgr.createGroup({
      name: "Engineering",
      memberIds: ["agent-coder", "agent-reviewer"],
      description: "Shared engineering channel",
    });
    assert.equal(group.name, "Engineering");
    assert.equal(group.memberIds.length, 2);
    assert.ok(group.memberIds.includes("agent-coder"));
    assert.ok(group.id);
  } finally {
    cleanup();
  }
});

test("unit: createGroup validates inputs", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    assert.throws(() => mgr.createGroup({ name: "" }), /required/);
    assert.throws(
      () => mgr.createGroup({ name: "ok", memberIds: ["BAD CAPS"] }),
      /Invalid member/,
    );
    assert.throws(
      () => mgr.createGroup({ name: "ok", memberIds: "not-array" }),
      /must be an array/,
    );
  } finally {
    cleanup();
  }
});

test("unit: createGroup deduplicates memberIds", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const g = mgr.createGroup({
      name: "Dup",
      memberIds: ["alpha", "alpha", "beta"],
    });
    assert.deepEqual(g.memberIds, ["alpha", "beta"]);
  } finally {
    cleanup();
  }
});

test("integration: fan-out recipients excludes sender", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const g = mgr.createGroup({
      name: "Team",
      memberIds: ["alpha", "beta", "gamma"],
    });
    const res = mgr.postToRoom({
      groupId: g.id,
      senderName: "alpha",
      content: "hello",
    });
    assert.equal(res.fanOutCount, 2);
    assert.deepEqual(res.fanOutCommands.map((c) => c.targetAgent).sort(), [
      "beta",
      "gamma",
    ]);
  } finally {
    cleanup();
  }
});

test("security: command substitution in content does NOT execute", () => {
  const { dir, mgr, cleanup } = tmpManager();
  try {
    const canary = join(dir, "PWNED");
    const g = mgr.createGroup({
      name: "Team",
      memberIds: ["alpha", "beta"],
    });
    // Every shell expansion form, plus quote-breakout and command chaining.
    const malicious =
      `hi $(touch ${canary}) \`touch ${canary}\` \${HOME} ` +
      `'; touch ${canary}; echo '` +
      `"; touch ${canary}; echo "`;
    const res = mgr.postToRoom({
      groupId: g.id,
      senderName: "alpha",
      content: malicious,
    });
    assert.equal(res.fanOutCount, 1);

    const argv = runInShell(res.fanOutCommands[0].cliCommand, dir);

    assert.ok(
      !existsSync(canary),
      "no shell expansion or chained command may execute",
    );
    // The payload must arrive as ONE argument, byte-identical to the input.
    const qIndex = argv.lastIndexOf("-q");
    assert.ok(qIndex >= 0, "stub should have received a -q flag");
    const payload = argv[qIndex + 1];
    assert.ok(
      payload.endsWith(malicious),
      `-q argument must be delivered verbatim; got: ${payload}`,
    );
    assert.equal(argv[argv.length - 1], payload, "-q must be the last argument");
  } finally {
    cleanup();
  }
});

test("security: shell metacharacters in the group name do NOT execute", () => {
  const { dir, mgr, cleanup } = tmpManager();
  try {
    // Relative name — group names are capped at 64 chars, and runInShell runs
    // with cwd set to the temp dir, so the canary lands there if it executes.
    const canary = join(dir, "PWNED_NAME");
    const g = mgr.createGroup({
      name: `Eng "Q" & $(touch PWNED_NAME) \`touch PWNED_NAME\``,
      memberIds: ["alpha", "beta"],
    });
    const res = mgr.postToRoom({
      groupId: g.id,
      senderName: "alpha",
      content: "hello",
    });

    const argv = runInShell(res.fanOutCommands[0].cliCommand, dir);

    assert.ok(!existsSync(canary), "group name must not be expanded");
    const cIndex = argv.indexOf("-c");
    assert.ok(cIndex >= 0, "stub should have received a -c flag");
    assert.equal(argv[cIndex + 1], `[Room: ${g.name}]`);
  } finally {
    cleanup();
  }
});

test("security: shellQuote is not JSON.stringify (regression guard)", async () => {
  const { shellQuote } = await import("../lib/validate.mjs");
  // A double-quoted string still expands in sh — the exact bug this replaced.
  assert.notEqual(shellQuote("$(id)"), JSON.stringify("$(id)"));
  assert.equal(shellQuote("$(id)"), "'$(id)'");
  assert.equal(shellQuote("it's"), "'it'\\''s'");
  assert.equal(
    execFileSync("/bin/sh", ["-c", `printf %s ${shellQuote("$(id) `id` ${x}")}`], {
      encoding: "utf8",
    }),
    "$(id) `id` ${x}",
  );
});

test("integration: postToRoom appends to room.jsonl", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const g = mgr.createGroup({ name: "X", memberIds: ["alpha", "beta"] });
    mgr.postToRoom({ groupId: g.id, senderName: "alpha", content: "first" });
    mgr.postToRoom({ groupId: g.id, senderName: "beta", content: "second" });
    const groups = mgr.listGroups();
    assert.equal(groups.length, 1);
    const again = mgr.getGroup(g.id);
    assert.equal(again.name, "X");
  } finally {
    cleanup();
  }
});

test("unit: getGroup returns null for missing or corrupt group", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const fakeId = "00000000-0000-4000-a000-000000000000";
    assert.equal(mgr.getGroup(fakeId), null);
    assert.throws(() => mgr.getGroup("not-a-uuid"), /Invalid group id/);
  } finally {
    cleanup();
  }
});

test("unit: listGroups ignores non-UUID directories", () => {
  const { dir, mgr, cleanup } = tmpManager();
  try {
    mkdirSync(join(dir, "not-a-group"), { recursive: true });
    writeFileSync(join(dir, "not-a-group", "group.json"), "{}", "utf8");
    const groups = mgr.listGroups();
    assert.equal(groups.length, 0);
  } finally {
    cleanup();
  }
});

test("unit: postToRoom rejects non-member sender", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const g = mgr.createGroup({ name: "Team", memberIds: ["alpha", "beta"] });
    assert.throws(
      () =>
        mgr.postToRoom({ groupId: g.id, senderName: "gamma", content: "hi" }),
      /not a member/,
    );
  } finally {
    cleanup();
  }
});
