import { PersistenceScope } from "../shared/messages.js";
import { PersistenceAdapter } from "./types.js";

//#region src/persistence/prisma.d.ts
interface FindArgs {
  where?: object;
  orderBy?: object;
  select?: object;
}
interface PrismaConversationDelegate {
  findMany(args: FindArgs): Promise<unknown[]>;
  findFirst(args: FindArgs): Promise<unknown>;
  create(args: {
    data: object;
    select?: object;
  }): Promise<unknown>;
  update(args: {
    where: object;
    data: object;
    select?: object;
  }): Promise<unknown>;
  delete(args: {
    where: object;
  }): Promise<unknown>;
  deleteMany(args: {
    where: object;
  }): Promise<unknown>;
}
interface PrismaMessageDelegate {
  findMany(args: FindArgs): Promise<unknown[]>;
  deleteMany(args: {
    where: object;
  }): unknown;
  createMany(args: {
    data: object[];
    skipDuplicates?: boolean;
  }): unknown;
}
interface PrismaTransactional {
  $transaction(operations: unknown[]): Promise<unknown>;
}
/**
 * The app-specific where/data clauses — the only thing that differs between
 * ownership models. An app may scope by columns (`{ workspaceId, userId }`) or via
 * a join (`{ parent: { ownerId: userId } }`). All return plain Prisma objects, so
 * this carries no Prisma types.
 */
interface PrismaPersistenceMapping {
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
interface CreatePrismaPersistenceOptions {
  /** The Prisma client (for `$transaction`). */
  db: PrismaTransactional;
  /** The conversation delegate, e.g. `db.conversation`. */
  conversation: PrismaConversationDelegate;
  /** The message delegate, e.g. `db.chatMessage` or `db.message`. */
  message: PrismaMessageDelegate;
  /** App-specific ownership/partition clauses. */
  mapping: PrismaPersistenceMapping;
}
/**
 * A Prisma-backed `PersistenceAdapter`. Centralizes the idempotent-create,
 * transactional-save, and prune-keep-one logic apps commonly duplicate; the
 * per-app ownership model is injected via `mapping`.
 */
declare function createPrismaPersistence(options: CreatePrismaPersistenceOptions): PersistenceAdapter;
//#endregion
export { CreatePrismaPersistenceOptions, PrismaConversationDelegate, PrismaMessageDelegate, PrismaPersistenceMapping, PrismaTransactional, createPrismaPersistence };