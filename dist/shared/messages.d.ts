//#region src/shared/messages.d.ts
/**
 * Who/what a conversation belongs to. `userId` always identifies the owner;
 * `partitionId` is the optional app partition the conversation lives under
 * (e.g. a workspace or document id). Apps whose ownership is derived another way
 * (e.g. a join, or row-level security) leave it unset.
 */
interface PersistenceScope {
  userId: string;
  partitionId?: string;
}
/** One message to persist — the AI SDK `UIMessage` reduced to its stored columns. */
interface PersistedMessage {
  id: string;
  role: string;
  parts: unknown;
}
/** One replayed message, in the shape the client's `useChat` expects. */
type ConversationMessage = PersistedMessage;
/** A chat session as shown in the session switcher (no message bodies). */
interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}
//#endregion
export { ConversationMessage, ConversationSummary, PersistedMessage, PersistenceScope };