'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
  type ChatTransport,
  type FileUIPart,
  type UIMessage,
} from 'ai';
import { Button } from '@coston/ui/button';
import { Textarea } from '@coston/ui/textarea';
import { Dialog, DialogContent, DialogTitle } from '@coston/ui/dialog';
import { AlertCircle, ArrowUp, Camera, Loader2, Paperclip, Sparkles, Square, X } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import { CameraDialog } from './camera-dialog';
import { useAttachments, type UploadAttachment } from './use-attachments';
import type { ToolRenderer } from './types';

export type { ChatAttachment, UploadAttachment } from './use-attachments';

/** A streamed tool call surfaced to the client for execution. */
export interface AgentToolCall {
  toolName: string;
  toolCallId: string;
  input: unknown;
  dynamic?: boolean;
}

/** Report a client-executed tool's result back into the conversation. */
export type AddToolOutput = (result: { tool: string; toolCallId: string; output: unknown }) => void;

/** Handle a client-side tool call (client-side actuation). */
export type ToolCallHandler = (args: { toolCall: AgentToolCall; addToolOutput: AddToolOutput }) => void;

/** A settled turn handed to the app (e.g. to persist a local-inference turn). */
export interface SettledTurn {
  conversationId: string;
  messages: { id: string; role: string; parts: unknown }[];
  isAbort: boolean;
  isError: boolean;
  finishReason?: string;
}

export interface ChatSessionProps<TMessage extends UIMessage = UIMessage> {
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
  /**
   * Image attachments. Enabled by default — picked images are inlined as `data:`
   * URLs so vision works with no backend. Provide `uploadFile` to store them and
   * send a reference instead (keeps history lightweight and bytes private).
   */
  enableAttachments?: boolean;
  /** Show a camera-capture button (requires `getUserMedia`). Default true. */
  enableCamera?: boolean;
  uploadFile?: UploadAttachment;
  /** Accepted image mime types. Defaults to jpeg/png/gif/webp (the safe vision set). */
  acceptedImageTypes?: string[];
  /** Max bytes per attachment. Default 5 MB. */
  maxAttachmentBytes?: number;
  assistantTestId?: string;
  viewportTestId?: string;
}

/**
 * One chat session: the `useChat` wrapper plus message list and composer. Generic
 * over the transport and tool set — server-execute tools just stream; client-side
 * tools are run via the injected `onToolCall` (which receives `addToolOutput`).
 * Re-key this by `conversationId` so each session gets a clean `useChat`.
 */
export function ChatSession<TMessage extends UIMessage = UIMessage>({
  conversationId,
  transport,
  initialMessages,
  providerReady,
  onToolCall,
  onTurnSettled,
  toolRenderers,
  suggestions = [],
  emptyStateText = 'Ask the agent to get started.',
  placeholder,
  onError,
  onConfigure,
  onBusyChange,
  onMessagesSynced,
  enableAttachments = true,
  enableCamera = true,
  uploadFile,
  acceptedImageTypes,
  maxAttachmentBytes,
  assistantTestId,
  viewportTestId,
}: ChatSessionProps<TMessage>) {
  // Hold `addToolOutput` in a ref so the `onToolCall` wrapper can reach it
  // without referencing the `useChat` return inside its own initializer.
  const addToolOutputRef = useRef<AddToolOutput | null>(null);

  const chat = useChat<TMessage>({
    id: conversationId,
    messages: initialMessages,
    transport,
    // Auto-continue the loop both when client-executed tools have produced
    // their outputs AND when a needs-approval call has been approved/denied —
    // the latter resumes the server so an approved tool actually runs.
    sendAutomaticallyWhen: ({ messages }) =>
      lastAssistantMessageIsCompleteWithToolCalls({ messages }) ||
      lastAssistantMessageIsCompleteWithApprovalResponses({ messages }),
    onToolCall: onToolCall
      ? ({ toolCall }) =>
          onToolCall({
            toolCall: toolCall as unknown as AgentToolCall,
            addToolOutput: result => addToolOutputRef.current?.(result),
          })
      : undefined,
    onFinish: onTurnSettled
      ? ({ messages, isAbort, isError, finishReason }) =>
          onTurnSettled({
            conversationId,
            messages: messages.map(m => ({ id: m.id, role: m.role, parts: m.parts })),
            isAbort: Boolean(isAbort),
            isError: Boolean(isError),
            finishReason,
          })
      : undefined,
    onError: e => onError?.(e.message || 'The agent ran into an error'),
  });
  addToolOutputRef.current = chat.addToolOutput as unknown as AddToolOutput;

  const { messages, sendMessage, status, stop, addToolApprovalResponse } = chat;
  const [input, setInput] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  // Full-screen preview of a tapped attachment thumbnail.
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  const attachmentsOn = enableAttachments && providerReady;
  const attachments = useAttachments({
    uploadFile,
    acceptedTypes: acceptedImageTypes,
    maxBytes: maxAttachmentBytes,
    onError,
  });
  const { items, add, remove, clear, ready, hasPending } = attachments;

  useEffect(() => {
    // `scrollTo` is absent in some environments (e.g. jsdom) — guard the call.
    viewportRef.current?.scrollTo?.({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, items]);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  // Sync the latest messages up to the orchestrator cache only on the settle
  // transition (busy → false), not on every streaming delta.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) onMessagesSynced?.(conversationId, messages);
    wasBusy.current = busy;
  }, [busy, messages, conversationId, onMessagesSynced]);

  const canSend = providerReady && !busy && !hasPending && (input.trim().length > 0 || ready.length > 0);

  function submit() {
    if (!canSend) return;
    const trimmed = input.trim();
    const files: FileUIPart[] = ready.map(a => ({
      type: 'file',
      url: a.url,
      mediaType: a.mediaType,
      ...(a.filename ? { filename: a.filename } : {}),
      ...(a.providerMetadata ? { providerMetadata: a.providerMetadata } : {}),
    }));
    if (files.length > 0) {
      sendMessage(trimmed ? { text: trimmed, files } : { files });
    } else {
      sendMessage({ text: trimmed });
    }
    setInput('');
    clear();
  }

  function pickFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.length > 0) void add(files);
  }

  return (
    <>
      <div ref={viewportRef} data-testid={viewportTestId} className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3 pt-6 text-center">
              <Sparkles className="mx-auto size-6 text-primary" />
              <p className="text-sm text-muted-foreground">{emptyStateText}</p>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-col gap-2">
                  {suggestions.map(s => (
                    <button
                      key={s}
                      type="button"
                      disabled={!providerReady}
                      onClick={() => {
                        // Send the suggestion immediately (no attachments expected).
                        if (providerReady && !busy) sendMessage({ text: s });
                      }}
                      className="rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            messages.map(m => (
              <MessageBubble
                key={m.id}
                message={m}
                toolRenderers={toolRenderers}
                onApproval={({ id, approved }) => addToolApprovalResponse({ id, approved })}
                assistantTestId={assistantTestId}
              />
            ))
          )}
        </div>
      </div>

      {!providerReady && (
        <div className="mx-3 mb-2 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span className="flex-1">Connect an AI provider to use the agent.</span>
          {onConfigure && (
            <Button size="sm" variant="outline" className="h-7" onClick={onConfigure}>
              Configure
            </Button>
          )}
        </div>
      )}

      <form
        className="border-t border-border p-3"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <div
          className="rounded-md border border-border transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
          onDragOver={attachmentsOn ? e => e.preventDefault() : undefined}
          onDrop={
            attachmentsOn
              ? e => {
                  e.preventDefault();
                  pickFiles(e.dataTransfer.files);
                }
              : undefined
          }
        >
          {items.length > 0 && (
            <div className="flex gap-2 overflow-x-auto p-2" data-testid="attachment-strip">
              {items.map(a => (
                <div
                  key={a.tempId}
                  data-testid="attachment-thumb"
                  className="relative size-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
                >
                  <img
                    src={a.objectUrl}
                    alt={a.filename}
                    onClick={() => setPreviewSrc(a.objectUrl)}
                    className="size-full cursor-zoom-in object-cover"
                  />
                  {a.status === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Loader2 className="size-4 animate-spin text-white" />
                    </div>
                  )}
                  {a.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/70 p-1 text-center text-[9px] leading-tight text-white">
                      {a.error ?? 'Failed'}
                    </div>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${a.filename}`}
                    onClick={() => remove(a.tempId)}
                    className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            onPaste={
              attachmentsOn
                ? e => {
                    const files = Array.from(e.clipboardData.files);
                    if (files.length > 0) {
                      e.preventDefault();
                      void add(files);
                    }
                  }
                : undefined
            }
            disabled={!providerReady}
            placeholder={placeholder ?? (providerReady ? 'Ask the agent…' : 'Connect a provider in Settings')}
            rows={2}
            className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />

          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <div className="flex items-center gap-1">
              {enableAttachments && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="sr-only"
                    data-testid="attachment-input"
                    aria-label="Attach images"
                    onChange={e => {
                      pickFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    disabled={!attachmentsOn}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach images"
                  >
                    <Paperclip className="size-4" />
                  </Button>
                  {enableCamera && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground"
                      disabled={!attachmentsOn}
                      onClick={() => setCameraOpen(true)}
                      aria-label="Take a photo"
                    >
                      <Camera className="size-4" />
                    </Button>
                  )}
                </>
              )}
            </div>

            {busy ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-8"
                onClick={() => stop()}
                aria-label="Stop"
              >
                <Square className="size-3.5" />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="size-8" disabled={!canSend} aria-label="Send">
                <ArrowUp className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </form>

      {enableAttachments && enableCamera && (
        <CameraDialog open={cameraOpen} onOpenChange={setCameraOpen} onCapture={file => void add([file])} />
      )}

      {/* Full-screen preview of a tapped thumbnail. Exit via the dialog's
          built-in close, Escape, the backdrop, or tapping the image. */}
      <Dialog open={Boolean(previewSrc)} onOpenChange={open => !open && setPreviewSrc(null)}>
        <DialogContent
          data-testid="attachment-preview"
          className="w-auto max-w-none border-0 bg-transparent p-0 shadow-none"
        >
          <DialogTitle className="sr-only">Image preview</DialogTitle>
          {previewSrc && (
            <img
              src={previewSrc}
              alt="Attachment preview"
              onClick={() => setPreviewSrc(null)}
              className="max-h-[85vh] max-w-[92vw] cursor-zoom-out rounded-md object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
