// Conversation/message contracts shared by the route, the persistence adapter,
// and the React layer. Messages are stored in the AI SDK `UIMessage` shape
// (`parts` kept verbatim) — no bespoke message model.

/**
 * Who/what a conversation belongs to. `userId` always identifies the owner;
 * `partitionId` is the optional app partition the conversation lives under
 * (e.g. a workspace or document id). Apps whose ownership is derived another way
 * (e.g. a join, or row-level security) leave it unset.
 */
export interface PersistenceScope {
  userId: string;
  partitionId?: string;
}

/** One message to persist — the AI SDK `UIMessage` reduced to its stored columns. */
export interface PersistedMessage {
  id: string;
  role: string;
  parts: unknown;
}

/** One replayed message, in the shape the client's `useChat` expects. */
export type ConversationMessage = PersistedMessage;

/** A chat session as shown in the session switcher (no message bodies). */
export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: Date;
}
