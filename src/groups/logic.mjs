/**
 * Pure group-room logic for the UI layer.
 *
 * Mirrors the validation and fan-out rules from groups.mjs (the file-backed
 * Node library) but without filesystem dependencies, so it runs in the
 * desktop plugin (browser) context and is testable with `node --test`.
 *
 * Storage (plugin storage vs files) is intentionally NOT handled here — the
 * caller (plugin-entry) owns the atom/storage sync. This module only turns
 * validated inputs into group objects and shell-safe fan-out commands.
 */
import { NAME_RE, UUID_RE, shellQuote } from "../../lib/validate.mjs";

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function assertGroupName(name) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Group name is required");
  }
  if (name.length > 64) throw new Error("Group name must be ≤64 characters");
  // Display name — allow spaces/punctuation but forbid control chars and path separators.
  // Shell metacharacters are deliberately NOT filtered; every use site quotes with shellQuote().
  // eslint-disable-next-line no-control-regex -- rejecting control chars is the point
  if (/[\0-\x1f\x7f/\\]/.test(name)) {
    throw new Error("Group name contains invalid characters");
  }
}

export function assertMemberId(id) {
  if (typeof id !== "string" || !NAME_RE.test(id)) {
    throw new Error(`Invalid member id "${id}" — must match ${NAME_RE.source}`);
  }
}

export function assertGroupId(id) {
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    throw new Error(`Invalid group id "${id}"`);
  }
}

export function createGroupMeta({ name, memberIds = [], description = "" }) {
  assertGroupName(name);
  if (!Array.isArray(memberIds)) throw new Error("memberIds must be an array");
  const deduped = [...new Set(memberIds)];
  for (const m of deduped) assertMemberId(m);
  if (typeof description !== "string") throw new Error("description must be a string");
  if (description.length > 500) throw new Error("description must be ≤500 characters");

  const id = randomId();
  return {
    id,
    name: name.trim(),
    description: description.trim(),
    memberIds: deduped,
    createdAt: Date.now(),
    room: [],
  };
}

/**
 * Build fan-out commands for posting `content` to `group` as `senderName`.
 *
 * Returns { message, fanOutCommands } where each command has both a shell-safe
 * `cliCommand` string (for CLI runners) and an `argv` array (for host.request
 * cli.exec, which avoids the shell entirely). Both are derived from the same
 * validated inputs and use shellQuote for the string form.
 */
export function buildFanOut({ group, senderName, content }) {
  if (!group || typeof group !== "object") throw new Error("group is required");
  assertGroupId(group.id);
  assertMemberId(senderName);
  if (typeof content !== "string") throw new Error("content must be a string");
  if (!content.trim()) throw new Error("content must not be empty");
  if (content.length > 4000) throw new Error("content must be ≤4000 characters");
  if (!Array.isArray(group.memberIds) || !group.memberIds.includes(senderName)) {
    throw new Error(`Sender "${senderName}" is not a member of group "${group.name}"`);
  }

  const msg = {
    id: randomId(),
    groupId: group.id,
    senderName,
    content,
    timestamp: Date.now(),
  };

  const roomLabel = `[Room: ${group.name}]`;
  const prefix = `${roomLabel} 🤖 ${senderName} (@${senderName}): `;
  const fullText = prefix + content;

  const fanOutCommands = group.memberIds
    .filter((m) => m !== senderName)
    .map((member) => {
      assertMemberId(member);
      return {
        targetAgent: member,
        // Shell form — for `sh -c` runners. POSIX single-quoted, no expansion.
        cliCommand: `hermes -p ${member} chat --in ~ -c ${shellQuote(roomLabel)} -Q -q ${shellQuote(fullText)}`,
        // Argv form — for host.request("cli.exec", { argv }). No quoting needed.
        argv: ["-p", member, "chat", "--in", "~", "-c", roomLabel, "-Q", "-q", fullText],
      };
    });

  return { message: msg, fanOutCommands };
}
