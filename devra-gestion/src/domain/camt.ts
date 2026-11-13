/**
 * Relevés bancaires ISO 20022 des banques suisses : camt.053 (relevé de
 * compte) et camt.054 (avis de crédit), téléchargés depuis l'e-banking.
 * On en lit les crédits en CHF comptabilisés, avec la référence de la
 * QR-facture quand le client l'a utilisée.
 */
import { XMLParser } from "fast-xml-parser";
import { createHash } from "node:crypto";

export type BankCredit = {
  /** Identifiant unique de l'opération : jamais enregistrée deux fois. */
  key: string;
  bookingDate: string;
  amountCents: number;
  /** Référence structurée (QRR ou SCOR), sans espaces. */
  reference: string;
  /** Communication libre. */
  remittance: string;
  debtorName: string;
};

type Node = Record<string, unknown>;

const ARRAYS = new Set(["Stmt", "Ntfctn", "Rpt", "Ntry", "NtryDtls", "TxDtls", "Ustrd"]);

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => ARRAYS.has(name),
});

function asNode(value: unknown): Node | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : undefined;
}

function list(value: unknown): Node[] {
  if (Array.isArray(value)) return value.filter((v): v is Node => asNode(v) !== undefined);
  const node = asNode(value);
  return node ? [node] : [];
}

/** Valeur texte d'un élément (avec ou sans attributs). */
function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  const node = asNode(value);
  if (node && "#text" in node) return text(node["#text"]);
  return "";
}

function path(node: Node | undefined, ...keys: string[]): unknown {
  let current: unknown = node;
  for (const key of keys) {
    const here = Array.isArray(current) ? current[0] : current;
    current = asNode(here)?.[key];
  }
  return current;
}

/** « 1490.00 » → 149000, sans passer par un nombre à virgule. */
export function amountToCents(value: string): number | null {
  const match = value.trim().match(/^(\d{1,12})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

function amount(node: unknown): { cents: number; currency: string } | null {
  const cents = amountToCents(text(node));
  if (cents === null) return null;
  const currency = text(asNode(node)?.["@Ccy"]) || "CHF";
  return { cents, currency };
}

function date(node: Node | undefined): string {
  const value = text(path(node, "Dt")) || text(path(node, "DtTm"));
  return value.slice(0, 10);
}

function debtor(tx: Node): string {
  return (
    text(path(tx, "RltdPties", "Dbtr", "Nm")) ||
    text(path(tx, "RltdPties", "Dbtr", "Pty", "Nm")) ||
    text(path(tx, "RltdPties", "UltmtDbtr", "Nm")) ||
    text(path(tx, "RltdPties", "UltmtDbtr", "Pty", "Nm"))
  );
}

function usable(id: string): string {
  return id && id.toUpperCase() !== "NOTPROVIDED" ? id : "";
}

export class CamtError extends Error {}

/**
 * Crédits CHF comptabilisés du fichier. Une écriture groupée (plusieurs
 * paiements QR crédités ensemble) donne une ligne par paiement.
 */
export function parseCamt(xml: string): BankCredit[] {
  let document: Node;
  try {
    document = asNode(parser.parse(xml)) ?? {};
  } catch {
    throw new CamtError("Ce fichier n'est pas un fichier XML lisible.");
  }
  const root = asNode(document.Document);
  const container =
    asNode(root?.BkToCstmrStmt) ??
    asNode(root?.BkToCstmrDbtCdtNtfctn) ??
    asNode(root?.BkToCstmrAcctRpt);
  if (!container) {
    throw new CamtError(
      "Ce fichier n'est pas un relevé camt.053 ou camt.054. Téléchargez le relevé au format ISO 20022 (XML) dans votre e-banking.",
    );
  }
  const reports = [...list(container.Stmt), ...list(container.Ntfctn), ...list(container.Rpt)];
  const credits: BankCredit[] = [];
  for (const report of reports) {
    for (const entry of list(report.Ntry)) {
      if (text(entry.CdtDbtInd) !== "CRDT") continue;
      const status = text(path(entry, "Sts", "Cd")) || text(entry.Sts);
      if (status && status !== "BOOK") continue;
      const entryAmount = amount(entry.Amt);
      const bookingDate = date(asNode(entry.BookgDt)) || date(asNode(entry.ValDt));
      if (!entryAmount || entryAmount.currency !== "CHF" || !bookingDate) continue;
      const transactions = list(entry.NtryDtls).flatMap((d) => list(d.TxDtls));
      const details = transactions.length ? transactions : [{} as Node];
      details.forEach((tx, index) => {
        const txAmount =
          amount(tx.Amt) ??
          amount(path(tx, "AmtDtls", "TxAmt", "Amt")) ??
          (details.length === 1 ? entryAmount : null);
        if (!txAmount || txAmount.currency !== "CHF") return;
        const reference = text(path(tx, "RmtInf", "Strd", "CdtrRefInf", "Ref"))
          .replace(/\s/g, "")
          .toUpperCase();
        const remittance = list(path(tx, "RmtInf") as unknown)
          .flatMap((r) => (Array.isArray(r.Ustrd) ? r.Ustrd : [r.Ustrd]))
          .map(text)
          .filter(Boolean)
          .join(" ")
          .slice(0, 500);
        const debtorName = debtor(tx).slice(0, 200);
        const bankId =
          usable(text(path(tx, "Refs", "AcctSvcrRef"))) ||
          (transactions.length <= 1 ? usable(text(entry.AcctSvcrRef)) : "");
        const endToEnd = usable(text(path(tx, "Refs", "EndToEndId")));
        const fingerprint = [
          bookingDate,
          txAmount.cents,
          reference,
          endToEnd,
          debtorName,
          remittance,
          index,
        ].join("|");
        credits.push({
          key: bankId
            ? `banque:${bankId}`
            : `empreinte:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 40)}`,
          bookingDate,
          amountCents: txAmount.cents,
          reference,
          remittance,
          debtorName,
        });
      });
    }
  }
  return credits;
}

export type OpenInvoice = {
  id: string;
  number: string;
  paymentReference: string;
  outstandingCents: number;
};

export type Match = { invoiceId: string | null; how: "reference" | "number" | "amount" | null };

/**
 * Facture correspondant à un crédit : par la référence de la QR-facture
 * (certain), par son numéro dans la communication (très probable), ou par le
 * montant si une seule facture ouverte a exactement ce solde (à vérifier).
 */
export function matchCredit(credit: BankCredit, invoices: OpenInvoice[]): Match {
  if (credit.reference) {
    const byReference = invoices.find(
      (i) =>
        i.paymentReference &&
        i.paymentReference.replace(/\s/g, "").toUpperCase() === credit.reference,
    );
    if (byReference) return { invoiceId: byReference.id, how: "reference" };
  }
  const haystack = `${credit.remittance} ${credit.reference}`.toUpperCase();
  const byNumber = invoices.filter((i) => i.number && haystack.includes(i.number.toUpperCase()));
  if (byNumber.length === 1) return { invoiceId: byNumber[0]!.id, how: "number" };
  const byAmount = invoices.filter((i) => i.outstandingCents === credit.amountCents);
  if (byAmount.length === 1) return { invoiceId: byAmount[0]!.id, how: "amount" };
  return { invoiceId: null, how: null };
}
