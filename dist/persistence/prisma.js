import { nextPlaceholderTitle } from "./title.js";
//#region src/persistence/prisma.ts
const summarySelect = {
	id: true,
	title: true,
	updatedAt: true
};
const DEFAULT_PRUNE_GRACE_MS = 120 * 1e3;
/**
* A Prisma-backed `PersistenceAdapter`. Centralizes the idempotent-create,
* transactional-save, and prune-keep-one logic apps commonly duplicate; the
* per-app ownership model is injected via `mapping`.
*/
function createPrismaPersistence(options) {
	const { db, conversation, message, mapping } = options;
	const nextTitle = mapping.nextTitle ?? nextPlaceholderTitle;
	const defaultTitle = mapping.defaultTitle ?? "New chat";
	const graceMs = mapping.pruneGraceMs ?? DEFAULT_PRUNE_GRACE_MS;
	const ownedWhere = (id, scope) => ({
		id,
		...mapping.ownershipWhere(scope)
	});
	async function assertOwnership(id, scope) {
		if (!await conversation.findFirst({
			where: ownedWhere(id, scope),
			select: { id: true }
		})) throw new Error("Conversation not found");
	}
	async function listSessions(scope) {
		return await conversation.findMany({
			where: mapping.partitionWhere(scope),
			orderBy: { updatedAt: "desc" },
			select: summarySelect
		});
	}
	async function createSession(scope) {
		await mapping.assertWritable?.(scope);
		const reusable = await conversation.findFirst({
			where: {
				...mapping.partitionWhere(scope),
				renamed: false,
				messages: { none: {} }
			},
			orderBy: { createdAt: "desc" },
			select: summarySelect
		});
		if (reusable) return reusable;
		const title = nextTitle((await conversation.findMany({
			where: mapping.partitionWhere(scope),
			select: { title: true }
		})).map((s) => s.title));
		return await conversation.create({
			data: mapping.createData(scope, title),
			select: summarySelect
		});
	}
	async function getOrCreateActiveSession(scope) {
		return await conversation.findFirst({
			where: mapping.partitionWhere(scope),
			orderBy: { updatedAt: "desc" },
			select: summarySelect
		}) ?? createSession(scope);
	}
	async function renameSession(id, scope, title) {
		await assertOwnership(id, scope);
		return await conversation.update({
			where: { id },
			data: {
				title: title.trim() || defaultTitle,
				renamed: true
			},
			select: summarySelect
		});
	}
	async function deleteSession(id, scope) {
		await assertOwnership(id, scope);
		await conversation.delete({ where: { id } });
	}
	async function pruneEmptySessions(scope) {
		const cutoff = new Date(Date.now() - graceMs);
		const stale = await conversation.findMany({
			where: {
				...mapping.partitionWhere(scope),
				renamed: false,
				createdAt: { lt: cutoff },
				messages: { none: {} }
			},
			orderBy: { createdAt: "asc" },
			select: { id: true }
		});
		const toDelete = stale.slice(0, Math.max(0, stale.length - 1));
		if (toDelete.length === 0) return;
		await conversation.deleteMany({ where: { id: { in: toDelete.map((c) => c.id) } } });
	}
	async function loadMessages(id, scope) {
		await assertOwnership(id, scope);
		return (await message.findMany({
			where: { conversationId: id },
			orderBy: { createdAt: "asc" },
			select: {
				id: true,
				role: true,
				parts: true
			}
		})).map((m) => ({
			id: m.id,
			role: m.role,
			parts: m.parts
		}));
	}
	async function saveMessages(id, scope, messages) {
		await assertOwnership(id, scope);
		await db.$transaction([message.deleteMany({ where: { conversationId: id } }), message.createMany({
			skipDuplicates: true,
			data: messages.map((m) => ({
				id: m.id,
				conversationId: id,
				role: m.role,
				parts: m.parts
			}))
		})]);
		await conversation.update({
			where: { id },
			data: { updatedAt: /* @__PURE__ */ new Date() }
		});
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
		assertOwnership
	};
}
//#endregion
export { createPrismaPersistence };
