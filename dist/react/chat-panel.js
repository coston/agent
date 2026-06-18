"use client";
import { cn } from "./cn.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@coston/ui/button";
import { Check, ChevronDown, Loader2, Pencil, Plus, Settings2, Sparkles, Trash2, X } from "lucide-react";
import { Input } from "@coston/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@coston/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@coston/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@coston/ui/alert-dialog";
//#region src/react/chat-panel.tsx
const DEFAULT_TEST_IDS = {
	switcher: "session-switcher",
	new: "session-new",
	item: "session-item",
	rename: "session-rename",
	renameInput: "session-rename-input",
	delete: "session-delete",
	configToggle: "provider-config-toggle"
};
/**
* The agent panel: orchestrates a partition's chat *sessions* (switch, new,
* rename, delete), keeps an in-memory message cache so switching is instant, and
* renders exactly one active session via `renderSession` (re-keyed by id). All
* app specifics — the transport, client-side tool execution, the provider-config
* form — are injected.
*/
function ChatPanel({ partitionId, conversations: initialConversations, activeConversationId, initialMessages, sessions, providerReady, renderSession, renderConfig, providerLabel, defaultTitle = "New chat", storageKeyPrefix = "coston-agent:active-conversation", onError, testIds }) {
	const ids = {
		...DEFAULT_TEST_IDS,
		...testIds
	};
	const [conversations, setConversations] = useState(initialConversations);
	const [activeId, setActiveId] = useState(activeConversationId);
	const [cache, setCache] = useState(() => new Map([[activeConversationId, initialMessages]]));
	const [busy, setBusy] = useState(false);
	const [configOpen, setConfigOpen] = useState(!providerReady);
	const [renameOpen, setRenameOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const storageKey = `${storageKeyPrefix}:${partitionId}`;
	const activeTitle = conversations.find((c) => c.id === activeId)?.title ?? defaultTitle;
	const persistActive = useCallback((id) => {
		try {
			localStorage.setItem(storageKey, id);
		} catch {}
	}, [storageKey]);
	const loadMessages = useCallback(async (id) => {
		const msgs = await sessions.loadMessages(id).catch(() => null);
		if (!msgs) {
			onError?.("Failed to load that chat");
			return;
		}
		setCache((prev) => new Map(prev).set(id, msgs));
	}, [sessions, onError]);
	const switchTo = useCallback((id) => {
		if (id === activeId) return;
		setActiveId(id);
		persistActive(id);
		if (!cache.has(id)) loadMessages(id);
	}, [
		activeId,
		cache,
		loadMessages,
		persistActive
	]);
	useEffect(() => {
		const stored = (() => {
			try {
				return localStorage.getItem(storageKey);
			} catch {
				return null;
			}
		})();
		if (stored && stored !== activeId && conversations.some((c) => c.id === stored)) switchTo(stored);
	}, []);
	const newChat = useCallback(async () => {
		const conv = await sessions.create().catch(() => null);
		if (!conv) {
			onError?.("Failed to start a new chat");
			return;
		}
		setConversations((prev) => [conv, ...prev.filter((c) => c.id !== conv.id)]);
		setCache((prev) => new Map(prev).set(conv.id, []));
		setActiveId(conv.id);
		persistActive(conv.id);
	}, [
		sessions,
		persistActive,
		onError
	]);
	const commitRename = useCallback(async (title) => {
		setRenameOpen(false);
		const trimmed = title.trim();
		if (!trimmed || trimmed === activeTitle) return;
		const updated = await sessions.rename(activeId, trimmed).catch(() => null);
		if (!updated) {
			onError?.("Failed to rename chat");
			return;
		}
		setConversations((prev) => prev.map((c) => c.id === updated.id ? updated : c));
	}, [
		activeId,
		activeTitle,
		sessions,
		onError
	]);
	const confirmDelete = useCallback(async () => {
		setDeleteOpen(false);
		const removedId = activeId;
		await sessions.remove(removedId).catch(() => null);
		const remaining = conversations.filter((c) => c.id !== removedId);
		setConversations(remaining);
		setCache((prev) => {
			const next = new Map(prev);
			next.delete(removedId);
			return next;
		});
		const fallback = remaining[0];
		if (fallback) {
			setActiveId(fallback.id);
			persistActive(fallback.id);
			if (!cache.has(fallback.id)) loadMessages(fallback.id);
		} else newChat();
	}, [
		activeId,
		cache,
		conversations,
		loadMessages,
		newChat,
		persistActive,
		sessions
	]);
	const handleMessagesSynced = useCallback((id, messages) => {
		setCache((prev) => new Map(prev).set(id, messages));
	}, []);
	const activeMessages = cache.get(activeId);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex min-h-0 flex-1 flex-col",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-1 border-b px-2 py-1.5",
				children: [
					/* @__PURE__ */ jsx(SessionSwitcher, {
						activeTitle,
						conversations,
						activeId,
						providerLabel,
						disabled: busy,
						onSelect: switchTo,
						onNew: () => void newChat(),
						testIds: ids
					}),
					/* @__PURE__ */ jsx(Button, {
						variant: "ghost",
						size: "icon",
						className: "size-7 shrink-0",
						disabled: busy,
						onClick: () => setRenameOpen(true),
						"aria-label": "Rename chat",
						"data-testid": ids.rename,
						children: /* @__PURE__ */ jsx(Pencil, { className: "size-4" })
					}),
					/* @__PURE__ */ jsx(Button, {
						variant: "ghost",
						size: "icon",
						className: "size-7 shrink-0",
						disabled: busy,
						onClick: () => setDeleteOpen(true),
						"aria-label": "Delete chat",
						"data-testid": ids.delete,
						children: /* @__PURE__ */ jsx(Trash2, { className: "size-4" })
					}),
					renderConfig && /* @__PURE__ */ jsx(Button, {
						variant: "ghost",
						size: "icon",
						className: "size-7 shrink-0",
						disabled: busy,
						onClick: () => setConfigOpen((o) => !o),
						"aria-label": configOpen ? "Back to chat" : "Configure AI provider",
						"aria-pressed": configOpen,
						"data-testid": ids.configToggle,
						children: configOpen ? /* @__PURE__ */ jsx(X, { className: "size-4" }) : /* @__PURE__ */ jsx(Settings2, { className: "size-4" })
					})
				]
			}),
			configOpen && renderConfig ? /* @__PURE__ */ jsx("div", {
				className: "min-h-0 flex-1 overflow-y-auto p-4",
				children: renderConfig({ close: () => setConfigOpen(false) })
			}) : activeMessages === void 0 ? /* @__PURE__ */ jsx("div", {
				className: "flex min-h-0 flex-1 items-center justify-center",
				children: /* @__PURE__ */ jsx(Loader2, { className: "size-5 animate-spin text-muted-foreground" })
			}) : /* @__PURE__ */ jsx("div", {
				className: "flex min-h-0 flex-1 flex-col",
				children: renderSession({
					conversationId: activeId,
					initialMessages: activeMessages,
					onBusyChange: setBusy,
					onMessagesSynced: handleMessagesSynced,
					onConfigure: () => setConfigOpen(true)
				})
			}, activeId),
			/* @__PURE__ */ jsx(RenameDialog, {
				open: renameOpen,
				initialTitle: activeTitle,
				onOpenChange: setRenameOpen,
				onSubmit: commitRename,
				inputTestId: ids.renameInput
			}),
			/* @__PURE__ */ jsx(AlertDialog, {
				open: deleteOpen,
				onOpenChange: setDeleteOpen,
				children: /* @__PURE__ */ jsxs(AlertDialogContent, { children: [/* @__PURE__ */ jsxs(AlertDialogHeader, { children: [/* @__PURE__ */ jsx(AlertDialogTitle, { children: "Delete this chat?" }), /* @__PURE__ */ jsxs(AlertDialogDescription, { children: [
					"“",
					activeTitle,
					"” and its messages will be permanently removed. This can’t be undone."
				] })] }), /* @__PURE__ */ jsxs(AlertDialogFooter, { children: [/* @__PURE__ */ jsx(AlertDialogCancel, { children: "Cancel" }), /* @__PURE__ */ jsx(AlertDialogAction, {
					onClick: () => void confirmDelete(),
					children: "Delete"
				})] })] })
			})
		]
	});
}
function SessionSwitcher({ activeTitle, conversations, activeId, providerLabel, disabled, onSelect, onNew, testIds }) {
	return /* @__PURE__ */ jsxs(DropdownMenu, { children: [/* @__PURE__ */ jsx(DropdownMenuTrigger, {
		asChild: true,
		children: /* @__PURE__ */ jsxs(Button, {
			variant: "ghost",
			size: "sm",
			disabled,
			className: "h-7 min-w-0 flex-1 justify-start gap-1.5 px-2",
			"data-testid": testIds.switcher,
			children: [
				/* @__PURE__ */ jsx(Sparkles, { className: "size-4 shrink-0 text-primary" }),
				/* @__PURE__ */ jsx("span", {
					className: "min-w-0 flex-1 truncate text-left text-sm",
					children: activeTitle
				}),
				/* @__PURE__ */ jsx(ChevronDown, { className: "size-4 shrink-0 text-muted-foreground" })
			]
		})
	}), /* @__PURE__ */ jsxs(DropdownMenuContent, {
		align: "start",
		className: "w-64",
		children: [
			providerLabel && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(DropdownMenuLabel, {
				className: "text-xs font-normal text-muted-foreground",
				children: providerLabel
			}), /* @__PURE__ */ jsx(DropdownMenuSeparator, {})] }),
			/* @__PURE__ */ jsxs(DropdownMenuItem, {
				onSelect: onNew,
				"data-testid": testIds.new,
				children: [/* @__PURE__ */ jsx(Plus, { className: "size-4" }), " New chat"]
			}),
			/* @__PURE__ */ jsx(DropdownMenuSeparator, {}),
			conversations.map((c) => /* @__PURE__ */ jsxs(DropdownMenuItem, {
				onSelect: () => onSelect(c.id),
				"data-testid": testIds.item,
				"data-active": c.id === activeId,
				children: [/* @__PURE__ */ jsx(Check, { className: cn("size-4", c.id === activeId ? "opacity-100" : "opacity-0") }), /* @__PURE__ */ jsx("span", {
					className: "min-w-0 flex-1 truncate",
					children: c.title
				})]
			}, c.id))
		]
	})] });
}
function RenameDialog({ open, initialTitle, onOpenChange, onSubmit, inputTestId }) {
	return /* @__PURE__ */ jsx(Dialog, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ jsxs(DialogContent, { children: [/* @__PURE__ */ jsxs(DialogHeader, { children: [/* @__PURE__ */ jsx(DialogTitle, { children: "Rename chat" }), /* @__PURE__ */ jsx(DialogDescription, { children: "Give this session a name you’ll recognise." })] }), /* @__PURE__ */ jsxs("form", {
			onSubmit: (e) => {
				e.preventDefault();
				const data = new FormData(e.currentTarget);
				onSubmit(String(data.get("title") ?? ""));
			},
			children: [/* @__PURE__ */ jsx(Input, {
				name: "title",
				defaultValue: initialTitle,
				autoFocus: true,
				"aria-label": "Chat name",
				"data-testid": inputTestId
			}), /* @__PURE__ */ jsx(DialogFooter, {
				className: "mt-4",
				children: /* @__PURE__ */ jsx(Button, {
					type: "submit",
					children: "Save"
				})
			})]
		})] })
	});
}
//#endregion
export { ChatPanel };
