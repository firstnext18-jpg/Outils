/**
 * Conversions entre un devis enregistré et les valeurs du formulaire de devis
 * (textes saisis). Module partagé navigateur / serveur.
 */
import { dbDateToIso } from "@/domain/dates";
import type { DiscountType } from "@/domain/totals";
import {
  discountToInput,
  previewDiscount,
  previewLines,
  storedLineToInput,
  type StoredLine,
} from "@/modules/documents/lines";
import type { QuoteInput } from "@/modules/quotes/schemas";

type StoredQuote = {
  clientId: string;
  language: "FR" | "DE";
  issueDate: Date;
  validUntil: Date;
  subject: string;
  siteTypeId: string | null;
  introText: string;
  conditionsText: string;
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number;
  depositType: DiscountType | null;
  depositValue: number;
  lines: StoredLine[];
};

/** Devis enregistré → valeurs du formulaire de modification (ou de duplication). */
export function quoteToInput(quote: StoredQuote): QuoteInput {
  const globalDiscount = discountToInput(quote.globalDiscountType, quote.globalDiscountValue);
  const deposit = discountToInput(quote.depositType, quote.depositValue);
  return {
    clientId: quote.clientId,
    language: quote.language,
    issueDate: dbDateToIso(quote.issueDate),
    validUntil: dbDateToIso(quote.validUntil),
    subject: quote.subject,
    siteTypeId: quote.siteTypeId,
    introText: quote.introText,
    conditionsText: quote.conditionsText,
    globalDiscountType: globalDiscount.type,
    globalDiscountValue: globalDiscount.value,
    depositType: deposit.type,
    depositValue: deposit.value,
    lines: quote.lines.map(storedLineToInput),
  };
}

/**
 * Lecture « tolérante » du formulaire pour afficher les totaux pendant la
 * saisie : une valeur encore invalide compte pour zéro (la validation stricte
 * a lieu à l'enregistrement).
 */
export function previewTotalsInput(
  values: Pick<
    QuoteInput,
    "lines" | "globalDiscountType" | "globalDiscountValue" | "depositType" | "depositValue"
  >,
) {
  return {
    lines: previewLines(values.lines),
    globalDiscount: previewDiscount(values.globalDiscountType, values.globalDiscountValue),
    deposit: previewDiscount(values.depositType, values.depositValue),
  };
}
