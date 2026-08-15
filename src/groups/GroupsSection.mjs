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
  useValue,
} from "@hermes/plugin-sdk";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  $groups,
  createGroup,
  deleteGroup,
  getGroup,
  persistGroups,
  postToGroup,
} from "./store.mjs";

let pluginCtxRef = null;
export function setGroupsPluginCtx(ctx) {
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
            children: jsx(DialogTitle, { children: "New Group" }),
          }),
          error
            ? jsx("div", { className: "text-sm text-red-500", children: error })
            : null,
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Group name",
              }),
              jsx(Input, {
                value: name,
                onChange: (e) => setName(e.target.value),
                placeholder: "Engineering",
              }),
            ],
          }),
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Description (optional)",
              }),
              jsx(Input, {
                value: description,
                onChange: (e) => setDescription(e.target.value),
                placeholder: "Shared channel",
              }),
            ],
          }),
          jsxs("div", {
            className: "grid gap-2",
            children: [
              jsx("label", {
                className: "text-sm font-medium",
                children: "Members",
              }),
              roster.length === 0
                ? jsx("div", {
                    className: "text-sm text-muted-foreground",
                    children: "No agents available",
                  })
                : jsx(ScrollArea, {
                    className: "max-h-40 rounded border p-2",
                    children: jsx("div", {
                      className: "grid gap-1",
                      children: roster.map((bot) =>
                        jsxs(
                          "label",
                          {
                            className: "flex items-center gap-2 text-sm",
                            children: [
                              jsx("input", {
                                type: "checkbox",
                                checked: Boolean(selected[bot.name]),
                                onChange: () => toggle(bot.name),
                              }),
                              jsx("span", { children: bot.name }),
                              bot.title
                                ? jsx("span", {
                                    className: "text-xs text-muted-foreground",
                                    children: `— ${bot.title}`,
                                  })
                                : null,
                            ],
                          },
                          bot.name,
                        ),
                      ),
                    }),
                  }),
            ],
          }),
          jsx(DialogFooter, {
            children: jsxs("div", {
              className: "flex justify-end gap-2",
              children: [
                jsx(Button, {
                  variant: "ghost",
                  onClick: onClose,
                  children: "Cancel",
                }),
                jsx(Button, { onClick: handleCreate, children: "Create" }),
              ],
            }),
          }),
        ],
      }),
    }),
  });
}

function GroupRow({ group, onPost, onDelete, expandAll }) {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (expandAll !== undefined) setExpanded(expandAll);
  }, [expandAll]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lastMsg =
    group.room && group.room.length ? group.room[group.room.length - 1] : null;
  const preview = lastMsg
    ? `${lastMsg.senderName}: ${String(lastMsg.content).slice(0, 60)}`
    : `${group.memberIds.length} members — no messages yet`;

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
                children: group.name,
              }),
              jsx("div", {
                className: "truncate text-xs text-muted-foreground",
                children: preview,
              }),
            ],
          }),
          jsx(Codicon, {
            name: expanded ? "chevron-up" : "chevron-down",
            className: "shrink-0 text-muted-foreground",
          }),
        ],
      }),
      expanded
        ? jsxs("div", {
            className: "mt-2 grid gap-2",
            children: [
              jsxs("div", {
                className: "text-xs text-muted-foreground",
                children: ["Members: ", group.memberIds.join(", ")],
              }),
              group.description
                ? jsx("div", {
                    className: "text-xs",
                    children: group.description,
                  })
                : null,
              group.room && group.room.length
                ? jsx(ScrollArea, {
                    className: "max-h-32 rounded bg-muted/30 p-2",
                    children: jsx("div", {
                      className: "grid gap-1",
                      children: group.room.slice(-10).map((m) =>
                        jsxs(
                          "div",
                          {
                            className: "text-xs",
                            children: [
                              jsx("span", {
                                className: "font-medium",
                                children: `${m.senderName}: `,
                              }),
                              jsx("span", { children: m.content }),
                            ],
                          },
                          m.id,
                        ),
                      ),
                    }),
                  })
                : jsx("div", {
                    className: "text-xs text-muted-foreground",
                    children: "No messages yet",
                  }),
              jsxs("div", {
                className: "flex gap-2",
                children: [
                  jsx(Textarea, {
                    value: draft,
                    onChange: (e) => setDraft(e.target.value),
                    placeholder: "Message group…",
                    rows: 2,
                    className: "min-h-[60px] flex-1",
                  }),
                  jsx(Button, {
                    onClick: handleSend,
                    disabled: sending || !draft.trim(),
                    children: sending ? "Sending…" : "Send",
                  }),
                ],
              }),
              jsxs("div", {
                className: "flex justify-end pt-1",
                children: [
                  jsx(Button, {
                    variant: "ghost",
                    size: "sm",
                    className: "text-destructive hover:text-destructive",
                    onClick: () => setConfirmDelete(true),
                    children: "Delete group",
                  }),
                ],
              }),
              confirmDelete
                ? jsx(Dialog, {
                    open: true,
                    onOpenChange: (o) => !o && setConfirmDelete(false),
                    children: jsx(DialogContent, {
                      children: jsxs("div", {
                        className: "grid gap-4",
                        children: [
                          jsx(DialogHeader, {
                            children: jsx(DialogTitle, {
                              children: `Delete "${group.name}"?`,
                            }),
                          }),
                          jsx("div", {
                            className: "text-sm text-muted-foreground",
                            children:
                              "This will remove the group and its transcript. This cannot be undone.",
                          }),
                          jsxs("div", {
                            className: "flex justify-end gap-2",
                            children: [
                              jsx(Button, {
                                variant: "ghost",
                                onClick: () => setConfirmDelete(false),
                                children: "Cancel",
                              }),
                              jsx(Button, {
                                variant: "destructive",
                                onClick: () => {
                                  setConfirmDelete(false);
                                  onDelete(group.id);
                                },
                                children: "Delete",
                              }),
                            ],
                          }),
                        ],
                      }),
                    }),
                  })
                : null,
            ],
          })
        : null,
    ],
  });
}

export function GroupsSection({ roster }) {
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
    let sender = active;
    if (!group.memberIds.includes(sender)) {
      if (group.memberIds.length === 0) {
        host.notify({ kind: "error", message: "Group has no members" });
        return;
      }
      console.log(
        `[Groups] active ${sender} not in group, falling back to ${group.memberIds[0]}`,
      );
      sender = group.memberIds[0];
    }

    let result;
    try {
      result = postToGroup({ groupId, senderName: sender, content });
      console.log("[Groups] postToGroup result", result);
    } catch (e) {
      console.error("[Groups] postToGroup failed", e);
      host.notify({ kind: "error", message: e?.message || String(e) });
      throw e;
    }

    // Persist updated room first so the message appears immediately even if fan-out lags or fails.
    try {
      persistGroups(pluginCtxRef, result.next);
      console.log("[Groups] persisted, new groups", result.next);
    } catch (e) {
      console.error("[Groups] persist failed", e);
    }

    // If there are no other members, just confirm the save.
    if (result.fanOutCommands.length === 0) {
      console.log("[Groups] no fan-out needed (sole member)");
      host.notify({
        kind: "info",
        message: "Message saved (no other members to notify)",
      });
      return;
    }

    // Fan-out: try the host CLI first, with fallbacks. Each send is best-effort.
    const failures = [];
    const successes = [];
    for (const cmd of result.fanOutCommands) {
      console.log(`[Groups] fan-out to ${cmd.targetAgent}`, {
        argv: cmd.argv,
        cliCommand: cmd.cliCommand,
      });
      let ok = false;
      // 1) Preferred: cli.exec with argv (no shell, no "hermes" prefix — matches existing "profile describe" usage).
      try {
        const res = await host.request("cli.exec", { argv: cmd.argv });
        console.log(
          `[Groups] cli.exec argv result for ${cmd.targetAgent}`,
          res,
        );
        if (res && res.code === 0 && !res.blocked) {
          ok = true;
        } else if (res?.output?.includes("No session found")) {
          console.log(
            `[Groups] No session for ${cmd.targetAgent}, retrying without -c`,
          );
          const fallbackArgv = cmd.argv.filter(
            (a, idx, arr) => a !== "-c" && arr[idx - 1] !== "-c",
          );
          try {
            const res2 = await host.request("cli.exec", { argv: fallbackArgv });
            console.log(
              `[Groups] fallback without -c for ${cmd.targetAgent}`,
              res2,
            );
            if (res2 && res2.code === 0 && !res2.blocked) {
              ok = true;
              // Rename the newly created session to the room name so future sends can use -c.
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
                      `[Room: ${group.name}]`,
                    ],
                  });
                  console.log(
                    `[Groups] renamed ${sid} to [Room: ${group.name}] for ${cmd.targetAgent}`,
                    rn,
                  );
                } catch (eRn) {
                  console.warn(
                    `[Groups] rename failed for ${cmd.targetAgent}:`,
                    eRn?.message || eRn,
                  );
                }
              }
            } else
              console.warn(
                `[Groups] fallback without -c failed for ${cmd.targetAgent}:`,
                res2,
              );
          } catch (errFb) {
            console.warn(
              `[Groups] fallback without -c threw for ${cmd.targetAgent}:`,
              errFb?.message || errFb,
            );
          }
          if (!ok) throw new Error(res?.output || `cli.exec code ${res?.code}`);
        } else {
          console.warn(
            `[Groups] cli.exec argv non-zero for ${cmd.targetAgent}:`,
            res,
          );
          throw new Error(res?.output || `cli.exec code ${res?.code}`);
        }
      } catch (err) {
        console.warn(
          `[Groups] cli.exec argv failed for ${cmd.targetAgent}:`,
          err?.message || err,
        );
        // 2) Fallback: try with "hermes" prefix in case this host expects it.
        try {
          const res2 = await host.request("cli.exec", {
            argv: ["hermes", ...cmd.argv],
          });
          console.log(
            `[Groups] cli.exec with hermes prefix ok for ${cmd.targetAgent}`,
            res2,
          );
          ok = true;
        } catch (err2) {
          console.warn(
            `[Groups] cli.exec with prefix also failed for ${cmd.targetAgent}:`,
            err2?.message || err2,
          );
          // 3) Last resort: try terminal if the host exposes it (LLM path uses terminal with background).
          try {
            if (typeof host.request === "function") {
              const res3 = await host.request("terminal.run", {
                command: cmd.cliCommand,
                background: true,
              });
              console.log(
                `[Groups] terminal.run ok for ${cmd.targetAgent}`,
                res3,
              );
              ok = true;
            }
          } catch (err3) {
            console.warn(
              `[Groups] terminal.run failed for ${cmd.targetAgent}:`,
              err3?.message || err3,
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
        message: `Sent to ${successes.length} members`,
      });
    } else if (successes.length > 0) {
      host.notify({
        kind: "info",
        message: `Sent to ${successes.join(", ")}, but ${failures.join(", ")} failed. Check console for cliCommand.`,
      });
      console.log(
        "[Groups] failed commands",
        result.fanOutCommands
          .filter((c) => failures.includes(c.targetAgent))
          .map((c) => c.cliCommand),
      );
    } else {
      host.notify({
        kind: "error",
        message: `Fan-out failed for ${failures.join(", ")}. Copied command to console.`,
      });
      console.log(
        "[Groups] all fan-out failed, commands:",
        result.fanOutCommands.map((c) => c.cliCommand).join("\n"),
      );
      // Also surface one command via notify so user can copy-paste manually.
      try {
        host.notify({
          kind: "info",
          message: result.fanOutCommands[0]?.cliCommand || "No command",
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
        message: `Group "${deleted.name}" deleted`,
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
            children: ["Groups", groups.length ? ` (${groups.length})` : ""],
          }),
          jsxs("div", {
            className: "flex items-center gap-1",
            children: [
              groups.length > 1
                ? jsx(Button, {
                    variant: "ghost",
                    size: "sm",
                    onClick: () => setExpandAll((v) => !v),
                    children: expandAll ? "Collapse all" : "Expand all",
                  })
                : null,
              jsx(Button, {
                variant: "ghost",
                size: "sm",
                onClick: () => setCreateOpen(true),
                children: jsxs("span", {
                  className: "flex items-center gap-1",
                  children: [jsx(Codicon, { name: "add" }), "New Group"],
                }),
              }),
            ],
          }),
        ],
      }),
      groups.length === 0
        ? jsx(EmptyState, {
            icon: "organization",
            title: "No groups yet",
            description: "Create a group to message multiple agents at once.",
          })
        : jsx("div", {
            className: "grid gap-2",
            children: groups.map((g) =>
              jsx(
                GroupRow,
                {
                  group: g,
                  onPost: handlePost,
                  onDelete: handleDelete,
                  expandAll,
                },
                g.id,
              ),
            ),
          }),
      jsx(CreateGroupDialog, {
        open: createOpen,
        onClose: () => setCreateOpen(false),
        roster,
      }),
    ],
  });
}
