'use client';

import { Streamdown } from 'streamdown';
import { cn } from './cn';
import type { AgentUIMessage, ToolPartState, ToolRenderer } from './types';

interface TextPart {
  type: 'text';
  text?: string;
}

interface ToolPart {
  type: string;
  state?: ToolPartState;
  output?: unknown;
  errorText?: string;
}

/** A pending tool-approval request part (AI SDK `needsApproval` flow). */
interface ApprovalRequestPart {
  type: 'tool-approval-request';
  approvalId: string;
  toolCall?: { toolName?: string };
}

/** Respond to a tool-approval request (wired to `useChat().addToolApprovalResponse`). */
export type ApprovalResponder = (response: { id: string; approved: boolean }) => void;

/** Title-case a tool name for the default label, e.g. `run_task` → `Run task`. */
function humanize(toolName: string): string {
  const s = toolName.replace(/[_-]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Spinner() {
  return (
    <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" className="opacity-75" />
    </svg>
  );
}

function Dot() {
  return (
    <svg className="size-3.5" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

function ApprovalView({
  part,
  renderer,
  fallbackLabel,
  onApproval,
}: {
  part: ApprovalRequestPart;
  renderer?: ToolRenderer;
  fallbackLabel: string;
  onApproval?: ApprovalResponder;
}) {
  const label = renderer?.label ?? fallbackLabel;
  const Icon = renderer?.icon;
  return (
    <div
      data-testid="tool-approval"
      className="flex w-full max-w-[90%] flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-1 font-medium">
        {Icon && <Icon className="size-3.5" />}
        Approve {label}?
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onApproval?.({ id: part.approvalId, approved: true })}
          className="rounded-md bg-primary px-2 py-1 text-primary-foreground hover:opacity-90"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => onApproval?.({ id: part.approvalId, approved: false })}
          className="rounded-md border px-2 py-1 hover:bg-accent"
        >
          Deny
        </button>
      </div>
    </div>
  );
}

function ToolPartView({
  part,
  renderer,
  fallbackLabel,
}: {
  part: ToolPart;
  renderer?: ToolRenderer;
  fallbackLabel: string;
}) {
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const label = renderer?.label ?? fallbackLabel;
  const Icon = renderer?.icon;
  const output = part.state === 'output-available' ? String(part.output ?? '') : null;

  return (
    <div
      data-testid="tool-part"
      className="flex w-full max-w-[90%] items-start gap-2 rounded-lg border bg-card px-3 py-2 text-xs"
    >
      <span className="mt-0.5 shrink-0 text-primary">
        {running ? <Spinner /> : Icon ? <Icon className="size-3.5" /> : <Dot />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-medium">{running ? `${label}…` : label}</div>
        {output && <p className="mt-0.5 text-muted-foreground">{output}</p>}
        {part.state === 'output-error' && <p className="mt-0.5 text-destructive">{part.errorText}</p>}
      </div>
    </div>
  );
}

export interface MessageBubbleProps {
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
export function MessageBubble({
  message,
  toolRenderers,
  onApproval,
  assistantTestId,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      {message.parts.map((raw, i) => {
        const part = raw as { type?: string };
        if (part.type === 'tool-approval-request') {
          const approval = raw as ApprovalRequestPart;
          const name = approval.toolCall?.toolName ?? '';
          return (
            <ApprovalView
              key={i}
              part={approval}
              renderer={name ? toolRenderers?.[name] : undefined}
              fallbackLabel={name ? humanize(name) : 'this action'}
              onApproval={onApproval}
            />
          );
        }
        if (part.type === 'text') {
          const text = (raw as TextPart).text;
          if (!text) return null;
          return isUser ? (
            <div
              key={i}
              className="max-w-[90%] whitespace-pre-wrap rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              {text}
            </div>
          ) : (
            <div
              key={i}
              data-testid={assistantTestId}
              className="max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm"
            >
              <Streamdown className="space-y-2 break-words text-sm leading-relaxed">{text}</Streamdown>
            </div>
          );
        }
        if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
          const name = part.type.slice('tool-'.length);
          return (
            <ToolPartView
              key={i}
              part={raw as ToolPart}
              renderer={toolRenderers?.[name]}
              fallbackLabel={humanize(name)}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
