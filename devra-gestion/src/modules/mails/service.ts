import "server-only";
import { randomUUID } from "node:crypto";
import type { ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import { FILE_MAX_BYTES, uploadProblem } from "@/domain/files";
import { bareMessageId, mailExcerpt, normalizeAddress, replyHeaders } from "@/domain/mails";
import { storeFiles } from "@/modules/files/service";
import type { MailData } from "@/modules/mails/schemas";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db } from "@/server/db";
import { brandingFooter } from "@/server/emails/branding";
import { escapeHtml } from "@/server/emails/layout";
import { env } from "@/server/env";
import { deleteStoredFiles, saveBuffer } from "@/server/files";
import { mailboxAddress, mailboxConfig, mailboxErrorMessage, withMailbox } from "@/server/mailbox";
import { buildRawMail, type MailMessage, sendMail, smtpSavesSentCopy } from "@/server/mailer";
import { sendPush } from "@/server/push";
import type { CurrentUser } from "@/server/session";

/**
 * Section Mail : emails envoyés aux clients depuis l'outil, et emails des
 * clients relevés dans la boîte configurée (IMAP), rangés par client.
 */

/** Première relève : emails des 60 derniers jours (les suivantes : les nouveaux seulement). */
const INITIAL_DAYS = 60;
/** Emails plus lourds ignorés (pièces jointes trop volumineuses). */
const MAX_MESSAGE_BYTES = 30 * 1024 * 1024;
/** Pièces jointes d'un envoi : 20 Mo au total (limite courante des messageries). */
const MAX_SEND_BYTES = FILE_MAX_BYTES;

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

export async function mailboxStatus() {
  const config = mailboxConfig();
  const state = config ? await db.mailboxState.findUnique({ where: { id: config.folder } }) : null;
  return {
    configured: Boolean(config),
    address: config?.user ?? null,
    lastSyncAt: state?.lastSyncAt ?? null,
    lastError: state?.lastError ?? "",
  };
}

/** Conversations (une par client), la plus récente d'abord. */
export async function listConversations() {
  const [latest, unread] = await Promise.all([
    db.emailMessage.groupBy({
      by: ["clientId"],
      _max: { date: true },
      orderBy: { _max: { date: "desc" } },
      take: 300,
    }),
    db.emailMessage.groupBy({
      by: ["clientId"],
      where: { direction: "INCOMING", readAt: null },
      _count: true,
    }),
  ]);
  const clientIds = latest.map((row) => row.clientId);
  const [clients, lastMessages] = await Promise.all([
    db.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, displayName: true, email: true },
    }),
    Promise.all(
      clientIds.map((clientId) =>
        db.emailMessage.findFirst({
          where: { clientId },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          select: { direction: true, subject: true, bodyText: true, date: true },
        }),
      ),
    ),
  ]);
  return latest.flatMap((row, i) => {
    const client = clients.find((c) => c.id === row.clientId);
    const last = lastMessages[i];
    if (!client || !last) return [];
    return [
      {
        client,
        lastDate: last.date,
        lastSubject: last.subject,
        lastExcerpt: mailExcerpt(last.bodyText),
        lastIncoming: last.direction === "INCOMING",
        unread: unread.find((u) => u.clientId === row.clientId)?._count ?? 0,
      },
    ];
  });
}

export type Conversation = Awaited<ReturnType<typeof listConversations>>[number];

/** Emails échangés avec un client, du plus ancien au plus récent. */
export async function getConversation(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, displayName: true, email: true, contactName: true },
  });
  if (!client) return null;
  const messages = await db.emailMessage.findMany({
    where: { clientId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: {
      sentBy: { select: { name: true } },
      attachments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, size: true, mimeType: true },
      },
    },
  });
  return { client, messages };
}

/** Derniers emails d'un client (fiche client). */
export function recentClientEmails(clientId: string, take = 5) {
  return db.emailMessage.findMany({
    where: { clientId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      direction: true,
      subject: true,
      bodyText: true,
      date: true,
      readAt: true,
    },
  });
}

/** Emails reçus pas encore ouverts dans l'outil (pastille du menu). */
export function unreadMailCount() {
  return db.emailMessage.count({ where: { direction: "INCOMING", readAt: null } });
}

export async function markConversationRead(clientId: string) {
  await db.emailMessage.updateMany({
    where: { clientId, direction: "INCOMING", readAt: null },
    data: { readAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Envoi
// ---------------------------------------------------------------------------

/** Texte et HTML de l'email : le message, puis la signature de l'entreprise (Paramètres). */
async function composeBody(body: string) {
  const settings = await getSettings();
  const signature = [displayCompanyName(settings), ...brandingFooter(settings)];
  const text = `${body.trim()}\n\n-- \n${signature.join("\n")}`;
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#171717">${paragraphs}<p style="margin:20px 0 0;color:#737373;font-size:12px">${signature
    .map(escapeHtml)
    .join("<br>")}</p></div>`;
  return { text, html };
}

function messageIdDomain(): string {
  const from = env().SMTP_FROM;
  return from.match(/@([^>\s]+)/)?.[1] ?? new URL(env().APP_URL).hostname;
}

/**
 * Envoie un email au client (et l'enregistre dans sa conversation). Les
 * réponses arrivent dans la boîte relevée (« Répondre à »).
 */
export async function sendClientEmail(actor: CurrentUser, data: MailData, files: File[]) {
  const client = await db.client.findUnique({
    where: { id: data.clientId },
    select: { id: true, displayName: true, email: true },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  const to = client.email.trim();
  if (!to) throw new UserError("Ce client n'a pas d'adresse email : ajoutez-la sur sa fiche.");
  if (files.length) {
    const problem = uploadProblem(files);
    if (problem) throw new UserError(problem);
    const total = files.reduce((sum, f) => sum + f.size, 0);
    if (total > MAX_SEND_BYTES) {
      throw new UserError("Pièces jointes : 20 Mo au total au plus.");
    }
  }
  const original = data.replyToId
    ? await db.emailMessage.findFirst({
        where: { id: data.replyToId, clientId: client.id },
        select: { messageId: true, references: true },
      })
    : null;
  const thread = original ? replyHeaders(original) : null;

  const settings = await getSettings();
  const replyTo = mailboxAddress() ?? (settings.companyEmail || undefined);
  const messageId = `${randomUUID()}@${messageIdDomain()}`;
  // À la seconde, comme l'en-tête Date : l'ordre reste juste face aux emails reçus.
  const date = new Date(Math.floor(Date.now() / 1000) * 1000);
  const { text, html } = await composeBody(data.body);
  const message: MailMessage = {
    to,
    replyTo,
    subject: data.subject,
    text,
    html,
    messageId: `<${messageId}>`,
    date,
    ...(thread
      ? {
          inReplyTo: `<${thread.inReplyTo}>`,
          references: thread.references.map((id) => `<${id}>`),
        }
      : {}),
    attachments: await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        content: Buffer.from(await file.arrayBuffer()),
        contentType: file.type || undefined,
      })),
    ),
  };

  try {
    await sendMail(message);
  } catch (error) {
    console.error("Envoi d'email au client impossible", error);
    throw new UserError(
      `L'email n'a pas pu être envoyé : ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const saved = await db.emailMessage.create({
    data: {
      clientId: client.id,
      direction: "OUTGOING",
      messageId,
      inReplyTo: thread?.inReplyTo ?? "",
      references: thread?.references ?? [],
      subject: data.subject,
      fromAddress: env().SMTP_FROM.match(/<([^>]+)>/)?.[1] ?? env().SMTP_FROM,
      fromName: actor.name,
      toAddresses: [to],
      bodyText: data.body.trim(),
      date,
      sentById: actor.id,
    },
  });
  if (files.length) {
    await storeFiles(files, {
      emailMessageId: saved.id,
      visibleToClient: false,
      uploadedById: actor.id,
    }).catch((error: unknown) => console.error("Pièces jointes de l'email non gardées", error));
  }
  await logActivity({
    userId: actor.id,
    action: "mail.sent",
    entityType: "client",
    entityId: client.id,
    label: client.displayName,
    details: { subject: data.subject, attachments: files.length },
  });
  return { message: saved, raw: message };
}

/**
 * Copie de l'email envoyé dans le dossier « Envoyés » de la boîte, pour le
 * retrouver dans Outlook ou sur le téléphone (sauf si le serveur d'envoi le
 * fait déjà, comme Gmail).
 */
export async function copyToSentFolder(message: MailMessage) {
  const mode = env().IMAP_SAVE_SENT;
  if (!mailboxConfig() || mode === "non" || (mode === "auto" && smtpSavesSentCopy())) return;
  try {
    const raw = await buildRawMail(message);
    await withMailbox(async (client) => {
      const folders = await client.list();
      const sent = folders.find((f) => f.specialUse === "\\Sent");
      if (!sent) return;
      await client.append(sent.path, raw, ["\\Seen"], message.date as Date);
    });
  } catch (error) {
    console.error("Copie dans « Envoyés » impossible", error);
  }
}

// ---------------------------------------------------------------------------
// Relève de la boîte (IMAP)
// ---------------------------------------------------------------------------

export type SyncResult =
  { ok: true; skipped?: string; imported: number } | { ok: false; error: string };

let running: Promise<SyncResult> | null = null;

/** Relève la boîte (une seule relève à la fois). */
export function syncMailbox(): Promise<SyncResult> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

function addresses(value: ParsedMail["to"]): string[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .flatMap((group) => group.value.map((a) => normalizeAddress(a.address)))
    .filter(Boolean);
}

async function runSync(): Promise<SyncResult> {
  const config = mailboxConfig();
  if (!config) return { ok: true, skipped: "Boîte mail non configurée", imported: 0 };
  const state = await db.mailboxState.findUnique({ where: { id: config.folder } });
  try {
    const result = await withMailbox(async (client) => {
      const lock = await client.getMailboxLock(config.folder);
      try {
        const mailbox = client.mailbox;
        if (!mailbox) throw new Error(`Dossier introuvable : ${config.folder}`);
        const uidValidity = BigInt(mailbox.uidValidity);
        const fresh = !state || state.uidValidity !== uidValidity;
        const since = new Date(Date.now() - INITIAL_DAYS * 86_400_000);
        const uids = fresh
          ? (await client.search({ since }, { uid: true })) || []
          : ((await client.search({ uid: `${state.lastUid + 1}:*` }, { uid: true })) || []).filter(
              (uid) => uid > state.lastUid,
            );
        if (uids.length === 0) {
          return { uidValidity, lastUid: fresh ? 0 : state.lastUid, imported: [], fresh };
        }

        // Clients reconnus à leur adresse email.
        const clients = await db.client.findMany({
          where: { email: { not: "" } },
          select: { id: true, displayName: true, email: true },
          orderBy: { createdAt: "asc" },
        });
        const byAddress = new Map<string, { id: string; displayName: string }>();
        for (const c of clients) {
          const key = normalizeAddress(c.email);
          if (!byAddress.has(key)) byAddress.set(key, c);
        }

        const imported: { clientId: string; clientName: string; subject: string }[] = [];
        let lastUid = fresh ? 0 : state.lastUid;
        const candidates: { uid: number; clientId: string; clientName: string }[] = [];
        for await (const msg of client.fetch(
          uids,
          { uid: true, envelope: true, size: true },
          { uid: true },
        )) {
          lastUid = Math.max(lastUid, msg.uid);
          const from = normalizeAddress(msg.envelope?.from?.[0]?.address);
          const match = byAddress.get(from);
          if (match && (msg.size ?? 0) <= MAX_MESSAGE_BYTES) {
            candidates.push({ uid: msg.uid, clientId: match.id, clientName: match.displayName });
          }
        }
        for (const candidate of candidates) {
          const one = await client.fetchOne(String(candidate.uid), { source: true }, { uid: true });
          if (!one || !one.source) continue;
          const saved = await storeIncoming(candidate.clientId, await simpleParser(one.source));
          if (saved) {
            imported.push({
              clientId: candidate.clientId,
              clientName: candidate.clientName,
              subject: saved.subject,
            });
          }
        }
        return { uidValidity, lastUid, imported, fresh };
      } finally {
        lock.release();
      }
    });

    await db.mailboxState.upsert({
      where: { id: config.folder },
      create: {
        id: config.folder,
        uidValidity: result.uidValidity,
        lastUid: result.lastUid,
        lastSyncAt: new Date(),
        lastError: "",
      },
      update: {
        uidValidity: result.uidValidity,
        lastUid: result.lastUid,
        lastSyncAt: new Date(),
        lastError: "",
      },
    });
    // Première relève (emails des semaines passées) : pas de notification.
    if (!result.fresh) await notifyTeam(result.imported);
    return { ok: true, imported: result.imported.length };
  } catch (error) {
    const message = mailboxErrorMessage(error);
    console.error("Relève de la boîte mail impossible", error);
    await db.mailboxState.upsert({
      where: { id: config.folder },
      create: { id: config.folder, lastError: message, lastSyncAt: new Date() },
      update: { lastError: message, lastSyncAt: new Date() },
    });
    return { ok: false, error: message };
  }
}

/** Enregistre un email reçu d'un client (jamais deux fois), avec ses pièces jointes. */
async function storeIncoming(clientId: string, mail: ParsedMail) {
  const from = mail.from?.value[0];
  const messageId = bareMessageId(mail.messageId) || `sans-id-${randomUUID()}@${messageIdDomain()}`;
  if (await db.emailMessage.findUnique({ where: { messageId }, select: { id: true } })) {
    return null;
  }
  const references = (
    Array.isArray(mail.references) ? mail.references : mail.references ? [mail.references] : []
  )
    .map(bareMessageId)
    .filter(Boolean)
    .slice(-20);
  const attachments = (mail.attachments ?? []).filter(
    (a) => a.contentDisposition !== "inline" && a.size > 0 && a.size <= FILE_MAX_BYTES,
  );
  const saved: Awaited<ReturnType<typeof saveBuffer>>[] = [];
  try {
    for (const a of attachments) {
      saved.push(await saveBuffer(a.content, a.filename ?? "piece-jointe", a.contentType));
    }
    return await db.emailMessage.create({
      data: {
        clientId,
        direction: "INCOMING",
        messageId,
        inReplyTo: bareMessageId(mail.inReplyTo),
        references,
        subject: (mail.subject ?? "").slice(0, 300) || "(sans objet)",
        fromAddress: normalizeAddress(from?.address),
        fromName: (from?.name ?? "").slice(0, 200),
        toAddresses: addresses(mail.to),
        ccAddresses: addresses(mail.cc),
        bodyText: (mail.text ?? "").trim().slice(0, 200_000),
        date: mail.date ?? new Date(),
        attachments: { create: saved.map((file) => ({ ...file, visibleToClient: false })) },
      },
    });
  } catch (error) {
    await deleteStoredFiles(saved.map((f) => f.storageName));
    // Déjà enregistré entre-temps (deux relèves simultanées) : rien à faire.
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  }
}

/** Une notification par email reçu (application de bureau, téléphone, navigateur). */
async function notifyTeam(imported: { clientId: string; clientName: string; subject: string }[]) {
  if (imported.length === 0) return;
  const users = await db.user.findMany({ where: { active: true }, select: { id: true } });
  for (const mail of imported) {
    await sendPush(
      users.map((u) => u.id),
      {
        title: `Mail de ${mail.clientName}`,
        body: mail.subject,
        url: `/mails/${mail.clientId}`,
        tag: `mail-${mail.clientId}`,
      },
    ).catch((error: unknown) => console.error("Notification de mail impossible", error));
  }
}
