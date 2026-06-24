'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@coston/ui/button';
import { Input } from '@coston/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@coston/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@coston/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@coston/ui/alert-dialog';
import { Check, ChevronDown, Loader2, Pencil, Plus, Settings2, Sparkles, Trash2, X } from 'lucide-react';
import { cn } from './cn';

/** A session as shown in the switcher. */
export interface ChatSessionSummary {
  id: string;
  title: string;
}

/** A cached/replayed message (the AI SDK `UIMessage` reduced to stored columns). */
export interface CachedMessage {
  id: string;
  role: string;
  parts: unknown;
}

/**
 * The session CRUD the panel drives — typically thin wrappers over the app's
 * server actions. Returning `null` from `create`/`rename` signals failure (the
 * panel surfaces it via `onError`).
 */
export interface SessionController {
  create: () => Promise<ChatSessionSummary | null>;
  rename: (id: string, title: string) => Promise<ChatSessionSummary | null>;
  remove: (id: string) => Promise<void>;
  loadMessages: (id: string) => Promise<CachedMessage[] | null>;
}

export interface ChatPanelSessionRenderArgs {
  conversationId: string;
  initialMessages: CachedMessage[];
  onBusyChange: (busy: boolean) => void;
  onMessagesSynced: (id: string, messages: CachedMessage[]) => void;
  onConfigure: () => void;
}

export interface ChatPanelTestIds {
  switcher?: string;
  new?: string;
  item?: string;
  rename?: string;
  renameInput?: string;
  delete?: string;
  configToggle?: string;
}

const DEFAULT_TEST_IDS: Required<ChatPanelTestIds> = {
  switcher: 'session-switcher',
  new: 'session-new',
  item: 'session-item',
  rename: 'session-rename',
  renameInput: 'session-rename-input',
  delete: 'session-delete',
  configToggle: 'provider-config-toggle',
};

export interface ChatPanelProps {
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
  renderConfig?: (args: { close: () => void }) => ReactNode;
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
export function ChatPanel({
  partitionId,
  conversations: initialConversations,
  activeConversationId,
  initialMessages,
  sessions,
  providerReady,
  renderSession,
  renderConfig,
  providerLabel,
  defaultTitle = 'New chat',
  storageKeyPrefix = 'coston-agent:active-conversation',
  onError,
  testIds,
}: ChatPanelProps) {
  const ids = { ...DEFAULT_TEST_IDS, ...testIds };
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(activeConversationId);
  const [cache, setCache] = useState<ReadonlyMap<string, CachedMessage[]>>(
    () => new Map([[activeConversationId, initialMessages]])
  );
  const [busy, setBusy] = useState(false);
  const [configOpen, setConfigOpen] = useState(!providerReady);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const storageKey = `${storageKeyPrefix}:${partitionId}`;
  const activeTitle = conversations.find(c => c.id === activeId)?.title ?? defaultTitle;

  const persistActive = useCallback(
    (id: string) => {
      try {
        localStorage.setItem(storageKey, id);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
    },
    [storageKey]
  );

  const loadMessages = useCallback(
    async (id: string) => {
      const msgs = await sessions.loadMessages(id).catch(() => null);
      if (!msgs) {
        onError?.('Failed to load that chat');
        return;
      }
      setCache(prev => new Map(prev).set(id, msgs));
    },
    [sessions, onError]
  );

  const switchTo = useCallback(
    (id: string) => {
      if (id === activeId) return;
      setActiveId(id);
      persistActive(id);
      if (!cache.has(id)) void loadMessages(id);
    },
    [activeId, cache, loadMessages, persistActive]
  );

  // On mount, continue whichever session this browser had open last (if it still
  // exists). Runs once.
  useEffect(() => {
    const stored = (() => {
      try {
        return localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    })();
    if (stored && stored !== activeId && conversations.some(c => c.id === stored)) {
      switchTo(stored);
    }
    // Run once on mount to restore the last-open session.
  }, []);

  const newChat = useCallback(async () => {
    const conv = await sessions.create().catch(() => null);
    if (!conv) {
      onError?.('Failed to start a new chat');
      return;
    }
    setConversations(prev => [conv, ...prev.filter(c => c.id !== conv.id)]);
    setCache(prev => new Map(prev).set(conv.id, []));
    setActiveId(conv.id);
    persistActive(conv.id);
  }, [sessions, persistActive, onError]);

  const commitRename = useCallback(
    async (title: string) => {
      setRenameOpen(false);
      const trimmed = title.trim();
      if (!trimmed || trimmed === activeTitle) return;
      const updated = await sessions.rename(activeId, trimmed).catch(() => null);
      if (!updated) {
        onError?.('Failed to rename chat');
        return;
      }
      setConversations(prev => prev.map(c => (c.id === updated.id ? updated : c)));
    },
    [activeId, activeTitle, sessions, onError]
  );

  const confirmDelete = useCallback(async () => {
    setDeleteOpen(false);
    const removedId = activeId;
    await sessions.remove(removedId).catch(() => null);
    const remaining = conversations.filter(c => c.id !== removedId);
    setConversations(remaining);
    setCache(prev => {
      const next = new Map(prev);
      next.delete(removedId);
      return next;
    });
    const fallback = remaining[0];
    if (fallback) {
      setActiveId(fallback.id);
      persistActive(fallback.id);
      if (!cache.has(fallback.id)) void loadMessages(fallback.id);
    } else {
      void newChat();
    }
  }, [activeId, cache, conversations, loadMessages, newChat, persistActive, sessions]);

  const handleMessagesSynced = useCallback((id: string, messages: CachedMessage[]) => {
    setCache(prev => new Map(prev).set(id, messages));
  }, []);

  const activeMessages = cache.get(activeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <SessionSwitcher
          activeTitle={activeTitle}
          conversations={conversations}
          activeId={activeId}
          providerLabel={providerLabel}
          disabled={busy}
          onSelect={switchTo}
          onNew={() => void newChat()}
          testIds={ids}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          disabled={busy}
          onClick={() => setRenameOpen(true)}
          aria-label="Rename chat"
          data-testid={ids.rename}
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete chat"
          data-testid={ids.delete}
        >
          <Trash2 className="size-4" />
        </Button>
        {renderConfig && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            disabled={busy}
            onClick={() => setConfigOpen(o => !o)}
            aria-label={configOpen ? 'Back to chat' : 'Configure AI provider'}
            aria-pressed={configOpen}
            data-testid={ids.configToggle}
          >
            {configOpen ? <X className="size-4" /> : <Settings2 className="size-4" />}
          </Button>
        )}
      </div>

      {configOpen && renderConfig ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {renderConfig({ close: () => setConfigOpen(false) })}
        </div>
      ) : activeMessages === undefined ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div key={activeId} className="flex min-h-0 flex-1 flex-col">
          {renderSession({
            conversationId: activeId,
            initialMessages: activeMessages,
            onBusyChange: setBusy,
            onMessagesSynced: handleMessagesSynced,
            onConfigure: () => setConfigOpen(true),
          })}
        </div>
      )}

      <RenameDialog
        open={renameOpen}
        initialTitle={activeTitle}
        onOpenChange={setRenameOpen}
        onSubmit={commitRename}
        inputTestId={ids.renameInput}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              “{activeTitle}” and its messages will be permanently removed. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SessionSwitcher({
  activeTitle,
  conversations,
  activeId,
  providerLabel,
  disabled,
  onSelect,
  onNew,
  testIds,
}: {
  activeTitle: string;
  conversations: ChatSessionSummary[];
  activeId: string;
  providerLabel?: string;
  disabled: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  testIds: Required<ChatPanelTestIds>;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-7 min-w-0 flex-1 justify-start gap-1.5 px-2"
          data-testid={testIds.switcher}
        >
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-left text-sm">{activeTitle}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {providerLabel && (
          <>
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              {providerLabel}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={onNew} data-testid={testIds.new}>
          <Plus className="size-4" /> New chat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {conversations.map(c => (
          <DropdownMenuItem
            key={c.id}
            onSelect={() => onSelect(c.id)}
            data-testid={testIds.item}
            data-active={c.id === activeId}
          >
            <Check className={cn('size-4', c.id === activeId ? 'opacity-100' : 'opacity-0')} />
            <span className="min-w-0 flex-1 truncate">{c.title}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameDialog({
  open,
  initialTitle,
  onOpenChange,
  onSubmit,
  inputTestId,
}: {
  open: boolean;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
  inputTestId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>Give this session a name you’ll recognise.</DialogDescription>
        </DialogHeader>
        {/* Uncontrolled: Radix remounts content on each open, so defaultValue
            always reflects the current title without a reset effect. */}
        <form
          onSubmit={e => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            onSubmit(String(data.get('title') ?? ''));
          }}
        >
          <Input
            name="title"
            defaultValue={initialTitle}
            autoFocus
            aria-label="Chat name"
            data-testid={inputTestId}
          />
          <DialogFooter className="mt-4">
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
