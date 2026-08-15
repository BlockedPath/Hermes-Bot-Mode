/**
 * Shared Group Rooms & Multi-Agent Fan-Out for Hermes Bot Mode
 *
 * File-backed group rooms: each group is a directory under baseDir
 * containing group.json + room.jsonl.  Hardened against injection and
 * corrupt data.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { NAME_RE, UUID_RE, shellQuote } from "./lib/validate.mjs";

function assertGroupName(name) {
  if (typeof name !== "string" || !name.trim())
    throw new Error("Group name is required");
  if (name.length > 64) throw new Error("Group name must be ≤64 characters");
  // Display name — allow spaces/punctuation but forbid control characters and
  // path separators. Shell metacharacters are deliberately NOT filtered here:
  // the name is legitimately free text, and every use site quotes it with
  // shellQuote(). Filtering would be a second, weaker line of defence.
  // eslint-disable-next-line no-control-regex -- rejecting control chars is the point
  if (/[\0-\x1f\x7f/\\]/.test(name))
    throw new Error("Group name contains invalid characters");
}

function assertMemberId(id) {
  if (typeof id !== "string" || !NAME_RE.test(id)) {
    throw new Error(`Invalid member id "${id}" — must match ${NAME_RE.source}`);
  }
}

function assertGroupId(id) {
  if (typeof id !== "string" || !UUID_RE.test(id))
    throw new Error(`Invalid group id "${id}"`);
}

/** Shell-safe quoting for a CLI argument — POSIX single-quote (see lib/validate.mjs). */
const q = shellQuote;

export class GroupManager {
  constructor(baseDir = join(homedir(), ".hermes", "agent-data", "agents")) {
    this.baseDir = baseDir;
    mkdirSync(this.baseDir, { recursive: true });
  }

  createGroup({ name, memberIds = [], description = "" }) {
    assertGroupName(name);
    if (!Array.isArray(memberIds))
      throw new Error("memberIds must be an array");
    const deduped = [...new Set(memberIds)];
    for (const m of deduped) assertMemberId(m);
    if (typeof description !== "string")
      throw new Error("description must be a string");
    if (description.length > 500)
      throw new Error("description must be ≤500 characters");

    const groupId = randomUUID();
    const groupDir = join(this.baseDir, groupId);
    mkdirSync(groupDir, { recursive: true });

    const meta = {
      id: groupId,
      name: name.trim(),
      description: description.trim(),
      memberIds: deduped,
      createdAt: Date.now(),
    };

    writeFileSync(
      join(groupDir, "group.json"),
      JSON.stringify(meta, null, 2),
      "utf8",
    );
    writeFileSync(join(groupDir, "room.jsonl"), "", "utf8");
    return meta;
  }

  getGroup(groupId) {
    assertGroupId(groupId);
    const file = join(this.baseDir, groupId, "group.json");
    if (!existsSync(file)) return null;
    try {
      const raw = readFileSync(file, "utf8");
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || parsed.id !== groupId)
        return null;
      return parsed;
    } catch {
      return null;
    }
  }

  listGroups() {
    if (!existsSync(this.baseDir)) return [];
    const groups = [];
    let entries;
    try {
      entries = readdirSync(this.baseDir, { withFileTypes: true });
    } catch {
      return [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Only consider UUID-named directories
      if (!UUID_RE.test(entry.name)) continue;
      const file = join(this.baseDir, entry.name, "group.json");
      if (!existsSync(file)) continue;
      const g = this.getGroup(entry.name);
      if (g) groups.push(g);
    }
    return groups;
  }

  postToRoom({ groupId, senderName, content }) {
    assertGroupId(groupId);
    assertMemberId(senderName);
    if (typeof content !== "string")
      throw new Error("content must be a string");
    if (!content.trim()) throw new Error("content must not be empty");
    if (content.length > 4000)
      throw new Error("content must be ≤4000 characters");

    const group = this.getGroup(groupId);
    if (!group) throw new Error(`Group room ${groupId} not found`);
    if (!group.memberIds.includes(senderName)) {
      throw new Error(
        `Sender "${senderName}" is not a member of group "${group.name}"`,
      );
    }

    const msg = {
      id: randomUUID(),
      groupId,
      senderName,
      content,
      timestamp: Date.now(),
    };

    const logFile = join(this.baseDir, groupId, "room.jsonl");
    appendFileSync(logFile, JSON.stringify(msg) + "\n", "utf8");

    // Build fan-out CLI commands for member agents.
    // Every interpolated value is wrapped in POSIX single quotes, which the
    // shell does not expand, so no metacharacter in group.name / senderName /
    // content can break out or trigger command substitution.
    const roomLabel = `[Room: ${group.name}]`;
    const prefix = `${roomLabel} 🤖 ${senderName} (@${senderName}): `;
    const commands = group.memberIds
      .filter((m) => m !== senderName)
      .map((member) => {
        assertMemberId(member);
        const fullText = prefix + content;
        return {
          targetAgent: member,
          cliCommand: `hermes -p ${member} chat --in ~ -c ${q(roomLabel)} -Q -q ${q(fullText)}`,
        };
      });

    return {
      message: msg,
      fanOutCount: commands.length,
      fanOutCommands: commands,
    };
  }
}
