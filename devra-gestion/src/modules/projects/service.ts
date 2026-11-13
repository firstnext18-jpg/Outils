import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isoToDbDate } from "@/domain/dates";
import { projectProgress } from "@/domain/time";
import type { ProjectData, ProjectUpdateData } from "@/modules/projects/schemas";
import { logActivity } from "@/server/activity";
import { UserError } from "@/server/action";
import { db, type Tx } from "@/server/db";
import type { CurrentUser } from "@/server/session";

/**
 * Projets des clients : étapes cochées au fil du travail (l'avancement est
 * visible dans l'espace client) et temps passé.
 */

const listSelect = {
  id: true,
  name: true,
  status: true,
  dueDate: true,
  budgetMinutes: true,
  client: { select: { id: true, displayName: true } },
  steps: { select: { doneAt: true } },
} satisfies Prisma.ProjectSelect;

/** Minutes passées par projet. */
async function minutesByProject(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();
  const rows = await db.timeEntry.groupBy({
    by: ["projectId"],
    where: { projectId: { in: projectIds }, startedAt: null },
    _sum: { minutes: true },
  });
  return new Map(rows.map((row) => [row.projectId ?? "", row._sum.minutes ?? 0]));
}

async function withProgress<T extends Prisma.ProjectGetPayload<{ select: typeof listSelect }>>(
  projects: T[],
) {
  const minutes = await minutesByProject(projects.map((p) => p.id));
  return projects.map(({ steps, ...project }) => ({
    ...project,
    progress: projectProgress(steps),
    minutes: minutes.get(project.id) ?? 0,
  }));
}

export async function listProjects(filter: { status?: "ACTIVE" | "PAUSED" | "DONE" } = {}) {
  const projects = await db.project.findMany({
    where: filter.status ? { status: filter.status } : {},
    orderBy: [
      { status: "asc" },
      { dueDate: { sort: "asc", nulls: "last" } },
      { createdAt: "desc" },
    ],
    take: 300,
    select: listSelect,
  });
  return withProgress(projects);
}

export type ProjectListRow = Awaited<ReturnType<typeof listProjects>>[number];

export async function listClientProjects(clientId: string) {
  const projects = await db.project.findMany({
    where: { clientId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: listSelect,
  });
  return withProgress(projects);
}

/** Projets proposés dans le suivi du temps : en cours ou en pause. */
export function openProjectOptions() {
  return db.project.findMany({
    where: { status: { not: "DONE" } },
    orderBy: [{ client: { sortName: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, clientId: true, client: { select: { displayName: true } } },
  });
}

export function getProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, displayName: true, account: { select: { active: true } } } },
      quote: { select: { id: true, number: true } },
      createdBy: { select: { name: true } },
      steps: {
        orderBy: { position: "asc" },
        include: { doneBy: { select: { name: true } } },
      },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

function log(
  actor: CurrentUser,
  action:
    | "project.created"
    | "project.updated"
    | "project.status_changed"
    | "project.deleted"
    | "project.step_done",
  project: { id: string; name: string },
  details?: Prisma.InputJsonValue,
  tx: Tx | typeof db = db,
) {
  return logActivity(
    {
      userId: actor.id,
      action,
      entityType: "project",
      entityId: project.id,
      label: project.name,
      details,
    },
    tx,
  );
}

function columns(data: ProjectUpdateData) {
  return {
    clientId: data.clientId,
    name: data.name,
    description: data.description,
    startDate: data.startDate ? isoToDbDate(data.startDate) : null,
    dueDate: data.dueDate ? isoToDbDate(data.dueDate) : null,
    hourlyRateCents: data.hourlyRateCents,
    budgetMinutes: data.budgetMinutes,
    showHoursToClient: data.showHoursToClient,
  };
}

async function assertClient(clientId: string) {
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) throw new UserError("Ce client n'existe plus.");
}

export async function createProject(actor: CurrentUser, data: ProjectData) {
  await assertClient(data.clientId);
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        ...columns(data),
        createdById: actor.id,
        steps: { create: data.steps.map((label, position) => ({ label, position })) },
      },
    });
    await log(actor, "project.created", project, undefined, tx);
    return project;
  });
}

export async function updateProject(actor: CurrentUser, id: string, data: ProjectUpdateData) {
  const project = await db.project.findUnique({ where: { id }, select: { clientId: true } });
  if (!project) throw new UserError("Ce projet n'existe plus.");
  if (project.clientId !== data.clientId) {
    // Le temps déjà saisi suit le projet chez le nouveau client.
    await assertClient(data.clientId);
  }
  const updated = await db.$transaction(async (tx) => {
    const saved = await tx.project.update({ where: { id }, data: columns(data) });
    if (project.clientId !== data.clientId) {
      await tx.timeEntry.updateMany({
        where: { projectId: id, invoiceId: null },
        data: { clientId: data.clientId },
      });
    }
    await log(actor, "project.updated", saved, undefined, tx);
    return saved;
  });
  return updated;
}

export async function setProjectStatus(
  actor: CurrentUser,
  id: string,
  status: "ACTIVE" | "PAUSED" | "DONE",
) {
  const project = await db.project.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  await log(actor, "project.status_changed", project, { status });
  return project;
}

/** Un projet dont du temps a été facturé ne se supprime pas (on le termine). */
export async function deleteProject(actor: CurrentUser, id: string) {
  const project = await db.project.findUnique({
    where: { id },
    include: { _count: { select: { timeEntries: { where: { invoiceId: { not: null } } } } } },
  });
  if (!project) throw new UserError("Ce projet n'existe plus.");
  if (project._count.timeEntries > 0) {
    throw new UserError("Du temps de ce projet a été facturé : marquez-le plutôt comme terminé.");
  }
  await db.$transaction(async (tx) => {
    await tx.timeEntry.deleteMany({ where: { projectId: id } });
    await tx.project.delete({ where: { id } });
    await log(actor, "project.deleted", project, undefined, tx);
  });
  return project;
}

// ---------------------------------------------------------------------------
// Étapes
// ---------------------------------------------------------------------------

async function stepOrThrow(id: string) {
  const step = await db.projectStep.findUnique({
    where: { id },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!step) throw new UserError("Cette étape n'existe plus. Rechargez la page.");
  return step;
}

export async function toggleStep(actor: CurrentUser, id: string, done: boolean) {
  const step = await stepOrThrow(id);
  await db.projectStep.update({
    where: { id },
    data: done ? { doneAt: new Date(), doneById: actor.id } : { doneAt: null, doneById: null },
  });
  if (done) await log(actor, "project.step_done", step.project, { step: step.label });
  return step.project.id;
}

export async function addStep(actor: CurrentUser, projectId: string, label: string) {
  const last = await db.projectStep.aggregate({ where: { projectId }, _max: { position: true } });
  const exists = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!exists) throw new UserError("Ce projet n'existe plus.");
  await db.projectStep.create({
    data: { projectId, label, position: (last._max.position ?? -1) + 1 },
  });
}

export async function renameStep(actor: CurrentUser, id: string, label: string) {
  const step = await stepOrThrow(id);
  await db.projectStep.update({ where: { id }, data: { label } });
  return step.project.id;
}

export async function deleteStep(actor: CurrentUser, id: string) {
  const step = await stepOrThrow(id);
  await db.projectStep.delete({ where: { id } });
  return step.project.id;
}

export async function moveStep(actor: CurrentUser, id: string, direction: "up" | "down") {
  const step = await stepOrThrow(id);
  const all = await db.projectStep.findMany({
    where: { projectId: step.projectId },
    orderBy: { position: "asc" },
  });
  const index = all.findIndex((s) => s.id === id);
  const neighbor = all[direction === "up" ? index - 1 : index + 1];
  if (!neighbor) return step.project.id;
  const reordered = [...all];
  reordered[index] = neighbor;
  reordered[all.indexOf(neighbor)] = all[index]!;
  await db.$transaction(
    reordered.map((s, position) =>
      db.projectStep.update({ where: { id: s.id }, data: { position } }),
    ),
  );
  return step.project.id;
}

// ---------------------------------------------------------------------------
// Espace client
// ---------------------------------------------------------------------------

/** Projets du client avec leurs étapes ; le temps passé seulement si le projet le montre. */
export async function portalProjects(clientId: string) {
  const projects = await db.project.findMany({
    where: { clientId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      startDate: true,
      dueDate: true,
      budgetMinutes: true,
      showHoursToClient: true,
      steps: { orderBy: { position: "asc" }, select: { id: true, label: true, doneAt: true } },
      timeEntries: {
        where: { startedAt: null },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: { id: true, date: true, minutes: true, description: true },
      },
    },
  });
  return projects.map(({ timeEntries, ...project }) => ({
    ...project,
    progress: projectProgress(project.steps),
    // Le temps passé n'est transmis que si le projet le montre au client.
    minutes: project.showHoursToClient ? timeEntries.reduce((sum, e) => sum + e.minutes, 0) : null,
    budgetMinutes: project.showHoursToClient ? project.budgetMinutes : null,
    timeEntries: project.showHoursToClient ? timeEntries : [],
  }));
}

export type PortalProject = Awaited<ReturnType<typeof portalProjects>>[number];
