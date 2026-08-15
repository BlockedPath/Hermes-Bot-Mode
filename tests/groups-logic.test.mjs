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
import { buildFanOut, createGroupMeta } from "../src/groups/logic.mjs";

function tmpDir() {
  return mkdtempSync(join(tmpdir(), "hermes-logic-test-"));
}

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

test("unit: createGroupMeta validates and dedupes", () => {
  const g = createGroupMeta({
    name: "Engineering",
    memberIds: ["alpha", "beta"],
    description: "x",
  });
  assert.equal(g.name, "Engineering");
  assert.equal(g.memberIds.length, 2);

  const dup = createGroupMeta({
    name: "Dup",
    memberIds: ["alpha", "alpha", "beta"],
  });
  assert.deepEqual(dup.memberIds, ["alpha", "beta"]);

  assert.throws(() => createGroupMeta({ name: "" }), /required/);
  assert.throws(
    () => createGroupMeta({ name: "ok", memberIds: ["BAD CAPS"] }),
    /Invalid member/,
  );
  assert.throws(
    () => createGroupMeta({ name: "ok", memberIds: "not-array" }),
    /must be an array/,
  );
});

test("security: logic buildFanOut command substitution does NOT execute", () => {
  const dir = tmpDir();
  try {
    const canary = join(dir, "PWNED");
    const group = createGroupMeta({
      name: "Team",
      memberIds: ["alpha", "beta"],
    });
    const malicious = `hi $(touch ${canary}) \`touch ${canary}\` \${HOME} '; touch ${canary}; echo '`;
    const { fanOutCommands } = buildFanOut({
      group,
      senderName: "alpha",
      content: malicious,
    });
    assert.equal(fanOutCommands.length, 1);
    const argv = runInShell(fanOutCommands[0].cliCommand, dir);
    assert.ok(
      !existsSync(canary),
      "no shell expansion or chained command may execute",
    );
    const qIndex = argv.lastIndexOf("-q");
    assert.ok(qIndex >= 0);
    const payload = argv[qIndex + 1];
    assert.ok(payload.endsWith(malicious));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("security: logic argv is shell-free and shell string is single-quoted", async () => {
  const { shellQuote } = await import("../lib/validate.mjs");
  const group = createGroupMeta({ name: "Team", memberIds: ["alpha", "beta"] });
  const { fanOutCommands } = buildFanOut({
    group,
    senderName: "alpha",
    content: "hello $(id)",
  });
  const cmd = fanOutCommands[0];
  // Argv form must be literal, no quoting.
  assert.deepEqual(cmd.argv, [
    "-p",
    "beta",
    "chat",
    "--in",
    "~",
    "-c",
    "[Room: Team]",
    "-Q",
    "-q",
    `[Room: Team] 🤖 alpha (@alpha): hello $(id)`,
  ]);
  // Shell form must be single-quoted via shellQuote, not JSON.stringify.
  assert.ok(cmd.cliCommand.includes(shellQuote("[Room: Team]")));
  assert.ok(
    !cmd.cliCommand.includes('"' + "[Room: Team]" + '"') ||
      cmd.cliCommand.includes("'"),
  );
});

test("unit: buildFanOut rejects non-member sender", () => {
  const group = createGroupMeta({ name: "Team", memberIds: ["alpha", "beta"] });
  assert.throws(
    () => buildFanOut({ group, senderName: "gamma", content: "hi" }),
    /not a member/,
  );
});
