"use server";

import { z } from "zod";
import { authAction } from "@/server/action";
import { searchClients } from "@/modules/clients/service";

/**
 * Recherche globale (Ctrl+K). Les devis et factures (par numéro) s'ajouteront
 * avec les phases 4 et 5.
 */
export const globalSearchAction = authAction(
  { role: "READONLY", schema: z.object({ query: z.string().trim().max(100) }) },
  async ({ query }) => {
    const clients = await searchClients(query);
    return { clients };
  },
);
