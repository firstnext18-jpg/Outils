"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/server/activity";
import { authAction, UserError } from "@/server/action";
import { db } from "@/server/db";
import { deleteUpload, detectImageType, saveUpload } from "@/server/storage";
import { setNextNumber } from "@/modules/settings/billing";
import {
  billingSettingsSchema,
  companySettingsSchema,
  documentTextsSchema,
  emailTemplatesSchema,
  reminderSettingsSchema,
  LOGO_MAX_BYTES,
} from "@/modules/settings/schemas";
import { getSettings } from "@/modules/settings/service";

export const updateCompanySettingsAction = authAction(
  { role: "ADMIN", schema: companySettingsSchema },
  async (input, { user }) => {
    await getSettings(); // garantit l'existence de la ligne
    await db.settings.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
    await logActivity({
      userId: user.id,
      action: "settings.company_updated",
      entityType: "settings",
    });
    revalidatePath("/", "layout");
    return null;
  },
);

export const uploadLogoAction = authAction(
  { role: "ADMIN", schema: z.instanceof(FormData) },
  async (formData, { user }) => {
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Choisissez un fichier.");
    if (file.size > LOGO_MAX_BYTES) throw new UserError("Le logo ne doit pas dépasser 2 Mo.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) throw new UserError("Format non pris en charge : utilisez une image PNG ou JPEG.");

    const previous = await getSettings();
    const fileName = await saveUpload("logo", type.extension, bytes);
    await db.settings.update({
      where: { id: 1 },
      data: { logoFile: fileName, updatedById: user.id },
    });
    if (previous.logoFile) await deleteUpload(previous.logoFile);

    await logActivity({ userId: user.id, action: "settings.logo_updated", entityType: "settings" });
    revalidatePath("/", "layout");
    return null;
  },
);

export const removeLogoAction = authAction(
  { role: "ADMIN", schema: z.object({}) },
  async (_input, { user }) => {
    const previous = await getSettings();
    if (!previous.logoFile) return null;
    await db.settings.update({ where: { id: 1 }, data: { logoFile: null, updatedById: user.id } });
    await deleteUpload(previous.logoFile);
    await logActivity({ userId: user.id, action: "settings.logo_removed", entityType: "settings" });
    revalidatePath("/", "layout");
    return null;
  },
);

export const updateDocumentTextsAction = authAction(
  { role: "ADMIN", schema: documentTextsSchema },
  async (input, { user }) => {
    await getSettings();
    await db.settings.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
    await logActivity({
      userId: user.id,
      action: "settings.documents_updated",
      entityType: "settings",
    });
    revalidatePath("/parametres/documents");
    return null;
  },
);

export const updateEmailTemplatesAction = authAction(
  { role: "ADMIN", schema: emailTemplatesSchema },
  async (input, { user }) => {
    await getSettings();
    await db.settings.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
    await logActivity({
      userId: user.id,
      action: "settings.emails_updated",
      entityType: "settings",
    });
    revalidatePath("/parametres/emails");
    return null;
  },
);

export const updateReminderSettingsAction = authAction(
  { role: "ADMIN", schema: reminderSettingsSchema },
  async (input, { user }) => {
    await getSettings();
    await db.settings.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
    await logActivity({
      userId: user.id,
      action: "settings.reminders_updated",
      entityType: "settings",
      details: { mode: input.reminderMode, autoSend: input.subscriptionAutoSend },
    });
    revalidatePath("/parametres/relances");
    return null;
  },
);

export const updateBillingSettingsAction = authAction(
  { role: "ADMIN", schema: billingSettingsSchema },
  async ({ nextQuoteNumber, nextInvoiceNumber, ...input }, { user }) => {
    await getSettings();
    await db.$transaction(async (tx) => {
      await tx.settings.update({ where: { id: 1 }, data: { ...input, updatedById: user.id } });
      if (nextQuoteNumber) await setNextNumber(tx, "QUOTE", nextQuoteNumber);
      if (nextInvoiceNumber) await setNextNumber(tx, "INVOICE", nextInvoiceNumber);
    });
    await logActivity({
      userId: user.id,
      action: "settings.billing_updated",
      entityType: "settings",
      details: { vatEnabled: input.vatEnabled, onlineAcceptance: input.onlineAcceptance },
    });
    revalidatePath("/parametres/facturation");
    return null;
  },
);
