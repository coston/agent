import { ProviderSetting, ProviderType } from "../shared/provider-types.js";
import { ModelChoice } from "../shared/models.js";
import * as react1 from "react";

//#region src/react/provider-form.d.ts
/** What the form submits — the app encrypts `apiKey` and saves the row. */
interface ProviderFormInput {
  provider: ProviderType;
  model: string;
  /** New key, or `undefined` to keep the saved one. */
  apiKey?: string;
  /** Local endpoint base URL (only for `openai_compatible`). */
  baseUrl?: string;
}
interface ProviderFormProps {
  /** The user's current setting (`hasKey` controls the key placeholder). */
  initial: ProviderSetting;
  /** Persist the change (the app encrypts + stores). */
  onSave: (input: ProviderFormInput) => Promise<void>;
  /** Called after a successful save (e.g. close the panel). */
  onSaved?: () => void;
  /** Surface a save error (e.g. a toast). */
  onError?: (message: string) => void;
  /** Override the model lists. Defaults to `MODELS_BY_PROVIDER`. */
  models?: Record<ProviderType, ModelChoice[]>;
  /** Which providers to offer, in order. */
  providers?: ProviderType[];
}
/**
 * A generic provider/model/key settings form, driven by the shared model
 * registry. App-agnostic: the app injects `onSave` (which encrypts the key and
 * writes its settings row). Use as `renderConfig` for `<ChatPanel>` or on a
 * dedicated settings page.
 */
declare function ProviderForm({
  initial,
  onSave,
  onSaved,
  onError,
  models,
  providers
}: ProviderFormProps): react1.JSX.Element;
//#endregion
export { ProviderForm, ProviderFormInput, ProviderFormProps };