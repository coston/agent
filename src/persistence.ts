// `@coston/agent/persistence` — the conversation/session store. One
// `PersistenceAdapter` interface backs the chat route, the session server
// actions, and the UI switcher. A Prisma adapter is provided; apps on another
// store implement the interface directly. The only bespoke interface in the
// package (the AI SDK does not standardize chat storage).

export type {
  ConversationMessage,
  ConversationSummary,
  PersistedMessage,
  PersistenceAdapter,
  PersistenceScope,
} from './persistence/types';
export {
  createPrismaPersistence,
  type CreatePrismaPersistenceOptions,
  type PrismaConversationDelegate,
  type PrismaMessageDelegate,
  type PrismaPersistenceMapping,
  type PrismaTransactional,
} from './persistence/prisma';
export { nextPlaceholderTitle } from './persistence/title';
