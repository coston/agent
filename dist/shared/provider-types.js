//#region src/shared/provider-types.ts
const PROVIDER_NAMES = {
	anthropic: "Anthropic",
	openai: "OpenAI",
	openai_compatible: "Local / OpenAI-compatible",
	gateway: "Vercel AI Gateway"
};
function providerDisplayName(provider) {
	return PROVIDER_NAMES[provider];
}
/** Drop a `provider/` prefix, e.g. "anthropic/claude-sonnet-4.6" → "claude-sonnet-4.6". */
function shortModelName(model) {
	return model.includes("/") ? model.slice(model.lastIndexOf("/") + 1) : model;
}
/** Short label for a toolbar/panel badge, e.g. "Anthropic · claude-sonnet-4-6". */
function providerBadgeLabel(setting) {
	return `${providerDisplayName(setting.provider)} · ${shortModelName(setting.model)}`;
}
//#endregion
export { providerBadgeLabel, providerDisplayName, shortModelName };
