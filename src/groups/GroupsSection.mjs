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
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import {
  $groups,
  createGroup,
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

function GroupRow({ group, onPost }) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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
            ],
          })
        : null,
    ],
  });
}

export function GroupsSection({ roster }) {
  const groups = useValue($groups);
  const [createOpen, setCreateOpen] = useState(false);

  const handlePost = async (groupId, content) => {
    const active = (host.state.profile.get() || "default").trim() || "default";
    const group = getGroup(groupId);
    if (!group) {
      host.notify({ kind: "error", message: "Group not found" });
      return;
    }
    // If active profile is not a member, fall back to first member as sender for now.
    // In a real multi-bot setup the user would pick the sender; minimal slice keeps it simple.
    let sender = active;
    if (!group.memberIds.includes(sender)) {
      if (group.memberIds.length === 0) {
        host.notify({ kind: "error", message: "Group has no members" });
        return;
      }
      sender = group.memberIds[0];
    }

    let result;
    try {
      result = postToGroup({ groupId, senderName: sender, content });
    } catch (e) {
      host.notify({ kind: "error", message: e?.message || String(e) });
      throw e;
    }

    // Persist updated room
    persistGroups(pluginCtxRef, result.next);

    // Fan-out via cli.exec argv (no shell quoting needed). Each send is best-effort.
    const failures = [];
    for (const cmd of result.fanOutCommands) {
      try {
        await host.request("cli.exec", { argv: ["hermes", ...cmd.argv] });
      } catch {
        failures.push(cmd.targetAgent);
      }
    }

    if (failures.length === 0) {
      host.notify({
        kind: "success",
        message: `Sent to ${result.fanOutCommands.length} members`,
      });
    } else if (failures.length < result.fanOutCommands.length) {
      host.notify({
        kind: "info",
        message: `Sent, but ${failures.join(", ")} failed`,
      });
    } else if (result.fanOutCommands.length > 0) {
      host.notify({
        kind: "error",
        message: `Fan-out failed for ${failures.join(", ")}`,
      });
    } else {
      host.notify({
        kind: "info",
        message: "Message saved (no other members to notify)",
      });
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
      groups.length === 0
        ? jsx(EmptyState, {
            icon: "organization",
            title: "No groups yet",
            description: "Create a group to message multiple agents at once.",
          })
        : jsx("div", {
            className: "grid gap-2",
            children: groups.map((g) =>
              jsx(GroupRow, { group: g, onPost: handlePost }, g.id),
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
