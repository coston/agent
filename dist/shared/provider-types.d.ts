//#region src/shared/provider-types.d.ts
type ProviderType = 'anthropic' | 'openai' | 'openai_compatible' | 'gateway';
interface ProviderSetting {
  provider: ProviderType;
  model: string;
  hasKey: boolean;
  baseUrl: string | null;
}
declare function providerDisplayName(provider: ProviderType): string;
/** Drop a `provider/` prefix, e.g. "anthropic/claude-sonnet-4.6" → "claude-sonnet-4.6". */
declare function shortModelName(model: string): string;
/** Short label for a toolbar/panel badge, e.g. "Anthropic · claude-sonnet-4-6". */
declare function providerBadgeLabel(setting: ProviderSetting): string;
//#endregion
export { ProviderSetting, ProviderType, providerBadgeLabel, providerDisplayName, shortModelName };