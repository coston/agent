import { useState, type ReactNode } from 'react';
import {
  ChatPanel,
  ChatSession,
  ProviderForm,
  CameraDialog,
  providerBadgeLabel,
  type CachedMessage,
  type ProviderSetting,
} from '@coston/agent/react';
import type { UIMessage } from 'ai';
import { mockTransport } from '@/lib/mock-transport';
import {
  SUGGESTIONS,
  conversationMessages,
  imageMessages,
  toolRunningMessages,
  toolDoneMessages,
  toolErrorMessages,
  toolApprovalMessages,
  panelConversations,
  panelInitialMessages,
  mockSessions,
  providerSettings,
} from '@/lib/fixtures';

const noop = () => {};
const noopAsync = async () => {};

/** Centers a fixed-size surface so every view is captured at a stable layout. */
function PageShell({ children, kind = 'chat' }: { children: ReactNode; kind?: 'chat' | 'form' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div
        className={
          kind === 'form'
            ? 'w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-sm'
            : // No `overflow-hidden` here: it would clip the composer's
              // focus-within ring (a box-shadow) at the frame's rounded corners.
              // The message viewport scrolls on its own.
              'flex h-[680px] w-full max-w-md flex-col rounded-xl border border-border bg-background shadow-sm'
        }
      >
        {children}
      </div>
    </div>
  );
}

/** A bare ChatSession wired to the no-op transport, for the message/tool states. */
function Session({
  messages,
  providerReady = true,
  suggestions,
  showConfigure = false,
}: {
  messages: UIMessage[];
  providerReady?: boolean;
  suggestions?: string[];
  showConfigure?: boolean;
}) {
  return (
    <PageShell kind="chat">
      <ChatSession
        conversationId="demo"
        transport={mockTransport}
        initialMessages={messages}
        providerReady={providerReady}
        suggestions={suggestions}
        onConfigure={showConfigure ? noop : undefined}
      />
    </PageShell>
  );
}

export const ChatEmpty = () => <Session messages={[]} suggestions={SUGGESTIONS} />;
export const ChatNotConnected = () => <Session messages={[]} providerReady={false} showConfigure />;
export const ChatConversation = () => <Session messages={conversationMessages} />;
export const ChatImageMessage = () => <Session messages={imageMessages} />;
export const ChatToolRunning = () => <Session messages={toolRunningMessages} />;
export const ChatToolDone = () => <Session messages={toolDoneMessages} />;
export const ChatToolError = () => <Session messages={toolErrorMessages} />;
export const ChatToolApproval = () => <Session messages={toolApprovalMessages} />;
export const ChatAttachments = () => <Session messages={[]} />;

export function Panel() {
  const setting = providerSettings.gateway;
  return (
    <PageShell kind="chat">
      <ChatPanel
        partitionId="demo"
        conversations={panelConversations}
        activeConversationId="conv-1"
        initialMessages={panelInitialMessages}
        sessions={mockSessions}
        providerReady
        providerLabel={providerBadgeLabel(setting)}
        renderSession={({ conversationId, initialMessages, onBusyChange, onMessagesSynced, onConfigure }) => (
          <ChatSession
            conversationId={conversationId}
            transport={mockTransport}
            initialMessages={initialMessages as unknown as UIMessage[]}
            providerReady
            onBusyChange={onBusyChange}
            onMessagesSynced={(id, messages) =>
              onMessagesSynced(id, messages as unknown as CachedMessage[])
            }
            onConfigure={onConfigure}
          />
        )}
        renderConfig={() => <ProviderForm initial={setting} onSave={noopAsync} />}
      />
    </PageShell>
  );
}

function Provider({ initial }: { initial: ProviderSetting }) {
  return (
    <PageShell kind="form">
      <ProviderForm initial={initial} onSave={noopAsync} />
    </PageShell>
  );
}

export const ProviderGateway = () => <Provider initial={providerSettings.gateway} />;
export const ProviderAnthropic = () => <Provider initial={providerSettings.anthropic} />;
export const ProviderOpenAI = () => <Provider initial={providerSettings.openai} />;
export const ProviderLocal = () => <Provider initial={providerSettings.local} />;

export function Camera() {
  // Always open so the dialog (and its no-camera error branch in headless) renders.
  const [open, setOpen] = useState(true);
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <CameraDialog open={open} onOpenChange={setOpen} onCapture={noop} />
    </div>
  );
}

/** Maps each view's `name` (from views.config) to its component, for the router. */
export const VIEW_COMPONENTS: Record<string, () => ReactNode> = {
  'chat-conversation': ChatConversation,
  'chat-empty': ChatEmpty,
  'chat-not-connected': ChatNotConnected,
  'chat-image-message': ChatImageMessage,
  'chat-attachments': ChatAttachments,
  'chat-tool-running': ChatToolRunning,
  'chat-tool-done': ChatToolDone,
  'chat-tool-error': ChatToolError,
  'chat-tool-approval': ChatToolApproval,
  panel: Panel,
  'provider-gateway': ProviderGateway,
  'provider-anthropic': ProviderAnthropic,
  'provider-openai': ProviderOpenAI,
  'provider-local': ProviderLocal,
  camera: Camera,
};
