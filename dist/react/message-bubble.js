"use client";
import { cn } from "./cn.js";
import { Streamdown } from "streamdown";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/react/message-bubble.tsx
/** Title-case a tool name for the default label, e.g. `run_task` → `Run task`. */
function humanize(toolName) {
	const s = toolName.replace(/[_-]+/g, " ").trim();
	return s.charAt(0).toUpperCase() + s.slice(1);
}
function Spinner() {
	return /* @__PURE__ */ jsxs("svg", {
		className: "size-3.5 animate-spin",
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "10",
			stroke: "currentColor",
			strokeWidth: "3",
			className: "opacity-25"
		}), /* @__PURE__ */ jsx("path", {
			d: "M12 2a10 10 0 0 1 10 10",
			stroke: "currentColor",
			strokeWidth: "3",
			className: "opacity-75"
		})]
	});
}
function Dot() {
	return /* @__PURE__ */ jsx("svg", {
		className: "size-3.5",
		viewBox: "0 0 24 24",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "12",
			r: "4",
			fill: "currentColor"
		})
	});
}
function ApprovalView({ part, renderer, fallbackLabel, onApproval }) {
	const label = renderer?.label ?? fallbackLabel;
	const Icon = renderer?.icon;
	return /* @__PURE__ */ jsxs("div", {
		"data-testid": "tool-approval",
		className: "flex w-full max-w-[90%] flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex items-center gap-1 font-medium",
			children: [
				Icon && /* @__PURE__ */ jsx(Icon, { className: "size-3.5" }),
				"Approve ",
				label,
				"?"
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex gap-2",
			children: [/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => onApproval?.({
					id: part.approvalId,
					approved: true
				}),
				className: "rounded-md bg-primary px-2 py-1 text-primary-foreground hover:opacity-90",
				children: "Approve"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => onApproval?.({
					id: part.approvalId,
					approved: false
				}),
				className: "rounded-md border px-2 py-1 hover:bg-accent",
				children: "Deny"
			})]
		})]
	});
}
function ToolPartView({ part, renderer, fallbackLabel }) {
	const running = part.state === "input-streaming" || part.state === "input-available";
	const label = renderer?.label ?? fallbackLabel;
	const Icon = renderer?.icon;
	const output = part.state === "output-available" ? String(part.output ?? "") : null;
	return /* @__PURE__ */ jsxs("div", {
		"data-testid": "tool-part",
		className: "flex w-full max-w-[90%] items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs",
		children: [/* @__PURE__ */ jsx("span", {
			className: "mt-0.5 shrink-0 text-primary",
			children: running ? /* @__PURE__ */ jsx(Spinner, {}) : Icon ? /* @__PURE__ */ jsx(Icon, { className: "size-3.5" }) : /* @__PURE__ */ jsx(Dot, {})
		}), /* @__PURE__ */ jsxs("div", {
			className: "min-w-0 flex-1",
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "flex items-center gap-1 font-medium",
					children: running ? `${label}…` : label
				}),
				output && /* @__PURE__ */ jsx("p", {
					className: "mt-0.5 text-muted-foreground",
					children: output
				}),
				part.state === "output-error" && /* @__PURE__ */ jsx("p", {
					className: "mt-0.5 text-destructive",
					children: part.errorText
				})
			]
		})]
	});
}
/**
* Render one chat message: user text verbatim, assistant text as streamed
* markdown, and tool parts as status cards. Generic over any tool set — apps
* override the per-tool label/icon via `toolRenderers`; unknown tools fall back
* to a humanized name. The package never hard-codes a tool.
*/
function MessageBubble({ message, toolRenderers, onApproval, assistantTestId }) {
	const isUser = message.role === "user";
	return /* @__PURE__ */ jsx("div", {
		className: cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start"),
		children: message.parts.map((raw, i) => {
			const part = raw;
			if (part.type === "tool-approval-request") {
				const approval = raw;
				const name = approval.toolCall?.toolName ?? "";
				return /* @__PURE__ */ jsx(ApprovalView, {
					part: approval,
					renderer: name ? toolRenderers?.[name] : void 0,
					fallbackLabel: name ? humanize(name) : "this action",
					onApproval
				}, i);
			}
			if (part.type === "text") {
				const text = raw.text;
				if (!text) return null;
				return isUser ? /* @__PURE__ */ jsx("div", {
					className: "max-w-[90%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground",
					children: text
				}, i) : /* @__PURE__ */ jsx("div", {
					"data-testid": assistantTestId,
					className: "max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm",
					children: /* @__PURE__ */ jsx(Streamdown, {
						className: "space-y-2 break-words text-sm leading-relaxed",
						children: text
					})
				}, i);
			}
			if (typeof part.type === "string" && part.type.startsWith("tool-")) {
				const name = part.type.slice(5);
				return /* @__PURE__ */ jsx(ToolPartView, {
					part: raw,
					renderer: toolRenderers?.[name],
					fallbackLabel: humanize(name)
				}, i);
			}
			return null;
		})
	});
}
//#endregion
export { MessageBubble };
