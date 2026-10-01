"use server";

import { revalidatePath } from "next/cache";
import {
  cancelInvoiceSchema,
  createFromQuoteSchema,
  createInvoiceSchema,
  invoiceIdSchema,
  issueInvoiceSchema,
  paymentIdSchema,
  paymentInputSchema,
  updateInvoiceSchema,
} from "@/modules/invoices/schemas";
import * as service from "@/modules/invoices/service";
import { archiveInvoicePdf } from "@/server/pdf/invoice-pdf";
import { authAction } from "@/server/action";

function refresh(id?: string) {
  revalidatePath("/factures");
  if (id) revalidatePath(`/factures/${id}`);
  revalidatePath("/devis/[id]", "page");
  revalidatePath("/clients/[id]", "page");
  revalidatePath("/"); // tableau de bord
}

export const createInvoiceAction = authAction(
  { role: "MEMBER", schema: createInvoiceSchema },
  async ({ invoice }, { user }) => {
    const created = await service.createInvoice(user, invoice);
    refresh(created.id);
    return { id: created.id };
  },
);

export const updateInvoiceAction = authAction(
  { role: "MEMBER", schema: updateInvoiceSchema },
  async ({ id, version, invoice }, { user }) => {
    await service.updateInvoice(user, id, version, invoice);
    refresh(id);
    return { id };
  },
);

export const createInvoiceFromQuoteAction = authAction(
  { role: "MEMBER", schema: createFromQuoteSchema },
  async ({ quoteId, kind }, { user }) => {
    const created = await service.createInvoiceFromQuote(user, quoteId, kind);
    refresh(created.id);
    return { id: created.id };
  },
);

export const issueInvoiceAction = authAction(
  { role: "MEMBER", schema: issueInvoiceSchema },
  async ({ id, version }, { user }) => {
    const issued = await service.issueInvoice(user, id, version);
    // Le PDF émis est archivé ; en cas d'échec, il sera régénéré à la demande.
    await archiveInvoicePdf(id).catch((error: unknown) => {
      console.error(`Archivage du PDF de la facture ${issued.number} impossible`, error);
    });
    refresh(id);
    return issued;
  },
);

export const cancelInvoiceAction = authAction(
  { role: "MEMBER", schema: cancelInvoiceSchema },
  async ({ id, reason }, { user }) => {
    await service.cancelInvoice(user, id, reason);
    refresh(id);
    return null;
  },
);

export const duplicateInvoiceAction = authAction(
  { role: "MEMBER", schema: invoiceIdSchema },
  async ({ id }, { user }) => {
    const copy = await service.duplicateInvoice(user, id);
    refresh(copy.id);
    return { id: copy.id };
  },
);

export const deleteInvoiceAction = authAction(
  { role: "MEMBER", schema: invoiceIdSchema },
  async ({ id }, { user }) => {
    await service.deleteInvoice(user, id);
    refresh();
    return null;
  },
);

export const recordPaymentAction = authAction(
  { role: "MEMBER", schema: paymentInputSchema },
  async (payment, { user }) => {
    const result = await service.recordPayment(user, payment);
    refresh(payment.invoiceId);
    return result;
  },
);

export const deletePaymentAction = authAction(
  { role: "MEMBER", schema: paymentIdSchema.extend({ invoiceId: invoiceIdSchema.shape.id }) },
  async ({ id, invoiceId }, { user }) => {
    await service.deletePayment(user, id);
    refresh(invoiceId);
    return null;
  },
);
