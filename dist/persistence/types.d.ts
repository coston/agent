import { ConversationMessage, ConversationSummary, PersistedMessage, PersistenceScope } from "../shared/messages.js";

//#region src/persistence/types.d.ts

/**
 * The conversation/session store an agent chat needs. One interface backs the
 * chat route's `saveMessages`, the app's session server actions, and the UI's
 * session switcher. The Prisma implementation is provided
 * (`createPrismaPersistence`); apps on another store (e.g. raw SQL + RLS) supply
 * their own. The only bespoke interface in the package — the AI SDK does not
 * standardize chat storage.
 */
interface PersistenceAdapter {
  /** All of a partition's sessions for this user, newest-active first. */
  listSessions(scope: PersistenceScope): Promise<ConversationSummary[]>;
  /** Start a session (reuses an untouched empty one rather than piling up rows). */
  createSession(scope: PersistenceScope): Promise<ConversationSummary>;
  /** The most-recently-active session, creating one if none exists. */
  getOrCreateActiveSession(scope: PersistenceScope): Promise<ConversationSummary>;
  /** Rename a session (marks it as manually renamed). */
  renameSession(id: string, scope: PersistenceScope, title: string): Promise<ConversationSummary>;
  /** Delete a session the user owns. */
  deleteSession(id: string, scope: PersistenceScope): Promise<void>;
  /** Sweep abandoned auto-named empty sessions, always keeping at least one. */
  pruneEmptySessions(scope: PersistenceScope): Promise<void>;
  /** Replay a session's messages, oldest first, in the `useChat` shape. */
  loadMessages(id: string, scope: PersistenceScope): Promise<ConversationMessage[]>;
  /** Replace a session's messages with a settled turn and bump its recency. */
  saveMessages(id: string, scope: PersistenceScope, messages: PersistedMessage[]): Promise<void>;
  /** Throw unless the session exists and is owned within this scope. */
  assertOwnership(id: string, scope: PersistenceScope): Promise<void>;
}
//#endregion
export { PersistenceAdapter };