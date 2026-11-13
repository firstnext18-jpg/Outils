/**
 * Listes modifiables dans Paramètres → Listes : états des clients, catégories
 * de dépenses, étapes proposées pour les projets.
 * Module pur : utilisable côté serveur comme côté client.
 */
export const LIST_KINDS = ["CLIENT_STAGE", "EXPENSE_CATEGORY", "PROJECT_STEP"] as const;
export type ListKind = (typeof LIST_KINDS)[number];

export const LIST_LABELS: Record<
  ListKind,
  { title: string; item: string; placeholder: string; description: string }
> = {
  CLIENT_STAGE: {
    title: "États des clients",
    item: "état",
    placeholder: "Nouvel état",
    description:
      "Choisis sur la fiche de chaque client et utilisés pour filtrer la liste des clients. Les indicateurs « Devis à accepter », « Facture à envoyer » et « Facture en retard » s'ajoutent automatiquement.",
  },
  EXPENSE_CATEGORY: {
    title: "Catégories de dépenses",
    item: "catégorie",
    placeholder: "Nouvelle catégorie",
    description: "Proposées à la saisie d'une dépense, et utilisées dans les totaux et l'export.",
  },
  PROJECT_STEP: {
    title: "Étapes des projets",
    item: "étape",
    placeholder: "Nouvelle étape",
    description:
      "Proposées à la création d'un projet (modifiables ensuite projet par projet). Le client voit l'avancement dans son espace.",
  },
};

export const LIST_ITEM_MAX = 60;
