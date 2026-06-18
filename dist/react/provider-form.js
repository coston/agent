"use client";
import { cn } from "./cn.js";
import { DEFAULT_MODEL, LOCAL_BASE_URL_HINTS, MODELS_BY_PROVIDER, providerNeedsKey } from "../shared/models.js";
import { providerDisplayName } from "../shared/provider-types.js";
import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Button } from "@coston/ui/button";
import { Input } from "@coston/ui/input";
//#region src/react/provider-form.tsx
const ALL_PROVIDERS = [
	"gateway",
	"anthropic",
	"openai",
	"openai_compatible"
];
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring";
/**
* A generic provider/model/key settings form, driven by the shared model
* registry. App-agnostic: the app injects `onSave` (which encrypts the key and
* writes its settings row). Use as `renderConfig` for `<ChatPanel>` or on a
* dedicated settings page.
*/
function ProviderForm({ initial, onSave, onSaved, onError, models = MODELS_BY_PROVIDER, providers = ALL_PROVIDERS }) {
	const [provider, setProvider] = useState(initial.provider);
	const [model, setModel] = useState(initial.model);
	const [apiKey, setApiKey] = useState("");
	const [baseUrl, setBaseUrl] = useState(initial.baseUrl ?? "");
	const [saving, setSaving] = useState(false);
	const choices = models[provider] ?? [];
	const isLocal = provider === "openai_compatible";
	const needsKey = providerNeedsKey(provider);
	function changeProvider(next) {
		setProvider(next);
		setModel((models[next] ?? [])[0]?.id ?? DEFAULT_MODEL[next] ?? "");
	}
	async function submit(e) {
		e.preventDefault();
		if (saving) return;
		setSaving(true);
		try {
			await onSave({
				provider,
				model: model.trim(),
				apiKey: apiKey.trim() || void 0,
				baseUrl: isLocal ? baseUrl.trim() || void 0 : void 0
			});
			onSaved?.();
		} catch (err) {
			onError?.(err instanceof Error ? err.message : "Failed to save provider settings");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ jsxs("form", {
		className: "flex flex-col gap-4",
		onSubmit: submit,
		"data-testid": "provider-form",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-1.5",
				children: [/* @__PURE__ */ jsx("label", {
					htmlFor: "agent-provider",
					className: "text-sm font-medium",
					children: "Provider"
				}), /* @__PURE__ */ jsx("select", {
					id: "agent-provider",
					value: provider,
					onChange: (e) => changeProvider(e.target.value),
					className: selectClass,
					children: providers.map((p) => /* @__PURE__ */ jsx("option", {
						value: p,
						children: providerDisplayName(p)
					}, p))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-1.5",
				children: [/* @__PURE__ */ jsx("label", {
					htmlFor: "agent-model",
					className: "text-sm font-medium",
					children: "Model"
				}), choices.length > 0 ? /* @__PURE__ */ jsx("select", {
					id: "agent-model",
					value: model,
					onChange: (e) => setModel(e.target.value),
					className: selectClass,
					children: choices.map((c) => /* @__PURE__ */ jsx("option", {
						value: c.id,
						children: c.label
					}, c.id))
				}) : /* @__PURE__ */ jsx(Input, {
					id: "agent-model",
					value: model,
					onChange: (e) => setModel(e.target.value),
					placeholder: "e.g. llama3.1"
				})]
			}),
			isLocal && /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-1.5",
				children: [
					/* @__PURE__ */ jsx("label", {
						htmlFor: "agent-base-url",
						className: "text-sm font-medium",
						children: "Base URL"
					}),
					/* @__PURE__ */ jsx(Input, {
						id: "agent-base-url",
						value: baseUrl,
						onChange: (e) => setBaseUrl(e.target.value),
						placeholder: "http://localhost:11434/v1"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex flex-wrap gap-2",
						children: LOCAL_BASE_URL_HINTS.map((h) => /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setBaseUrl(h.url),
							className: cn("rounded border px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground"),
							children: h.label
						}, h.url))
					})
				]
			}),
			(needsKey || isLocal) && /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-1.5",
				children: [/* @__PURE__ */ jsxs("label", {
					htmlFor: "agent-api-key",
					className: "text-sm font-medium",
					children: ["API key", isLocal ? " (optional)" : ""]
				}), /* @__PURE__ */ jsx(Input, {
					id: "agent-api-key",
					type: "password",
					value: apiKey,
					onChange: (e) => setApiKey(e.target.value),
					autoComplete: "off",
					placeholder: initial.hasKey ? "•••••••• (saved — leave blank to keep)" : "sk-…"
				})]
			}),
			/* @__PURE__ */ jsx(Button, {
				type: "submit",
				disabled: saving,
				children: saving ? "Saving…" : "Save"
			})
		]
	});
}
//#endregion
export { ProviderForm };
