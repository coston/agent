"use client";
import { MessageBubble } from "./message-bubble.js";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { Button } from "@coston/ui/button";
import { Textarea } from "@coston/ui/textarea";
import { AlertCircle, ArrowUp, Sparkles, Square } from "lucide-react";
//#region src/react/chat-session.tsx
/**
* One chat session: the `useChat` wrapper plus message list and composer. Generic
* over the transport and tool set — server-execute tools just stream; client-side
* tools are run via the injected `onToolCall` (which receives `addToolOutput`).
* Re-key this by `conversationId` so each session gets a clean `useChat`.
*/
function ChatSession({ conversationId, transport, initialMessages, providerReady, onToolCall, onTurnSettled, toolRenderers, suggestions = [], emptyStateText = "Ask the agent to get started.", placeholder, onError, onConfigure, onBusyChange, onMessagesSynced, assistantTestId, viewportTestId }) {
	const addToolOutputRef = useRef(null);
	const chat = useChat({
		id: conversationId,
		messages: initialMessages,
		transport,
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onToolCall: onToolCall ? ({ toolCall }) => onToolCall({
			toolCall,
			addToolOutput: (result) => addToolOutputRef.current?.(result)
		}) : void 0,
		onFinish: onTurnSettled ? ({ messages, isAbort, isError, finishReason }) => onTurnSettled({
			conversationId,
			messages: messages.map((m) => ({
				id: m.id,
				role: m.role,
				parts: m.parts
			})),
			isAbort: Boolean(isAbort),
			isError: Boolean(isError),
			finishReason
		}) : void 0,
		onError: (e) => onError?.(e.message || "The agent ran into an error")
	});
	addToolOutputRef.current = chat.addToolOutput;
	const { messages, sendMessage, status, stop, addToolApprovalResponse } = chat;
	const [input, setInput] = useState("");
	const viewportRef = useRef(null);
	const busy = status === "submitted" || status === "streaming";
	useEffect(() => {
		viewportRef.current?.scrollTo?.({
			top: viewportRef.current.scrollHeight,
			behavior: "smooth"
		});
	}, [messages]);
	useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
	useEffect(() => () => onBusyChange?.(false), [onBusyChange]);
	const wasBusy = useRef(false);
	useEffect(() => {
		if (wasBusy.current && !busy) onMessagesSynced?.(conversationId, messages);
		wasBusy.current = busy;
	}, [
		busy,
		messages,
		conversationId,
		onMessagesSynced
	]);
	function submit(text) {
		const trimmed = text.trim();
		if (!trimmed || busy || !providerReady) return;
		sendMessage({ text: trimmed });
		setInput("");
	}
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsx("div", {
			ref: viewportRef,
			"data-testid": viewportTestId,
			className: "min-h-0 flex-1 overflow-y-auto",
			children: /* @__PURE__ */ jsx("div", {
				className: "flex flex-col gap-4 p-4",
				children: messages.length === 0 ? /* @__PURE__ */ jsxs("div", {
					className: "flex flex-col gap-3 pt-6 text-center",
					children: [
						/* @__PURE__ */ jsx(Sparkles, { className: "mx-auto size-6 text-primary" }),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted-foreground",
							children: emptyStateText
						}),
						suggestions.length > 0 && /* @__PURE__ */ jsx("div", {
							className: "mt-2 flex flex-col gap-2",
							children: suggestions.map((s) => /* @__PURE__ */ jsx("button", {
								type: "button",
								disabled: !providerReady,
								onClick: () => submit(s),
								className: "rounded-md border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
								children: s
							}, s))
						})
					]
				}) : messages.map((m) => /* @__PURE__ */ jsx(MessageBubble, {
					message: m,
					toolRenderers,
					onApproval: ({ id, approved }) => addToolApprovalResponse({
						id,
						approved
					}),
					assistantTestId
				}, m.id))
			})
		}),
		!providerReady && /* @__PURE__ */ jsxs("div", {
			className: "mx-3 mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs",
			children: [
				/* @__PURE__ */ jsx(AlertCircle, { className: "size-4 shrink-0 text-amber-600" }),
				/* @__PURE__ */ jsx("span", {
					className: "flex-1",
					children: "Connect an AI provider to use the agent."
				}),
				onConfigure && /* @__PURE__ */ jsx(Button, {
					size: "sm",
					variant: "outline",
					className: "h-7",
					onClick: onConfigure,
					children: "Configure"
				})
			]
		}),
		/* @__PURE__ */ jsx("form", {
			className: "border-t p-3",
			onSubmit: (e) => {
				e.preventDefault();
				submit(input);
			},
			children: /* @__PURE__ */ jsxs("div", {
				className: "relative",
				children: [/* @__PURE__ */ jsx(Textarea, {
					value: input,
					onChange: (e) => setInput(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							submit(input);
						}
					},
					disabled: !providerReady,
					placeholder: placeholder ?? (providerReady ? "Ask the agent…" : "Connect a provider in Settings"),
					rows: 2,
					className: "resize-none pr-12"
				}), busy ? /* @__PURE__ */ jsx(Button, {
					type: "button",
					size: "icon",
					variant: "secondary",
					className: "absolute bottom-2 right-2 size-8",
					onClick: () => stop(),
					"aria-label": "Stop",
					children: /* @__PURE__ */ jsx(Square, { className: "size-3.5" })
				}) : /* @__PURE__ */ jsx(Button, {
					type: "submit",
					size: "icon",
					className: "absolute bottom-2 right-2 size-8",
					disabled: !input.trim() || !providerReady,
					"aria-label": "Send",
					children: /* @__PURE__ */ jsx(ArrowUp, { className: "size-4" })
				})]
			})
		})
	] });
}
//#endregion
export { ChatSession };
