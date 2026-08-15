/**
 * Groups store — plugin storage + in-memory atom.
 *
 * The file-backed GroupManager (groups.mjs) remains for CLI use. This store
 * is the UI counterpart: it persists groups via plugin storage (like bot-meta),
 * hydrates on register, and keeps the room transcript in-memory as `room: []`.
 *
 * File sync is best-effort: when a group is created/updated, we also try to
 * mirror slim meta to the file layer via cli.exec if the host supports it,
 * but the UI does not depend on it.
 */
import { atom } from "@hermes/plugin-sdk";
import { createGroupMeta, buildFanOut } from "./logic.mjs";

export const $groups = atom([]);

/** Hydrate from plugin storage value. */
export function hydrateGroups(value) {
 if (!Array.isArray(value)) return;
 // Basic shape validation — drop malformed entries but keep valid ones.
 const valid = value.filter(
  (g) =>
   g &&
   typeof g === "object" &&
   typeof g.id === "string" &&
   typeof g.name === "string" &&
   Array.isArray(g.memberIds),
 );
 $groups.set(valid);
}

/** Persist to plugin storage. Caller must have pluginCtx available. */
export function persistGroups(pluginCtx, next) {
 $groups.set(next);
 try {
  Promise.resolve(pluginCtx?.storage?.set?.("groups", next)).catch(
   () => undefined,
  );
 } catch {
  /* no storage */
 }
}

export function createGroup({ name, memberIds, description }) {
 const meta = createGroupMeta({ name, memberIds, description });
 const next = [...$groups.get(), meta];
 return { meta, next };
}

export function getGroup(id) {
 return $groups.get().find((g) => g.id === id) || null;
}

export function listGroups() {
 return $groups.get().slice();
}

/**
 * Append a message to the group's room and return fan-out commands.
 * Caller is responsible for persisting via persistGroups if desired.
 */
export function postToGroup({ groupId, senderName, content }) {
 const groups = $groups.get();
 const idx = groups.findIndex((g) => g.id === groupId);
 if (idx === -1) throw new Error(`Group ${groupId} not found`);
 const group = groups[idx];
 const { message, fanOutCommands } = buildFanOut({
  group,
  senderName,
  content,
 });
 const updated = { ...group, room: [...(group.room || []), message] };
 const next = groups.slice();
 next[idx] = updated;
 return { message, fanOutCommands, updated, next };
}
