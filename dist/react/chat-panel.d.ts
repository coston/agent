import * as react2 from "react";
import { ReactNode } from "react";

//#region src/react/chat-panel.d.ts
/** A session as shown in the switcher. */
interface ChatSessionSummary {
  id: string;
  title: string;
}
/** A cached/replayed message (the AI SDK `UIMessage` reduced to stored columns). */
interface CachedMessage {
  id: string;
  role: string;
  parts: unknown;
}
/**
 * The session CRUD the panel drives — typically thin wrappers over the app's
 * server actions. Returning `null` from `create`/`rename` signals failure (the
 * panel surfaces it via `onError`).
 */
interface SessionController {
  create: () => Promise<ChatSessionSummary | null>;
  rename: (id: string, title: string) => Promise<ChatSessionSummary | null>;
  remove: (id: string) => Promise<void>;
  loadMessages: (id: string) => Promise<CachedMessage[] | null>;
}
interface ChatPanelSessionRenderArgs {
  conversationId: string;
  initialMessages: CachedMessage[];
  onBusyChange: (busy: boolean) => void;
  onMessagesSynced: (id: string, messages: CachedMessage[]) => void;
  onConfigure: () => void;
}
interface ChatPanelTestIds {
  switcher?: string;
  new?: string;
  item?: string;
  rename?: string;
  renameInput?: string;
  delete?: string;
  configToggle?: string;
}
interface ChatPanelProps {
  /** Partition the sessions belong to (e.g. a workspace or document id) — used for the storage key. */
  partitionId: string;
  conversations: ChatSessionSummary[];
  activeConversationId: string;
  initialMessages: CachedMessage[];
  sessions: SessionController;
  providerReady: boolean;
  /** Render the active session's chat surface (the app wires transport/onToolCall here). */
  renderSession: (args: ChatPanelSessionRenderArgs) => ReactNode;
  /** Render the provider-config panel (opened by the header gear). `close` dismisses it. */
  renderConfig?: (args: {
    close: () => void;
  }) => ReactNode;
  /** Label shown in the switcher dropdown header (e.g. the active provider/model). */
  providerLabel?: string;
  /** Fallback title for an untitled session. Defaults to "New chat". */
  defaultTitle?: string;
  /** localStorage key prefix for the last-open session. Defaults to "coston-agent:active-conversation". */
  storageKeyPrefix?: string;
  /** Surface a user-facing error (e.g. a toast). */
  onError?: (message: string) => void;
  testIds?: ChatPanelTestIds;
}
/**
 * The agent panel: orchestrates a partition's chat *sessions* (switch, new,
 * rename, delete), keeps an in-memory message cache so switching is instant, and
 * renders exactly one active session via `renderSession` (re-keyed by id). All
 * app specifics — the transport, client-side tool execution, the provider-config
 * form — are injected.
 */
declare function ChatPanel({
  partitionId,
  conversations: initialConversations,
  activeConversationId,
  initialMessages,
  sessions,
  providerReady,
  renderSession,
  renderConfig,
  providerLabel,
  defaultTitle,
  storageKeyPrefix,
  onError,
  testIds
}: ChatPanelProps): react2.JSX.Element;
//#endregion
export { CachedMessage, ChatPanel, ChatPanelProps, ChatPanelSessionRenderArgs, ChatPanelTestIds, ChatSessionSummary, SessionController };