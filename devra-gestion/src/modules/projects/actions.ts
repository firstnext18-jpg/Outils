"use server";

import { revalidatePath } from "next/cache";
import { authAction } from "@/server/action";
import {
  addStepSchema,
  createProjectSchema,
  moveStepSchema,
  projectIdSchema,
  projectStatusSchema,
  renameStepSchema,
  stepIdSchema,
  toggleStepSchema,
  updateProjectSchema,
} from "@/modules/projects/schemas";
import * as service from "@/modules/projects/service";

function refresh(projectId: string, clientId?: string) {
  revalidatePath("/projets");
  revalidatePath(`/projets/${projectId}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

export const createProjectAction = authAction(
  { role: "MEMBER", schema: createProjectSchema },
  async ({ project }, { user }) => {
    const created = await service.createProject(user, project);
    refresh(created.id, created.clientId);
    return { id: created.id };
  },
);

export const updateProjectAction = authAction(
  { role: "MEMBER", schema: updateProjectSchema },
  async ({ id, project }, { user }) => {
    const updated = await service.updateProject(user, id, project);
    refresh(id, updated.clientId);
    return { id };
  },
);

export const setProjectStatusAction = authAction(
  { role: "MEMBER", schema: projectStatusSchema },
  async ({ id, status }, { user }) => {
    const project = await service.setProjectStatus(user, id, status);
    refresh(id, project.clientId);
    return null;
  },
);

export const deleteProjectAction = authAction(
  { role: "MEMBER", schema: projectIdSchema },
  async ({ id }, { user }) => {
    const project = await service.deleteProject(user, id);
    revalidatePath("/projets");
    revalidatePath(`/clients/${project.clientId}`);
    return null;
  },
);

export const toggleStepAction = authAction(
  { role: "MEMBER", schema: toggleStepSchema },
  async ({ id, done }, { user }) => {
    refresh(await service.toggleStep(user, id, done));
    return null;
  },
);

export const addStepAction = authAction(
  { role: "MEMBER", schema: addStepSchema },
  async ({ projectId, label }, { user }) => {
    await service.addStep(user, projectId, label);
    refresh(projectId);
    return null;
  },
);

export const renameStepAction = authAction(
  { role: "MEMBER", schema: renameStepSchema },
  async ({ id, label }, { user }) => {
    refresh(await service.renameStep(user, id, label));
    return null;
  },
);

export const deleteStepAction = authAction(
  { role: "MEMBER", schema: stepIdSchema },
  async ({ id }, { user }) => {
    refresh(await service.deleteStep(user, id));
    return null;
  },
);

export const moveStepAction = authAction(
  { role: "MEMBER", schema: moveStepSchema },
  async ({ id, direction }, { user }) => {
    refresh(await service.moveStep(user, id, direction));
    return null;
  },
);
