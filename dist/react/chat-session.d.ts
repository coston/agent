import { ToolRenderer } from "./types.js";
import * as react0 from "react";
import { ChatTransport, UIMessage } from "ai";

//#region src/react/chat-session.d.ts
/** A streamed tool call surfaced to the client for execution. */
interface AgentToolCall {
  toolName: string;
  toolCallId: string;
  input: unknown;
  dynamic?: boolean;
}
/** Report a client-executed tool's result back into the conversation. */
type AddToolOutput = (result: {
  tool: string;
  toolCallId: string;
  output: unknown;
}) => void;
/** Handle a client-side tool call (client-side actuation). */
type ToolCallHandler = (args: {
  toolCall: AgentToolCall;
  addToolOutput: AddToolOutput;
}) => void;
/** A settled turn handed to the app (e.g. to persist a local-inference turn). */
interface SettledTurn {
  conversationId: string;
  messages: {
    id: string;
    role: string;
    parts: unknown;
  }[];
  isAbort: boolean;
  isError: boolean;
  finishReason?: string;
}
interface ChatSessionProps<TMessage extends UIMessage = UIMessage> {
  conversationId: string;
  /** The transport — a server `DefaultChatTransport` or a browser `createLocalTransport`. */
  transport: ChatTransport<TMessage>;
  initialMessages: TMessage[];
  providerReady: boolean;
  /** Execute a client-side tool call (tools without `execute`). */
  onToolCall?: ToolCallHandler;
  /** Called when a turn fully settles — apps persist local-inference turns here. */
  onTurnSettled?: (turn: SettledTurn) => void;
  /** Per-tool label/icon overrides for tool parts. */
  toolRenderers?: Record<string, ToolRenderer>;
  /** Prompt chips shown on the empty state. */
  suggestions?: string[];
  /** Empty-state lead text. */
  emptyStateText?: string;
  placeholder?: string;
  /** Map a stream error to a user-facing message (e.g. a toast). */
  onError?: (message: string) => void;
  /** Open the provider-config panel from the "not connected" banner. */
  onConfigure?: () => void;
  /** Lock session switching while a turn streams. */
  onBusyChange?: (busy: boolean) => void;
  /** Sync the latest messages up to an orchestrator cache when a turn settles. */
  onMessagesSynced?: (id: string, messages: TMessage[]) => void;
  assistantTestId?: string;
  viewportTestId?: string;
}
/**
 * One chat session: the `useChat` wrapper plus message list and composer. Generic
 * over the transport and tool set — server-execute tools just stream; client-side
 * tools are run via the injected `onToolCall` (which receives `addToolOutput`).
 * Re-key this by `conversationId` so each session gets a clean `useChat`.
 */
declare function ChatSession<TMessage extends UIMessage = UIMessage>({
  conversationId,
  transport,
  initialMessages,
  providerReady,
  onToolCall,
  onTurnSettled,
  toolRenderers,
  suggestions,
  emptyStateText,
  placeholder,
  onError,
  onConfigure,
  onBusyChange,
  onMessagesSynced,
  assistantTestId,
  viewportTestId
}: ChatSessionProps<TMessage>): react0.JSX.Element;
//#endregion
export { AddToolOutput, AgentToolCall, ChatSession, ChatSessionProps, SettledTurn, ToolCallHandler };