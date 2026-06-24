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
          className="rounded-md border border-border px-2 py-1 hover:bg-accent"
        >
          Deny
        </button>
      </div>
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
  const [open, setOpen] = useState(false);
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
            renderer.render(part.output)
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
