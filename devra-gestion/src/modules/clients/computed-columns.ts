import { clientDisplayName, clientSearchColumns } from "@/domain/clients";
import type { ClientData } from "@/modules/clients/schemas";

/** Colonnes calculées (nom affiché, tri, recherche) à enregistrer avec les données saisies. */
export function withComputedColumns(data: ClientData) {
  const displayName = clientDisplayName(data);
  return { ...data, displayName, ...clientSearchColumns({ ...data, displayName }) };
}
