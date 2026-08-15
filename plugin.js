// GENERATED FILE - DO NOT EDIT.
// Built from src/plugin-entry.mjs by build.mjs (esbuild).
// Edit the source in src/ and run: npm run build


// src/plugin-entry.mjs
import {
  atom as atom2,
  Button as Button2,
  Checkbox,
  cn,
  Codicon as Codicon2,
  COMPOSER_AREAS,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Dialog as Dialog2,
  DialogContent as DialogContent2,
  DialogDescription,
  DialogFooter as DialogFooter2,
  DialogHeader as DialogHeader2,
  DialogTitle as DialogTitle2,
  EmptyState as EmptyState2,
  GlyphSpinner,
  haptic,
  host as host2,
  Input as Input2,
  PALETTE_AREA,
  profileColor,
  queryClient,
  relativeTime,
  ScrollArea as ScrollArea2,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea as Textarea2,
  Tip,
  useQuery,
  useValue as useValue2
} from "@hermes/plugin-sdk";
import { useEffect as useEffect2, useRef, useState as useState2 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";

// src/groups/GroupsSection.mjs
import {
  Button,
  Codicon,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  host,
  Input,
  ScrollArea,
  Textarea,
  useValue
} from "@hermes/plugin-sdk";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

// src/groups/store.mjs
import { atom } from "@hermes/plugin-sdk";

// lib/validate.mjs
var NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function shellQuote(arg) {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}

// src/groups/logic.mjs
function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `grp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function assertGroupName(name) {
  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Group name is required");
  }
  if (name.length > 64) throw new Error("Group name must be ≤64 characters");
  if (/[\0-\x1f\x7f/\\]/.test(name)) {
    throw new Error("Group name contains invalid characters");
  }
}
function assertMemberId(id) {
  if (typeof id !== "string" || !NAME_RE.test(id)) {
    throw new Error(`Invalid member id "${id}" — must match ${NAME_RE.source}`);
  }
}
function assertGroupId(id) {
  if (typeof id !== "string" || !UUID_RE.test(id)) {
    throw new Error(`Invalid group id "${id}"`);
  }
}
function createGroupMeta({ name, memberIds = [], description = "" }) {
  assertGroupName(name);
  if (!Array.isArray(memberIds)) throw new Error("memberIds must be an array");
  const deduped = [...new Set(memberIds)];
  for (const m of deduped) assertMemberId(m);
  if (typeof description !== "string")
    throw new Error("description must be a string");
  if (description.length > 500)
    throw new Error("description must be ≤500 characters");
  const id = randomId();
  return {
    id,
    name: name.trim(),
    description: description.trim(),
    memberIds: deduped,
    createdAt: Date.now(),
    room: []
  };
}
function buildFanOut({
  group,
  senderName,
  content,
  excludeSender = true,
  allowExternalSender = false
}) {
  if (!group || typeof group !== "object") throw new Error("group is required");
  assertGroupId(group.id);
  if (allowExternalSender) {
    if (typeof senderName !== "string" || !senderName.trim())
      throw new Error("senderName is required");
  } else {
    assertMemberId(senderName);
    if (!Array.isArray(group.memberIds) || !group.memberIds.includes(senderName)) {
      throw new Error(
        `Sender "${senderName}" is not a member of group "${group.name}"`
      );
    }
  }
  const msg = {
    id: randomId(),
    groupId: group.id,
    senderName,
    content,
    timestamp: Date.now()
  };
  const roomLabel = `[Room: ${group.name}]`;
  const prefix = `${roomLabel} 🤖 ${senderName} (@${senderName}): `;
  const fullText = prefix + content;
  const fanOutCommands = group.memberIds.filter((m) => excludeSender ? m !== senderName : true).map((member) => {
    assertMemberId(member);
    return {
      targetAgent: member,
      // Shell form — for `sh -c` runners. POSIX single-quoted, no expansion.
      cliCommand: `hermes -p ${member} chat --in ~ -c ${shellQuote(roomLabel)} -Q -q ${shellQuote(fullText)}`,
      // Argv form — for host.request("cli.exec", { argv }). No quoting needed.
      argv: [
        "-p",
        member,
        "chat",
        "--in",
        "~",
        "-c",
        roomLabel,
        "-Q",
        "-q",
        fullText
      ]
    };
  });
  return { message: msg, fanOutCommands };
}

// src/groups/store.mjs
var $groups = atom([]);
function hydrateGroups(value) {
  if (!Array.isArray(value)) return;
  const valid = value.filter(
    (g) => g && typeof g === "object" && typeof g.id === "string" && typeof g.name === "string" && Array.isArray(g.memberIds)
  );
  $groups.set(valid);
}
function persistGroups(pluginCtx2, next) {
  $groups.set(next);
  try {
    Promise.resolve(pluginCtx2?.storage?.set?.("groups", next)).catch(
      () => void 0
    );
  } catch {
  }
}
function createGroup({ name, memberIds, description }) {
  const meta = createGroupMeta({ name, memberIds, description });
  const next = [...$groups.get(), meta];
  return { meta, next };
}
function getGroup(id) {
  return $groups.get().find((g) => g.id === id) || null;
}
function deleteGroup(id) {
  const groups = $groups.get();
  const idx = groups.findIndex((g) => g.id === id);
  if (idx === -1) throw new Error(`Group ${id} not found`);
  const deleted = groups[idx];
  const next = groups.filter((g) => g.id !== id);
  return { deleted, next };
}
function postToGroup({ groupId, senderName, content, excludeSender = true, allowExternalSender = false }) {
  const groups = $groups.get();
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx === -1) throw new Error(`Group ${groupId} not found`);
  const group = groups[idx];
  const { message, fanOutCommands } = buildFanOut({
    group,
    senderName,
    content,
    excludeSender,
    allowExternalSender
  });
  const updated = { ...group, room: [...group.room || [], message] };
  const next = groups.slice();
  next[idx] = updated;
  return { message, fanOutCommands, updated, next };
}

// src/groups/GroupsSection.mjs
var pluginCtxRef = null;
function setGroupsPluginCtx(ctx) {
  pluginCtxRef = ctx;
}
function CreateGroupDialog({ open, onClose, roster }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState({});
  const [error, setError] = useState("");
  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const memberIds = Object.keys(selected).filter((k) => selected[k]);
  const handleCreate = () => {
    setError("");
    try {
      const { meta, next } = createGroup({ name, memberIds, description });
      persistGroups(pluginCtxRef, next);
      host.notify({ kind: "success", message: `Group "${meta.name}" created` });
      setName("");
      setDescription("");
      setSelected({});
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
    }
  };
  return jsx(Dialog, {
    open,
    onOpenChange: (o) => !o && onClose(),
    children: jsx(DialogContent, {
      children: jsxs("div", {
        className: "grid gap-4",
        children: [
          jsx(DialogHeader, {
            children: jsx(DialogTitle, { children: "New Group" })
          }),
          error ? jsx("div", { className: "text-sm text-red-500", children: error }) : null,
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Group name"
              }),
              jsx(Input, {
                value: name,
                onChange: (e) => setName(e.target.value),
                placeholder: "Engineering"
              })
            ]
          }),
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Description (optional)"
              }),
              jsx(Input, {
                value: description,
                onChange: (e) => setDescription(e.target.value),
                placeholder: "Shared channel"
              })
            ]
          }),
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Members"
              }),
              roster.length === 0 ? jsx("div", {
                className: "text-sm text-muted-foreground",
                children: "No agents available"
              }) : jsx(ScrollArea, {
                className: "max-h-40 rounded border p-2",
                children: jsx("div", {
                  className: "grid gap-1",
                  children: roster.map(
                    (bot) => jsxs(
                      "label",
                      {
                        className: "flex items-center gap-2 text-sm",
                        children: [
                          jsx("input", {
                            type: "checkbox",
                            checked: Boolean(selected[bot.name]),
                            onChange: () => toggle(bot.name)
                          }),
                          jsx("span", { children: bot.name }),
                          bot.title ? jsx("span", {
                            className: "text-xs text-muted-foreground",
                            children: `— ${bot.title}`
                          }) : null
                        ]
                      },
                      bot.name
                    )
                  )
                })
              })
            ]
          }),
          jsx(DialogFooter, {
            children: jsxs("div", {
              className: "flex justify-end gap-2",
              children: [
                jsx(Button, {
                  variant: "ghost",
                  onClick: onClose,
                  children: "Cancel"
                }),
                jsx(Button, { onClick: handleCreate, children: "Create" })
              ]
            })
          })
        ]
      })
    })
  });
}
function GroupRow({ group, onPost, onDelete, expandAll }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (expandAll !== void 0) setExpanded(expandAll);
  }, [expandAll]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastMsg = group.room && group.room.length ? group.room[group.room.length - 1] : null;
  const preview = lastMsg ? `${lastMsg.senderName}: ${String(lastMsg.content).slice(0, 60)}` : `${group.memberIds.length} members — no messages yet`;
  const handleSend = async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await onPost(group.id, draft);
      setDraft("");
    } finally {
      setSending(false);
    }
  };
  return jsxs("div", {
    className: "rounded border border-(--ui-stroke-secondary) p-2",
    children: [
      jsxs("button", {
        className: "flex w-full items-center justify-between text-left",
        onClick: () => setExpanded((v) => !v),
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("div", {
                className: "truncate text-sm font-medium",
                children: group.name
              }),
              jsx("div", {
                className: "truncate text-xs text-muted-foreground",
                children: preview
              })
            ]
          }),
          jsx(Codicon, {
            name: expanded ? "chevron-up" : "chevron-down",
            className: "shrink-0 text-muted-foreground"
          })
        ]
      }),
      expanded ? jsxs("div", {
        className: "mt-2 grid gap-2",
        children: [
          jsxs("div", {
            className: "text-xs text-muted-foreground",
            children: ["Members: ", group.memberIds.join(", ")]
          }),
          group.description ? jsx("div", {
            className: "text-xs",
            children: group.description
          }) : null,
          group.room && group.room.length ? jsx(ScrollArea, {
            className: "max-h-32 rounded bg-muted/30 p-2",
            children: jsx("div", {
              className: "grid gap-1",
              children: group.room.slice(-10).map(
                (m) => jsxs(
                  "div",
                  {
                    className: "text-xs",
                    children: [
                      jsx("span", {
                        className: "font-medium",
                        children: `${m.senderName}: `
                      }),
                      jsx("span", { children: m.content })
                    ]
                  },
                  m.id
                )
              )
            })
          }) : jsx("div", {
            className: "text-xs text-muted-foreground",
            children: "No messages yet"
          }),
          jsxs("div", {
            className: "flex gap-2",
            children: [
              jsx(Textarea, {
                value: draft,
                onChange: (e) => setDraft(e.target.value),
                placeholder: "Message group…",
                rows: 2,
                className: "min-h-[60px] flex-1"
              }),
              jsx(Button, {
                onClick: handleSend,
                disabled: sending || !draft.trim(),
                children: sending ? "Sending…" : "Send"
              })
            ]
          }),
          jsxs("div", {
            className: "flex justify-end pt-1",
            children: [
              jsx(Button, {
                variant: "ghost",
                size: "sm",
                className: "text-destructive hover:text-destructive",
                onClick: () => setConfirmDelete(true),
                children: "Delete group"
              })
            ]
          }),
          confirmDelete ? jsx(Dialog, {
            open: true,
            onOpenChange: (o) => !o && setConfirmDelete(false),
            children: jsx(DialogContent, {
              children: jsxs("div", {
                className: "grid gap-4",
                children: [
                  jsx(DialogHeader, {
                    children: jsx(DialogTitle, {
                      children: `Delete "${group.name}"?`
                    })
                  }),
                  jsx("div", {
                    className: "text-sm text-muted-foreground",
                    children: "This will remove the group and its transcript. This cannot be undone."
                  }),
                  jsxs("div", {
                    className: "flex justify-end gap-2",
                    children: [
                      jsx(Button, {
                        variant: "ghost",
                        onClick: () => setConfirmDelete(false),
                        children: "Cancel"
                      }),
                      jsx(Button, {
                        variant: "destructive",
                        onClick: () => {
                          setConfirmDelete(false);
                          onDelete(group.id);
                        },
                        children: "Delete"
                      })
                    ]
                  })
                ]
              })
            })
          }) : null
        ]
      }) : null
    ]
  });
}
function GroupsSection({ roster }) {
  const groups = useValue($groups);
  const [createOpen, setCreateOpen] = useState(false);
  const [expandAll, setExpandAll] = useState(false);
  const handlePost = async (groupId, content) => {
    console.log("[Groups] handlePost called", { groupId, content });
    const active = (host.state.profile.get() || "default").trim() || "default";
    console.log("[Groups] active profile", active);
    const group = getGroup(groupId);
    console.log("[Groups] group", group);
    if (!group) {
      host.notify({ kind: "error", message: "Group not found" });
      return;
    }
    if (group.memberIds.length === 0) {
      host.notify({ kind: "error", message: "Group has no members" });
      return;
    }
    const sender = "You";
    console.log(`[Groups] human sender You -> fan-out to all ${group.memberIds.length} members`, group.memberIds);
    let result;
    try {
      result = postToGroup({
        groupId,
        senderName: sender,
        content,
        excludeSender: false,
        allowExternalSender: true
      });
      console.log("[Groups] postToGroup result", result);
    } catch (e) {
      console.error("[Groups] postToGroup failed", e);
      host.notify({ kind: "error", message: e?.message || String(e) });
      throw e;
    }
    try {
      persistGroups(pluginCtxRef, result.next);
      console.log("[Groups] persisted, new groups", result.next);
    } catch (e) {
      console.error("[Groups] persist failed", e);
    }
    if (result.fanOutCommands.length === 0) {
      console.log("[Groups] no fan-out needed (sole member)");
      host.notify({
        kind: "info",
        message: "Message saved (no other members to notify)"
      });
      return;
    }
    const failures = [];
    const successes = [];
    for (const cmd of result.fanOutCommands) {
      console.log(`[Groups] fan-out to ${cmd.targetAgent}`, {
        argv: cmd.argv,
        cliCommand: cmd.cliCommand
      });
      let ok = false;
      try {
        const res = await host.request("cli.exec", { argv: cmd.argv });
        console.log(
          `[Groups] cli.exec argv result for ${cmd.targetAgent}`,
          res
        );
        if (res && res.code === 0 && !res.blocked) {
          ok = true;
        } else if (res?.output?.includes("No session found")) {
          console.log(
            `[Groups] No session for ${cmd.targetAgent}, retrying without -c`
          );
          const fallbackArgv = cmd.argv.filter(
            (a, idx, arr) => a !== "-c" && arr[idx - 1] !== "-c"
          );
          try {
            const res2 = await host.request("cli.exec", { argv: fallbackArgv });
            console.log(
              `[Groups] fallback without -c for ${cmd.targetAgent}`,
              res2
            );
            if (res2 && res2.code === 0 && !res2.blocked) {
              ok = true;
              const m = res2.output?.match(/session_id:\s*([A-Za-z0-9_-]+)/);
              if (m) {
                const sid = m[1];
                try {
                  const rn = await host.request("cli.exec", {
                    argv: [
                      "-p",
                      cmd.targetAgent,
                      "sessions",
                      "rename",
                      sid,
                      `[Room: ${group.name}]`
                    ]
                  });
                  console.log(
                    `[Groups] renamed ${sid} to [Room: ${group.name}] for ${cmd.targetAgent}`,
                    rn
                  );
                } catch (eRn) {
                  console.warn(
                    `[Groups] rename failed for ${cmd.targetAgent}:`,
                    eRn?.message || eRn
                  );
                }
              }
            } else
              console.warn(
                `[Groups] fallback without -c failed for ${cmd.targetAgent}:`,
                res2
              );
          } catch (errFb) {
            console.warn(
              `[Groups] fallback without -c threw for ${cmd.targetAgent}:`,
              errFb?.message || errFb
            );
          }
          if (!ok) throw new Error(res?.output || `cli.exec code ${res?.code}`);
        } else {
          console.warn(
            `[Groups] cli.exec argv non-zero for ${cmd.targetAgent}:`,
            res
          );
          throw new Error(res?.output || `cli.exec code ${res?.code}`);
        }
      } catch (err) {
        console.warn(
          `[Groups] cli.exec argv failed for ${cmd.targetAgent}:`,
          err?.message || err
        );
        try {
          const res2 = await host.request("cli.exec", {
            argv: ["hermes", ...cmd.argv]
          });
          console.log(
            `[Groups] cli.exec with hermes prefix ok for ${cmd.targetAgent}`,
            res2
          );
          ok = true;
        } catch (err2) {
          console.warn(
            `[Groups] cli.exec with prefix also failed for ${cmd.targetAgent}:`,
            err2?.message || err2
          );
          try {
            if (typeof host.request === "function") {
              const res3 = await host.request("terminal.run", {
                command: cmd.cliCommand,
                background: true
              });
              console.log(
                `[Groups] terminal.run ok for ${cmd.targetAgent}`,
                res3
              );
              ok = true;
            }
          } catch (err3) {
            console.warn(
              `[Groups] terminal.run failed for ${cmd.targetAgent}:`,
              err3?.message || err3
            );
          }
        }
      }
      if (ok) successes.push(cmd.targetAgent);
      else failures.push(cmd.targetAgent);
    }
    console.log("[Groups] fan-out done", { successes, failures });
    if (failures.length === 0) {
      host.notify({
        kind: "success",
        message: `Sent to ${successes.length} members`
      });
    } else if (successes.length > 0) {
      host.notify({
        kind: "info",
        message: `Sent to ${successes.join(", ")}, but ${failures.join(", ")} failed. Check console for cliCommand.`
      });
      console.log(
        "[Groups] failed commands",
        result.fanOutCommands.filter((c) => failures.includes(c.targetAgent)).map((c) => c.cliCommand)
      );
    } else {
      host.notify({
        kind: "error",
        message: `Fan-out failed for ${failures.join(", ")}. Copied command to console.`
      });
      console.log(
        "[Groups] all fan-out failed, commands:",
        result.fanOutCommands.map((c) => c.cliCommand).join("\n")
      );
      try {
        host.notify({
          kind: "info",
          message: result.fanOutCommands[0]?.cliCommand || "No command"
        });
      } catch (_e) {
        void _e;
      }
    }
  };
  const handleDelete = (groupId) => {
    try {
      const { deleted, next } = deleteGroup(groupId);
      persistGroups(pluginCtxRef, next);
      host.notify({
        kind: "success",
        message: `Group "${deleted.name}" deleted`
      });
      console.log("[Groups] deleted", deleted);
    } catch (e) {
      console.error("[Groups] delete failed", e);
      host.notify({ kind: "error", message: e?.message || String(e) });
    }
  };
  return jsxs("div", {
    className: "border-t border-(--ui-stroke-secondary) p-2",
    children: [
      jsxs("div", {
        className: "mb-2 flex items-center justify-between",
        children: [
          jsxs("div", {
            className: "text-sm font-semibold",
            children: ["Groups", groups.length ? ` (${groups.length})` : ""]
          }),
          jsxs("div", {
            className: "flex items-center gap-1",
            children: [
              groups.length > 1 ? jsx(Button, {
                variant: "ghost",
                size: "sm",
                onClick: () => setExpandAll((v) => !v),
                children: expandAll ? "Collapse all" : "Expand all"
              }) : null,
              jsx(Button, {
                variant: "ghost",
                size: "sm",
                onClick: () => setCreateOpen(true),
                children: jsxs("span", {
                  className: "flex items-center gap-1",
                  children: [jsx(Codicon, { name: "add" }), "New Group"]
                })
              })
            ]
          })
        ]
      }),
      groups.length === 0 ? jsx(EmptyState, {
        icon: "organization",
        title: "No groups yet",
        description: "Create a group to message multiple agents at once."
      }) : jsx("div", {
        className: "grid gap-2",
        children: groups.map(
          (g) => jsx(
            GroupRow,
            {
              group: g,
              onPost: handlePost,
              onDelete: handleDelete,
              expandAll
            },
            g.id
          )
        )
      }),
      jsx(CreateGroupDialog, {
        open: createOpen,
        onClose: () => setCreateOpen(false),
        roster
      })
    ]
  });
}

// src/plugin-entry.mjs
var ID = "hermes-bots";
var ROSTER_KEY = [ID, "roster"];
var ROUTINES_KEY = [ID, "routines"];
var NAME_RE2 = /^[a-z0-9][a-z0-9_-]{0,63}$/;
function shellQuote2(arg) {
  return `'${String(arg).replace(/'/g, `'\\''`)}'`;
}
function sanitizeTitle(title, max = 80) {
  return String(title || "").replace(/[\0-\x1f\x7f"'`$\\]/g, "").slice(0, max).trim();
}
var pluginCtx = null;
var $lastRoster = atom2([]);
var $botUnread = atom2({});
var rosterWatermarks = /* @__PURE__ */ new Map();
var watermarksSeeded = false;
function resetWatermarks() {
  rosterWatermarks.clear();
  watermarksSeeded = false;
}
function trackInboundActivity(roster) {
  const seeding = !watermarksSeeded;
  watermarksSeeded = true;
  for (const bot of roster) {
    const ts = bot.last_session?.last_active || 0;
    const prev = rosterWatermarks.get(bot.name) || 0;
    rosterWatermarks.set(bot.name, Math.max(prev, ts));
    if (seeding || ts <= prev) {
      continue;
    }
    if ($selectedBot.get() === bot.name) {
      continue;
    }
    const meta = $botMeta.get()[bot.name];
    const label = displayName(bot, meta);
    const preview = (bot.last_session?.preview || "").trim();
    const inbound = /^Message from/i.test(preview);
    $botUnread.set({ ...$botUnread.get(), [bot.name]: true });
    host2.notify({
      kind: "info",
      title: inbound ? `🤖 New message for ${label}` : `${label} has new activity`,
      message: preview.slice(0, 140) || "Open the chat to see it."
    });
  }
}
var $selectedBot = atom2("default");
var $botMeta = atom2({});
function migrateChatPin(entry) {
  if (!entry || typeof entry !== "object") return entry;
  if (!entry.chat_pin) return entry;
  const next = { ...entry };
  if (!next.chat) next.chat = next.chat_pin;
  delete next.chat_pin;
  return next;
}
function saveBotMeta(name, patch) {
  const base = $botMeta.get()[name] || {};
  const merged = { ...base, ...patch };
  const migrated = migrateChatPin(merged);
  const next = { ...$botMeta.get(), [name]: migrated };
  $botMeta.set(next);
  try {
    Promise.resolve(pluginCtx?.storage?.set?.("bot-meta", next)).catch(
      () => void 0
    );
  } catch {
  }
  try {
    const { image, pet, ...rest } = next[name] || {};
    host2.request("profiles.configure", { name, ui_meta: { "hermes-bots": rest } }).catch(() => void 0);
  } catch {
  }
  if ("image" in patch) {
    try {
      const req = patch.image ? host2.request("profiles.set_asset", {
        name,
        asset: "avatar",
        data: patch.image
      }) : host2.request("profiles.set_asset", {
        name,
        asset: "avatar",
        clear: true
      });
      req.catch(() => void 0);
    } catch {
    }
  }
}
var avatarFetchInflight = /* @__PURE__ */ new Set();
var avatarPushInflight = /* @__PURE__ */ new Set();
function pushLocalAvatars(roster) {
  for (const bot of roster) {
    if (bot.has_avatar || avatarPushInflight.has(bot.name)) {
      continue;
    }
    const image = $botMeta.get()[bot.name]?.image;
    if (image && typeof image === "string" && image.startsWith("data:")) {
      avatarPushInflight.add(bot.name);
      host2.request("profiles.set_asset", {
        name: bot.name,
        asset: "avatar",
        data: image
      }).then(
        () => queryClient.invalidateQueries({
          queryKey: ["hermes-bots", "roster"]
        })
      ).catch(() => avatarPushInflight.delete(bot.name));
      continue;
    }
    const svg = document.querySelector(
      "svg[data-bot-face=" + JSON.stringify(bot.name) + "]"
    );
    if (!svg) {
      continue;
    }
    avatarPushInflight.add(bot.name);
    rasterizeSvgToPng(svg, 160).then(
      (png) => png ? host2.request("profiles.set_asset", {
        name: bot.name,
        asset: "avatar",
        data: png
      }).then(
        () => queryClient.invalidateQueries({
          queryKey: ["hermes-bots", "roster"]
        })
      ) : Promise.reject(new Error("rasterize failed"))
    ).catch(() => avatarPushInflight.delete(bot.name));
  }
}
function rasterizeSvgToPng(svgEl, size) {
  return new Promise((resolve) => {
    try {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(size));
      clone.setAttribute("height", String(size));
      const markup = new XMLSerializer().serializeToString(clone);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(markup);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          canvas.getContext("2d").drawImage(img, 0, 0, size, size);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}
function pullServerAvatars(roster) {
  pushLocalAvatars(roster);
  for (const bot of roster) {
    if (!bot.has_avatar || avatarFetchInflight.has(bot.name)) {
      continue;
    }
    if ($botMeta.get()[bot.name]?.image) {
      continue;
    }
    avatarFetchInflight.add(bot.name);
    host2.request("profiles.get_asset", { name: bot.name, asset: "avatar" }).then((res) => {
      if (res?.found && res.data) {
        const current = $botMeta.get();
        $botMeta.set({
          ...current,
          [bot.name]: { ...current[bot.name] || {}, image: res.data }
        });
        try {
          Promise.resolve(
            pluginCtx?.storage?.set?.("bot-meta", $botMeta.get())
          ).catch(() => void 0);
        } catch {
        }
      }
    }).catch(() => void 0).finally(() => avatarFetchInflight.delete(bot.name));
  }
}
function mergeServerMeta(roster) {
  const local = $botMeta.get();
  let changed = false;
  const next = { ...local };
  for (const bot of roster) {
    const rawServer = bot.ui_meta?.["hermes-bots"];
    if (rawServer && typeof rawServer === "object") {
      const server = migrateChatPin(rawServer);
      const mine = next[bot.name] || {};
      const mergedRaw = { ...mine, ...server };
      const merged = migrateChatPin(mergedRaw);
      if (mine.image) {
        merged.image = mine.image;
      }
      if (JSON.stringify(next[bot.name] || null) !== JSON.stringify(merged)) {
        next[bot.name] = merged;
        changed = true;
      }
    }
  }
  if (changed) {
    $botMeta.set(next);
  }
}
async function duplicateBot(bot, roster) {
  const base = bot.name;
  let name = null;
  for (let n = 2; n < 100; n++) {
    const suffix = `-${n}`;
    const candidate = base.slice(0, 64 - suffix.length) + suffix;
    if (!roster.some((b) => b.name === candidate)) {
      name = candidate;
      break;
    }
  }
  if (!name) {
    throw new Error("No free name for the duplicate.");
  }
  await host2.request("profiles.create", {
    name,
    clone_from: base,
    description: bot.description || ""
  });
  const meta = $botMeta.get()[base];
  if (meta) {
    saveBotMeta(name, {
      ...meta,
      title: meta.title ? `${meta.title} (copy)` : ""
    });
  }
  return name;
}
if (typeof document !== "undefined" && !document.getElementById("hermes-bots-roster-css")) {
  const style = document.createElement("style");
  style.id = "hermes-bots-roster-css";
  style.textContent = ".hermes-bots-roster [data-radix-scroll-area-viewport] > div { display: block !important; width: 100%; min-width: 0; }";
  document.head.appendChild(style);
}
var AVATAR_SHAPES = [
  "circle",
  "squircle",
  "pill",
  "triangle",
  "hexagon",
  "cloud",
  "drop"
];
function sigilRng(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0 || 88675123;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}
function sigilGeometry(name, seed) {
  const rng = sigilRng(`${name}::${seed}`);
  const gx = (i) => 6 + i * 7;
  const gy = (j) => 8 + j * 6;
  const strokes = [];
  const segments = 4 + Math.floor(rng() * 3);
  for (let k = 0; k < segments; k++) {
    const x1 = Math.floor(rng() * 3);
    const y1 = Math.floor(rng() * 5);
    const x2 = Math.min(2, Math.max(0, x1 + (rng() > 0.5 ? 1 : -1)));
    const y2 = Math.min(4, Math.max(0, y1 + Math.floor(rng() * 3) - 1));
    strokes.push(`M${gx(x1)} ${gy(y1)} L${gx(x2)} ${gy(y2)}`);
    strokes.push(`M${gx(4 - x1)} ${gy(y1)} L${gx(4 - x2)} ${gy(y2)}`);
    if (rng() > 0.6) {
      strokes.push(`M${gx(x2)} ${gy(y2)} L${gx(4 - x2)} ${gy(y2)}`);
    }
  }
  strokes.push(`M20 ${gy(0)} L20 ${gy(4)}`);
  const ring = rng() > 0.45 ? "M20 4 L36 20 L20 36 L4 20 Z" : null;
  return { strokes: strokes.join(" "), ring };
}
var AVATAR_COLORS = [
  "#f5f5f4",
  // white
  "#8d6748",
  // brown
  "#ef4444",
  // red
  "#f97316",
  // orange
  "#14b8a6",
  // teal
  "#38bdf8",
  // cyan
  "#3b40c8",
  // royal blue
  "#8b5cf6",
  // violet
  "#ec4899",
  // magenta
  "#9ca3af"
  // silver
];
function isDarkColor(hex) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16 & 255;
    const g = n >> 8 & 255;
    const b = n & 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
  } catch {
    return false;
  }
}
function defaultShapeFor(name) {
  let hash = 0;
  for (const ch of name) {
    hash = hash * 31 + ch.charCodeAt(0) >>> 0;
  }
  return AVATAR_SHAPES[hash % AVATAR_SHAPES.length];
}
function shapeNode(shape, color, botName = "agent") {
  if (shape.startsWith("sigil-")) {
    const seed = Number(shape.slice(6)) || 0;
    const { strokes, ring } = sigilGeometry(botName, seed);
    const sw = {
      fill: "none",
      stroke: color,
      strokeWidth: 2.2,
      strokeLinecap: "round",
      strokeLinejoin: "round"
    };
    return jsxs2("g", {
      children: [
        ring ? jsx2("path", {
          d: ring,
          fill: "none",
          stroke: color,
          strokeWidth: 1.2,
          opacity: 0.5
        }) : null,
        jsx2("path", { d: strokes, ...sw })
      ]
    });
  }
  const stroke = {
    fill: color,
    stroke: color,
    strokeWidth: 7,
    strokeLinejoin: "round"
  };
  const edge = {
    fill: "none",
    stroke: "rgba(0,0,0,0.4)",
    strokeWidth: 1.4,
    strokeLinejoin: "round",
    strokeLinecap: "round"
  };
  const face = {
    fill: color,
    stroke: "rgba(0,0,0,0.4)",
    strokeWidth: 1.4,
    strokeLinejoin: "round"
  };
  switch (shape) {
    // ── platonic solids ──
    case "tetrahedron":
      return jsxs2("g", {
        children: [
          jsx2("path", { d: "M20 5 L36 33 L4 33 Z", ...face }),
          jsx2("path", {
            d: "M20 5 L20 25 M4 33 L20 25 M36 33 L20 25",
            ...edge
          })
        ]
      });
    case "cube":
      return jsxs2("g", {
        children: [
          jsx2("path", {
            d: "M20 4 L33 11 L33 29 L20 36 L7 29 L7 11 Z",
            ...face
          }),
          jsx2("path", { d: "M7 11 L20 18 L33 11 M20 18 L20 36", ...edge })
        ]
      });
    case "octahedron":
      return jsxs2("g", {
        children: [
          jsx2("path", { d: "M20 3 L36 20 L20 37 L4 20 Z", ...face }),
          jsx2("path", { d: "M4 20 L36 20 M20 3 L20 37", ...edge })
        ]
      });
    case "dodecahedron":
      return jsxs2("g", {
        children: [
          jsx2("path", {
            d: "M20 3 L30 6.2 L36.2 14.7 L36.2 25.3 L30 33.8 L20 37 L10 33.8 L3.8 25.3 L3.8 14.7 L10 6.2 Z",
            ...face
          }),
          jsx2("path", {
            d: "M20 12 L27.6 17.5 L24.7 26.5 L15.3 26.5 L12.4 17.5 Z M20 12 L20 3 M27.6 17.5 L36.2 14.7 M24.7 26.5 L30 33.8 M15.3 26.5 L10 33.8 M12.4 17.5 L3.8 14.7",
            ...edge
          })
        ]
      });
    case "icosahedron":
      return jsxs2("g", {
        children: [
          jsx2("path", {
            d: "M20 3 L34.7 11.5 L34.7 28.5 L20 37 L5.3 28.5 L5.3 11.5 Z",
            ...face
          }),
          jsx2("path", {
            d: "M20 11 L27.8 24.5 L12.2 24.5 Z M20 11 L20 3 M20 11 L34.7 11.5 M20 11 L5.3 11.5 M27.8 24.5 L34.7 11.5 M27.8 24.5 L34.7 28.5 M27.8 24.5 L20 37 M12.2 24.5 L5.3 11.5 M12.2 24.5 L5.3 28.5 M12.2 24.5 L20 37",
            ...edge
          })
        ]
      });
    // ── legacy flat shapes (stored picks from earlier versions) ──
    case "squircle":
      return jsx2("rect", {
        x: 3,
        y: 3,
        width: 34,
        height: 34,
        rx: 11,
        fill: color
      });
    case "pill":
      return jsx2("rect", {
        x: 2,
        y: 7,
        width: 36,
        height: 26,
        rx: 13,
        fill: color
      });
    case "triangle":
      return jsx2("path", { d: "M20 5.5 L36 33.5 L4 33.5 Z", ...stroke });
    case "hexagon":
      return jsx2("path", {
        d: "M20 3.5 L34.5 11.75 L34.5 28.25 L20 36.5 L5.5 28.25 L5.5 11.75 Z",
        ...stroke
      });
    case "cloud":
      return jsx2("path", {
        d: "M11 32 a7.5 7.5 0 0 1 -1 -14.9 A9.5 9.5 0 0 1 29 12.5 A7 7 0 0 1 30 32 Z",
        fill: color
      });
    case "drop":
      return jsx2("path", {
        d: "M20 3 C20 3 6 20 6 27 a14 13.5 0 0 0 28 0 C34 20 20 3 20 3 Z",
        fill: color
      });
    default:
      return jsx2("circle", { cx: 20, cy: 20, r: 17.5, fill: color });
  }
}
var EYE_Y = {
  // solids: eyes sit on the upper face region, clear of the busiest edges
  tetrahedron: 26,
  cube: 22.5,
  octahedron: 14.5,
  dodecahedron: 20,
  icosahedron: 17.5,
  // legacy
  circle: 17,
  squircle: 17,
  pill: 20,
  triangle: 25,
  hexagon: 17,
  cloud: 22,
  drop: 24
};
var EYE_X = {
  tetrahedron: [16.5, 23.5],
  cube: [15, 25],
  octahedron: [16, 24],
  dodecahedron: [16.5, 23.5],
  icosahedron: [16.5, 23.5]
};
function BotFace({
  shape,
  color,
  image,
  size = 36,
  name = "agent",
  mood = "idle"
}) {
  const [blink, setBlink] = useState2(false);
  const [scanX, setScanX] = useState2(0);
  useEffect2(() => {
    if (mood === "work") {
      let dir = 1;
      let x = 0;
      const t = setInterval(() => {
        x += dir;
        if (x >= 2 || x <= -2) {
          dir = -dir;
        }
        setScanX(x);
      }, 180);
      return () => clearInterval(t);
    }
    if (mood === "idle") {
      let closeTimer = null;
      const schedule = () => {
        closeTimer = setTimeout(
          () => {
            setBlink(true);
            setTimeout(() => {
              setBlink(false);
              schedule();
            }, 120);
          },
          3e3 + Math.random() * 4e3
        );
      };
      schedule();
      return () => clearTimeout(closeTimer);
    }
    return void 0;
  }, [mood]);
  if (image) {
    return jsx2("img", {
      src: image,
      alt: "",
      "aria-hidden": true,
      style: {
        width: size,
        height: size,
        borderRadius: "22%",
        objectFit: "cover",
        display: "block"
      }
    });
  }
  const isSigil = shape.startsWith("sigil-");
  const eyeY = isSigil ? 14 : EYE_Y[shape] ?? 17;
  const [eyeL, eyeR] = isSigil ? [16, 24] : EYE_X[shape] ?? [15.5, 24.5];
  const eyeFill = isSigil ? color : isDarkColor(color) ? "rgba(232,220,195,0.95)" : "rgba(0,0,0,0.85)";
  const eyes = mood === "error" ? jsx2("path", {
    d: `M${eyeL - 2} ${eyeY - 2} L${eyeL + 2} ${eyeY + 2} M${eyeL + 2} ${eyeY - 2} L${eyeL - 2} ${eyeY + 2} M${eyeR - 2} ${eyeY - 2} L${eyeR + 2} ${eyeY + 2} M${eyeR + 2} ${eyeY - 2} L${eyeR - 2} ${eyeY + 2}`,
    stroke: eyeFill,
    strokeWidth: 1.6,
    strokeLinecap: "round",
    fill: "none"
  }) : blink ? jsx2("path", {
    d: `M${eyeL - 2.2} ${eyeY} L${eyeL + 2.2} ${eyeY} M${eyeR - 2.2} ${eyeY} L${eyeR + 2.2} ${eyeY}`,
    stroke: eyeFill,
    strokeWidth: 1.8,
    strokeLinecap: "round",
    fill: "none"
  }) : jsxs2("g", {
    children: [
      jsx2("circle", {
        cx: eyeL + scanX,
        cy: eyeY,
        r: 2.4,
        fill: eyeFill
      }),
      jsx2("circle", {
        cx: eyeR + scanX,
        cy: eyeY,
        r: 2.4,
        fill: eyeFill
      })
    ]
  });
  return jsxs2("svg", {
    "data-bot-face": name,
    viewBox: "0 0 40 40",
    width: size,
    height: size,
    "aria-hidden": true,
    children: [shapeNode(shape, color, name), eyes]
  });
}
async function mcpRpc(method, params) {
  try {
    const res = await host2.request(method, params);
    return { ok: true, result: res };
  } catch (err) {
    const msg = String(err && err.message || err || "");
    if (/unknown method/i.test(msg)) {
      return { ok: false, unsupported: true };
    }
    return { ok: false, error: msg };
  }
}
var _mcpRpcSupported = null;
async function mcpSetupSupported() {
  if (_mcpRpcSupported !== null) {
    return _mcpRpcSupported;
  }
  const r = await mcpRpc("mcp.servers.list", {});
  _mcpRpcSupported = !(r.ok === false && r.unsupported);
  return _mcpRpcSupported;
}
function McpSetupButton({ profile, entry, onDone }) {
  const [phase, setPhase] = useState2("idle");
  const [supported, setSupported] = useState2(null);
  const [keyValues, setKeyValues] = useState2({});
  const [message, setMessage] = useState2("");
  const pollRef = useRef(null);
  useEffect2(() => {
    let alive = true;
    mcpSetupSupported().then((ok) => {
      if (alive) setSupported(ok);
    });
    return () => {
      alive = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);
  const isOAuth = (entry.auth || "").toLowerCase() === "oauth";
  const requires = entry.requires || [];
  const beginKeys = async () => {
    setPhase("busy");
    setMessage("");
    if (entry.fromCatalog && !entry.installed) {
      const add = await mcpRpc("mcp.servers.add", {
        profile,
        name: entry.name,
        preset: entry.name
      });
      if (!add.ok) {
        setPhase("error");
        setMessage(add.error || "Could not add server");
        return;
      }
    }
    setPhase(isOAuth ? "oauth" : "keys");
  };
  const submitKeys = async () => {
    setPhase("busy");
    for (const k of requires) {
      const val = (keyValues[k] || "").trim();
      if (!val) {
        continue;
      }
      const r = await mcpRpc("mcp.servers.set_api_key", {
        profile,
        name: entry.name,
        env_var: k,
        value: val
      });
      if (!r.ok) {
        setPhase("error");
        setMessage(r.error || "Failed to set " + k);
        return;
      }
    }
    const t = await mcpRpc("mcp.servers.test", { profile, name: entry.name });
    if (t.ok && t.result && (t.result.ok || t.result.result && t.result.result.ok)) {
      setPhase("done");
      host2.notify({ kind: "success", message: entry.name + " configured" });
      onDone && onDone();
    } else {
      setPhase("error");
      setMessage(
        t.result && (t.result.error || t.result.result && t.result.result.error) || "Server test failed after setup"
      );
    }
  };
  const beginOAuth = async () => {
    setPhase("busy");
    setMessage("");
    if (entry.fromCatalog && !entry.installed) {
      const add = await mcpRpc("mcp.servers.add", {
        profile,
        name: entry.name,
        preset: entry.name
      });
      if (!add.ok) {
        setPhase("error");
        setMessage(add.error || "Could not add server");
        return;
      }
    }
    const start = await mcpRpc("mcp.servers.oauth.start", {
      profile,
      name: entry.name
    });
    const payload = start.result && (start.result.result || start.result);
    const authUrl = payload && (payload.auth_url || payload.verification_url);
    const sessionId = payload && payload.session_id;
    if (!start.ok || !authUrl || !sessionId) {
      setPhase("error");
      setMessage(start.error || "Could not start OAuth");
      return;
    }
    let safeAuthUrl = null;
    try {
      const parsed = new URL(String(authUrl));
      if (parsed.protocol === "https:") safeAuthUrl = parsed.toString();
    } catch {
    }
    if (!safeAuthUrl) {
      setPhase("error");
      setMessage("OAuth returned an invalid auth URL");
      return;
    }
    try {
      if (host2.openExternal) {
        host2.openExternal(safeAuthUrl);
      } else if (typeof window !== "undefined" && window.hermesDesktop && window.hermesDesktop.openExternal) {
        window.hermesDesktop.openExternal(safeAuthUrl);
      } else {
        host2.notify({
          kind: "info",
          message: `Open this URL to authenticate: ${safeAuthUrl}`
        });
      }
    } catch {
    }
    setPhase("oauth");
    setMessage("Complete sign-in in your browser...");
    pollRef.current = setInterval(async () => {
      const poll = await mcpRpc("mcp.servers.oauth.poll", {
        profile,
        name: entry.name,
        session_id: sessionId
      });
      const pd = poll.result && (poll.result.result || poll.result);
      const status = pd && pd.status;
      if (status === "approved") {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPhase("done");
        host2.notify({
          kind: "success",
          message: entry.name + " authenticated"
        });
        onDone && onDone();
      } else if (status === "error") {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setPhase("error");
        setMessage(pd && pd.error_message || "OAuth failed");
      }
    }, 2e3);
  };
  if (supported === false) {
    return jsx2("span", {
      className: "ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)",
      children: "needs setup (" + requires.join(", ") + ") — restart the gateway to enable in-app setup"
    });
  }
  if (phase === "done") {
    return jsx2("span", {
      className: "ml-1.5 text-[0.65rem] text-(--ui-success,#22c55e)",
      children: "set up ✓"
    });
  }
  if (phase === "keys") {
    return jsxs2("div", {
      className: "mt-1 grid gap-1",
      children: [
        ...requires.map(
          (k) => jsx2(
            Input2,
            {
              key: k,
              type: "password",
              className: "h-6 text-[0.7rem]",
              placeholder: k,
              value: keyValues[k] || "",
              onChange: (e) => setKeyValues((prev) => ({ ...prev, [k]: e.target.value }))
            },
            k
          )
        ),
        jsxs2("div", {
          className: "flex gap-1",
          children: [
            jsx2(Button2, {
              size: "xs",
              variant: "secondary",
              onClick: () => void submitKeys(),
              children: "Save & test"
            }),
            jsx2(Button2, {
              size: "xs",
              variant: "ghost",
              onClick: () => setPhase("idle"),
              children: "Cancel"
            })
          ]
        })
      ]
    });
  }
  if (phase === "oauth") {
    return jsx2("span", {
      className: "ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)",
      children: message || "Authorizing…"
    });
  }
  if (phase === "busy") {
    return jsx2("span", {
      className: "ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)",
      children: "Working…"
    });
  }
  if (phase === "error") {
    return jsxs2("span", {
      className: "ml-1.5 text-[0.65rem] text-(--ui-danger,#ef4444)",
      children: [
        (message || "Setup failed") + " ",
        jsx2("button", {
          className: "underline",
          onClick: () => setPhase("idle"),
          children: "retry"
        })
      ]
    });
  }
  return jsx2("button", {
    className: "ml-1.5 text-[0.65rem] text-(--ui-accent,#4f9cf9) underline",
    onClick: () => void (isOAuth ? beginOAuth() : beginKeys()),
    children: isOAuth ? "Sign in…" : "Set up…"
  });
}
function botAppearance(name, meta) {
  const isPrimary = (name || "").trim().toLowerCase() === "default";
  const userCustomized = Boolean(meta?.custom);
  if (isPrimary && !userCustomized) {
    return { shape: "squircle", color: "#8b5cf6", image: meta?.image || null };
  }
  return {
    shape: meta?.shape || defaultShapeFor(name),
    color: meta?.color || profileColor(name),
    image: meta?.image || null
  };
}
function normalizeAvatarImage(dataUrl, edge = 256) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = edge;
        canvas.height = edge;
        const ctx2d = canvas.getContext("2d");
        const side = Math.min(img.width, img.height);
        ctx2d.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          edge,
          edge
        );
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
function pickImageFromDevice() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        return resolve(null);
      }
      if (file.size > 15e6) {
        host2.notify({ kind: "error", message: "Image too large (max 15MB)." });
        return resolve(null);
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
var $imagenAvailable = atom2(null);
var imagenProbeInflight = null;
function probeImagen() {
  if (imagenProbeInflight) {
    return imagenProbeInflight;
  }
  imagenProbeInflight = host2.request("image.generate", { probe: true }).then((res) => $imagenAvailable.set(Boolean(res?.available))).catch(() => $imagenAvailable.set(false)).finally(() => {
    imagenProbeInflight = null;
  });
  return imagenProbeInflight;
}
async function generateAvatarImage(bot, title, description) {
  const who = [title || bot, description].filter(Boolean).join(" — ");
  const res = await host2.request("image.generate", {
    prompt: `Cute minimal robot avatar for an AI agent named "${who}". Friendly simple mascot face, bold flat vector style, solid color background, centered, no text.`,
    aspect_ratio: "square"
  });
  if (!res?.success) {
    throw new Error(res?.error || "generation failed");
  }
  return res.image_data || res.image;
}
function AvatarPicker({
  shape,
  color,
  image,
  onShape,
  onColor,
  onImage,
  generateSeed
}) {
  const pickerName = generateSeed?.name || "agent";
  const imagen = useValue2($imagenAvailable);
  const [tab, setTab] = useState2("bot");
  const [describe, setDescribe] = useState2("");
  const [genBusy, setGenBusy] = useState2(false);
  useEffect2(() => {
    if (imagen === null) void probeImagen();
  }, [imagen]);
  const goTab = (id) => {
    setTab(id);
    if (id === "generate" && $imagenAvailable.get() === false) {
      $imagenAvailable.set(null);
      void probeImagen();
    }
  };
  const upload = async () => {
    const raw = await pickImageFromDevice();
    if (raw) {
      onImage(await normalizeAvatarImage(raw));
    }
  };
  const generate = async () => {
    if (genBusy) {
      return;
    }
    setGenBusy(true);
    try {
      const custom = describe.trim();
      const img = custom ? await (async () => {
        const res = await host2.request("image.generate", {
          prompt: `${custom}. Avatar for an AI agent: centered, bold flat vector style, solid color background, no text.`,
          aspect_ratio: "square"
        });
        if (!res?.success) {
          throw new Error(res?.error || "generation failed");
        }
        return res.image_data || res.image;
      })() : await generateAvatarImage(
        generateSeed?.name || "agent",
        generateSeed?.title,
        generateSeed?.description
      );
      if (img) {
        onImage(await normalizeAvatarImage(img));
      }
    } catch (err) {
      host2.notifyError(err, "Avatar generation failed");
    } finally {
      setGenBusy(false);
    }
  };
  const tabButton = (id, label) => jsx2(
    "button",
    {
      type: "button",
      className: cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors",
        tab === id ? "bg-(--chrome-action-hover) text-foreground" : "text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)"
      ),
      onClick: () => goTab(id),
      children: label
    },
    id
  );
  return jsxs2("div", {
    className: "grid justify-items-center gap-3",
    children: [
      // Tab pills: Bot | Generate | Upload | Pet
      jsxs2("div", {
        className: "flex items-center gap-1",
        children: [
          tabButton("bot", "Bot"),
          tabButton("generate", "Generate"),
          tabButton("upload", "Upload"),
          tabButton("pet", "Pet")
        ]
      }),
      image && tab !== "generate" ? jsx2(Button2, {
        type: "button",
        variant: "ghost",
        size: "sm",
        onClick: () => onImage(null),
        children: "Remove image — use shape"
      }) : null,
      tab === "bot" ? jsxs2("div", {
        className: "grid justify-items-center gap-3",
        children: [
          jsx2("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "6px",
              justifyItems: "center"
            },
            children: AVATAR_SHAPES.map(
              (s) => jsx2(
                "button",
                {
                  type: "button",
                  className: cn(
                    "flex items-center justify-center rounded-md transition-colors hover:bg-(--chrome-action-hover)",
                    s === shape && !image && "ring-1 ring-(--ui-accent)"
                  ),
                  style: { width: 44, height: 44 },
                  onClick: () => {
                    onImage(null);
                    onShape(s);
                  },
                  children: jsx2(BotFace, {
                    shape: s,
                    color,
                    size: 32,
                    name: pickerName
                  })
                },
                s
              )
            )
          }),
          jsx2("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "8px",
              justifyItems: "center"
            },
            children: AVATAR_COLORS.map(
              (c) => jsx2(
                "button",
                {
                  type: "button",
                  className: cn(
                    "rounded-full transition-transform hover:scale-110",
                    c === color && "ring-2 ring-(--ui-accent) ring-offset-1 ring-offset-(--ui-bg, transparent)"
                  ),
                  style: { width: 22, height: 22, backgroundColor: c },
                  onClick: () => onColor(c)
                },
                c
              )
            )
          })
        ]
      }) : null,
      tab === "generate" ? imagen ? jsxs2("div", {
        className: "grid w-full gap-2",
        children: [
          jsx2(Textarea2, {
            className: "min-h-16 text-xs",
            placeholder: "Describe your avatar…",
            value: describe,
            onChange: (event) => setDescribe(event.target.value)
          }),
          jsxs2(Button2, {
            type: "button",
            variant: "secondary",
            className: "w-full justify-center",
            disabled: genBusy,
            onClick: generate,
            children: [
              genBusy ? jsx2(GlyphSpinner, {
                spinner: "breathe",
                className: "mr-1 text-[0.8rem]"
              }) : jsx2(Codicon2, {
                name: "sparkle",
                className: "mr-1 text-[0.8rem]"
              }),
              genBusy ? "Generating…" : "Generate"
            ]
          }),
          describe.trim() ? null : jsx2("div", {
            className: "text-center text-[0.65rem] text-(--ui-text-quaternary)",
            children: "Leave blank to generate from the agent’s name and description."
          })
        ]
      }) : jsx2("div", {
        className: "px-2 py-3 text-center text-xs leading-5 text-(--ui-text-tertiary)",
        children: imagen === false ? 'No image model available. If you just enabled one (or updated Hermes), restart the gateway: Ctrl+K → "Restart gateway".' : "Checking image backend…"
      }) : null,
      tab === "upload" ? jsxs2(Button2, {
        type: "button",
        variant: "secondary",
        className: "w-full justify-center",
        onClick: upload,
        children: [
          jsx2(Codicon2, {
            name: "device-camera",
            className: "mr-1 text-[0.8rem]"
          }),
          "Choose an image…"
        ]
      }) : null,
      tab === "pet" ? jsx2(PetTab, { image, onImage }) : null
    ]
  });
}
var PET_FRAME_W = 192;
var PET_FRAME_H = 208;
var petFrameCache = /* @__PURE__ */ new Map();
var petFetchActive = 0;
var petFetchQueue = [];
function pumpPetQueue() {
  while (petFetchActive < 4 && petFetchQueue.length) {
    const job = petFetchQueue.shift();
    petFetchActive++;
    job().finally(() => {
      petFetchActive--;
      pumpPetQueue();
    });
  }
}
function petFrameIcon(spriteUrl) {
  if (!spriteUrl) {
    return Promise.resolve(null);
  }
  if (!petFrameCache.has(spriteUrl)) {
    petFrameCache.set(
      spriteUrl,
      new Promise((resolve) => {
        petFetchQueue.push(async () => {
          try {
            const resp = await fetch(spriteUrl);
            const blob = await resp.blob();
            const bitmap = await createImageBitmap(
              blob,
              0,
              0,
              PET_FRAME_W,
              PET_FRAME_H
            );
            const canvas = document.createElement("canvas");
            canvas.width = 96;
            canvas.height = 104;
            canvas.getContext("2d").drawImage(bitmap, 0, 0, 96, 104);
            bitmap.close();
            resolve(canvas.toDataURL("image/png"));
          } catch {
            resolve(null);
          }
        });
        pumpPetQueue();
      })
    );
  }
  return petFrameCache.get(spriteUrl);
}
function PetThumb({ spriteUrl, size = 40 }) {
  const [icon, setIcon] = useState2(null);
  useEffect2(() => {
    let alive = true;
    petFrameIcon(spriteUrl).then((url) => {
      if (alive) {
        setIcon(url);
      }
    });
    return () => {
      alive = false;
    };
  }, [spriteUrl]);
  if (!icon) {
    return jsx2("div", {
      style: {
        width: size,
        height: size,
        borderRadius: 6,
        background: "var(--chrome-action-hover, rgba(255,255,255,0.06))"
      }
    });
  }
  return jsx2("img", {
    src: icon,
    alt: "",
    style: {
      width: size,
      height: size,
      objectFit: "contain",
      imageRendering: "pixelated",
      borderRadius: 6
    }
  });
}
function PetTab({ image, onImage }) {
  const [selectedSlug, setSelectedSlug] = useState2(null);
  const { data, isLoading } = useQuery({
    queryKey: [ID, "pet-gallery"],
    queryFn: () => host2.request("pet.gallery", {}),
    staleTime: 3e5
  });
  const [query, setQuery] = useState2("");
  const [limit, setLimit] = useState2(24);
  const pets = data?.pets ?? [];
  if (isLoading) {
    return jsx2("div", {
      className: "flex justify-center py-4",
      children: jsx2(GlyphSpinner, {
        spinner: "breathe",
        className: "text-(--ui-text-tertiary)"
      })
    });
  }
  if (!pets.length) {
    return jsx2("div", {
      className: "px-2 py-3 text-center text-xs text-(--ui-text-tertiary)",
      children: "No pets in the petdex gallery. Run `hermes pets` to explore."
    });
  }
  const q = query.trim().toLowerCase();
  const filtered = q ? pets.filter(
    (pet) => (pet.displayName || "").toLowerCase().includes(q) || (pet.slug || "").includes(q)
  ) : pets;
  const ranked = filtered.slice().sort((a, b) => {
    const rank = (pet) => pet.installed ? 0 : pet.curated ? 1 : 2;
    return rank(a) - rank(b);
  });
  const visible = ranked.slice(0, limit);
  const onScroll = (event) => {
    const el = event.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120 && limit < ranked.length) {
      setLimit((prev) => Math.min(prev + 24, ranked.length));
    }
  };
  return jsxs2("div", {
    className: "grid w-full gap-2",
    children: [
      jsx2("div", {
        className: "text-center text-[0.65rem] text-(--ui-text-quaternary)",
        children: "Pick a pet as this agent’s profile picture."
      }),
      jsx2(Input2, {
        className: "h-7 text-xs",
        placeholder: `Search ${pets.length} pets…`,
        value: query,
        onChange: (event) => {
          setQuery(event.target.value);
          setLimit(24);
        }
      }),
      image && selectedSlug ? jsx2(Button2, {
        type: "button",
        variant: "ghost",
        size: "sm",
        className: "justify-center",
        onClick: () => {
          setSelectedSlug(null);
          onImage(null);
        },
        children: "Remove — back to shape avatar"
      }) : null,
      filtered.length === 0 ? jsx2("div", {
        className: "py-3 text-center text-xs text-(--ui-text-quaternary)",
        children: "No pets match."
      }) : jsxs2("div", {
        onScroll,
        style: { maxHeight: 220, overflowY: "auto" },
        children: [
          jsx2("div", {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "6px"
            },
            children: visible.map(
              (pet) => jsxs2(
                "button",
                {
                  type: "button",
                  className: cn(
                    "grid justify-items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-(--chrome-action-hover)",
                    selectedSlug === pet.slug && "ring-1 ring-(--ui-accent)"
                  ),
                  onClick: () => {
                    setSelectedSlug(pet.slug);
                    void petFrameIcon(pet.spritesheetUrl).then((icon) => {
                      if (icon) {
                        onImage(icon);
                      } else {
                        setSelectedSlug(null);
                        host2.notify({
                          kind: "error",
                          message: "Could not load that pet — try another."
                        });
                      }
                    });
                  },
                  children: [
                    jsx2(PetThumb, {
                      spriteUrl: pet.spritesheetUrl,
                      size: 40
                    }),
                    jsx2("span", {
                      className: "w-full truncate text-center text-[0.6rem] text-(--ui-text-tertiary)",
                      children: pet.displayName
                    })
                  ]
                },
                pet.slug
              )
            )
          }),
          limit < ranked.length ? jsx2("div", {
            className: "py-2 text-center text-[0.65rem] text-(--ui-text-quaternary)",
            children: `Scroll for more (${limit} of ${ranked.length})`
          }) : null
        ]
      })
    ]
  });
}
function useRoster() {
  return useQuery({
    queryKey: ROSTER_KEY,
    queryFn: () => host2.request("profiles.list", {}),
    refetchInterval: 5e3,
    staleTime: 5e3,
    // Remote (SSH) gateways connect slowly and drop on sleep/wake; keep
    // retrying instead of latching a terminal error card.
    retry: true,
    retryDelay: (attempt) => Math.min(15e3, 1e3 * 2 ** attempt)
  });
}
function botHandle(name) {
  return (name || "").trim().toLowerCase() === "default" ? "hermes" : name;
}
function showsHandle(name, meta) {
  const display = displayName({ name }, meta);
  return Boolean(
    name && display.toLowerCase() !== botHandle(name).toLowerCase()
  );
}
var canonicalCreations = /* @__PURE__ */ new Map();
function createCanonicalChat(name) {
  const inflight = canonicalCreations.get(name);
  if (inflight) {
    return inflight;
  }
  const run = (async () => {
    const res = await host2.request("session.create", {
      profile: name,
      title: "Bot Chat"
    });
    const sid = res?.stored_session_id;
    const runtime = res?.session_id;
    if (sid) {
      saveBotMeta(name, { chat: sid });
    }
    if (sid && typeof host2.openSession === "function") {
      try {
        await host2.openSession(sid, { profile: name });
      } catch {
      }
    }
    if (runtime) {
      window.setTimeout(() => {
        void host2.request("prompt.submit", {
          session_id: runtime,
          text: "Hey, tell me about yourself!"
        }).catch(() => void 0);
      }, 400);
    }
    return sid || null;
  })().finally(() => canonicalCreations.delete(name));
  canonicalCreations.set(name, run);
  return run;
}
function displayName(bot, meta) {
  if (meta?.title?.trim()) {
    return meta.title.trim();
  }
  if ((bot.name || "").trim().toLowerCase() === "default" && !bot.title) {
    return "Hermes";
  }
  const raw = (bot.title || bot.name || "").replace(/[-_]+/g, " ").trim();
  return raw.replace(/\b\w/g, (ch) => ch.toUpperCase());
}
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}
function messagingProtocolSection(name, roster) {
  const teammates = (roster || []).filter((b) => b.name !== name);
  const safeName = NAME_RE2.test(name) ? name : "agent";
  const examplePrefix = `Message from 🤖 ${safeName} (@${safeName}): `;
  return [
    "## Messaging other agents",
    "",
    "You work alongside other named agents. Every agent (including you) has",
    'ONE canonical conversation titled "Bot Chat" — created with the agent,',
    "so it always exists. Agent-to-agent messages are delivered straight",
    "into it, like a DM. To message a teammate, run:",
    "",
    "```",
    `hermes -p <agent-name> chat --in ~ -c 'Bot Chat' -Q -q ${shellQuote2(examplePrefix + "your message")}`,
    "",
    "Run the send with background=true and notify_on_complete=true on the",
    "terminal tool, then finish your turn — the reply arrives later as a",
    "background process notification. Never block waiting for it.",
    "```",
    "",
    "(`--in ~ -c 'Bot Chat'` resumes their canonical conversation in the home",
    "workspace. `-Q` keeps output clean. Always open with the",
    `${JSON.stringify(examplePrefix)} prefix so they know`,
    "who is talking (the @handle lets the app show your avatar to them).",
    "Their reply prints to stdout — relay the relevant part back to the",
    "user, and say which agent it came from. In the rare case the target",
    'has no "Bot Chat" yet, send once WITHOUT -c, then',
    "`hermes -p <agent-name> sessions rename <session-id> 'Bot Chat'`.)",
    "",
    'If a message in YOUR chat starts with "Message from 🤖 <name>", it is',
    "a teammate messaging you, not the user. Answer it directly — your reply",
    "reaches them via their own delivery — and use the same command if you",
    "need to start a conversation yourself.",
    "",
    'When the user writes @<agent-name> or says "ask <name> to ..." /',
    '"tell <name> ...", that is a handoff: message that agent, wait for the',
    "reply, and report back.",
    "",
    "The roster grows over time — run `hermes profiles list` for the LIVE",
    "teammate list before a handoff. Teammates when you were created:",
    ...teammates.length ? teammates.map(
      (b) => `- \`${b.name}\`${b.description ? ` — ${b.description}` : ""}`
    ) : ["- (none yet)"]
  ].join("\n");
}
function composeSoul({ name, title, description, roster, customSoul }) {
  if (customSoul && customSoul.trim()) {
    return customSoul.trim() + "\n\n" + messagingProtocolSection(name, roster);
  }
  const lines = [
    `# ${displayName({ name, title })}`,
    "",
    title ? `**Role:** ${title}` : null,
    description ? `**Mission:** ${description}` : null,
    "",
    `You are ${displayName({ name, title })}, a persistent named agent (profile \`${name}\`) on this machine.`,
    "You keep your own memory, skills, and conversation history across sessions."
  ];
  return lines.filter((line) => line !== null).join("\n") + "\n\n" + messagingProtocolSection(name, roster);
}
function BotRow({ bot, onEdit }) {
  const activeProfile = useValue2(host2.state.profile);
  const meta = useValue2($botMeta)[bot.name];
  const last = bot.last_session;
  const isActive = bot.name === activeProfile;
  const { shape, color, image } = botAppearance(bot.name, meta);
  const gatewayState = useValue2(host2.state.gateway);
  const botMood = isActive && gatewayState === "busy" ? "work" : "idle";
  const unread = Boolean(useValue2($botUnread)[bot.name]);
  const open = async () => {
    haptic("tap");
    $selectedBot.set(bot.name);
    if ($botUnread.get()[bot.name]) {
      const next = { ...$botUnread.get() };
      delete next[bot.name];
      $botUnread.set(next);
    }
    let id = meta?.chat || meta?.chat_pin || null;
    if (id) {
      try {
        const res = await host2.request("session.list", {
          profile: bot.name,
          limit: 100
        });
        const rows = res?.sessions ?? [];
        if (rows.length && !rows.some((s) => s.id === id)) {
          id = rows[0].id;
          saveBotMeta(bot.name, { chat: id });
        }
      } catch {
      }
    } else {
      try {
        id = await createCanonicalChat(bot.name);
        return;
      } catch {
        id = null;
      }
    }
    if (id && typeof host2.openSession === "function") {
      void host2.openSession(id, { profile: bot.name });
    } else if (typeof host2.newChat === "function") {
      host2.newChat(bot.name);
    } else {
      host2.navigate("/");
    }
  };
  const row = jsxs2("button", {
    type: "button",
    onClick: open,
    className: cn(
      "flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors",
      "hover:bg-(--chrome-action-hover)",
      isActive && "bg-(--chrome-action-hover)"
    ),
    children: [
      jsx2("div", {
        className: "shrink-0",
        children: jsx2(BotFace, {
          shape,
          color,
          image,
          size: 34,
          name: bot.name,
          mood: botMood
        })
      }),
      jsxs2("div", {
        className: "min-w-0 flex-1",
        children: [
          jsxs2("div", {
            className: "flex items-baseline justify-between gap-2",
            children: [
              jsxs2("div", {
                className: "flex min-w-0 items-baseline gap-1.5 truncate",
                children: [
                  meta?.pinned ? jsx2("span", {
                    className: "shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)",
                    title: "Pinned",
                    children: "📌"
                  }) : null,
                  jsx2("span", {
                    className: "truncate text-[0.8125rem] font-medium",
                    children: displayName(bot, meta)
                  }),
                  showsHandle(bot.name, meta) ? jsx2("span", {
                    className: "shrink-0 font-mono text-[0.6875rem] text-(--ui-text-quaternary)",
                    children: `@${botHandle(bot.name)}`
                  }) : null
                ]
              }),
              unread ? jsx2("span", {
                className: "size-2 shrink-0 rounded-full bg-(--ui-accent,#4f9cf9)",
                "aria-label": "unread"
              }) : null,
              last ? jsx2("span", {
                className: "shrink-0 text-[0.6875rem] text-(--ui-text-quaternary)",
                children: relativeTime(last.last_active * 1e3)
              }) : null
            ]
          }),
          jsx2("div", {
            className: "truncate text-xs text-(--ui-text-tertiary)",
            children: last?.preview || bot.description || "No conversations yet — say hi"
          })
        ]
      })
    ]
  });
  return jsxs2(ContextMenu, {
    children: [
      jsx2(ContextMenuTrigger, { asChild: true, children: row }),
      jsxs2(ContextMenuContent, {
        children: [
          jsx2(ContextMenuItem, {
            onSelect: () => {
              const pinned = Boolean($botMeta.get()[bot.name]?.pinned);
              saveBotMeta(bot.name, { pinned: !pinned });
              host2.notify({
                kind: "info",
                message: `${displayName(bot, meta)} ${pinned ? "unpinned" : "pinned to top"}`
              });
            },
            children: meta?.pinned ? "Unpin" : "Pin to top"
          }),
          jsx2(ContextMenuSeparator, {}),
          jsx2(ContextMenuItem, {
            onSelect: () => onEdit(bot),
            children: "Edit Profile"
          }),
          jsx2(ContextMenuItem, {
            onSelect: () => {
              host2.notify({
                kind: "info",
                message: `Duplicating ${displayName(bot, meta)}…`
              });
              duplicateBot(bot, $lastRoster.get()).then((name) => {
                queryClient.invalidateQueries({ queryKey: ROSTER_KEY });
                host2.notify({
                  kind: "success",
                  message: `Created ${name} — full copy of ${bot.name}`
                });
              }).catch((err) => host2.notifyError(err, "Duplicate failed"));
            },
            children: "Duplicate"
          }),
          jsx2(ContextMenuSeparator, {}),
          jsx2(ContextMenuItem, {
            onSelect: () => {
              $selectedBot.set(bot.name);
              if (typeof host2.newChat === "function") {
                host2.newChat(bot.name);
              }
            },
            children: "New chat with this agent"
          })
        ]
      })
    ]
  });
}
function useModelOptions() {
  return useQuery({
    queryKey: [ID, "model-options"],
    queryFn: () => host2.request("model.options", {}),
    staleTime: 12e4,
    retry: false
  });
}
function ModelPicker({
  value,
  onChange,
  placeholderModel = "gateway default"
}) {
  const { data, isLoading, error } = useModelOptions();
  if (isLoading) {
    return jsx2("div", {
      className: "flex justify-center py-2",
      children: jsx2(GlyphSpinner, {
        spinner: "breathe",
        className: "text-(--ui-text-tertiary)"
      })
    });
  }
  const providers = (data?.providers || []).filter(
    (p) => (p.models || []).length
  );
  if (error || !providers.length) {
    return jsxs2("div", {
      style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" },
      children: [
        labeled(
          "Provider",
          jsx2(Input2, {
            placeholder: "nous / openrouter …",
            value: value.provider,
            onChange: (event) => onChange({ provider: event.target.value })
          })
        ),
        labeled(
          "Model",
          jsx2(Input2, {
            placeholder: "anthropic/claude-fable-5",
            value: value.model,
            onChange: (event) => onChange({ model: event.target.value })
          })
        )
      ]
    });
  }
  const NONE = "__default__";
  const activeProvider = providers.find((p) => p.slug === value.provider) || null;
  const models = activeProvider ? (activeProvider.models || []).map(
    (m) => typeof m === "string" ? m : m.id
  ) : [];
  return jsxs2("div", {
    style: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "10px" },
    children: [
      labeled(
        "Provider",
        jsxs2(Select, {
          value: value.provider || NONE,
          onValueChange: (v) => {
            if (v === NONE) {
              onChange({ provider: "", model: "" });
            } else {
              const prov = providers.find((p) => p.slug === v);
              const first = prov?.models?.[0];
              onChange({
                provider: v,
                // Keep the model if it exists under the new provider,
                // otherwise preselect that provider's first model.
                model: prov && (prov.models || []).some(
                  (m) => (typeof m === "string" ? m : m.id) === value.model
                ) ? value.model : typeof first === "string" ? first : first?.id || ""
              });
            }
          },
          children: [
            jsx2(SelectTrigger, {
              className: "h-8 rounded-md",
              children: jsx2(SelectValue, {})
            }),
            jsxs2(SelectContent, {
              children: [
                jsx2(SelectItem, {
                  value: NONE,
                  children: "Inherit (launch profile)"
                }),
                ...providers.map(
                  (p) => jsx2(SelectItem, { value: p.slug, children: p.slug }, p.slug)
                )
              ]
            })
          ]
        })
      ),
      labeled(
        "Model",
        activeProvider ? jsxs2(Select, {
          value: value.model || (models[0] ?? ""),
          onValueChange: (v) => onChange({ model: v }),
          children: [
            jsx2(SelectTrigger, {
              className: "h-8 rounded-md",
              children: jsx2(SelectValue, {})
            }),
            jsx2(SelectContent, {
              children: models.map(
                (m) => jsx2(SelectItem, { value: m, children: m }, m)
              )
            })
          ]
        }) : jsx2(Input2, {
          disabled: true,
          placeholder: placeholderModel,
          value: "",
          onChange: () => void 0
        })
      )
    ]
  });
}
function CheckList({ items, onToggle, columns = 2 }) {
  return jsx2("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: "2px 12px"
    },
    children: items.map(
      (item) => jsxs2(
        "label",
        {
          className: "flex min-w-0 cursor-pointer items-center gap-1.5 py-0.5 text-xs text-(--ui-text-secondary)",
          title: item.description || item.name,
          children: [
            jsx2(Checkbox, {
              checked: item.enabled,
              onCheckedChange: (value) => onToggle(item.name, Boolean(value))
            }),
            jsx2("span", { className: "truncate", children: item.name }),
            item.tool_count ? jsx2("span", {
              className: "shrink-0 text-[0.6rem] text-(--ui-text-quaternary)",
              children: `${item.tool_count}`
            }) : null
          ]
        },
        item.name
      )
    )
  });
}
function AdvancedProfileConfig({ bot, state, setState }) {
  const [unsupported, setUnsupported] = useState2(false);
  const [skillFilter, setSkillFilter] = useState2("");
  useEffect2(() => {
    let cancelled = false;
    Promise.all([
      host2.request("profiles.describe", { name: bot }),
      host2.request("mcp.catalog", { profile: bot }).catch(() => null)
    ]).then(([res, cat]) => {
      if (cancelled) return;
      const configured = res.mcp_servers || [];
      const have = new Set(configured.map((m) => m.name));
      const catalog = (cat && cat.servers || []).filter(
        (s) => !have.has(s.name)
      );
      setState((prev) => ({
        ...prev,
        provider: res.model?.provider || "",
        model: res.model?.default || "",
        soul: res.soul || "",
        skills: res.skills || [],
        toolsets: res.toolsets || [],
        mcp: [
          ...configured.map((m) => ({ ...m, enabled: m.enabled !== false })),
          ...catalog.map((s) => ({
            name: s.name,
            enabled: false,
            fromCatalog: true,
            installed: s.installed,
            auth: s.auth,
            requires: s.requires || [],
            description: s.description || ""
          }))
        ],
        loaded: true
      }));
    }).catch(() => {
      if (!cancelled) setUnsupported(true);
    });
    return () => {
      cancelled = true;
    };
  }, [bot]);
  if (unsupported) {
    return jsx2("div", {
      className: "px-2 py-3 text-center text-xs text-(--ui-text-tertiary)",
      children: "Full configuration needs a newer gateway (restart it after updating Hermes)."
    });
  }
  if (!state.loaded) {
    return jsx2("div", {
      className: "flex justify-center py-4",
      children: jsx2(GlyphSpinner, {
        spinner: "breathe",
        className: "text-(--ui-text-tertiary)"
      })
    });
  }
  const visibleSkills = skillFilter.trim() ? state.skills.filter(
    (s) => s.name.toLowerCase().includes(skillFilter.trim().toLowerCase())
  ) : state.skills;
  const toggleSkill = (name, enabled) => setState((prev) => ({
    ...prev,
    dirtySkills: true,
    skills: prev.skills.map((s) => s.name === name ? { ...s, enabled } : s)
  }));
  const toggleToolset = (name, enabled) => setState((prev) => ({
    ...prev,
    dirtyToolsets: true,
    toolsets: prev.toolsets.map(
      (t) => t.name === name ? { ...t, enabled } : t
    )
  }));
  const toggleMcp = (name, enabled) => setState((prev) => ({
    ...prev,
    dirtyMcp: true,
    mcp: (prev.mcp || []).map(
      (m) => m.name === name ? { ...m, enabled } : m
    )
  }));
  const enabledSkills = state.skills.filter((s) => s.enabled).length;
  const enabledToolsets = state.toolsets.filter((t) => t.enabled).length;
  const mcpList = state.mcp || [];
  const enabledMcp = mcpList.filter((m) => m.enabled).length;
  return jsxs2("div", {
    className: "grid gap-4",
    children: [
      jsx2(ModelPicker, {
        value: { provider: state.provider, model: state.model },
        onChange: (patch) => setState((prev) => ({ ...prev, dirtyModel: true, ...patch }))
      }),
      labeled(
        `Skills (${enabledSkills}/${state.skills.length} enabled)`,
        jsxs2("div", {
          className: "grid gap-1.5 rounded-md border border-(--ui-stroke-secondary) p-2",
          children: [
            jsx2(Input2, {
              className: "h-7 text-xs",
              placeholder: "Filter skills…",
              value: skillFilter,
              onChange: (event) => setSkillFilter(event.target.value)
            }),
            jsx2(ScrollArea2, {
              style: { maxHeight: 180 },
              children: jsx2(CheckList, {
                items: visibleSkills,
                onToggle: toggleSkill,
                columns: 2
              })
            }),
            jsx2(HubSkillsSection, {
              forProfile: bot,
              onInstalled: (name) => setState(
                (prev) => prev.skills.some((s) => s.name === name) ? prev : {
                  ...prev,
                  skills: [...prev.skills, { name, enabled: true }]
                }
              )
            })
          ]
        })
      ),
      labeled(
        `Toolsets (${enabledToolsets}/${state.toolsets.length} enabled — unchecking all restores the default)`,
        jsx2("div", {
          className: "rounded-md border border-(--ui-stroke-secondary) p-2",
          children: jsx2(ScrollArea2, {
            style: { maxHeight: 160 },
            children: jsx2(CheckList, {
              items: state.toolsets,
              onToggle: toggleToolset,
              columns: 2
            })
          })
        })
      ),
      labeled(
        `MCP servers (${enabledMcp}/${mcpList.length} enabled)`,
        jsx2("div", {
          className: "rounded-md border border-(--ui-stroke-secondary) p-2",
          children: mcpList.length === 0 ? jsx2("div", {
            className: "px-1 py-2 text-center text-xs text-(--ui-text-tertiary)",
            children: "No MCP servers configured or in the catalog."
          }) : jsx2(ScrollArea2, {
            style: { maxHeight: 180 },
            children: jsx2("div", {
              className: "grid gap-1",
              children: mcpList.map((m) => {
                const needsSetup = m.fromCatalog && !m.installed && ((m.requires || []).length > 0 || (m.auth || "").toLowerCase() === "oauth");
                return jsxs2(
                  "label",
                  {
                    className: "flex items-start gap-2 text-xs text-(--ui-text-secondary)",
                    children: [
                      jsx2(Checkbox, {
                        checked: !!m.enabled,
                        disabled: needsSetup,
                        onCheckedChange: (value) => toggleMcp(m.name, Boolean(value))
                      }),
                      jsxs2("span", {
                        className: "min-w-0",
                        children: [
                          jsx2("span", { children: m.name }),
                          m.fromCatalog && !needsSetup ? jsx2("span", {
                            className: "ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)",
                            children: m.installed ? "catalog · installed" : "catalog"
                          }) : null,
                          needsSetup ? jsx2(McpSetupButton, {
                            profile: bot,
                            entry: m,
                            onDone: () => toggleMcp(m.name, true)
                          }) : null,
                          m.description ? jsx2("div", {
                            className: "truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
                            children: m.description
                          }) : null
                        ]
                      })
                    ]
                  },
                  m.name
                );
              })
            })
          })
        })
      ),
      labeled(
        "SOUL.md (persona + agent-messaging protocol)",
        jsx2(Textarea2, {
          className: "min-h-28 font-mono text-xs leading-5",
          value: state.soul,
          onChange: (event) => setState((prev) => ({
            ...prev,
            dirtySoul: true,
            soul: event.target.value
          }))
        })
      )
    ]
  });
}
var HUB_ORIGIN = "https://hermes-agent.nousresearch.com";
var HUB_PICKER_URL = HUB_ORIGIN + "/docs/skills?embed=picker";
function HubSkillsSection({ forProfile, onInstalled }) {
  const [query, setQuery] = useState2("");
  const [results, setResults] = useState2(null);
  const [searching, setSearching] = useState2(false);
  const [installing, setInstalling] = useState2(null);
  const [installed, setInstalled] = useState2({});
  const [browseHub, setBrowseHub] = useState2(false);
  const installRef = useRef(null);
  useEffect2(() => {
    if (!browseHub) {
      return void 0;
    }
    const onMessage = (event) => {
      if (event.origin !== HUB_ORIGIN) {
        return;
      }
      const data = event.data;
      if (!data || data.type !== "hermes-skill-pick" || typeof data.name !== "string" || !data.name.trim()) {
        return;
      }
      const rawName = data.name.trim().slice(0, 120);
      const rawTarget = String(data.identifier || rawName).trim().slice(0, 120);
      if (!/^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?$/i.test(rawName) || !/^[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)?$/i.test(rawTarget)) {
        return;
      }
      if (installRef.current) {
        void installRef.current(rawTarget, rawName);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [browseHub]);
  const search = async () => {
    const q = query.trim();
    if (!q || searching) {
      return;
    }
    setSearching(true);
    setResults(null);
    try {
      const res = await host2.request("skills.manage", {
        action: "search",
        query: q
      });
      setResults(res.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };
  const install = async (name, displayName2) => {
    const label = displayName2 || name;
    if (installing) {
      return;
    }
    setInstalling(label);
    try {
      await host2.request("skills.manage", {
        action: "install",
        query: name,
        ...forProfile ? { profile: forProfile } : {}
      });
      setInstalled((prev) => ({ ...prev, [label]: true }));
      host2.notify({ kind: "success", message: `Skill "${label}" installed` });
      if (typeof onInstalled === "function") {
        onInstalled(label);
      }
    } catch (err) {
      host2.notifyError(err, `Installing "${label}" failed`);
    } finally {
      setInstalling(null);
    }
  };
  installRef.current = install;
  return jsxs2("div", {
    className: "grid gap-1.5 border-t border-(--ui-stroke-secondary) pt-2",
    children: [
      jsxs2("div", {
        className: "flex items-baseline justify-between gap-2",
        children: [
          jsx2("div", {
            className: "text-[0.7rem] font-medium text-(--ui-text-secondary)",
            children: "Skills Hub"
          }),
          jsx2("button", {
            type: "button",
            className: "text-[0.65rem] text-(--ui-text-quaternary) hover:text-(--ui-text-secondary)",
            onClick: () => setBrowseHub((v) => !v),
            children: browseHub ? "hide the hub browser" : "browse the full hub ▾"
          })
        ]
      }),
      browseHub ? jsxs2("div", {
        className: "grid gap-1",
        children: [
          // Resizable viewport: native CSS resize handle (bottom-right
          // corner) lets the user drag it larger/smaller. The iframe
          // inside is rendered oversized and scaled DOWN (133% × 0.75)
          // so the hub page starts zoomed out — we can't style the
          // cross-origin page itself, but scaling the frame is ours.
          jsx2("div", {
            style: {
              width: "100%",
              height: 560,
              minHeight: 240,
              minWidth: 320,
              maxWidth: "100%",
              resize: "both",
              overflow: "hidden",
              border: "1px solid var(--ui-stroke-secondary)",
              borderRadius: 8,
              position: "relative"
            },
            children: jsx2("iframe", {
              src: HUB_PICKER_URL,
              title: "Hermes Skills Hub",
              style: {
                width: "133.34%",
                height: "133.34%",
                border: "none",
                background: "transparent",
                transform: "scale(0.75)",
                transformOrigin: "top left"
              },
              sandbox: "allow-scripts allow-same-origin"
            })
          }),
          jsx2("div", {
            className: "px-1 text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
            children: installing ? `Installing "${installing}"…` : 'Hit "+ Add to this Agent" on any skill — it installs and appears in the list above. Drag the corner to resize.'
          })
        ]
      }) : null,
      jsxs2("div", {
        className: "flex gap-1.5",
        children: [
          jsx2(Input2, {
            className: "h-7 flex-1 text-xs",
            placeholder: "Search the hub (community + well-known sources)…",
            value: query,
            onChange: (event) => setQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }
          }),
          jsx2(Button2, {
            size: "sm",
            variant: "secondary",
            disabled: searching || !query.trim(),
            onClick: () => void search(),
            children: searching ? "Searching…" : "Search"
          })
        ]
      }),
      searching ? jsx2("div", {
        className: "px-1 text-[0.65rem] text-(--ui-text-quaternary)",
        children: "Searching community + well-known sources — can take ~10s…"
      }) : null,
      results === null ? null : results.length === 0 ? jsx2("div", {
        className: "px-1 py-1.5 text-[0.7rem] text-(--ui-text-quaternary)",
        children: "No hub skills matched."
      }) : jsx2(ScrollArea2, {
        style: { maxHeight: 150 },
        children: jsx2("div", {
          className: "grid gap-1",
          children: results.map(
            (r) => jsxs2(
              "div",
              {
                className: "flex items-center gap-2 text-xs",
                children: [
                  jsxs2("div", {
                    className: "min-w-0 flex-1",
                    children: [
                      jsx2("div", {
                        className: "truncate font-medium",
                        children: r.name
                      }),
                      r.description ? jsx2("div", {
                        className: "truncate text-[0.65rem] text-(--ui-text-quaternary)",
                        children: r.description
                      }) : null
                    ]
                  }),
                  installed[r.name] ? jsx2("span", {
                    className: "shrink-0 text-[0.65rem] text-(--ui-text-tertiary)",
                    children: "✓ added"
                  }) : jsx2(Button2, {
                    size: "sm",
                    variant: "ghost",
                    className: "shrink-0 px-2 font-semibold",
                    disabled: installing !== null,
                    title: `Install "${r.name}" and add it to the list above`,
                    onClick: () => void install(r.name),
                    children: installing === r.name ? "…" : "+"
                  })
                ]
              },
              r.name
            )
          )
        })
      })
    ]
  });
}
function emptyAdvancedState() {
  return {
    loaded: false,
    provider: "",
    model: "",
    soul: "",
    skills: [],
    toolsets: [],
    mcp: [],
    dirtyModel: false,
    dirtySoul: false,
    dirtySkills: false,
    dirtyToolsets: false,
    dirtyMcp: false
  };
}
async function applyAdvancedConfig(bot, state) {
  const payload = { name: bot };
  if (state.dirtySoul) {
    payload.soul = state.soul;
  }
  if (state.dirtyModel && state.model.trim() && state.provider.trim()) {
    payload.model = state.model.trim();
    payload.provider = state.provider.trim();
  }
  if (state.dirtySkills) {
    payload.disabled_skills = state.skills.filter((s) => !s.enabled).map((s) => s.name);
  }
  if (state.dirtyToolsets) {
    const all = state.toolsets.length;
    const enabled = state.toolsets.filter((t) => t.enabled);
    payload.enabled_toolsets = enabled.length === all || enabled.length === 0 ? [] : enabled.map((t) => t.name);
  }
  if (state.dirtyMcp) {
    payload.enabled_mcp_servers = (state.mcp || []).filter((m) => m.enabled).map((m) => m.name);
  }
  if (Object.keys(payload).length === 1) {
    return { ok: true, applied: {} };
  }
  return host2.request("profiles.configure", payload);
}
function labeled(label, control) {
  return jsxs2("div", {
    className: "grid gap-1.5",
    children: [
      jsx2("label", {
        className: "text-xs font-medium text-(--ui-text-secondary)",
        children: label
      }),
      control
    ]
  });
}
function EditProfileDialog({ bot, open, onClose }) {
  const metaAll = useValue2($botMeta);
  const meta = bot ? metaAll[bot.name] : null;
  const appearance = bot ? botAppearance(bot.name, meta) : { shape: "circle", color: AVATAR_COLORS[3] };
  const [shape, setShape] = useState2(appearance.shape);
  const [color, setColor] = useState2(appearance.color);
  const [image, setImage] = useState2(appearance.image);
  const [title, setTitle] = useState2(meta?.title || "");
  const [description, setDescription] = useState2(bot?.description || "");
  const [busy, setBusy] = useState2(false);
  const [advanced, setAdvanced] = useState2(false);
  const [adv, setAdv] = useState2(emptyAdvancedState());
  const currentKey = bot ? `${bot.name}:${open}` : null;
  useEffect2(() => {
    if (bot && open) {
      setShape(appearance.shape);
      setColor(appearance.color);
      setImage(appearance.image);
      setTitle(meta?.title || "");
      setDescription(bot.description || "");
      setBusy(false);
      setAdvanced(false);
      setAdv(emptyAdvancedState());
    }
  }, [currentKey]);
  if (!bot) {
    return null;
  }
  const submit = async () => {
    if (busy) {
      return;
    }
    setBusy(true);
    saveBotMeta(bot.name, {
      shape,
      color,
      image,
      title: title.trim(),
      custom: true
    });
    const desc = description.trim();
    if (desc !== (bot.description || "").trim()) {
      try {
        await host2.request("cli.exec", {
          argv: ["profile", "describe", bot.name, "--text", desc]
        });
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY });
      } catch (err) {
        host2.notifyError(err, "Saved look locally; description update failed");
      }
    }
    if (adv.loaded && (adv.dirtyModel || adv.dirtySoul || adv.dirtySkills || adv.dirtyToolsets || adv.dirtyMcp)) {
      try {
        const res = await applyAdvancedConfig(bot.name, adv);
        const failed = Object.entries(res?.applied || {}).filter(
          ([, ok]) => !ok
        );
        if (failed.length) {
          host2.notify({
            kind: "error",
            message: `Some sections failed: ${failed.map(([k]) => k).join(", ")}`
          });
        }
      } catch (err) {
        host2.notifyError(err, "Advanced configuration failed");
      }
    }
    host2.notify({
      kind: "success",
      message: `${displayName(bot, { title })} updated`
    });
    setBusy(false);
    onClose();
  };
  return jsx2(Dialog2, {
    open,
    onOpenChange: (value) => !value && !busy && onClose(),
    children: jsxs2(DialogContent2, {
      className: advanced ? "max-w-3xl" : "max-w-sm",
      // Same resizable-window treatment as the create dialog.
      style: advanced ? {
        resize: "both",
        overflow: "auto",
        minWidth: 420,
        minHeight: 360,
        maxWidth: "95vw",
        maxHeight: "90vh"
      } : void 0,
      children: [
        jsxs2(DialogHeader2, {
          children: [
            jsx2(DialogTitle2, { children: "Edit Profile" }),
            jsx2(DialogDescription, {
              children: `Appearance and role for ${displayName(bot, null)} (${bot.name}).`
            })
          ]
        }),
        jsxs2("div", {
          className: "grid gap-4",
          children: [
            jsx2("div", {
              className: "flex justify-center py-1",
              children: jsx2(BotFace, {
                shape,
                color,
                image,
                size: 64,
                name: bot.name
              })
            }),
            jsx2(AvatarPicker, {
              shape,
              color,
              image,
              onShape: setShape,
              onColor: setColor,
              onImage: setImage,
              generateSeed: { name: bot.name, title, description }
            }),
            labeled(
              "Title",
              jsx2(Input2, {
                placeholder: displayName(bot, null),
                value: title,
                onChange: (event) => setTitle(event.target.value)
              })
            ),
            labeled(
              "Description",
              jsx2(Textarea2, {
                className: "min-h-16",
                placeholder: "What should this agent help with?",
                value: description,
                onChange: (event) => setDescription(event.target.value)
              })
            ),
            jsxs2("button", {
              type: "button",
              className: "flex items-center gap-1 text-xs font-medium text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)",
              onClick: () => setAdvanced((v) => !v),
              children: [
                jsx2(Codicon2, {
                  name: advanced ? "chevron-down" : "chevron-right",
                  className: "text-[0.8rem]"
                }),
                "Advanced — model, skills, toolsets, SOUL.md"
              ]
            }),
            advanced ? jsx2("div", {
              className: "rounded-md border border-(--ui-stroke-secondary) p-3",
              children: jsx2(AdvancedProfileConfig, {
                bot: bot.name,
                state: adv,
                setState: setAdv
              })
            }) : null
          ]
        }),
        jsxs2(DialogFooter2, {
          children: [
            jsx2(Button2, {
              variant: "ghost",
              disabled: busy,
              onClick: onClose,
              children: "Cancel"
            }),
            jsx2(Button2, {
              disabled: busy,
              onClick: submit,
              children: busy ? "Saving…" : "Save"
            })
          ]
        })
      ]
    })
  });
}
function CreateAgentDialog({ open, onClose, roster }) {
  const [name, setName] = useState2("");
  const setupProfile = null;
  const [title, setTitle] = useState2("");
  const [description, setDescription] = useState2("");
  const [shape, setShape] = useState2("circle");
  const [color, setColor] = useState2(AVATAR_COLORS[3]);
  const [image, setImage] = useState2(null);
  const [advanced, setAdvanced] = useState2(false);
  const [cloneFrom, setCloneFrom] = useState2("__none__");
  const [model, setModel] = useState2("");
  const [provider, setProvider] = useState2("");
  const [soul, setSoul] = useState2("");
  const [noSkills, setNoSkills] = useState2(false);
  const [shareAuth, setShareAuth] = useState2(true);
  const [advTab, setAdvTab] = useState2("general");
  const [caps, setCaps] = useState2(null);
  const [capsFailed, setCapsFailed] = useState2(false);
  const [dirtyCaps, setDirtyCaps] = useState2({
    skills: false,
    toolsets: false,
    mcp: false
  });
  const [capFilter, setCapFilter] = useState2("");
  const [busy, setBusy] = useState2(false);
  const [error, setError] = useState2(null);
  const slug = slugify(name);
  const valid = slug.length > 0 && NAME_RE2.test(slug);
  const taken = roster.some((b) => b.name === slug);
  const reset = () => {
    setName("");
    setTitle("");
    setDescription("");
    setShape("circle");
    setColor(AVATAR_COLORS[3]);
    setImage(null);
    setAdvanced(false);
    setCloneFrom("__none__");
    setModel("");
    setProvider("");
    setSoul("");
    setNoSkills(false);
    setShareAuth(true);
    setAdvTab("general");
    setCaps(null);
    setCapsFailed(false);
    setDirtyCaps({ skills: false, toolsets: false, mcp: false });
    setCapFilter("");
    setBusy(false);
    setError(null);
  };
  const capSource = cloneFrom === "__none__" ? "default" : cloneFrom;
  const ensureCaps = () => {
    if (caps && caps.source === capSource || capsFailed) {
      return;
    }
    Promise.all([
      host2.request("profiles.describe", { name: capSource }),
      host2.request("mcp.catalog", {}).catch(() => null)
    ]).then(([res, cat]) => {
      const configured = res.mcp_servers || [];
      const have = new Set(configured.map((m) => m.name));
      const catalog = (cat && cat.servers || []).filter(
        (s) => !have.has(s.name)
      );
      setCaps({
        source: capSource,
        skills: res.skills || [],
        toolsets: res.toolsets || [],
        mcp: [
          ...configured,
          ...catalog.map((s) => ({
            name: s.name,
            enabled: false,
            fromCatalog: true,
            installed: s.installed,
            requires: s.requires || [],
            description: s.description || ""
          }))
        ]
      });
    }).catch(() => setCapsFailed(true));
  };
  const toggleCap = (kind, name2, enabled) => {
    setDirtyCaps((prev) => ({
      ...prev,
      [kind === "mcp" ? "mcp" : kind]: true
    }));
    setCaps(
      (prev) => prev ? {
        ...prev,
        [kind]: prev[kind].map(
          (x) => x.name === name2 ? { ...x, enabled } : x
        )
      } : prev
    );
  };
  const submit = async () => {
    if (!valid || taken || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const descriptionText = [title, description].filter(Boolean).join(" — ");
      await host2.request("profiles.create", {
        name: slug,
        description: descriptionText,
        clone_from: cloneFrom === "__none__" ? null : cloneFrom,
        no_skills: noSkills,
        // Shared (not copied) auth keeps ONE OAuth/token pool with the main
        // profile, so refreshes can't invalidate each other. Older gateways
        // ignore the param and copy — still functional, just forked.
        share_auth: shareAuth,
        soul: composeSoul({
          name: slug,
          title,
          description,
          roster,
          customSoul: soul
        }),
        ...model.trim() && provider.trim() ? { model: model.trim(), provider: provider.trim() } : {}
      });
      try {
        const capPayload = {};
        if (dirtyCaps.skills && caps) {
          capPayload.disabled_skills = caps.skills.filter((s) => !s.enabled).map((s) => s.name);
        }
        if (dirtyCaps.toolsets && caps) {
          const en = caps.toolsets.filter((t) => t.enabled);
          capPayload.enabled_toolsets = en.length === caps.toolsets.length || en.length === 0 ? [] : en.map((t) => t.name);
        }
        if (dirtyCaps.mcp && caps) {
          capPayload.enabled_mcp_servers = caps.mcp.filter((m) => m.enabled).map((m) => m.name);
        }
        if (Object.keys(capPayload).length) {
          await host2.request("profiles.configure", {
            name: slug,
            ...capPayload
          });
        }
      } catch {
      }
      saveBotMeta(slug, {
        shape,
        color,
        image,
        title: title.trim(),
        created: Date.now()
      });
      queryClient.invalidateQueries({ queryKey: ROSTER_KEY });
      host2.notify({
        kind: "success",
        message: `Agent "${displayName({ name: slug, title })}" created`
      });
      reset();
      onClose();
      $selectedBot.set(slug);
      try {
        const sid = await createCanonicalChat(slug);
        if (!sid && typeof host2.newChat === "function") {
          host2.newChat(slug);
        }
      } catch {
        if (typeof host2.newChat === "function") {
          host2.newChat(slug);
        }
      }
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return jsx2(Dialog2, {
    open,
    onOpenChange: (value) => {
      if (!value && !busy) {
        reset();
        onClose();
      }
    },
    children: jsxs2(DialogContent2, {
      className: advanced ? "max-w-3xl" : "max-w-md",
      // Native resize handle (bottom-right corner): the dialog becomes a
      // window the user can grow/shrink. overflow:auto is required for CSS
      // resize to engage; caps keep it on screen.
      style: advanced ? {
        resize: "both",
        overflow: "auto",
        minWidth: 420,
        minHeight: 360,
        maxWidth: "95vw",
        maxHeight: "90vh"
      } : void 0,
      children: [
        jsxs2(DialogHeader2, {
          children: [
            jsx2(DialogTitle2, { children: "New Agent" }),
            jsx2(DialogDescription, {
              children: "A named teammate with its own memory, skills, and chat. It can message your other agents."
            })
          ]
        }),
        jsxs2("div", {
          className: "grid gap-3.5",
          children: [
            jsx2("div", {
              className: "flex justify-center py-1",
              children: jsx2(BotFace, {
                shape,
                color,
                image,
                size: 56,
                name: slug || "agent"
              })
            }),
            jsx2(AvatarPicker, {
              shape,
              color,
              image,
              onShape: setShape,
              onColor: setColor,
              onImage: setImage,
              generateSeed: { name: slug || "agent", title, description }
            }),
            labeled(
              "Name",
              jsx2(Input2, {
                autoFocus: true,
                placeholder: "inbox-triage",
                value: name,
                onChange: (event) => setName(event.target.value)
              })
            ),
            taken ? jsx2("div", {
              className: "text-xs text-(--ui-accent)",
              children: `An agent named "${slug}" already exists.`
            }) : null,
            labeled(
              "Title",
              jsx2(Input2, {
                placeholder: "Inbox Triage",
                value: title,
                onChange: (event) => setTitle(event.target.value)
              })
            ),
            labeled(
              "Description",
              jsx2(Textarea2, {
                className: "min-h-16",
                placeholder: "What should this Bot help with?",
                value: description,
                onChange: (event) => setDescription(event.target.value)
              })
            ),
            jsxs2("button", {
              type: "button",
              className: "flex items-center gap-1 text-xs font-medium text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)",
              onClick: () => {
                setAdvanced((v) => {
                  if (!v) {
                    ensureCaps();
                  }
                  return !v;
                });
              },
              children: [
                jsx2(Codicon2, {
                  name: advanced ? "chevron-down" : "chevron-right",
                  className: "text-[0.8rem]"
                }),
                "Advanced"
              ]
            }),
            advanced ? jsxs2("div", {
              className: "grid gap-3 rounded-md border border-(--ui-stroke-secondary) p-3",
              children: [
                jsx2("div", {
                  className: "flex gap-1",
                  children: [
                    ["general", "General"],
                    ["skills", "Skills"],
                    ["toolsets", "Tools"],
                    ["mcp", "MCP"]
                  ].map(
                    ([id, label]) => jsx2(
                      "button",
                      {
                        type: "button",
                        className: cn(
                          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                          advTab === id ? "bg-(--chrome-action-hover) text-(--ui-text-primary)" : "text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)"
                        ),
                        onClick: () => {
                          setAdvTab(id);
                          setCapFilter("");
                          if (id !== "general") {
                            ensureCaps();
                          }
                        },
                        children: label
                      },
                      id
                    )
                  )
                }),
                advTab === "general" ? jsxs2("div", {
                  className: "grid gap-3.5",
                  children: [
                    labeled(
                      "Clone from profile",
                      jsxs2(Select, {
                        value: cloneFrom,
                        onValueChange: (value) => {
                          setCloneFrom(value);
                          setCaps(null);
                          setCapsFailed(false);
                        },
                        children: [
                          jsx2(SelectTrigger, {
                            className: "h-8 rounded-md",
                            children: jsx2(SelectValue, {})
                          }),
                          jsxs2(SelectContent, {
                            children: [
                              jsx2(SelectItem, {
                                value: "__none__",
                                children: "Fresh profile (bundled skills)"
                              }),
                              ...roster.map(
                                (b) => jsx2(
                                  SelectItem,
                                  { value: b.name, children: b.name },
                                  b.name
                                )
                              )
                            ]
                          })
                        ]
                      })
                    ),
                    jsx2(ModelPicker, {
                      value: { provider, model },
                      onChange: (patch) => {
                        if ("provider" in patch) {
                          setProvider(patch.provider);
                        }
                        if ("model" in patch) {
                          setModel(patch.model);
                        }
                      },
                      placeholderModel: "inherited from launch profile"
                    }),
                    labeled(
                      "SOUL.md (optional — replaces the generated persona)",
                      jsx2(Textarea2, {
                        className: "min-h-24 font-mono text-xs leading-5",
                        placeholder: "Leave blank to auto-generate from name/title/description + agent-messaging roster.",
                        value: soul,
                        onChange: (event) => setSoul(event.target.value)
                      })
                    ),
                    jsxs2("label", {
                      className: "flex items-center gap-2 text-xs text-(--ui-text-secondary)",
                      children: [
                        jsx2(Checkbox, {
                          checked: shareAuth,
                          onCheckedChange: (value) => setShareAuth(Boolean(value))
                        }),
                        "Share keys & accounts with the main profile"
                      ]
                    }),
                    jsx2("div", {
                      className: "pl-6 pt-0.5 text-[0.7rem] leading-5 text-(--ui-text-tertiary)",
                      children: "Subscriptions, OAuth logins, and API keys stay shared (not copied), so token refreshes never invalidate each other. Uncheck for an isolated snapshot copy."
                    }),
                    jsxs2("label", {
                      className: "flex items-center gap-2 text-xs text-(--ui-text-secondary)",
                      children: [
                        jsx2(Checkbox, {
                          checked: noSkills,
                          onCheckedChange: (value) => setNoSkills(Boolean(value))
                        }),
                        "Create empty (skip bundled skills)"
                      ]
                    })
                  ]
                }) : capsFailed ? jsx2("div", {
                  className: "px-2 py-3 text-center text-xs text-(--ui-text-tertiary)",
                  children: "Capability catalog needs a newer gateway (restart it after updating Hermes)."
                }) : caps ? advTab === "skills" ? noSkills ? jsx2("div", {
                  className: "px-2 py-3 text-center text-xs text-(--ui-text-tertiary)",
                  children: "“Create empty” is checked — no bundled skills will be installed."
                }) : jsxs2("div", {
                  className: "grid gap-1.5",
                  children: [
                    jsx2(Input2, {
                      className: "h-7 text-xs",
                      placeholder: "Filter skills…",
                      value: capFilter,
                      onChange: (event) => setCapFilter(event.target.value)
                    }),
                    jsx2(ScrollArea2, {
                      style: { maxHeight: 200 },
                      children: jsx2(CheckList, {
                        items: capFilter.trim() ? caps.skills.filter(
                          (s) => s.name.toLowerCase().includes(
                            capFilter.trim().toLowerCase()
                          )
                        ) : caps.skills,
                        onToggle: (name2, enabled) => toggleCap("skills", name2, enabled),
                        columns: 2
                      })
                    }),
                    jsx2("div", {
                      className: "text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
                      children: `Catalog from ${caps.source} — unchecked skills are disabled after creation.`
                    }),
                    jsx2(HubSkillsSection, {
                      forProfile: null,
                      onInstalled: (name2) => setCaps(
                        (prev) => !prev || prev.skills.some(
                          (s) => s.name === name2
                        ) ? prev : {
                          ...prev,
                          skills: [
                            ...prev.skills,
                            { name: name2, enabled: true }
                          ]
                        }
                      )
                    })
                  ]
                }) : advTab === "toolsets" ? jsxs2("div", {
                  className: "grid gap-1.5",
                  children: [
                    jsx2(ScrollArea2, {
                      style: { maxHeight: 200 },
                      children: jsx2(CheckList, {
                        items: caps.toolsets,
                        onToggle: (name2, enabled) => toggleCap("toolsets", name2, enabled),
                        columns: 2
                      })
                    }),
                    jsx2("div", {
                      className: "text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
                      children: "Leaving all (or none) checked keeps the default toolset behavior."
                    })
                  ]
                }) : caps.mcp.length === 0 ? jsx2("div", {
                  className: "px-2 py-3 text-center text-xs text-(--ui-text-tertiary)",
                  children: "No MCP servers configured or in the catalog."
                }) : jsxs2("div", {
                  className: "grid gap-1.5",
                  children: [
                    jsx2(ScrollArea2, {
                      style: { maxHeight: 200 },
                      children: jsx2("div", {
                        className: "grid gap-1",
                        children: caps.mcp.map((m) => {
                          const needsSetup = m.fromCatalog && !m.installed && (m.requires || []).length > 0;
                          return jsxs2(
                            "label",
                            {
                              className: "flex items-start gap-2 text-xs text-(--ui-text-secondary)",
                              children: [
                                jsx2(Checkbox, {
                                  checked: !!m.enabled,
                                  disabled: needsSetup,
                                  onCheckedChange: (value) => toggleCap(
                                    "mcp",
                                    m.name,
                                    Boolean(value)
                                  )
                                }),
                                jsxs2("span", {
                                  className: "min-w-0",
                                  children: [
                                    jsx2("span", {
                                      children: m.name
                                    }),
                                    m.fromCatalog ? jsx2("span", {
                                      className: "ml-1.5 text-[0.65rem] text-(--ui-text-quaternary)",
                                      children: needsSetup ? setupProfile ? null : "needs setup (" + (m.requires || []).join(", ") + ") — save the agent first, then set up here" : m.installed ? "catalog · installed" : "catalog"
                                    }) : null,
                                    needsSetup && setupProfile ? jsx2(McpSetupButton, {
                                      profile: setupProfile,
                                      entry: m,
                                      onDone: () => toggleCap(
                                        "mcp",
                                        m.name,
                                        true
                                      )
                                    }) : null,
                                    m.description ? jsx2("div", {
                                      className: "truncate text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
                                      children: m.description
                                    }) : null
                                  ]
                                })
                              ]
                            },
                            m.name
                          );
                        })
                      })
                    }),
                    jsx2("div", {
                      className: "text-[0.65rem] leading-4 text-(--ui-text-quaternary)",
                      children: "Configured servers copy from the main profile; catalog entries are the bundled MCP menu. Entries needing API keys route through setup first (credentials follow the shared keys setting)."
                    })
                  ]
                }) : jsx2("div", {
                  className: "flex justify-center py-4",
                  children: jsx2(GlyphSpinner, {
                    spinner: "breathe",
                    className: "text-(--ui-text-tertiary)"
                  })
                })
              ]
            }) : null,
            error ? jsx2("div", {
              className: "rounded-md border border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-accent)",
              children: error
            }) : null
          ]
        }),
        jsxs2(DialogFooter2, {
          children: [
            jsx2(Button2, {
              variant: "ghost",
              disabled: busy,
              onClick: () => {
                reset();
                onClose();
              },
              children: "Cancel"
            }),
            jsx2(Button2, {
              disabled: busy || !valid || taken,
              onClick: submit,
              children: busy ? "Creating…" : "Create Agent"
            })
          ]
        })
      ]
    })
  });
}
var BOT_TAG_RE = /^\[bot:([a-z0-9][a-z0-9_-]*)\]\s*/i;
function routineBot(job) {
  const match = BOT_TAG_RE.exec(job?.name || "");
  return match ? match[1].toLowerCase() : null;
}
function routineTitle(job) {
  return (job?.name || "").replace(BOT_TAG_RE, "") || "Untitled cronjob";
}
function useRoutines() {
  return useQuery({
    queryKey: ROUTINES_KEY,
    queryFn: () => host2.request("cron.manage", { action: "list", include_disabled: true }),
    refetchInterval: 2e4,
    staleTime: 8e3
  });
}
function normalizedProfileName(profile) {
  return typeof profile === "string" ? profile.trim().toLowerCase() : "";
}
function routinePrompt(bot, title, instruction, activeProfile) {
  if (normalizedProfileName(bot) && normalizedProfileName(bot) === normalizedProfileName(activeProfile)) {
    return instruction;
  }
  const safeBot = NAME_RE2.test(bot) ? bot : "default";
  const safeTitle = sanitizeTitle(title);
  return `You are running the scheduled routine ${JSON.stringify(safeTitle)} for agent '${safeBot}'. Execute it AS that agent so the run lands in its own history: run this in the terminal and relay the output:

hermes -p ${safeBot} chat -c ${shellQuote2(`Routine: ${safeTitle}`)} -q ${shellQuote2(`[Scheduled routine] ${instruction}`)}

Run the command EXACTLY as written — do not re-quote, expand, or "fix" it. If the command fails, report the error instead.`;
}
function scheduleLabel(schedule) {
  const once = /^once in (.+)$/.exec(schedule || "");
  if (once) {
    return `Once (${once[1]})`;
  }
  const bare = /^(\d+)([mhd])$/.exec(schedule || "");
  if (bare) {
    return `Once (${bare[1]}${bare[2]})`;
  }
  const match = /^every (\d+)m$/.exec(schedule || "");
  if (match) {
    const minutes = Number(match[1]);
    if (minutes % 1440 === 0) {
      const d = minutes / 1440;
      return d === 1 ? "Daily" : `Every ${d} days`;
    }
    if (minutes % 60 === 0) {
      const h = minutes / 60;
      return h === 1 ? "Hourly" : `Every ${h}h`;
    }
    return `Every ${minutes}m`;
  }
  return schedule || "";
}
function RoutineRow({ job, onChanged }) {
  const [busy, setBusy] = useState2(false);
  const [pendingActive, setPendingActive] = useState2(null);
  const serverActive = job.enabled !== false && job.state !== "paused";
  const active = pendingActive === null ? serverActive : pendingActive;
  if (pendingActive !== null && pendingActive === serverActive) {
    setPendingActive(null);
  }
  const act = async (action) => {
    if (busy) {
      return;
    }
    setBusy(true);
    if (action === "pause" || action === "resume") {
      setPendingActive(action === "resume");
    }
    try {
      await host2.request("cron.manage", { action, name: job.job_id });
      onChanged();
    } catch (err) {
      setPendingActive(null);
      host2.notifyError(err, "Cronjob update failed");
    } finally {
      setBusy(false);
    }
  };
  return jsxs2("div", {
    className: cn(
      "group grid gap-1.5 rounded-lg border border-(--ui-stroke-secondary) p-2.5 transition-colors",
      "hover:border-(--ui-stroke-primary, var(--ui-stroke-secondary))"
    ),
    children: [
      jsxs2("div", {
        className: "flex items-center gap-2",
        children: [
          jsx2("span", {
            "aria-hidden": true,
            className: cn(
              "size-1.5 shrink-0 rounded-full",
              active ? "bg-emerald-500" : "bg-(--ui-text-quaternary)"
            )
          }),
          jsx2("span", {
            className: cn(
              "min-w-0 flex-1 truncate text-xs font-medium",
              !active && "text-(--ui-text-tertiary)"
            ),
            children: routineTitle(job)
          }),
          jsx2(Switch, {
            checked: active,
            disabled: busy,
            onCheckedChange: (value) => act(value ? "resume" : "pause")
          }),
          jsx2(Tip, {
            label: "Delete cronjob",
            children: jsx2("button", {
              type: "button",
              disabled: busy,
              className: "flex size-5 items-center justify-center rounded text-(--ui-text-quaternary) opacity-0 transition-opacity group-hover:opacity-100 hover:bg-(--chrome-action-hover) hover:text-foreground",
              onClick: () => act("remove"),
              children: jsx2(Codicon2, {
                name: "trash",
                className: "text-[0.75rem]"
              })
            })
          })
        ]
      }),
      jsxs2("div", {
        className: "flex items-center justify-between gap-2 pl-3.5",
        children: [
          jsxs2("span", {
            className: "inline-flex items-center gap-1 rounded-full border border-(--ui-stroke-secondary) px-1.5 py-0.5 text-[0.65rem] text-(--ui-text-tertiary)",
            children: [
              jsx2(Codicon2, { name: "calendar", className: "text-[0.7rem]" }),
              scheduleLabel(job.schedule)
            ]
          }),
          jsx2("span", {
            className: "truncate text-[0.65rem] text-(--ui-text-quaternary)",
            children: active && job.next_run_at ? `next ${relativeTime(new Date(job.next_run_at).getTime())}` : "paused"
          })
        ]
      })
    ]
  });
}
var FREQUENCIES = [
  { id: "once", label: "Once, in…" },
  { id: "hourly", label: "Every hour" },
  { id: "daily", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekly", label: "Every week" },
  { id: "monthly", label: "Every month" },
  { id: "interval", label: "Interval" },
  { id: "advanced", label: "Advanced…" }
];
var WEEKDAYS = [
  { id: "1", label: "Monday" },
  { id: "2", label: "Tuesday" },
  { id: "3", label: "Wednesday" },
  { id: "4", label: "Thursday" },
  { id: "5", label: "Friday" },
  { id: "6", label: "Saturday" },
  { id: "0", label: "Sunday" }
];
var TIMES = (() => {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const ampm = h < 12 ? "AM" : "PM";
      const h12 = h % 12 === 0 ? 12 : h % 12;
      out.push({
        id: `${h}:${m}`,
        label: `${h12}:${String(m).padStart(2, "0")} ${ampm}`,
        h,
        m
      });
    }
  }
  return out;
})();
function composeSchedule(state) {
  const [h, m] = (state.time || "9:0").split(":").map(Number);
  switch (state.freq) {
    case "once": {
      const n = Math.max(1, parseInt(state.onceN, 10) || 1);
      return `${n}${state.onceUnit || "h"}`;
    }
    case "hourly":
      return "every 1h";
    case "daily":
      return `${m} ${h} * * *`;
    case "weekdays":
      return `${m} ${h} * * 1-5`;
    case "weekly":
      return `${m} ${h} * * ${state.weekday || "1"}`;
    case "monthly":
      return `${m} ${h} ${state.monthday || "1"} * *`;
    case "interval": {
      const n = Math.max(1, parseInt(state.intervalN, 10) || 1);
      return `every ${n}${state.intervalUnit || "h"}`;
    }
    default:
      return state.raw || "";
  }
}
function scheduleSummary(state) {
  const t = TIMES.find((x) => x.id === state.time);
  const tl = t ? t.label : "9:00 AM";
  const unitWord = (u) => u === "m" ? "minute(s)" : u === "d" ? "day(s)" : "hour(s)";
  const cap = state.freq !== "once" && String(state.repeatN || "").trim() ? `, ${Math.max(1, parseInt(state.repeatN, 10) || 1)} time(s) total` : "";
  switch (state.freq) {
    case "once":
      return `Runs once, ${Math.max(1, parseInt(state.onceN, 10) || 1)} ${unitWord(state.onceUnit)} from now`;
    case "hourly":
      return "Runs at the top of every hour" + cap;
    case "daily":
      return `Runs every day at ${tl}` + cap;
    case "weekdays":
      return `Runs Monday–Friday at ${tl}` + cap;
    case "weekly":
      return `Runs every ${(WEEKDAYS.find((w) => w.id === state.weekday) || WEEKDAYS[0]).label} at ${tl}` + cap;
    case "monthly":
      return `Runs on day ${state.monthday || "1"} of each month at ${tl}` + cap;
    case "interval":
      return `Runs every ${Math.max(1, parseInt(state.intervalN, 10) || 1)} ${unitWord(state.intervalUnit)}` + cap;
    default:
      return "Raw schedule — every Nm/Nh/Nd or 5-field cron";
  }
}
function pickerSelect(value, onChange, options) {
  return jsxs2(Select, {
    value,
    onValueChange: onChange,
    children: [
      jsx2(SelectTrigger, {
        className: "h-8 rounded-md",
        children: jsx2(SelectValue, {})
      }),
      jsx2(SelectContent, {
        children: options.map(
          (o) => jsx2(SelectItem, { value: o.id, children: o.label }, o.id)
        )
      })
    ]
  });
}
function SchedulePicker({ state, setState }) {
  const upd = (patch) => setState((prev) => ({ ...prev, ...patch }));
  const needsTime = ["daily", "weekdays", "weekly", "monthly"].includes(
    state.freq
  );
  return jsxs2("div", {
    className: "grid gap-2",
    children: [
      jsxs2("div", {
        style: {
          display: "grid",
          gridTemplateColumns: needsTime ? "1fr 1fr" : "1fr",
          gap: "8px"
        },
        children: [
          pickerSelect(state.freq, (v) => upd({ freq: v }), FREQUENCIES),
          needsTime ? pickerSelect(state.time, (v) => upd({ time: v }), TIMES) : null
        ]
      }),
      state.freq === "once" ? jsxs2("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px"
        },
        children: [
          jsx2(Input2, {
            className: "h-8",
            placeholder: "30",
            value: state.onceN,
            onChange: (event) => upd({
              onceN: event.target.value.replace(/[^0-9]/g, "").slice(0, 4)
            })
          }),
          pickerSelect(state.onceUnit, (v) => upd({ onceUnit: v }), [
            { id: "m", label: "minutes from now" },
            { id: "h", label: "hours from now" },
            { id: "d", label: "days from now" }
          ])
        ]
      }) : null,
      state.freq === "weekly" ? pickerSelect(state.weekday, (v) => upd({ weekday: v }), WEEKDAYS) : null,
      state.freq === "monthly" ? labeled(
        "Day of month",
        jsx2(Input2, {
          className: "h-8",
          placeholder: "1",
          value: state.monthday,
          onChange: (event) => upd({
            monthday: event.target.value.replace(/[^0-9]/g, "").slice(0, 2)
          })
        })
      ) : null,
      state.freq === "interval" ? jsxs2("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px"
        },
        children: [
          jsx2(Input2, {
            className: "h-8",
            placeholder: "2",
            value: state.intervalN,
            onChange: (event) => upd({
              intervalN: event.target.value.replace(/[^0-9]/g, "").slice(0, 4)
            })
          }),
          pickerSelect(
            state.intervalUnit,
            (v) => upd({ intervalUnit: v }),
            [
              { id: "m", label: "minutes" },
              { id: "h", label: "hours" },
              { id: "d", label: "days" }
            ]
          )
        ]
      }) : null,
      state.freq === "advanced" ? jsx2(Input2, {
        className: "h-8 font-mono text-xs",
        placeholder: "every 1d · every 2h · 0 9 * * * (cron)",
        value: state.raw,
        onChange: (event) => upd({ raw: event.target.value })
      }) : null,
      state.freq !== "once" && state.freq !== "advanced" ? jsxs2("div", {
        className: "flex items-center gap-2",
        children: [
          jsx2("span", {
            className: "text-xs text-(--ui-text-tertiary)",
            children: "Stop after"
          }),
          jsx2(Input2, {
            className: "h-7 w-16 text-xs",
            placeholder: "∞",
            value: state.repeatN,
            onChange: (event) => upd({
              repeatN: event.target.value.replace(/[^0-9]/g, "").slice(0, 4)
            })
          }),
          jsx2("span", {
            className: "text-xs text-(--ui-text-tertiary)",
            children: "runs (blank = forever)"
          })
        ]
      }) : null,
      jsx2("div", {
        className: "text-[0.65rem] text-(--ui-text-quaternary)",
        children: `${scheduleSummary(state)} · ${composeSchedule(state) || "—"}`
      })
    ]
  });
}
function defaultScheduleState() {
  return {
    freq: "daily",
    time: "9:0",
    weekday: "1",
    monthday: "1",
    intervalN: "2",
    intervalUnit: "h",
    onceN: "30",
    onceUnit: "m",
    repeatN: "",
    raw: ""
  };
}
function CreateRoutineDialog({ bot, open, onClose }) {
  const [name, setName] = useState2("");
  const [instruction, setInstruction] = useState2("");
  const [sched, setSched] = useState2(defaultScheduleState());
  const [busy, setBusy] = useState2(false);
  const [error, setError] = useState2(null);
  const activeProfile = useValue2(host2.state.profile);
  const schedule = composeSchedule(sched);
  const reset = () => {
    setName("");
    setInstruction("");
    setSched(defaultScheduleState());
    setBusy(false);
    setError(null);
  };
  const submit = async () => {
    const title = name.trim();
    const task = instruction.trim();
    if (!title || !task || !schedule.trim() || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const repeatN = sched.freq !== "once" && sched.freq !== "advanced" && String(sched.repeatN || "").trim() ? Math.max(1, parseInt(sched.repeatN, 10) || 1) : null;
      await host2.request("cron.manage", {
        action: "add",
        name: `[bot:${bot}] ${title}`,
        schedule: schedule.trim(),
        prompt: routinePrompt(bot, title, task, activeProfile),
        ...repeatN ? { repeat: repeatN } : {}
      });
      queryClient.invalidateQueries({ queryKey: ROUTINES_KEY });
      host2.notify({ kind: "success", message: `Cronjob "${title}" scheduled` });
      reset();
      onClose();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  return jsx2(Dialog2, {
    open,
    onOpenChange: (value) => {
      if (!value && !busy) {
        reset();
        onClose();
      }
    },
    children: jsxs2(DialogContent2, {
      className: "max-w-md",
      children: [
        jsxs2(DialogHeader2, {
          children: [
            jsx2(DialogTitle2, { children: "New Cronjob" }),
            jsx2(DialogDescription, {
              children: `A recurring task ${displayName({ name: bot }, $botMeta.get()[bot])} runs on a schedule. Runs land in its own chat history.`
            })
          ]
        }),
        jsxs2("div", {
          className: "grid gap-3.5",
          children: [
            labeled(
              "Name",
              jsx2(Input2, {
                autoFocus: true,
                placeholder: "Name this cronjob",
                value: name,
                onChange: (event) => setName(event.target.value)
              })
            ),
            labeled(
              "Instruction",
              jsx2(Textarea2, {
                className: "min-h-20",
                placeholder: "What should this cronjob do each time it runs?",
                value: instruction,
                onChange: (event) => setInstruction(event.target.value)
              })
            ),
            labeled(
              "When to run",
              jsx2(SchedulePicker, { state: sched, setState: setSched })
            ),
            error ? jsx2("div", {
              className: "rounded-md border border-(--ui-stroke-secondary) px-3 py-2 text-xs text-(--ui-accent)",
              children: error
            }) : null
          ]
        }),
        jsxs2(DialogFooter2, {
          children: [
            jsx2(Button2, {
              variant: "ghost",
              disabled: busy,
              onClick: () => {
                reset();
                onClose();
              },
              children: "Cancel"
            }),
            jsx2(Button2, {
              disabled: busy || !name.trim() || !instruction.trim() || !schedule.trim(),
              onClick: submit,
              children: busy ? "Scheduling…" : "Create Cronjob"
            })
          ]
        })
      ]
    })
  });
}
function RoutinesPane() {
  const selected = useValue2($selectedBot);
  const gatewayProfile = useValue2(host2.state.profile);
  const bot = (gatewayProfile || selected || "default").trim() || "default";
  const meta = useValue2($botMeta)[bot];
  const { shape, color, image } = botAppearance(bot, meta);
  const { data, isLoading, refetch } = useRoutines();
  const [createOpen, setCreateOpen] = useState2(false);
  const jobs = (data?.jobs ?? []).filter((job) => routineBot(job) === bot);
  return jsxs2("div", {
    className: "flex h-full flex-col",
    children: [
      jsxs2("div", {
        className: "flex items-center gap-2 px-3 pt-3 pb-2",
        children: [
          jsx2(BotFace, { shape, color, image, size: 22, name: bot }),
          jsxs2("div", {
            className: "min-w-0 flex-1",
            children: [
              jsxs2("div", {
                className: "flex min-w-0 items-baseline gap-1.5 truncate",
                children: [
                  jsx2("div", {
                    className: "truncate text-xs font-semibold",
                    children: displayName({ name: bot }, meta)
                  }),
                  showsHandle(bot, meta) ? jsx2("span", {
                    className: "shrink-0 font-mono text-[0.65rem] text-(--ui-text-quaternary)",
                    children: `@${botHandle(bot)}`
                  }) : null
                ]
              }),
              jsx2("div", {
                className: "text-[0.65rem] uppercase tracking-wider text-(--ui-text-quaternary)",
                children: "Cronjobs"
              })
            ]
          }),
          jsx2(Tip, {
            label: "New Cronjob",
            children: jsx2("button", {
              type: "button",
              className: "flex size-6 shrink-0 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground",
              onClick: () => setCreateOpen(true),
              children: jsx2(Codicon2, { name: "add" })
            })
          })
        ]
      }),
      jsx2("div", { className: "mx-3 border-t border-(--ui-stroke-secondary)" }),
      isLoading ? jsx2("div", {
        className: "flex flex-1 items-center justify-center",
        children: jsx2(GlyphSpinner, {
          spinner: "breathe",
          className: "text-(--ui-text-tertiary)"
        })
      }) : jobs.length === 0 ? jsxs2("div", {
        className: "flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center",
        children: [
          jsx2(Codicon2, {
            name: "calendar",
            className: "text-[1.6rem] text-(--ui-text-quaternary)"
          }),
          jsx2("div", {
            className: "text-xs leading-5 text-(--ui-text-tertiary)",
            children: "Cronjobs are recurring tasks this agent runs on a schedule."
          }),
          jsx2(Button2, {
            variant: "secondary",
            size: "sm",
            onClick: () => setCreateOpen(true),
            children: "Create Cronjob"
          })
        ]
      }) : jsx2(ScrollArea2, {
        className: "min-h-0 flex-1",
        children: jsx2("div", {
          className: "grid gap-1.5 px-2.5 py-2",
          children: jobs.map(
            (job) => jsx2(
              RoutineRow,
              { job, onChanged: () => void refetch() },
              job.job_id
            )
          )
        })
      }),
      jsx2(CreateRoutineDialog, {
        bot,
        open: createOpen,
        onClose: () => {
          setCreateOpen(false);
          void refetch();
        }
      })
    ]
  });
}
function BotsPane() {
  const { data, error, isLoading, refetch } = useRoster();
  const gatewayUp = useValue2(host2.state.gateway) === "open";
  const [createOpen, setCreateOpen] = useState2(false);
  const [editing, setEditing] = useState2(null);
  const prevGatewayUp = useRef(gatewayUp);
  useEffect2(() => {
    if (gatewayUp && !prevGatewayUp.current) {
      resetWatermarks();
    }
    prevGatewayUp.current = gatewayUp;
    if (gatewayUp) {
      void refetch();
    }
  }, [gatewayUp, refetch]);
  const allMeta = $botMeta.get();
  const activityOf = (bot) => {
    const created = allMeta[bot.name]?.created || bot.ui_meta?.["hermes-bots"]?.created || 0;
    const lastMsg = (bot.last_session?.last_active || 0) * 1e3;
    return Math.max(created, lastMsg);
  };
  const isPinned = (bot) => Boolean(allMeta[bot.name]?.pinned);
  const live = Array.isArray(data?.profiles) ? data.profiles : null;
  const source = live ?? (error ? $lastRoster.get() : []);
  const roster = source.slice().sort((a, b) => {
    const pa = isPinned(a) ? 1 : 0;
    const pb = isPinned(b) ? 1 : 0;
    if (pa !== pb) {
      return pb - pa;
    }
    return activityOf(b) - activityOf(a);
  });
  if (live) {
    $lastRoster.set(roster);
    mergeServerMeta(live);
    pullServerAvatars(live);
    trackInboundActivity(live);
    if (typeof host2.warmProfile === "function") {
      for (const bot of live) {
        try {
          host2.warmProfile(bot.name);
        } catch {
        }
      }
    }
  }
  const staleNotice = error && !live && roster.length ? "Roster refresh failed — showing the last good list." + (gatewayUp ? "" : " Waiting for the gateway to reconnect…") : null;
  return jsxs2("div", {
    className: "flex h-full flex-col",
    children: [
      jsxs2("div", {
        className: "flex items-center justify-between gap-2 px-2.5 pt-2.5 pb-1.5",
        children: [
          jsx2("span", {
            className: "text-[0.6875rem] font-semibold uppercase tracking-wider text-(--ui-text-quaternary)",
            children: "Bots"
          }),
          jsx2(Tip, {
            label: "New Agent",
            children: jsx2("button", {
              type: "button",
              className: "flex size-6 items-center justify-center rounded-md text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground",
              onClick: () => setCreateOpen(true),
              children: jsx2(Codicon2, { name: "add" })
            })
          })
        ]
      }),
      staleNotice ? jsx2("div", {
        className: "mx-2.5 mb-1 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)",
        children: staleNotice
      }) : null,
      isLoading && !roster.length ? jsx2("div", {
        className: "flex flex-1 items-center justify-center",
        children: jsx2(GlyphSpinner, {
          spinner: "breathe",
          className: "text-(--ui-text-tertiary)"
        })
      }) : error && !roster.length ? jsxs2("div", {
        className: "grid gap-2 px-3 py-4 text-xs text-(--ui-text-tertiary)",
        children: [
          jsx2("div", {
            children: gatewayUp ? `Roster unavailable: ${error instanceof Error ? error.message : "gateway error"}. If your gateway predates profiles.list, update Hermes and restart the gateway.` : "Waiting for the gateway connection… (remote gateways can take a few seconds; retries automatically)"
          }),
          jsx2(Button2, {
            variant: "secondary",
            size: "sm",
            className: "justify-self-start",
            onClick: () => void refetch(),
            children: "Retry now"
          })
        ]
      }) : roster.length === 0 ? jsx2(EmptyState2, {
        icon: "hubot",
        title: "No agents yet",
        description: "Create your first teammate."
      }) : jsx2(ScrollArea2, {
        className: "hermes-bots-roster min-h-0 flex-1",
        children: jsx2("div", {
          className: "grid w-full min-w-0 gap-0.5 px-1.5 pb-2",
          children: roster.map(
            (bot) => jsx2(BotRow, { bot, onEdit: setEditing }, bot.name)
          )
        })
      }),
      jsx2(GroupsSection, { roster }),
      jsx2("div", {
        className: "border-t border-(--ui-stroke-secondary) p-2",
        children: jsxs2(Button2, {
          className: "w-full justify-center gap-1.5",
          variant: "secondary",
          onClick: () => setCreateOpen(true),
          children: [jsx2(Codicon2, { name: "add" }), "New Agent"]
        })
      }),
      jsx2(CreateAgentDialog, {
        open: createOpen,
        onClose: () => {
          setCreateOpen(false);
          void refetch();
        },
        roster
      }),
      jsx2(EditProfileDialog, {
        bot: editing,
        open: Boolean(editing),
        onClose: () => {
          setEditing(null);
          void refetch();
        }
      })
    ]
  });
}
var plugin_entry_default = {
  id: ID,
  name: "Bots",
  register(ctx) {
    pluginCtx = ctx;
    if (!document.getElementById("hermes-bots-keyframes")) {
      const style = document.createElement("style");
      style.id = "hermes-bots-keyframes";
      style.textContent = "@keyframes hermes-bots-bob { from { transform: translateY(0); } to { transform: translateY(-3px); } }";
      document.head.appendChild(style);
    }
    try {
      Promise.resolve(ctx.storage?.get?.("bot-meta")).then((value) => {
        if (value && typeof value === "object") {
          const migrated = Object.fromEntries(
            Object.entries(value).map(([k, v]) => [k, migrateChatPin(v)])
          );
          $botMeta.set(migrated);
          if (JSON.stringify(migrated) !== JSON.stringify(value)) {
            try {
              Promise.resolve(ctx.storage?.set?.("bot-meta", migrated)).catch(
                () => void 0
              );
            } catch {
            }
          }
        }
      }).catch(() => void 0);
    } catch {
    }
    setGroupsPluginCtx(ctx);
    try {
      Promise.resolve(ctx.storage?.get?.("groups")).then((v) => {
        if (v !== void 0) hydrateGroups(v);
      }).catch(() => void 0);
    } catch {
    }
    host2.state.profile.listen((profile) => {
      if (profile && typeof profile === "string") {
        $selectedBot.set(profile);
      }
    });
    ctx.register({
      id: "pane",
      area: "panes",
      title: "Bots",
      data: { placement: "left", width: "260px" },
      render: () => jsx2(BotsPane, {})
    });
    ctx.register({
      id: "routines",
      area: "panes",
      title: "Cronjobs",
      data: {
        placement: "main",
        dock: { pane: "workspace", pos: "right" },
        width: "250px"
      },
      render: () => jsx2(RoutinesPane, {})
    });
    ctx.register({
      id: "new-agent",
      area: PALETTE_AREA,
      data: {
        id: `${ID}.new-agent`,
        label: "New Agent…",
        keywords: ["bot", "agent", "profile", "teammate", "create"],
        run: () => {
          host2.notify({
            kind: "info",
            message: "Open the Bots pane and hit “New Agent”."
          });
        }
      }
    });
    ctx.register({
      id: "mention-middleware",
      area: COMPOSER_AREAS.middleware,
      data: {
        handler: async (draft) => {
          const text = draft.text || "";
          const slashNew = /^\/(new|reset)\s*$/.exec(text.trim());
          if (slashNew) {
            const activeBot = $selectedBot.get();
            const meta = activeBot ? $botMeta.get()[activeBot] : null;
            const pinnedId = meta?.chat || meta?.chat_pin || null;
            const currentId = host2.activeSessionId?.get?.() ?? null;
            if (activeBot && pinnedId && currentId && String(currentId) === String(pinnedId)) {
              host2.notify({
                kind: "info",
                title: "This chat never resets",
                message: "Bot chats are one continuous conversation — compacting instead. For a throwaway session with this agent, use Sessions mode."
              });
              return { ...draft, text: "/compact" };
            }
          }
          if (!/(^|\s)@[a-z0-9][a-z0-9_-]*/i.test(text)) {
            return draft;
          }
          let names = [];
          try {
            const res = await host2.request("profiles.list", {
              include_sessions: false
            });
            names = (res?.profiles ?? []).map((p) => p.name);
          } catch {
            return draft;
          }
          const prose = text.replace(/```[\s\S]*?```/g, " ").replace(/`[^`\n]*`/g, " ");
          const active = (host2.state.profile.get() || "default").trim() || "default";
          const mentioned = [];
          for (const match of prose.matchAll(
            /(^|\s)@([a-z0-9][a-z0-9_-]*)/gi
          )) {
            let name = match[2].toLowerCase();
            if (name === "hermes" && !names.includes("hermes") && names.includes("default")) {
              name = "default";
            }
            if (names.includes(name) && name !== active && !mentioned.includes(name)) {
              mentioned.push(name);
            }
          }
          if (!mentioned.length) {
            return draft;
          }
          const activeMeta = $botMeta.get()[active];
          const rawSender = displayName(
            { name: active, title: activeMeta?.title },
            activeMeta
          );
          const senderName = sanitizeTitle(rawSender, 40) || "agent";
          const safeHandle = botHandle(active).replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || "agent";
          const prefixExample = `Message from 🤖 ${senderName} (@${safeHandle}): `;
          const note = "\n\n[@mention handoff — for each mentioned agent (" + mentioned.map(botHandle).join(", ") + "): COMPOSE a message from you (" + senderName + ") to that agent conveying what the user wants — do not forward this text verbatim. Send it with exactly one terminal call, run with background=true AND notify_on_complete=true (the recipient may take minutes; the user must not be blocked):\n" + mentioned.map(
            (n) => "`hermes -p " + n + " chat --in ~ -c 'Bot Chat' -Q -q " + shellQuote2(prefixExample + "<your composed message>") + "`"
          ).join("\n") + '\nAfter dispatching, tell the user the message was sent and END YOUR TURN — do not wait or poll; when the background process completes, its notification carries the reply — relay it then, attributed to that agent. If it fails with "No session found matching \'Bot Chat\'", send once without the -c flag, then run `hermes -p <agent> sessions rename <session_id from the output> "Bot Chat"`. Relay the reply back to the user, attributed to that agent.]';
          return { ...draft, text: text + note };
        }
      }
    });
  }
};
export {
  plugin_entry_default as default
};
