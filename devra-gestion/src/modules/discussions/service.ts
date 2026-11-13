import "server-only";
import { CLIENT_DISCUSSION_TITLE } from "@/domain/portal";
import {
  GENERAL_DISCUSSION_ID,
  GENERAL_DISCUSSION_TITLE,
  isGeneralDiscussion,
  MESSAGES_PAGE,
  messageExcerpt,
} from "@/domain/discussions";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { storeFiles } from "@/modules/files/service";
import { sendPortalMessageEmail } from "@/server/emails/portal-emails";
import { sendPush, sendPushToEndpoint } from "@/server/push";
import type { CurrentUser } from "@/server/session";
import type { PushSubscriptionInput } from "@/modules/discussions/schemas";

/** Le canal général existe toujours (recréé s'il a été effacé). */
async function ensureGeneralDiscussion() {
  await db.discussion.createMany({
    data: [{ id: GENERAL_DISCUSSION_ID, title: GENERAL_DISCUSSION_TITLE }],
    skipDuplicates: true,
  });
}

/**
 * Discussion avec le client (visible dans son espace client), créée avec son
 * accès. Une seule par client : l'identifiant du client est unique dans
 * `portalClientId`.
 */
export async function ensureClientDiscussion(clientId: string) {
  await db.discussion.createMany({
    data: [{ clientId, portalClientId: clientId, title: CLIENT_DISCUSSION_TITLE }],
    skipDuplicates: true,
  });
  return db.discussion.findUniqueOrThrow({
    where: { portalClientId: clientId },
    select: { id: true },
  });
}

/** Identifiant de la discussion avec le client, si elle existe. */
export async function clientDiscussionId(clientId: string): Promise<string | null> {
  const discussion = await db.discussion.findUnique({
    where: { portalClientId: clientId },
    select: { id: true },
  });
  return discussion?.id ?? null;
}

/** Auteur affiché d'un message : la personne de l'équipe, ou le client. */
function messageAuthor(
  message: { fromClient: boolean; author: { name: string } | null },
  clientName: string | undefined,
) {
  if (message.fromClient) return clientName ?? "Client";
  return message.author?.name ?? "Ancien utilisateur";
}

/**
 * Messages non lus d'un utilisateur, par discussion : ceux des autres, écrits
 * depuis sa dernière lecture (ou, s'il n'a jamais ouvert la discussion, depuis
 * la création de son compte).
 */
async function unreadByDiscussion(userId: string): Promise<Map<string, number>> {
  const rows = await db.$queryRaw<{ id: string; unread: number }[]>`
    SELECT m."discussionId" AS id, count(*)::int AS unread
    FROM discussion_message m
    LEFT JOIN discussion_read r ON r."discussionId" = m."discussionId" AND r."userId" = ${userId}
    WHERE (m."authorId" IS NULL OR m."authorId" <> ${userId})
      AND m."createdAt" > COALESCE(r."lastReadAt", (SELECT "createdAt" FROM "user" WHERE id = ${userId}))
    GROUP BY m."discussionId"`;
  return new Map(rows.map((row) => [row.id, row.unread]));
}

/** Nombre de messages non lus, toutes discussions confondues (pastille du menu). */
export async function unreadMessageCount(userId: string): Promise<number> {
  let total = 0;
  for (const count of (await unreadByDiscussion(userId)).values()) total += count;
  return total;
}

/** Discussions, la plus active en premier ; toutes, ou celles d'un client. */
export async function listDiscussions(userId: string, filter: { clientId?: string } = {}) {
  if (!filter.clientId) await ensureGeneralDiscussion();
  const [discussions, unread] = await Promise.all([
    db.discussion.findMany({
      where: filter.clientId ? { clientId: filter.clientId } : {},
      orderBy: { lastMessageAt: "desc" },
      take: 300,
      include: {
        client: { select: { id: true, displayName: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { author: { select: { name: true } } },
        },
        _count: { select: { messages: true } },
      },
    }),
    unreadByDiscussion(userId),
  ]);
  return discussions.map((d) => {
    const last = d.messages[0];
    return {
      id: d.id,
      title: d.title,
      general: isGeneralDiscussion(d.id),
      client: d.client,
      lastMessageAt: d.lastMessageAt,
      /** Discussion avec le client : visible dans son espace client. */
      withClient: d.portalClientId !== null,
      lastMessage: last
        ? {
            author: messageAuthor(last, d.client?.displayName),
            excerpt: last.body.trim() ? messageExcerpt(last.body) : "📎 Fichier joint",
          }
        : null,
      messageCount: d._count.messages,
      unread: unread.get(d.id) ?? 0,
    };
  });
}

export type DiscussionSummary = Awaited<ReturnType<typeof listDiscussions>>[number];

/** Une discussion et ses messages (les plus récents, ou tous). */
export async function getDiscussion(id: string, options: { all?: boolean } = {}) {
  if (isGeneralDiscussion(id)) await ensureGeneralDiscussion();
  const discussion = await db.discussion.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, displayName: true, archivedAt: true } },
      createdBy: { select: { name: true } },
      _count: { select: { messages: true } },
    },
  });
  if (!discussion) return null;
  const [messages, reads] = await Promise.all([
    db.discussionMessage.findMany({
      where: { discussionId: id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(options.all ? {} : { take: MESSAGES_PAGE }),
      include: {
        author: { select: { id: true, name: true } },
        attachments: {
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, size: true, mimeType: true },
        },
      },
    }),
    // Dernière lecture de chaque utilisateur actif : accusés de lecture.
    db.discussionRead.findMany({
      where: { discussionId: id, user: { active: true } },
      orderBy: { user: { name: "asc" } },
      select: { userId: true, lastReadAt: true, user: { select: { name: true } } },
    }),
  ]);
  const clientName = discussion.client?.displayName;
  return {
    ...discussion,
    general: isGeneralDiscussion(discussion.id),
    withClient: discussion.portalClientId !== null,
    messages: messages.reverse().map((m) => ({ ...m, authorName: messageAuthor(m, clientName) })),
    reads: reads.map((r) => ({ userId: r.userId, name: r.user.name, lastReadAt: r.lastReadAt })),
    hiddenCount: Math.max(0, discussion._count.messages - messages.length),
  };
}

export type DiscussionDetail = NonNullable<Awaited<ReturnType<typeof getDiscussion>>>;

/** Nouvelle discussion sur un client, avec son premier message. */
export async function createDiscussion(
  actor: CurrentUser,
  input: { clientId: string; title: string; body: string },
) {
  const client = await db.client.findUnique({
    where: { id: input.clientId },
    select: { id: true, displayName: true },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  const now = new Date();
  const discussion = await db.$transaction(async (tx) => {
    const created = await tx.discussion.create({
      data: {
        clientId: client.id,
        title: input.title,
        createdById: actor.id,
        createdAt: now,
        lastMessageAt: now,
        messages: { create: { authorId: actor.id, body: input.body, createdAt: now } },
        reads: { create: { userId: actor.id, lastReadAt: now } },
      },
    });
    await logActivity(
      {
        userId: actor.id,
        action: "discussion.created",
        entityType: "discussion",
        entityId: created.id,
        label: input.title,
        details: { client: client.displayName },
      },
      tx,
    );
    return created;
  });
  return {
    id: discussion.id,
    notification: {
      title: `Nouvelle discussion · ${client.displayName}`,
      body: `${actor.name} : ${input.title} — ${messageExcerpt(input.body, 100)}`,
    },
  };
}

/** Nouveau message dans une discussion (ou le canal général). */
/** Texte d'un message pour les notifications : le message, ou les fichiers joints. */
export function messageSummary(body: string, fileNames: string[], max = 140) {
  if (body.trim()) return messageExcerpt(body, max);
  return messageExcerpt(`📎 ${fileNames.join(", ")}`, max);
}

export async function postMessage(
  actor: CurrentUser,
  input: { discussionId: string; body: string },
  files: File[] = [],
) {
  if (isGeneralDiscussion(input.discussionId)) await ensureGeneralDiscussion();
  const discussion = await db.discussion.findUnique({
    where: { id: input.discussionId },
    include: { client: { select: { displayName: true } } },
  });
  if (!discussion) throw new UserError("Cette discussion n'existe plus.");
  if (!input.body.trim() && files.length === 0) throw new UserError("Écrivez un message");
  const now = new Date();
  const key = { discussionId: discussion.id, userId: actor.id };
  const message = await db.$transaction(async (tx) => {
    const created = await tx.discussionMessage.create({
      data: { discussionId: discussion.id, authorId: actor.id, body: input.body, createdAt: now },
    });
    await tx.discussion.update({ where: { id: discussion.id }, data: { lastMessageAt: now } });
    await tx.discussionRead.upsert({
      where: { discussionId_userId: key },
      create: { ...key, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return created;
  });
  // Pièces jointes : rattachées au client de la discussion ; visibles par lui
  // seulement dans la discussion avec le client.
  const saved = files.length
    ? await storeFiles(files, {
        clientId: discussion.clientId,
        messageId: message.id,
        visibleToClient: discussion.portalClientId !== null,
        uploadedById: actor.id,
      }).catch(async (error: unknown) => {
        await db.discussionMessage.delete({ where: { id: message.id } });
        throw error;
      })
    : [];
  const summary = messageSummary(
    input.body,
    saved.map((f) => f.name),
  );
  return {
    id: discussion.id,
    withClient: discussion.portalClientId !== null,
    notification: {
      title: discussion.client
        ? `${discussion.client.displayName} · ${discussion.title}`
        : discussion.title,
      body: `${actor.name} : ${summary}`,
    },
    summary,
  };
}

/**
 * Prévient le client par email d'un nouveau message de l'équipe dans sa
 * discussion. Un seul email tant qu'il n'a pas lu les messages précédents :
 * plusieurs messages d'affilée ne font pas plusieurs emails.
 */
export async function notifyClient(actor: CurrentUser, discussionId: string, body: string) {
  const discussion = await db.discussion.findUnique({
    where: { id: discussionId },
    select: {
      id: true,
      portalClientId: true,
      clientReadAt: true,
      clientNotifiedAt: true,
      client: {
        select: {
          displayName: true,
          email: true,
          language: true,
          account: { select: { active: true } },
        },
      },
    },
  });
  const client = discussion?.client;
  if (!discussion?.portalClientId || !client?.email || !client.account?.active) return;
  const alreadyNotified =
    discussion.clientNotifiedAt !== null &&
    (discussion.clientReadAt === null || discussion.clientNotifiedAt > discussion.clientReadAt);
  if (alreadyNotified) return;
  await db.discussion.update({
    where: { id: discussion.id },
    data: { clientNotifiedAt: new Date() },
  });
  await sendPortalMessageEmail(
    { name: client.displayName, email: client.email, language: client.language },
    { author: actor.name, excerpt: messageExcerpt(body, 300) },
  );
}

/** L'utilisateur a lu la discussion jusqu'ici. */
export async function markRead(user: CurrentUser, discussionId: string) {
  const exists = await db.discussion.findUnique({
    where: { id: discussionId },
    select: { id: true },
  });
  if (!exists) return;
  const key = { discussionId, userId: user.id };
  const now = new Date();
  await db.discussionRead.upsert({
    where: { discussionId_userId: key },
    create: { ...key, lastReadAt: now },
    update: { lastReadAt: now },
  });
}

/** Prévient les autres utilisateurs (appareils abonnés aux notifications). */
export async function notifyOthers(
  actor: CurrentUser,
  discussionId: string,
  notification: { title: string; body: string },
) {
  const recipients = await db.user.findMany({
    where: { active: true, id: { not: actor.id } },
    select: { id: true },
  });
  await sendPush(
    recipients.map((u) => u.id),
    { ...notification, url: `/discussions/${discussionId}`, tag: `discussion-${discussionId}` },
  );
}

// ---------------------------------------------------------------------------
// Appareils abonnés aux notifications
// ---------------------------------------------------------------------------

export async function savePushSubscription(user: CurrentUser, input: PushSubscriptionInput) {
  const data = {
    userId: user.id,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    device: input.device ?? "",
  };
  // Un navigateur passé à un autre compte : l'abonnement suit la personne connectée.
  await db.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
  });
  await sendPushToEndpoint(input.endpoint, {
    title: "Notifications activées",
    body: "Vous serez prévenu ici des nouveaux messages des discussions.",
    url: "/discussions",
    tag: "notifications-activees",
  });
}

export async function deletePushSubscription(user: CurrentUser, endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}
