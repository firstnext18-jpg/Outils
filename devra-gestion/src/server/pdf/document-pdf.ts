import "server-only";
import PDFDocument from "pdfkit";
import { SwissQRBill } from "swissqrbill/pdf";
import type { Data as QrBillData } from "swissqrbill/types";
import type { PeriodicityCode } from "@/domain/catalog";
import { formatPercent } from "@/domain/percent";
import { formatQuantity } from "@/domain/quantity";
import type { Discount, DocumentTotals } from "@/domain/totals";
import { unitLabel, type UnitCode } from "@/domain/units";
import { documentLabels, fillLabel, type DocumentLabels } from "@/i18n/documents";
import { formatAmount } from "@/lib/format";
import type { CompanySnapshot } from "@/modules/settings/documents";

/**
 * Mise en page A4 commune aux devis et aux factures : sobre (noir, gris,
 * blanc), seul le logo identifie l'entreprise. Polices Helvetica intégrées à
 * PDFKit (compatibles avec la QR-facture, qui exige une police sans empattement).
 *
 * Factures : la QR-facture (section paiement et récépissé, 105 mm de haut) est
 * placée en bas de la dernière page, au niveau de la perforation ; s'il ne
 * reste pas assez de place, elle passe seule sur une nouvelle page A4.
 */

const MM = 72 / 25.4; // points par millimètre
const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = { left: 20 * MM, right: 20 * MM, top: 15 * MM, bottom: 22 * MM };
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right;
const COLOR = { text: "#111111", muted: "#6b6b6b", rule: "#d4d4d4", light: "#f4f4f4" };

export type PdfLine = {
  lineType: "FLAT" | "HOURLY" | "EXTRA" | "SUBSCRIPTION";
  periodicity: PeriodicityCode | null;
  label: string;
  description: string;
  quantityMilli: number;
  unit: UnitCode;
  unitPriceCents: number;
  discount: Discount;
  netCents: number;
};

export type PdfRecipient = {
  name: string;
  contact: string;
  street: string;
  postalCity: string;
  /** Nom du pays, seulement hors de Suisse. */
  country: string | null;
};

export type PdfDocumentData = {
  language: "FR" | "DE";
  /** Ex. « Devis D-2026-001 » */
  title: string;
  /** Filigrane en travers des pages (« BROUILLON », « ANNULÉE »), ou null. */
  watermark: string | null;
  company: CompanySnapshot;
  logo: Buffer | null;
  recipient: PdfRecipient;
  /** Lignes d'information sous le titre : [libellé, valeur]. */
  meta: [string, string][];
  intro: string;
  lines: PdfLine[];
  totals: DocumentTotals;
  globalDiscount: Discount;
  deposit: Discount;
  vatEnabled: boolean;
  /** Devis : abonnements dans une section à part. Facture : false. */
  separateRecurring?: boolean;
  /** Facture finale : acomptes déduits du total. */
  deductions?: { number: string; amountCents: number }[];
  conditions: string;
  /** Données de la QR-facture (factures émises avec un montant à payer). */
  qrBill?: QrBillData | null;
  /** Relance : récapitulatif des montants à la place des totaux calculés. */
  summaryRows?: TotalRow[];
  /** Métadonnées du fichier PDF. */
  info: { title: string; subject: string };
  /** Test uniquement : flux non compressés pour pouvoir lire le texte. */
  uncompressed?: boolean;
};

type Doc = PDFKit.PDFDocument;

function companyLines(
  company: CompanySnapshot,
  vatEnabled: boolean,
  labels: DocumentLabels,
): string[] {
  return [
    [company.street, company.streetNumber].filter(Boolean).join(" "),
    [company.postalCode, company.city].filter(Boolean).join(" "),
    company.email,
    company.phone,
    company.website,
    vatEnabled && company.vatNumber ? `${labels.vatNumber} ${company.vatNumber}` : "",
  ].filter(Boolean);
}

function periodLabel(periodicity: PeriodicityCode, labels: DocumentLabels): string {
  return { MONTHLY: labels.perMonth, QUARTERLY: labels.perQuarter, YEARLY: labels.perYear }[
    periodicity
  ];
}

function discountText(discount: Discount): string {
  if (!discount) return "";
  return discount.type === "PERCENT" ? formatPercent(discount.value) : formatAmount(discount.value);
}

/** Génère le PDF et renvoie son contenu. */
export function renderDocumentPdf(data: PdfDocumentData): Promise<Buffer> {
  const labels = documentLabels(data.language);
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGIN,
    bufferPages: true,
    compress: !data.uncompressed,
    lang: data.language === "DE" ? "de-CH" : "fr-CH",
    info: {
      Title: data.info.title,
      Subject: data.info.subject,
      Author: data.company.name,
      Creator: data.company.name,
    },
  });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  drawHeader(doc, data, labels);
  let y = drawTitle(doc, data);
  y = drawParagraph(doc, data.intro, y);
  y = drawLines(doc, data, labels, y);
  y = drawTotals(doc, data, labels, y);
  drawParagraph(doc, data.conditions, y + 6);
  // doc.y : bas du dernier texte écrit (sans la marge ajoutée après un paragraphe).
  const qrPage = data.qrBill ? drawQrBill(doc, data.qrBill, data.language, doc.y) : null;
  drawPageDecorations(doc, data, labels, qrPage);

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// En-tête : logo, expéditeur, destinataire (fenêtre d'enveloppe à droite)
// ---------------------------------------------------------------------------

function drawHeader(doc: Doc, data: PdfDocumentData, labels: DocumentLabels) {
  const top = MARGIN.top;
  let senderY = top;
  if (data.logo) {
    try {
      doc.image(data.logo, MARGIN.left, top, { fit: [55 * MM, 20 * MM] });
      senderY = top + 24 * MM;
    } catch {
      // Logo illisible : on continue sans.
    }
  }
  doc.fillColor(COLOR.text).font("Helvetica-Bold").fontSize(9);
  if (data.company.name) doc.text(data.company.name, MARGIN.left, senderY, { width: 80 * MM });
  else doc.y = senderY;
  doc.font("Helvetica").fontSize(8.5).fillColor(COLOR.muted);
  for (const line of companyLines(data.company, data.vatEnabled, labels)) {
    doc.text(line, MARGIN.left, doc.y, { width: 80 * MM });
  }

  // Destinataire : position de la fenêtre des enveloppes suisses (C5, fenêtre à droite).
  const x = 118 * MM;
  const width = PAGE.width - MARGIN.right - x;
  const returnAddress = [
    data.company.name,
    [data.company.postalCode, data.company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");
  doc
    .font("Helvetica")
    .fontSize(7)
    .fillColor(COLOR.muted)
    .text(returnAddress, x, 45 * MM, { width, lineBreak: false, ellipsis: true });
  doc
    .moveTo(x, 45 * MM + 9)
    .lineTo(x + width, 45 * MM + 9)
    .lineWidth(0.4)
    .strokeColor(COLOR.rule)
    .stroke();
  const recipient = data.recipient;
  doc
    .fillColor(COLOR.text)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(recipient.name, x, 45 * MM + 14, { width });
  doc.font("Helvetica").fontSize(10);
  for (const line of [
    recipient.contact,
    recipient.street,
    recipient.postalCity,
    recipient.country ?? "",
  ].filter(Boolean)) {
    doc.text(line, x, doc.y, { width });
  }
}

function drawTitle(doc: Doc, data: PdfDocumentData): number {
  // Sous la fenêtre de l'enveloppe (qui s'arrête vers 90 mm).
  let y = 92 * MM;
  doc
    .fillColor(COLOR.text)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(data.title, MARGIN.left, y, { width: CONTENT_WIDTH });
  y = doc.y + 6;
  doc.fontSize(9);
  for (const [label, value] of data.meta) {
    doc
      .font("Helvetica")
      .fillColor(COLOR.muted)
      .text(label, MARGIN.left, y, { width: 35 * MM });
    doc
      .fillColor(COLOR.text)
      .text(value, MARGIN.left + 35 * MM, y, { width: CONTENT_WIDTH - 35 * MM });
    y = doc.y + 2;
  }
  return y + 8;
}

/** Paragraphe (introduction, conditions), avec saut de page si nécessaire. */
function drawParagraph(doc: Doc, text: string, y: number): number {
  if (!text.trim()) return y;
  doc.font("Helvetica").fontSize(9.5).fillColor(COLOR.text);
  const height = doc.heightOfString(text, { width: CONTENT_WIDTH });
  if (y + height > bottomLimit()) y = newPage(doc);
  doc.text(text, MARGIN.left, y, { width: CONTENT_WIDTH, lineGap: 1.5 });
  return doc.y + 9;
}

function bottomLimit() {
  return PAGE.height - MARGIN.bottom;
}

function newPage(doc: Doc): number {
  doc.addPage();
  return MARGIN.top + 10;
}

// ---------------------------------------------------------------------------
// Tableau des lignes
// ---------------------------------------------------------------------------

const COLUMNS = (() => {
  const position = 9 * MM;
  const quantity = 14 * MM;
  const unit = 19 * MM;
  const unitPrice = 22 * MM;
  const discount = 16 * MM;
  const amount = 24 * MM;
  const description = CONTENT_WIDTH - position - quantity - unit - unitPrice - discount - amount;
  let x = MARGIN.left;
  const col = (width: number) => {
    const c = { x, width };
    x += width;
    return c;
  };
  return {
    position: col(position),
    description: col(description),
    quantity: col(quantity),
    unit: col(unit),
    unitPrice: col(unitPrice),
    discount: col(discount),
    amount: col(amount),
  };
})();

function drawTableHeader(doc: Doc, labels: DocumentLabels, y: number): number {
  doc.font("Helvetica-Bold").fontSize(8).fillColor(COLOR.muted);
  const cells: [keyof typeof COLUMNS, string, "left" | "right"][] = [
    ["position", labels.position, "left"],
    ["description", labels.description, "left"],
    ["quantity", labels.quantity, "right"],
    ["unit", labels.unit, "left"],
    ["unitPrice", labels.unitPrice, "right"],
    ["discount", labels.discount, "right"],
    ["amount", `${labels.amount} ${labels.currency}`, "right"],
  ];
  for (const [key, text, align] of cells) {
    const column = COLUMNS[key];
    const padding = align === "left" && key === "unit" ? 6 : 0;
    doc.text(text, column.x + padding, y, { width: column.width - padding, align });
  }
  const bottom = y + 12;
  doc
    .moveTo(MARGIN.left, bottom)
    .lineTo(PAGE.width - MARGIN.right, bottom)
    .lineWidth(0.6)
    .strokeColor(COLOR.text)
    .stroke();
  return bottom + 5;
}

function lineHeight(doc: Doc, line: PdfLine): number {
  doc.font("Helvetica-Bold").fontSize(9);
  let height = doc.heightOfString(line.label, { width: COLUMNS.description.width - 6 });
  if (line.description) {
    doc.font("Helvetica").fontSize(8);
    height += 1 + doc.heightOfString(line.description, { width: COLUMNS.description.width - 6 });
  }
  return height;
}

function drawLine(doc: Doc, line: PdfLine, position: number, y: number, language: "FR" | "DE") {
  const { description } = COLUMNS;
  doc.fillColor(COLOR.text).font("Helvetica").fontSize(9);
  doc.text(String(position), COLUMNS.position.x, y, { width: COLUMNS.position.width });
  doc.font("Helvetica-Bold").text(line.label, description.x, y, { width: description.width - 6 });
  if (line.description) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(line.description, description.x, doc.y + 1, {
        width: description.width - 6,
      });
  }
  doc.font("Helvetica").fontSize(9).fillColor(COLOR.text);
  doc.text(formatQuantity(line.quantityMilli), COLUMNS.quantity.x, y, {
    width: COLUMNS.quantity.width,
    align: "right",
  });
  doc.text(unitLabel(line.unit, language, line.quantityMilli), COLUMNS.unit.x + 6, y, {
    width: COLUMNS.unit.width - 6,
  });
  doc.text(formatAmount(line.unitPriceCents), COLUMNS.unitPrice.x, y, {
    width: COLUMNS.unitPrice.width,
    align: "right",
  });
  doc.text(discountText(line.discount), COLUMNS.discount.x, y, {
    width: COLUMNS.discount.width,
    align: "right",
  });
  doc.text(formatAmount(line.netCents), COLUMNS.amount.x, y, {
    width: COLUMNS.amount.width,
    align: "right",
  });
}

function drawLines(
  doc: Doc,
  data: PdfDocumentData,
  labels: DocumentLabels,
  startY: number,
): number {
  let y = startY;
  if (data.lines.length === 0) return y;
  if (y + 60 > bottomLimit()) y = newPage(doc);
  y = drawTableHeader(doc, labels, y);

  const separate = data.separateRecurring ?? true;
  const isRecurring = (line: PdfLine) => separate && line.lineType === "SUBSCRIPTION";
  const oneTime = data.lines.filter((line) => !isRecurring(line));
  const recurring = data.lines.filter(isRecurring);
  let position = 0;

  const drawRows = (lines: PdfLine[]) => {
    for (const line of lines) {
      const height = lineHeight(doc, line);
      if (y + height > bottomLimit()) {
        y = drawTableHeader(doc, labels, newPage(doc));
      }
      position += 1;
      drawLine(doc, line, position, y, data.language);
      y += height + 5;
      doc
        .moveTo(MARGIN.left, y - 2.5)
        .lineTo(PAGE.width - MARGIN.right, y - 2.5)
        .lineWidth(0.3)
        .strokeColor(COLOR.rule)
        .stroke();
    }
  };

  drawRows(oneTime);
  if (recurring.length > 0) {
    if (y + 40 > bottomLimit()) y = drawTableHeader(doc, labels, newPage(doc));
    y += 6;
    doc
      .font("Helvetica-Bold")
      .fontSize(8.5)
      .fillColor(COLOR.muted)
      .text(labels.recurringTitle.toUpperCase(), MARGIN.left, y, {
        width: CONTENT_WIDTH,
        characterSpacing: 0.3,
      });
    y = doc.y + 4;
    drawRows(recurring);
  }
  return y + 4;
}

// ---------------------------------------------------------------------------
// Totaux
// ---------------------------------------------------------------------------

export type TotalRow = {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
  ruleAbove?: boolean;
};

function totalRows(data: PdfDocumentData, labels: DocumentLabels): TotalRow[] {
  if (data.summaryRows) return data.summaryRows;
  const { oneTime, recurring, depositCents } = data.totals;
  const rows: TotalRow[] = [];
  const chf = (cents: number) => `${labels.currency} ${formatAmount(cents)}`;
  const hasOneTime = oneTime.subtotalCents > 0 || recurring.length === 0;
  if (hasOneTime) {
    if (oneTime.discountCents > 0 || oneTime.vat.length > 0 || oneTime.roundingCents !== 0) {
      rows.push({ label: labels.subtotal, value: chf(oneTime.subtotalCents) });
    }
    if (oneTime.discountCents > 0) {
      const percent =
        data.globalDiscount?.type === "PERCENT"
          ? ` (${formatPercent(data.globalDiscount.value)})`
          : "";
      rows.push({
        label: `${labels.globalDiscount}${percent}`,
        value: chf(-oneTime.discountCents),
      });
    }
    for (const vat of oneTime.vat) {
      rows.push({ label: `${labels.vat} ${formatPercent(vat.rateBps)}`, value: chf(vat.vatCents) });
    }
    if (oneTime.roundingCents !== 0)
      rows.push({ label: labels.rounding, value: chf(oneTime.roundingCents), muted: true });
    rows.push({ label: labels.total, value: chf(oneTime.totalCents), bold: true, ruleAbove: true });
    const deductions = data.deductions ?? [];
    for (const deduction of deductions) {
      rows.push({
        label: fillLabel(labels.deduction, { number: deduction.number }),
        value: chf(-deduction.amountCents),
      });
    }
    if (deductions.length > 0) {
      const due = oneTime.totalCents - deductions.reduce((sum, d) => sum + d.amountCents, 0);
      rows.push({ label: labels.amountDue, value: chf(due), bold: true, ruleAbove: true });
    }
  }
  for (const group of recurring) {
    rows.push({
      label: `${labels.recurringTotal} (${periodLabel(group.periodicity, labels)})`,
      value: chf(group.totalCents),
      bold: !hasOneTime,
      ruleAbove: !hasOneTime && group === recurring[0],
    });
  }
  if (depositCents > 0) {
    const percent =
      data.deposit?.type === "PERCENT" ? ` (${formatPercent(data.deposit.value)})` : "";
    rows.push({ label: `${labels.deposit}${percent}`, value: chf(depositCents) });
  }
  return rows;
}

function drawTotals(
  doc: Doc,
  data: PdfDocumentData,
  labels: DocumentLabels,
  startY: number,
): number {
  const rows = totalRows(data, labels);
  const width = 100 * MM;
  const x = PAGE.width - MARGIN.right - width;
  const height = rows.length * 15 + 24;
  let y = startY + 4;
  if (y + height > bottomLimit()) y = newPage(doc);

  for (const row of rows) {
    if (row.ruleAbove) {
      doc
        .moveTo(x, y - 2)
        .lineTo(x + width, y - 2)
        .lineWidth(0.6)
        .strokeColor(COLOR.text)
        .stroke();
      y += 3;
    }
    doc
      .font(row.bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(row.bold ? 10.5 : 9.5)
      .fillColor(row.muted ? COLOR.muted : COLOR.text);
    doc.text(row.label, x, y, { width: width - 30 * MM });
    doc.text(row.value, x + width - 30 * MM, y, { width: 30 * MM, align: "right" });
    y = Math.max(doc.y, y + 12) + 3;
  }
  if (!data.vatEnabled) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(COLOR.muted)
      .text(labels.vatExempt, x, y + 2, { width, align: "right" });
    y = doc.y;
  }
  return y + 10;
}

// ---------------------------------------------------------------------------
// QR-facture
// ---------------------------------------------------------------------------

/** Hauteur de la section paiement (norme SIX) et place réservée au pied de page au-dessus. */
const QR_HEIGHT = 105 * MM;
const QR_FOOTER_SPACE = 10 * MM;

/** Dessine la QR-facture et renvoie l'index de la page qui la porte. */
function drawQrBill(doc: Doc, data: QrBillData, language: "FR" | "DE", contentEnd: number): number {
  const bill = new SwissQRBill(data, { language, fontName: "Helvetica" });
  if (contentEnd + QR_FOOTER_SPACE > PAGE.height - QR_HEIGHT) doc.addPage();
  doc.y = PAGE.height - QR_HEIGHT - QR_FOOTER_SPACE;
  // Écrire jusqu'en bas de la page sans saut de page automatique.
  const bottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  bill.attachTo(doc, 0, PAGE.height - QR_HEIGHT);
  doc.page.margins.bottom = bottomMargin;
  const range = doc.bufferedPageRange();
  return range.start + range.count - 1;
}

// ---------------------------------------------------------------------------
// Pied de page, numéros de page, filigrane
// ---------------------------------------------------------------------------

function drawPageDecorations(
  doc: Doc,
  data: PdfDocumentData,
  labels: DocumentLabels,
  qrPage: number | null,
) {
  const range = doc.bufferedPageRange();
  const footer = data.language === "DE" ? data.company.footerDe : data.company.footerFr;
  const address = [
    data.company.name,
    companyLines(data.company, data.vatEnabled, labels).slice(0, 2).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    // Écrire dans la marge du bas sans provoquer de saut de page automatique.
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    if (data.watermark) {
      doc.save();
      doc.rotate(-35, { origin: [PAGE.width / 2, PAGE.height / 2] });
      doc.font("Helvetica-Bold").fontSize(96).fillColor("#000000").fillOpacity(0.06);
      doc.text(data.watermark, 0, PAGE.height / 2 - 48, {
        width: PAGE.width,
        align: "center",
        lineBreak: false,
      });
      doc.restore();
      doc.fillOpacity(1);
    }

    // Sur la page de la QR-facture, une seule ligne juste au-dessus de la section
    // paiement (l'adresse figure déjà dans l'en-tête et sur la QR-facture).
    const onQrPage = range.start + i === qrPage;
    const y = onQrPage ? PAGE.height - QR_HEIGHT - 6 * MM : PAGE.height - 14 * MM;
    doc
      .moveTo(MARGIN.left, y - 4)
      .lineTo(PAGE.width - MARGIN.right, y - 4)
      .lineWidth(0.3)
      .strokeColor(COLOR.rule)
      .stroke();
    doc.font("Helvetica").fontSize(7.5).fillColor(COLOR.muted);
    const lines = onQrPage ? [footer || address] : [footer, address].filter(Boolean);
    lines.forEach((text, index) => {
      doc.text(text, MARGIN.left, y + index * 10, {
        width: CONTENT_WIDTH - 30 * MM,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.text(
      fillLabel(labels.page, { page: i + 1, pages: range.count }),
      PAGE.width - MARGIN.right - 30 * MM,
      y,
      {
        width: 30 * MM,
        align: "right",
        lineBreak: false,
      },
    );
    doc.page.margins.bottom = bottomMargin;
  }
}
