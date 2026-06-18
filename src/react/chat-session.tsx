'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { lastAssistantMessageIsCompleteWithToolCalls, type ChatTransport, type UIMessage } from 'ai';
import { Button } from '@coston/ui/button';
import { Textarea } from '@coston/ui/textarea';
import { AlertCircle, ArrowUp, Sparkles, Square } from 'lucide-react';
import { MessageBubble } from './message-bubble';
import type { ToolRenderer } from './types';

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
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    // `scrollTo` is absent in some environments (e.g. jsdom) — guard the call.
    viewportRef.current?.scrollTo?.({ top: viewportRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  // Sync the latest messages up to the orchestrator cache only on the settle
  // transition (busy → false), not on every streaming delta.
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy) onMessagesSynced?.(conversationId, messages);
    wasBusy.current = busy;
  }, [busy, messages, conversationId, onMessagesSynced]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !providerReady) return;
    sendMessage({ text: trimmed });
    setInput('');
  }

  return (
    <>
      <div
        ref={viewportRef}
        data-testid={viewportTestId}
        className="min-h-0 flex-1 overflow-y-auto"
      >
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
                      onClick={() => submit(s)}
                      className="rounded-md border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
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
        className="border-t p-3"
        onSubmit={e => {
          e.preventDefault();
          submit(input);
        }}
      >
        <div className="relative">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            disabled={!providerReady}
            placeholder={
              placeholder ?? (providerReady ? 'Ask the agent…' : 'Connect a provider in Settings')
            }
            rows={2}
            className="resize-none pr-12"
          />
          {busy ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute bottom-2 right-2 size-8"
              onClick={() => stop()}
              aria-label="Stop"
            >
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              className="absolute bottom-2 right-2 size-8"
              disabled={!input.trim() || !providerReady}
              aria-label="Send"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
