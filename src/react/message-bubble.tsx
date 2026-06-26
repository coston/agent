'use client';

import { useState } from 'react';
import { Streamdown } from 'streamdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@coston/ui/dialog';
import { cn } from './cn';
import type { AgentUIMessage, ToolPartState, ToolRenderer } from './types';

interface TextPart {
  type: 'text';
  text?: string;
}

/** A file/image attachment part (AI SDK `FileUIPart`). */
interface FilePart {
  type: 'file';
  url?: string;
  mediaType?: string;
  filename?: string;
}

interface ToolPart {
  type: string;
  state?: ToolPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  /** Present while a `needsApproval` tool call awaits a decision. */
  approval?: { id: string; approved?: boolean };
}

/**
 * A standalone tool-approval request part (AI SDK `needsApproval` flow). Carries
 * only ids — the proposed input lives on the sibling `tool-<name>` part in its
 * `approval-requested` state, which is the path that drives a rich approval.
 */
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('size-3.5 shrink-0 transition-transform', open && 'rotate-90')}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Coerce arbitrary tool output to a markdown string: strings pass through, everything else becomes a JSON code block. */
function outputToMarkdown(output: unknown): string {
  if (typeof output === 'string') return output;
  return '```json\n' + JSON.stringify(output, null, 2) + '\n```';
}

function ApprovalView({
  approvalId,
  input,
  renderer,
  fallbackLabel,
  onApproval,
}: {
  approvalId: string;
  /** The proposed tool-call input, when known (present on the tool-part path). */
  input?: unknown;
  renderer?: ToolRenderer;
  fallbackLabel: string;
  onApproval?: ApprovalResponder;
}) {
  const label = renderer?.label ?? fallbackLabel;
  const Icon = renderer?.icon;
  const approve = () => onApproval?.({ id: approvalId, approved: true });
  const deny = () => onApproval?.({ id: approvalId, approved: false });
  return (
    <div
      data-testid="tool-approval"
      className="flex w-full max-w-[90%] flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs"
    >
      {renderer?.renderApproval ? (
        renderer.renderApproval({ input, approve, deny })
      ) : (
        <>
          <div className="flex items-center gap-1 font-medium">
            {Icon && <Icon className="size-3.5" />}
            Approve {label}?
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={approve}
              className="rounded-md bg-primary px-2 py-1 text-primary-foreground hover:opacity-90"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={deny}
              className="rounded-md border border-border px-2 py-1 hover:bg-accent"
            >
              Deny
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** An inline image attachment with click-to-enlarge. */
function ImagePart({ url, filename }: { url: string; filename?: string }) {
  const [open, setOpen] = useState(false);
  const alt = filename ?? 'attachment';
  return (
    <>
      <button
        type="button"
        data-testid="message-image"
        onClick={() => setOpen(true)}
        className="block max-w-[70%] overflow-hidden rounded-lg border border-border"
      >
        <img src={url} alt={alt} className="max-h-64 w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <img src={url} alt={alt} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
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
  const [open, setOpen] = useState(renderer?.defaultExpanded ?? false);
  const running = part.state === 'input-streaming' || part.state === 'input-available';
  const label = renderer?.label ?? fallbackLabel;
  const Icon = renderer?.icon;
  const hasOutput = part.state === 'output-available' && part.output != null && part.output !== '';
  const isError = part.state === 'output-error';
  const expandable = hasOutput || isError;

  return (
    <div data-testid="tool-part" className="w-full max-w-[90%] rounded-lg border border-border bg-card text-xs">
      <button
        type="button"
        disabled={!expandable}
        aria-expanded={expandable ? open : undefined}
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          expandable && 'cursor-pointer hover:bg-accent/50'
        )}
      >
        <span className="shrink-0 text-primary">
          {running ? <Spinner /> : Icon ? <Icon className="size-3.5" /> : <Dot />}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{running ? `${label}…` : label}</span>
        {expandable && <Chevron open={open} />}
      </button>
      {open && hasOutput && (
        <div
          data-testid="tool-output"
          className="max-h-80 overflow-auto border-t border-border px-3 py-2 text-muted-foreground"
        >
          {renderer?.render ? (
            renderer.render(part.output, part.input)
          ) : (
            <Streamdown className="space-y-2 break-words">{outputToMarkdown(part.output)}</Streamdown>
          )}
        </div>
      )}
      {open && isError && (
        <p className="border-t border-border px-3 py-2 text-destructive">{part.errorText}</p>
      )}
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
  // Approvals are driven by the `tool-<name>` part's `approval-requested` state
  // (it carries the proposed input). Collect those approval ids so the bare,
  // input-less `tool-approval-request` part is not rendered as a duplicate card.
  const richApprovalIds = new Set(
    message.parts
      .map(raw => raw as ToolPart)
      .filter(p => typeof p.type === 'string' && p.type.startsWith('tool-') && p.state === 'approval-requested')
      .map(p => p.approval?.id)
      .filter((id): id is string => Boolean(id))
  );
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      {message.parts.map((raw, i) => {
        const part = raw as { type?: string };
        if (part.type === 'tool-approval-request') {
          const approval = raw as ApprovalRequestPart;
          // Already shown by the corresponding tool part (with its input).
          if (richApprovalIds.has(approval.approvalId)) return null;
          const name = approval.toolCall?.toolName ?? '';
          return (
            <ApprovalView
              key={i}
              approvalId={approval.approvalId}
              renderer={name ? toolRenderers?.[name] : undefined}
              fallbackLabel={name ? humanize(name) : 'this action'}
              onApproval={onApproval}
            />
          );
        }
        if (part.type === 'file') {
          const file = raw as FilePart;
          if (!file.url) return null;
          if (file.mediaType?.startsWith('image/')) {
            return <ImagePart key={i} url={file.url} filename={file.filename} />;
          }
          return (
            <a
              key={i}
              href={file.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-[90%] truncate text-sm text-primary underline"
            >
              {file.filename ?? 'Attachment'}
            </a>
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
          const toolPart = raw as ToolPart;
          // A `needsApproval` call paused here: render the approval card with the
          // proposed input (lets a renderer preview a plan before it runs).
          if (toolPart.state === 'approval-requested' && toolPart.approval?.id) {
            return (
              <ApprovalView
                key={i}
                approvalId={toolPart.approval.id}
                input={toolPart.input}
                renderer={toolRenderers?.[name]}
                fallbackLabel={humanize(name)}
                onApproval={onApproval}
              />
            );
          }
          return (
            <ToolPartView
              key={i}
              part={toolPart}
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
