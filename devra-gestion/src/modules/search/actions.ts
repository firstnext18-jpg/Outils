"use server";

import { z } from "zod";
import { authAction } from "@/server/action";
import { searchClients } from "@/modules/clients/service";
import { searchInvoices } from "@/modules/invoices/service";
import { searchQuotes } from "@/modules/quotes/service";

/** Recherche globale (Ctrl+K) : clients, devis et factures (numéro, objet, client). */
export const globalSearchAction = authAction(
  { role: "READONLY", schema: z.object({ query: z.string().trim().max(100) }) },
  async ({ query }) => {
    const [clients, quotes, invoices] = await Promise.all([
      searchClients(query),
      searchQuotes(query),
      searchInvoices(query),
    ]);
    return { clients, quotes, invoices };
  },
);
