import { AgentUIMessage, ToolRenderer } from "./types.js";
import * as react0 from "react";

//#region src/react/message-bubble.d.ts
/** Respond to a tool-approval request (wired to `useChat().addToolApprovalResponse`). */
type ApprovalResponder = (response: {
  id: string;
  approved: boolean;
}) => void;
interface MessageBubbleProps {
  /** A UIMessage (any app's `UIMessage<…>` satisfies the structural shape). */
  message: AgentUIMessage;
  /** Per-tool label/icon overrides, keyed by tool name (e.g. `{ run_task: { label: 'Running task' } }`). */
  toolRenderers?: Record<string, ToolRenderer>;
  /** Respond to tool-approval requests (wire to `useChat().addToolApprovalResponse`). */
  onApproval?: ApprovalResponder;
  /** `data-testid` for the assistant markdown bubble (E2E hook). */
  assistantTestId?: string;
}
/**
 * Render one chat message: user text verbatim, assistant text as streamed
 * markdown, and tool parts as status cards. Generic over any tool set — apps
 * override the per-tool label/icon via `toolRenderers`; unknown tools fall back
 * to a humanized name. The package never hard-codes a tool.
 */
declare function MessageBubble({
  message,
  toolRenderers,
  onApproval,
  assistantTestId
}: MessageBubbleProps): react0.JSX.Element;
//#endregion
export { ApprovalResponder, MessageBubble, MessageBubbleProps };