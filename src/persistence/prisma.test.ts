import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPrismaPersistence } from './prisma';
import type { PersistenceScope } from '../shared/messages';

const scope: PersistenceScope = { userId: 'u1', partitionId: 'h1' };

function makeDeps() {
  const conversation = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(async () => ({})),
    deleteMany: vi.fn(async () => ({})),
  };
  const message = {
    findMany: vi.fn(),
    deleteMany: vi.fn(() => 'delete-op'),
    createMany: vi.fn(() => 'create-op'),
  };
  const db = { $transaction: vi.fn(async () => []) };
  const mapping = {
    ownershipWhere: (s: PersistenceScope) => ({ userId: s.userId }),
    partitionWhere: (s: PersistenceScope) => ({ workspaceId: s.partitionId, userId: s.userId }),
    createData: (s: PersistenceScope, title: string) => ({
      workspaceId: s.partitionId,
      userId: s.userId,
      title,
    }),
    assertWritable: vi.fn(async () => {}),
  };
  const adapter = createPrismaPersistence({ db, conversation, message, mapping });
  return { conversation, message, db, mapping, adapter };
}

describe('createPrismaPersistence', () => {
  let deps: ReturnType<typeof makeDeps>;
  beforeEach(() => {
    deps = makeDeps();
  });

  describe('assertOwnership', () => {
    it('passes when the conversation is found within scope', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce({ id: 'c1' });
      await expect(deps.adapter.assertOwnership('c1', scope)).resolves.toBeUndefined();
      expect(deps.conversation.findFirst).toHaveBeenCalledWith({
        where: { id: 'c1', userId: 'u1' },
        select: { id: true },
      });
    });

    it('throws when not found', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce(null);
      await expect(deps.adapter.assertOwnership('c1', scope)).rejects.toThrow('Conversation not found');
    });
  });

  describe('createSession', () => {
    it('reuses an untouched empty session instead of creating a new one', async () => {
      const reusable = { id: 'c0', title: 'Chat 1', updatedAt: new Date() };
      deps.conversation.findFirst.mockResolvedValueOnce(reusable);
      const result = await deps.adapter.createSession(scope);
      expect(result).toBe(reusable);
      expect(deps.mapping.assertWritable).toHaveBeenCalledWith(scope);
      expect(deps.conversation.create).not.toHaveBeenCalled();
    });

    it('creates the next "Chat N" with app-specific data when none is reusable', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce(null); // no reusable
      deps.conversation.findMany.mockResolvedValueOnce([{ title: 'Chat 1' }, { title: 'Notes' }]);
      const created = { id: 'c2', title: 'Chat 2', updatedAt: new Date() };
      deps.conversation.create.mockResolvedValueOnce(created);

      const result = await deps.adapter.createSession(scope);
      expect(result).toBe(created);
      expect(deps.conversation.create).toHaveBeenCalledWith({
        data: { workspaceId: 'h1', userId: 'u1', title: 'Chat 2' },
        select: { id: true, title: true, updatedAt: true },
      });
    });
  });

  describe('getOrCreateActiveSession', () => {
    it('returns the latest session when one exists', async () => {
      const latest = { id: 'c9', title: 'Chat 9', updatedAt: new Date() };
      deps.conversation.findFirst.mockResolvedValueOnce(latest);
      const result = await deps.adapter.getOrCreateActiveSession(scope);
      expect(result).toBe(latest);
      expect(deps.conversation.create).not.toHaveBeenCalled();
    });

    it('creates a session when none exists', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce(null); // no latest
      deps.conversation.findFirst.mockResolvedValueOnce(null); // no reusable
      deps.conversation.findMany.mockResolvedValueOnce([]);
      const created = { id: 'c1', title: 'Chat 1', updatedAt: new Date() };
      deps.conversation.create.mockResolvedValueOnce(created);
      const result = await deps.adapter.getOrCreateActiveSession(scope);
      expect(result).toBe(created);
    });
  });

  describe('renameSession', () => {
    it('falls back to the default title when the new title is blank', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce({ id: 'c1' });
      deps.conversation.update.mockResolvedValueOnce({ id: 'c1', title: 'New chat', updatedAt: new Date() });
      await deps.adapter.renameSession('c1', scope, '   ');
      expect(deps.conversation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { title: 'New chat', renamed: true },
        select: { id: true, title: true, updatedAt: true },
      });
    });
  });

  describe('saveMessages', () => {
    it('replaces messages transactionally and bumps recency', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce({ id: 'c1' }); // ownership
      const messages = [{ id: 'm1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] }];
      await deps.adapter.saveMessages('c1', scope, messages);

      expect(deps.message.deleteMany).toHaveBeenCalledWith({ where: { conversationId: 'c1' } });
      expect(deps.message.createMany).toHaveBeenCalledWith({
        skipDuplicates: true,
        data: [{ id: 'm1', conversationId: 'c1', role: 'assistant', parts: [{ type: 'text', text: 'hi' }] }],
      });
      expect(deps.db.$transaction).toHaveBeenCalledWith(['delete-op', 'create-op']);
      expect(deps.conversation.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: expect.objectContaining({ updatedAt: expect.any(Date) }),
      });
    });

    it('refuses to save into a conversation the user does not own', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce(null);
      await expect(deps.adapter.saveMessages('c1', scope, [])).rejects.toThrow('Conversation not found');
      expect(deps.db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('pruneEmptySessions', () => {
    it('deletes all but one stale empty session', async () => {
      deps.conversation.findMany.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
      await deps.adapter.pruneEmptySessions(scope);
      expect(deps.conversation.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['a', 'b'] } },
      });
    });

    it('keeps the only stale session (never empties the partition)', async () => {
      deps.conversation.findMany.mockResolvedValueOnce([{ id: 'only' }]);
      await deps.adapter.pruneEmptySessions(scope);
      expect(deps.conversation.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('loadMessages', () => {
    it('replays owned messages oldest-first in the useChat shape', async () => {
      deps.conversation.findFirst.mockResolvedValueOnce({ id: 'c1' }); // ownership
      deps.message.findMany.mockResolvedValueOnce([
        { id: 'm1', role: 'user', parts: [], createdAt: new Date() },
      ]);
      const result = await deps.adapter.loadMessages('c1', scope);
      expect(result).toEqual([{ id: 'm1', role: 'user', parts: [] }]);
    });
  });
});
