"use client";

import { useFormContext } from "react-hook-form";
import type { DiscountType } from "@/domain/totals";
import type { DocumentLineInput } from "@/modules/documents/lines";

/**
 * Champs communs aux formulaires de devis et de facture. Les blocs de
 * l'éditeur lisent le formulaire par le contexte de react-hook-form : ils
 * servent aux deux éditeurs.
 */
export type DocumentFormValues = {
  clientId: string;
  language: "FR" | "DE";
  issueDate: string;
  /** Devis seulement. */
  validUntil?: string;
  /** Facture seulement. */
  dueDate?: string;
  subject: string;
  siteTypeId: string | null;
  introText: string;
  conditionsText: string;
  lines: DocumentLineInput[];
  globalDiscountType: DiscountType;
  globalDiscountValue: string;
  /** Devis seulement. */
  depositType?: DiscountType;
  depositValue?: string;
};

/** Réglages transmis à l'éditeur (TVA, textes par défaut selon la langue). */
export type DocumentEditorSettings = {
  vatEnabled: boolean;
  vatRates: number[];
  defaultVatRate: number | null;
  texts: Record<"FR" | "DE", { intro: string; conditions: string }>;
};

export function useDocumentForm() {
  return useFormContext<DocumentFormValues>();
}
