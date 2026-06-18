import type { PersistedMessage, PersistenceScope } from '../shared/messages';
import type { PersistenceAdapter } from './types';
import { nextPlaceholderTitle } from './title';

// Structural Prisma delegate shapes — just the methods this adapter calls. Typed
// loosely (plain `object` args, `unknown` results) so the package stays decoupled
// from any specific generated Prisma schema: an app passes `db.conversation`,
// `db.chatMessage`/`db.message`, and `db` directly.
interface FindArgs {
  where?: object;
  orderBy?: object;
  select?: object;
}

export interface PrismaConversationDelegate {
  findMany(args: FindArgs): Promise<unknown[]>;
  findFirst(args: FindArgs): Promise<unknown>;
  create(args: { data: object; select?: object }): Promise<unknown>;
  update(args: { where: object; data: object; select?: object }): Promise<unknown>;
  delete(args: { where: object }): Promise<unknown>;
  deleteMany(args: { where: object }): Promise<unknown>;
}

export interface PrismaMessageDelegate {
  findMany(args: FindArgs): Promise<unknown[]>;
  // `deleteMany`/`createMany` are passed into `$transaction` un-awaited (lazy
  // Prisma ops), so they return the operation value, not an awaited result.
  deleteMany(args: { where: object }): unknown;
  createMany(args: { data: object[]; skipDuplicates?: boolean }): unknown;
}

export interface PrismaTransactional {
  $transaction(operations: unknown[]): Promise<unknown>;
}

/**
 * The app-specific where/data clauses — the only thing that differs between
 * ownership models. An app may scope by columns (`{ workspaceId, userId }`) or via
 * a join (`{ parent: { ownerId: userId } }`). All return plain Prisma objects, so
 * this carries no Prisma types.
 */
export interface PrismaPersistenceMapping {
  /** Where-clause matching one conversation owned within this scope (combined with `{ id }`). */
  ownershipWhere(scope: PersistenceScope): object;
  /** Where-clause matching all of a partition's conversations for this user. */
  partitionWhere(scope: PersistenceScope): object;
  /** Data to create a new conversation in this partition. */
  createData(scope: PersistenceScope, title: string): object;
  /** Optional pre-create authorization (e.g. a membership or owner check). */
  assertWritable?: (scope: PersistenceScope) => Promise<void>;
  /** Generate the next placeholder title. Defaults to `nextPlaceholderTitle`. */
  nextTitle?: (existingTitles: string[]) => string;
  /** Fallback title when a rename is blank. Defaults to "New chat". */
  defaultTitle?: string;
  /** Grace window (ms) before an empty session may be pruned. Defaults to 2 minutes. */
  pruneGraceMs?: number;
}

export interface CreatePrismaPersistenceOptions {
  /** The Prisma client (for `$transaction`). */
  db: PrismaTransactional;
  /** The conversation delegate, e.g. `db.conversation`. */
  conversation: PrismaConversationDelegate;
  /** The message delegate, e.g. `db.chatMessage` or `db.message`. */
  message: PrismaMessageDelegate;
  /** App-specific ownership/partition clauses. */
  mapping: PrismaPersistenceMapping;
}

interface SummaryRow {
  id: string;
  title: string;
  updatedAt: Date;
}

const summarySelect = { id: true, title: true, updatedAt: true } as const;
const DEFAULT_PRUNE_GRACE_MS = 2 * 60 * 1000;

/**
 * A Prisma-backed `PersistenceAdapter`. Centralizes the idempotent-create,
 * transactional-save, and prune-keep-one logic apps commonly duplicate; the
 * per-app ownership model is injected via `mapping`.
 */
export function createPrismaPersistence(options: CreatePrismaPersistenceOptions): PersistenceAdapter {
  const { db, conversation, message, mapping } = options;
  const nextTitle = mapping.nextTitle ?? nextPlaceholderTitle;
  const defaultTitle = mapping.defaultTitle ?? 'New chat';
  const graceMs = mapping.pruneGraceMs ?? DEFAULT_PRUNE_GRACE_MS;

  const ownedWhere = (id: string, scope: PersistenceScope) => ({
    id,
    ...mapping.ownershipWhere(scope),
  });

  async function assertOwnership(id: string, scope: PersistenceScope): Promise<void> {
    const found = await conversation.findFirst({
      where: ownedWhere(id, scope),
      select: { id: true },
    });
    if (!found) throw new Error('Conversation not found');
  }

  async function listSessions(scope: PersistenceScope): Promise<SummaryRow[]> {
    const rows = await conversation.findMany({
      where: mapping.partitionWhere(scope),
      orderBy: { updatedAt: 'desc' },
      select: summarySelect,
    });
    return rows as SummaryRow[];
  }

  async function createSession(scope: PersistenceScope): Promise<SummaryRow> {
    await mapping.assertWritable?.(scope);
    // Reuse an untouched (auto-named, empty) session rather than piling up rows.
    const reusable = (await conversation.findFirst({
      where: { ...mapping.partitionWhere(scope), renamed: false, messages: { none: {} } },
      orderBy: { createdAt: 'desc' },
      select: summarySelect,
    })) as SummaryRow | null;
    if (reusable) return reusable;

    const siblings = (await conversation.findMany({
      where: mapping.partitionWhere(scope),
      select: { title: true },
    })) as { title: string }[];
    const title = nextTitle(siblings.map(s => s.title));
    return (await conversation.create({
      data: mapping.createData(scope, title),
      select: summarySelect,
    })) as SummaryRow;
  }

  async function getOrCreateActiveSession(scope: PersistenceScope): Promise<SummaryRow> {
    const latest = (await conversation.findFirst({
      where: mapping.partitionWhere(scope),
      orderBy: { updatedAt: 'desc' },
      select: summarySelect,
    })) as SummaryRow | null;
    return latest ?? createSession(scope);
  }

  async function renameSession(
    id: string,
    scope: PersistenceScope,
    title: string
  ): Promise<SummaryRow> {
    await assertOwnership(id, scope);
    return (await conversation.update({
      where: { id },
      data: { title: title.trim() || defaultTitle, renamed: true },
      select: summarySelect,
    })) as SummaryRow;
  }

  async function deleteSession(id: string, scope: PersistenceScope): Promise<void> {
    await assertOwnership(id, scope);
    await conversation.delete({ where: { id } });
  }

  async function pruneEmptySessions(scope: PersistenceScope): Promise<void> {
    const cutoff = new Date(Date.now() - graceMs);
    const stale = (await conversation.findMany({
      where: {
        ...mapping.partitionWhere(scope),
        renamed: false,
        createdAt: { lt: cutoff },
        messages: { none: {} },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    })) as { id: string }[];
    // Always keep at least one session so the panel has an active thread.
    const toDelete = stale.slice(0, Math.max(0, stale.length - 1));
    if (toDelete.length === 0) return;
    await conversation.deleteMany({ where: { id: { in: toDelete.map(c => c.id) } } });
  }

  async function loadMessages(id: string, scope: PersistenceScope) {
    await assertOwnership(id, scope);
    const rows = (await message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, parts: true },
    })) as { id: string; role: string; parts: unknown }[];
    return rows.map(m => ({ id: m.id, role: m.role, parts: m.parts }));
  }

  async function saveMessages(
    id: string,
    scope: PersistenceScope,
    messages: PersistedMessage[]
  ): Promise<void> {
    await assertOwnership(id, scope);
    await db.$transaction([
      message.deleteMany({ where: { conversationId: id } }),
      message.createMany({
        skipDuplicates: true,
        data: messages.map(m => ({
          id: m.id,
          conversationId: id,
          role: m.role,
          parts: m.parts,
        })),
      }),
    ]);
    await conversation.update({ where: { id }, data: { updatedAt: new Date() } });
  }

  return {
    listSessions,
    createSession,
    getOrCreateActiveSession,
    renameSession,
    deleteSession,
    pruneEmptySessions,
    loadMessages,
    saveMessages,
    assertOwnership,
  };
}
