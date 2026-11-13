import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { uploadProblem } from "@/domain/files";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import { deleteStoredFiles, saveFile } from "@/server/files";
import type { PortalSession } from "@/server/portal-session";
import { sendPush } from "@/server/push";
import type { CurrentUser } from "@/server/session";

/**
 * Fichiers partagés : sur la fiche client (avec ou sans visibilité dans
 * l'espace client), pièces jointes des discussions, justificatifs des dépenses.
 */

const fileSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  visibleToClient: true,
  uploadedByClient: true,
  createdAt: true,
  messageId: true,
  project: { select: { id: true, name: true } },
  uploadedBy: { select: { name: true } },
} satisfies Prisma.StoredFileSelect;

export type FileRow = Prisma.StoredFileGetPayload<{ select: typeof fileSelect }>;

/** Fichiers d'un client (hors justificatifs de dépenses), les plus récents d'abord. */
export function listClientFiles(clientId: string, options: { projectId?: string } = {}) {
  return db.storedFile.findMany({
    where: {
      clientId,
      expenseId: null,
      ...(options.projectId ? { projectId: options.projectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: fileSelect,
  });
}

/** Fichiers visibles dans l'espace du client. */
export function listPortalFiles(clientId: string) {
  return db.storedFile.findMany({
    where: { clientId, expenseId: null, visibleToClient: true },
    orderBy: { createdAt: "desc" },
    select: fileSelect,
  });
}

type FileOwner = {
  clientId?: string | null;
  projectId?: string | null;
  messageId?: string | null;
  expenseId?: string | null;
  visibleToClient: boolean;
  uploadedById?: string | null;
  uploadedByClient?: boolean;
};

/**
 * Enregistre des fichiers (disque puis base). En cas d'erreur en base, les
 * fichiers déjà écrits sont effacés.
 */
export async function storeFiles(files: File[], owner: FileOwner, tx: Tx | typeof db = db) {
  const problem = uploadProblem(files);
  if (problem) throw new UserError(problem);
  const saved = [];
  try {
    for (const file of files) saved.push(await saveFile(file));
    await tx.storedFile.createMany({
      data: saved.map((file) => ({
        ...file,
        ...owner,
        uploadedByClient: owner.uploadedByClient ?? false,
      })),
    });
  } catch (error) {
    await deleteStoredFiles(saved.map((file) => file.storageName));
    throw error;
  }
  return saved;
}

async function clientOrThrow(clientId: string) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { id: true, displayName: true },
  });
  if (!client) throw new UserError("Ce client n'existe plus.");
  return client;
}

export async function uploadClientFiles(
  actor: CurrentUser,
  input: { clientId: string; projectId: string | null; visibleToClient: boolean; files: File[] },
) {
  const client = await clientOrThrow(input.clientId);
  if (input.projectId) {
    const project = await db.project.findFirst({
      where: { id: input.projectId, clientId: client.id },
      select: { id: true },
    });
    if (!project) throw new UserError("Ce projet n'existe plus.");
  }
  const saved = await storeFiles(input.files, {
    clientId: client.id,
    projectId: input.projectId,
    visibleToClient: input.visibleToClient,
    uploadedById: actor.id,
  });
  await logActivity({
    userId: actor.id,
    action: "file.uploaded",
    entityType: "client",
    entityId: client.id,
    label: client.displayName,
    details: { files: saved.map((f) => f.name), visibleToClient: input.visibleToClient },
  });
  return saved.length;
}

async function fileOrThrow(id: string) {
  const file = await db.storedFile.findUnique({
    where: { id },
    include: { client: { select: { id: true, displayName: true } } },
  });
  if (!file) throw new UserError("Ce fichier n'existe plus.");
  return file;
}

export async function setFileVisibility(actor: CurrentUser, id: string, visibleToClient: boolean) {
  const file = await fileOrThrow(id);
  if (!file.clientId || file.expenseId) {
    throw new UserError("Ce fichier ne peut pas être partagé avec un client.");
  }
  await db.storedFile.update({ where: { id }, data: { visibleToClient } });
  await logActivity({
    userId: actor.id,
    action: "file.visibility_changed",
    entityType: "client",
    entityId: file.clientId,
    label: file.client?.displayName,
    details: { file: file.name, visibleToClient },
  });
  return file.clientId;
}

export async function deleteFile(actor: CurrentUser, id: string) {
  const file = await fileOrThrow(id);
  await db.storedFile.delete({ where: { id } });
  await deleteStoredFiles([file.storageName]);
  if (file.clientId) {
    await logActivity({
      userId: actor.id,
      action: "file.deleted",
      entityType: "client",
      entityId: file.clientId,
      label: file.client?.displayName,
      details: { file: file.name },
    });
  }
  return { clientId: file.clientId, expenseId: file.expenseId };
}

/** Fichier pour l'équipe (tout utilisateur connecté). */
export function fileForTeam(id: string) {
  return db.storedFile.findUnique({ where: { id }, select: { name: true, storageName: true } });
}

/** Fichier pour le client connecté : seulement les siens, partagés avec lui. */
export function fileForPortal(clientId: string, id: string) {
  return db.storedFile.findFirst({
    where: { id, clientId, visibleToClient: true, expenseId: null },
    select: { name: true, storageName: true },
  });
}

/** Fichiers envoyés par le client depuis son espace : l'équipe est prévenue. */
export async function uploadPortalFiles(session: PortalSession, files: File[]) {
  const saved = await storeFiles(files, {
    clientId: session.client.id,
    visibleToClient: true,
    uploadedByClient: true,
  });
  await logActivity({
    userId: null,
    action: "file.uploaded",
    entityType: "client",
    entityId: session.client.id,
    label: session.client.displayName,
    details: {
      files: saved.map((f) => f.name),
      visibleToClient: true,
      onlineName: session.client.displayName,
      portal: true,
    },
  });
  return saved;
}

export async function notifyTeamOfClientFiles(session: PortalSession, names: string[]) {
  const users = await db.user.findMany({ where: { active: true }, select: { id: true } });
  await sendPush(
    users.map((u) => u.id),
    {
      title: `${session.client.displayName} · Nouveaux fichiers`,
      body: names.join(", ").slice(0, 200),
      url: `/clients/${session.client.id}#fichiers`,
      tag: `fichiers-${session.client.id}`,
    },
  );
}

/** Fichiers sur le disque d'un client (à effacer après la suppression de sa fiche). */
export async function clientStorageNames(clientId: string): Promise<string[]> {
  const files = await db.storedFile.findMany({
    where: { clientId },
    select: { storageName: true },
  });
  return files.map((f) => f.storageName);
}
