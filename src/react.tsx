// `@coston/agent/react` — the browser half of the agent-chat module. Generic
// chat UI + transport built on `@ai-sdk/react`'s `useChat` and the AI SDK's
// `ChatTransport`. App-specific tool execution, system prompt, and session
// actions are injected.

export {
  MessageBubble,
  type ApprovalResponder,
  type MessageBubbleProps,
} from './react/message-bubble';
export {
  ChatSession,
  type AddToolOutput,
  type AgentToolCall,
  type ChatAttachment,
  type ChatSessionProps,
  type SettledTurn,
  type ToolCallHandler,
  type UploadAttachment,
} from './react/chat-session';
export { CameraDialog, type CameraDialogProps } from './react/camera-dialog';
export {
  ChatPanel,
  type CachedMessage,
  type ChatPanelProps,
  type ChatPanelSessionRenderArgs,
  type ChatPanelTestIds,
  type ChatSessionSummary,
  type SessionController,
} from './react/chat-panel';
export {
  createLocalTransport,
  type CreateLocalTransportOptions,
} from './react/local-transport';
export {
  ProviderForm,
  type ProviderFormInput,
  type ProviderFormProps,
} from './react/provider-form';
export { cn } from './react/cn';
export type { AgentUIMessage, ToolPartState, ToolRenderer } from './react/types';

// Client-safe model registry (also exported from `@coston/agent/server`).
export {
  DEFAULT_MODEL,
  LOCAL_BASE_URL_HINTS,
  MODELS_BY_PROVIDER,
  providerNeedsKey,
  type ModelChoice,
} from './shared/models';

// Client-safe provider helpers (also exported from `@coston/agent/server`).
export {
  providerBadgeLabel,
  providerDisplayName,
  shortModelName,
  type ProviderSetting,
  type ProviderType,
} from './shared/provider-types';
