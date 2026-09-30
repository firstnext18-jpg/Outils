"use server";

import { z } from "zod";
import { authAction } from "@/server/action";
import { searchClients } from "@/modules/clients/service";
import { searchQuotes } from "@/modules/quotes/service";

/**
 * Recherche globale (Ctrl+K) : clients et devis (numéro, objet, client).
 * Les factures s'ajouteront avec la phase 5.
 */
export const globalSearchAction = authAction(
  { role: "READONLY", schema: z.object({ query: z.string().trim().max(100) }) },
  async ({ query }) => {
    const [clients, quotes] = await Promise.all([searchClients(query), searchQuotes(query)]);
    return { clients, quotes };
  },
);
