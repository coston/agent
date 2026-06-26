# Adopting `@coston/agent` in any app

A recipe for wiring an app-scoped copilot into a Next.js app. The example uses a
generic **"notes"** app — substitute your own domain. Nothing here is specific to
any one app; everything app-specific is injected.

## 1. Prerequisites

Install the package, then the peers your subpaths need (Node >=20 required):

```bash
npm install @coston/agent
```

Peers resolve from the app, and most are optional — install only what the
subpaths you use need:

```jsonc
// package.json
"dependencies": {
  "@coston/agent": "^0.2.0",

  // always required (the chat route + provider resolution):
  "ai": "^6",
  "@ai-sdk/anthropic": "^3",
  "@ai-sdk/openai": "^3",

  // for the /react UI:
  "@ai-sdk/react": "^3",
  "@coston/ui": ">=0.3 <0.5",
  "lucide-react": "^1",
  "streamdown": "^2",
  "react": "^19",
  "react-dom": "^19",

  // only if you expose an MCP server (/mcp):
  "@modelcontextprotocol/sdk": "^1",
  "mcp-handler": "^1",

  // only for the browser local transport (createLocalTransport):
  "@ai-sdk/openai-compatible": "^2"
}
```

**Env vars:** `ENCRYPTION_KEY` (base64, 32 bytes — `openssl rand -base64 32`) for
provider-key encryption, plus whichever of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`
/ `AI_GATEWAY_API_KEY` you default to.

## 2. Data model (Prisma)

The package is storage-agnostic (`PersistenceAdapter`), but `createPrismaPersistence`
expects a conversation + message pair and a provider-settings row. The **ownership
columns are yours** — wire them via the adapter `mapping`. A column-scoped shape
(`userId` + a partition column):

```prisma
model AiProviderSetting {
  userId           String  @id
  provider         String  @default("gateway")
  model            String  @default("anthropic/claude-sonnet-4.6")
  apiKeyCiphertext String?
  baseUrl          String?
}

model Conversation {
  id         String   @id @default(cuid())
  userId     String
  notebookId String   // your partition column (a workspace / document / project id)
  title      String   @default("New chat")
  renamed    Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  messages   ChatMessage[]

  @@index([notebookId, userId, updatedAt])
}

model ChatMessage {
  id             String   @id
  conversationId String
  role           String
  parts          Json     // the AI SDK UIMessage parts, stored verbatim
  createdAt      DateTime @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
}
```

## 3. Provider resolution + persistence (server)

```ts
// lib/agent.ts
import { createProviderResolver, decryptSecret } from '@coston/agent/server';
import { createPrismaPersistence } from '@coston/agent/persistence';
import { db } from '@/lib/db';

export const { resolveUserModel } = createProviderResolver({
  loadSetting: async userId => db.aiProviderSetting.findUnique({ where: { userId } }),
  decrypt: decryptSecret,
});

export const persistence = createPrismaPersistence({
  db,
  conversation: db.conversation,
  message: db.chatMessage,
  mapping: {
    // ownership for a single conversation (combined with { id }):
    ownershipWhere: s => ({ userId: s.userId }),
    // all conversations in the partition for this user:
    partitionWhere: s => ({ notebookId: s.partitionId, userId: s.userId }),
    createData: (s, title) => ({ notebookId: s.partitionId, userId: s.userId, title }),
  },
});
```

**Custom store (no Prisma).** `PersistenceAdapter` is the package's only bespoke
interface — implement it directly for raw SQL, RLS, or any other store. It is one
interface backing the chat route's `saveMessages`, the session server actions
(§6), and the UI switcher. Implement its nine methods against your store
(`scope` is `{ userId, partitionId? }` throughout — apply your ownership check in
each; `src/persistence/types.ts` has the exact signatures):

- `listSessions(scope)` — a partition's sessions for this user, newest-active first
- `createSession(scope)` — start a session, reusing an untouched empty one
- `getOrCreateActiveSession(scope)` — the most-recent session, creating one if none
- `renameSession(id, scope, title)` — rename, marking it manually renamed
- `deleteSession(id, scope)` — delete a session the user owns
- `pruneEmptySessions(scope)` — sweep abandoned empties, always keeping ≥1
- `loadMessages(id, scope)` — replay oldest-first in the `useChat` shape
- `saveMessages(id, scope, messages)` — replace with a settled turn
- `assertOwnership(id, scope)` — throw unless the session is owned within scope

Messages are stored verbatim as AI SDK `UIMessage` parts.

### Provider settings UI (`ProviderForm`)

`<ProviderForm>` (from `@coston/agent/react`) is the generic provider/model/key
form that writes the `AiProviderSetting` row the resolver above reads. The app
injects `onSave`, which encrypts the key with `encryptSecret` and stores it — the
package never sees a plaintext key after submission:

```tsx
// app/settings/provider-settings.tsx
'use client';
import { ProviderForm, type ProviderSetting } from '@coston/agent/react';
import { saveProvider } from '@/actions/provider';
import { toast } from 'sonner';

export function ProviderSettings({ initial }: { initial: ProviderSetting }) {
  return <ProviderForm initial={initial} onSave={saveProvider} onError={m => toast.error(m)} />;
}
```

```ts
// app/actions/provider.ts
'use server';
import { encryptSecret, type ProviderType } from '@coston/agent/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function saveProvider(input: {
  provider: ProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  const data = {
    provider: input.provider,
    model: input.model,
    baseUrl: input.baseUrl ?? null,
    // only overwrite the stored key when the user typed a new one:
    ...(input.apiKey ? { apiKeyCiphertext: encryptSecret(input.apiKey) } : {}),
  };
  await db.aiProviderSetting.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });
}
```

`providerReady` (threaded through `<ChatPanel>` / `<ChatSession>` below) is just
"does the user have a usable setting?" — compute it server-side from the saved
row (a model is chosen, and a key exists for providers that need one).

## 4. Chat route — `app/api/chat/route.ts`

Two ways to supply tools + prompt: inline, or via `defineAgent` (recommended —
adds Markdown instructions + Skills + approval gates).

```ts
import { createChatRoute, defineAgent } from '@coston/agent/server';
import type { UIMessage } from 'ai';
import { auth } from '@/lib/auth';
import { resolveUserModel, persistence } from '@/lib/agent';
import { buildNoteTools } from '@/lib/note-tools';
import instructions from '@/agent/instructions.md'; // app loads the markdown

interface Body {
  messages: UIMessage[];
  conversationId: string;
  notebookId: string;
}

const agent = defineAgent<{ userId: string; notebookId: string }>({
  instructions,
  tools: ctx => buildNoteTools(ctx),            // standard ToolSet — passed directly, no cast
  skills: [/* { name, description, content } */],
  approvals: ['delete_note'],                    // → AI SDK needsApproval → Approve/Deny UI
});
// For a rich approval body (preview a plan/batch instead of the default
// Approve/Deny prompt), give the tool's renderer a `renderApproval` — see README.

export const { POST } = createChatRoute<Body, { userId: string; notebookId: string }>({
  conversationIdFrom: b => b.conversationId,
  authorize: async (_req, b) => {
    const session = await auth();
    if (!session?.user?.id) return { error: 'Unauthorized', status: 401 };
    // ...verify the conversation belongs to (user, notebook)...
    return {
      userId: session.user.id,
      scope: { userId: session.user.id, partitionId: b.notebookId },
      context: { userId: session.user.id, notebookId: b.notebookId },
    };
  },
  resolveModel: resolveUserModel,
  buildTools: ({ context }) => agent.tools(context),
  buildSystemPrompt: ({ context }) => agent.systemPrompt(context),
  saveMessages: ({ conversationId, scope, messages }) =>
    persistence.saveMessages(conversationId, scope, messages),
});
```

How instructions, Skills (the on-demand `load_skill` tool), and `approvals`
(Approve/Deny UI) compose is covered in
[ARCHITECTURE.md → Agent definition](./ARCHITECTURE.md#agent-definition).

## 5. MCP server (optional) — `app/api/[transport]/route.ts`

```ts
import { createMcpRoute, createScopedHelper, mcpText } from '@coston/agent/mcp';
import { verifyToken } from '@/lib/mcp/verify-token'; // app-owned (PAT and/or OAuth)

const scoped = createScopedHelper<'notes:read' | 'notes:write'>();

export const { GET, POST, DELETE } = createMcpRoute({
  serverInfo: { name: 'notes', version: '1.0.0' },
  verifyToken,
  registerTools: server => {
    server.tool('list_notes', 'List your notes', {}, scoped('notes:read', async (_args, { userId }) => {
      // ...load this user's notes from your store...
      return mcpText('your notes…');
    }));
  },
});
```

## 6. The panel (client)

`ChatPanel` owns session orchestration; you provide a `SessionController` (thin
wrappers over your server actions) and render the active session. For **server-side
tools** the session is just `<ChatSession>` with a `DefaultChatTransport`; for
**client-side tools** (executed in the browser), pass `onToolCall`.

The server actions are thin wrappers over the persistence adapter — `create`
needs the partition, the rest are scoped by owner + conversation id:

```ts
// app/actions/conversations.ts
'use server';
import { auth } from '@/lib/auth';
import { persistence } from '@/lib/agent';

const userScope = async () => {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return { userId: session.user.id };
};

export const createConvo = async (notebookId: string) =>
  persistence.createSession({ ...(await userScope()), partitionId: notebookId });
export const renameConvo = async (id: string, title: string) =>
  persistence.renameSession(id, await userScope(), title);
export const deleteConvo = async (id: string) =>
  persistence.deleteSession(id, await userScope());
export const loadConvo = async (id: string) =>
  persistence.loadMessages(id, await userScope());
```

```tsx
'use client';
import { DefaultChatTransport } from 'ai';
import { ChatPanel, ChatSession } from '@coston/agent/react';
import { toast } from 'sonner';
import { createConvo, renameConvo, deleteConvo, loadConvo } from '@/actions/conversations';

export function NotesCopilot({
  notebookId,
  conversations,
  activeConversationId,
  initialMessages,
  providerReady,
}) {
  return (
    <ChatPanel
      partitionId={notebookId}
      conversations={conversations}
      activeConversationId={activeConversationId}
      initialMessages={initialMessages}
      providerReady={providerReady}
      sessions={{
        create: () => createConvo(notebookId),
        rename: (id, title) => renameConvo(id, title),
        remove: id => deleteConvo(id),
        loadMessages: id => loadConvo(id),
      }}
      onError={m => toast.error(m)}
      renderSession={({ conversationId, initialMessages, onBusyChange, onMessagesSynced }) => (
        <ChatSession
          conversationId={conversationId}
          initialMessages={initialMessages}
          providerReady={providerReady}
          transport={new DefaultChatTransport({
            api: '/api/chat',
            prepareSendMessagesRequest: ({ messages }) => ({ body: { messages, conversationId, notebookId } }),
          })}
          onBusyChange={onBusyChange}
          onMessagesSynced={onMessagesSynced}
          onError={m => toast.error(m)}
        />
      )}
    />
  );
}
```

**Server tools vs client tools.** Tools with `execute` run on the server (the
default — the route's `streamText` runs them). Tools *without* `execute` are
surfaced to the browser; pass an `onToolCall` to `<ChatSession>` to run them
against live client state (client-side actuation). The same `ToolSet`
supports a mix.

### Browser-side inference (`createLocalTransport`)

To run inference against a user's **own** local / OpenAI-compatible endpoint
(Ollama, LM Studio, vLLM, …), give `<ChatSession>` a `createLocalTransport`
instead of a `DefaultChatTransport`. The model call happens in the browser, so
the server never requests the user-supplied base URL (no SSRF) and the key never
leaves the client — the server resolver deliberately refuses `openai_compatible`:

```tsx
'use client';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createLocalTransport } from '@coston/agent/react';
import { buildNoteTools } from '@/lib/note-tools';

// drop-in replacement for the `transport` prop in renderSession above:
const transport = createLocalTransport({
  buildModel: () =>
    createOpenAICompatible({ name: 'local', baseURL, apiKey }).chatModel(model),
  buildSystemPrompt: () => systemPrompt,
  tools: buildNoteTools(ctx), // schema-only tools run in the browser via onToolCall
});
```

`baseURL` / `apiKey` / `model` come from the user's saved provider settings
(§3), read client-side.
