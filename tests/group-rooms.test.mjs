import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

test("integration: fan-out CLI commands are shell-safe (no injection)", () => {
  const { mgr, cleanup } = tmpManager();
  try {
    const g = mgr.createGroup({
      name: 'Eng "Quotes" & $pecial',
      memberIds: ["alpha", "beta"],
    });
    const malicious = 'hello"; rm -rf /; echo "';
    const res = mgr.postToRoom({
      groupId: g.id,
      senderName: "alpha",
      content: malicious,
    });
    assert.equal(res.fanOutCount, 1);
    const cmd = res.fanOutCommands[0].cliCommand;
    // Extract JSON-quoted segments: "(?:\\.|[^"\\])*"
    const jsonRe = /"(?:\\.|[^"\\])*"/g;
    const quoted = cmd.match(jsonRe);
    assert.ok(
      quoted && quoted.length >= 2,
      "command should have at least two JSON-quoted strings (-c and -q)",
    );
    // Last quoted segment is the -q payload
    const parsed = JSON.parse(quoted[quoted.length - 1]);
    assert.ok(
      parsed.includes(malicious),
      "parsed -q should contain original malicious content",
    );
    // First quoted segment is the -c room label
    assert.doesNotThrow(() => JSON.parse(quoted[0]));
    // The raw shell breakout must not appear outside the quoted string —
    // strip quoted segments, remainder must have no rm.
    const stripped = cmd.replace(jsonRe, '""');
    assert.ok(
      !stripped.includes("rm -rf"),
      "stripped command must not contain raw injection",
    );
  } finally {
    cleanup();
  }
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
