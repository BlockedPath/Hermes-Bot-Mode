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

const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertGroupName(name) {
  if (typeof name !== "string" || !name.trim())
    throw new Error("Group name is required");
  if (name.length > 64) throw new Error("Group name must be ≤64 characters");
  // Display name — allow spaces/punctuation but forbid control chars and path separators
  if (/[\0\n\r/\\]/.test(name))
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

/** Shell-safe quoting for a CLI argument: JSON.stringify gives a double-quoted, escaped string. */
function q(arg) {
  return JSON.stringify(String(arg));
}

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
    // Every interpolated value is shell-quoted via JSON.stringify so no
    // metacharacter in group.name / senderName / content can break out.
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
