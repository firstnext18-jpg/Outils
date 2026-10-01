import "server-only";
import { countryName } from "@/domain/countries";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { documentFileName } from "@/domain/file-names";
import { documentLabels } from "@/i18n/documents";
import type { QuoteDetail } from "@/modules/quotes/service";
import { storedDiscount, storedDocumentTotals } from "@/modules/documents/lines";
import { companySnapshot, type CompanySnapshot } from "@/modules/settings/documents";
import type { AppSettings } from "@/modules/settings/service";
import { renderDocumentPdf, type PdfRecipient } from "@/server/pdf/document-pdf";
import { readUpload } from "@/server/storage";

type ClientData = {
  displayName: string;
  kind: string;
  contactName: string;
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  country: string;
};

function regionName(code: string, language: "FR" | "DE") {
  try {
    return (
      new Intl.DisplayNames([language === "DE" ? "de-CH" : "fr-CH"], { type: "region" }).of(code) ??
      code
    );
  } catch {
    return countryName(code);
  }
}

export function pdfRecipient(client: ClientData, language: "FR" | "DE"): PdfRecipient {
  return {
    name: client.displayName,
    contact: client.kind === "COMPANY" ? client.contactName : "",
    street: [client.street, client.streetNumber].filter(Boolean).join(" "),
    postalCity: [client.postalCode, client.city].filter(Boolean).join(" "),
    country:
      client.country && client.country !== "CH" ? regionName(client.country, language) : null,
  };
}

/**
 * PDF d'un devis. Un devis envoyé utilise les coordonnées figées à l'envoi ;
 * un brouillon, les données actuelles (et porte la mention « brouillon »).
 */
export async function buildQuotePdf(
  quote: QuoteDetail,
  settings: AppSettings,
  options: { uncompressed?: boolean } = {},
) {
  const labels = documentLabels(quote.language);
  const company = (quote.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings);
  const client = (quote.clientSnapshot as ClientData | null) ?? quote.client;
  const logo = company.logoFile ? await readUpload(company.logoFile) : null;
  const { totals, globalDiscount, deposit } = storedDocumentTotals(quote);

  const meta: [string, string][] = [
    [labels.date, formatIsoDate(dbDateToIso(quote.issueDate))],
    [labels.validUntil, formatIsoDate(dbDateToIso(quote.validUntil))],
  ];
  if (quote.subject) meta.push([labels.subject, quote.subject]);

  const buffer = await renderDocumentPdf({
    language: quote.language,
    title: `${labels.quote} ${quote.number}`,
    watermark: quote.status === "DRAFT" ? labels.draft : null,
    company,
    logo,
    recipient: pdfRecipient(client, quote.language),
    meta,
    intro: quote.introText,
    lines: quote.lines.map((line) => ({
      lineType: line.lineType,
      periodicity: line.periodicity,
      label: line.label,
      description: line.description,
      quantityMilli: line.quantityMilli,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
      discount: storedDiscount(line.discountType, line.discountValue),
      netCents: line.netCents,
    })),
    totals,
    globalDiscount,
    deposit,
    vatEnabled: quote.vatEnabled,
    conditions: quote.conditionsText,
    info: {
      title: `${labels.quote} ${quote.number}`,
      subject: quote.subject || client.displayName,
    },
    uncompressed: options.uncompressed,
  });

  return {
    buffer,
    fileName: documentFileName(company.name, labels.quote, quote.number, client.displayName),
  };
}
