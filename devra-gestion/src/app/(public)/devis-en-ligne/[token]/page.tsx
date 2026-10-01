import type { Metadata } from "next";
import { FileDownIcon } from "lucide-react";
import { DecisionForm } from "@/app/(public)/devis-en-ligne/[token]/decision-form";
import { CompanyBrand } from "@/components/company-brand";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { dbDateToIso, formatIsoDate } from "@/domain/dates";
import { formatPercent } from "@/domain/percent";
import { formatQuantity } from "@/domain/quantity";
import { unitLabel } from "@/domain/units";
import { documentLabels, fillLabel } from "@/i18n/documents";
import { onlineQuoteTexts } from "@/i18n/online-quote";
import { formatChf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { storedDocumentTotals } from "@/modules/documents/lines";
import { quoteForToken } from "@/modules/online-quotes/service";
import {
  clientSnapshot,
  companySnapshot,
  type ClientSnapshot,
  type CompanySnapshot,
} from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";

// Le lien ne doit fuiter ni vers d'autres sites ni dans un moteur de recherche.
export const metadata: Metadata = {
  title: "Devis · Offerte",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

function Amount({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "text-base font-semibold")}>
      <dt>{label}</dt>
      <dd className="whitespace-nowrap tabular-nums">{formatChf(cents)}</dd>
    </div>
  );
}

export default async function OnlineQuotePage({ params }: PageProps<"/devis-en-ligne/[token]">) {
  const { token } = await params;
  const found = await quoteForToken(token);
  if (!found) {
    const fr = onlineQuoteTexts("FR");
    const de = onlineQuoteTexts("DE");
    return (
      <Card>
        <CardContent className="space-y-4 py-6 text-sm">
          <div lang="fr" className="space-y-1">
            <h1 className="text-lg font-semibold">{fr.notFoundTitle}</h1>
            <p className="text-muted-foreground">{fr.notFoundText}</p>
          </div>
          <div lang="de" className="space-y-1">
            <h2 className="text-lg font-semibold">{de.notFoundTitle}</h2>
            <p className="text-muted-foreground">{de.notFoundText}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { quote, state } = found;
  const settings = await getSettings();
  const language = quote.language;
  const lang = language === "DE" ? "de" : "fr";
  const texts = onlineQuoteTexts(language);
  const labels = documentLabels(language);
  const company = (quote.companySnapshot as CompanySnapshot | null) ?? companySnapshot(settings);
  const client = (quote.clientSnapshot as ClientSnapshot | null) ?? clientSnapshot(quote.client);
  const { totals, globalDiscount, deposit } = storedDocumentTotals(quote, {
    separateRecurring: true,
  });
  const oneTime = quote.lines.filter((line) => line.lineType !== "SUBSCRIPTION");
  const recurring = quote.lines.filter((line) => line.lineType === "SUBSCRIPTION");
  const perPeriod = {
    MONTHLY: labels.perMonth,
    QUARTERLY: labels.perQuarter,
    YEARLY: labels.perYear,
  };
  const validUntil = formatIsoDate(dbDateToIso(quote.validUntil));
  const decidedOn = quote.decidedAt
    ? quote.decidedAt.toLocaleDateString("de-CH", {
        timeZone: "Europe/Zurich",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
  const contact = [company.email, company.phone].filter(Boolean).join(" · ");

  const lineRows = (lines: typeof quote.lines, offset: number) =>
    lines.map((line, i) => (
      <tr key={line.id} className="border-b align-top last:border-0">
        <td className="text-muted-foreground py-2 pr-2 tabular-nums">{offset + i + 1}</td>
        <td className="py-2 pr-4">
          <div className="font-medium">{line.label}</div>
          {line.description && (
            <div className="text-muted-foreground whitespace-pre-wrap">{line.description}</div>
          )}
          <div className="text-muted-foreground">
            {formatQuantity(line.quantityMilli)}{" "}
            {unitLabel(line.unit, language, line.quantityMilli)} × {formatChf(line.unitPriceCents)}
            {line.discountType &&
              line.discountValue > 0 &&
              ` − ${labels.discount} ${
                line.discountType === "PERCENT"
                  ? formatPercent(line.discountValue)
                  : formatChf(line.discountValue)
              }`}
          </div>
        </td>
        <td className="py-2 text-right font-medium whitespace-nowrap tabular-nums">
          {formatChf(line.netCents)}
          {line.lineType === "SUBSCRIPTION" && line.periodicity && (
            <div className="text-muted-foreground text-xs font-normal">
              {perPeriod[line.periodicity]}
            </div>
          )}
        </td>
      </tr>
    ));

  return (
    <div lang={lang} className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <CompanyBrand
            name={company.name || "—"}
            logoFile={settings.logoFile}
            className="[&_img]:h-12 [&_img]:max-w-48"
          />
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">
              {fillLabel(texts.sentBy, { company: company.name })}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {fillLabel(texts.pageTitle, { number: quote.number })}
            </h1>
            {quote.subject && <p className="text-muted-foreground">{quote.subject}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">{labels.client}</dt>
            <dd>{client.displayName}</dd>
            <dt className="text-muted-foreground">{labels.date}</dt>
            <dd>{formatIsoDate(dbDateToIso(quote.issueDate))}</dd>
            <dt className="text-muted-foreground">{labels.validUntil}</dt>
            <dd>{validUntil}</dd>
          </dl>
        </CardHeader>
        <CardContent className="space-y-6 text-sm">
          {quote.introText && <p className="whitespace-pre-wrap">{quote.introText}</p>}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="py-2 pr-2 font-medium">{labels.position}</th>
                  <th className="py-2 pr-4 font-medium">{labels.description}</th>
                  <th className="py-2 text-right font-medium">{labels.amount}</th>
                </tr>
              </thead>
              <tbody>{lineRows(oneTime, 0)}</tbody>
            </table>
          </div>

          {oneTime.length > 0 && (
            <dl className="ml-auto max-w-sm space-y-1.5">
              {(totals.oneTime.discountCents > 0 || totals.oneTime.vat.length > 0) && (
                <Amount label={labels.subtotal} cents={totals.oneTime.subtotalCents} />
              )}
              {totals.oneTime.discountCents > 0 && (
                <Amount
                  label={`${labels.globalDiscount}${
                    globalDiscount?.type === "PERCENT"
                      ? ` (${formatPercent(globalDiscount.value)})`
                      : ""
                  }`}
                  cents={-totals.oneTime.discountCents}
                />
              )}
              {totals.oneTime.vat.map((vat) => (
                <Amount
                  key={vat.rateBps}
                  label={`${labels.vat} ${formatPercent(vat.rateBps)}`}
                  cents={vat.vatCents}
                />
              ))}
              {totals.oneTime.roundingCents !== 0 && (
                <Amount label={labels.rounding} cents={totals.oneTime.roundingCents} />
              )}
              <div className="border-t pt-1.5">
                <Amount label={labels.total} cents={totals.oneTime.totalCents} strong />
              </div>
              {totals.depositCents > 0 && (
                <Amount
                  label={`${labels.deposit}${
                    deposit?.type === "PERCENT" ? ` (${formatPercent(deposit.value)})` : ""
                  }`}
                  cents={totals.depositCents}
                />
              )}
              {!quote.vatEnabled && (
                <p className="text-muted-foreground text-xs">{labels.vatExempt}</p>
              )}
            </dl>
          )}

          {recurring.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-medium">{labels.recurringTitle}</h2>
              <table className="w-full">
                <tbody>{lineRows(recurring, oneTime.length)}</tbody>
              </table>
              <dl className="bg-muted/60 ml-auto max-w-sm space-y-1.5 rounded-md p-3">
                {totals.recurring.map((group) => (
                  <Amount
                    key={group.periodicity}
                    label={`${labels.recurringTotal} ${perPeriod[group.periodicity]}`}
                    cents={group.totalCents}
                    strong
                  />
                ))}
              </dl>
            </div>
          )}

          {quote.conditionsText && (
            <div className="space-y-1">
              <h2 className="font-medium">{texts.conditions}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{quote.conditionsText}</p>
            </div>
          )}

          <a
            href={`/api/devis-en-ligne/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium hover:underline"
          >
            <FileDownIcon className="size-4" /> {texts.downloadPdf}
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-2 text-sm">
          {state === "open" && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                {fillLabel(texts.validUntilNotice, { date: validUntil })}
              </p>
              <DecisionForm token={token} texts={texts} />
            </div>
          )}
          {state === "accepted" && (
            <p role="status" className="text-success font-medium">
              {quote.decidedOnline
                ? fillLabel(texts.accepted, { date: decidedOn, name: quote.decisionName })
                : texts.acceptedOffline}
            </p>
          )}
          {state === "refused" && (
            <p role="status" className="font-medium">
              {fillLabel(texts.refused, { date: decidedOn })}
            </p>
          )}
          {state === "expired" && (
            <p role="status" className="font-medium">
              {fillLabel(texts.expired, { date: validUntil })}
            </p>
          )}
          {state === "unavailable" && (
            <p role="status" className="font-medium">
              {texts.unavailable}
            </p>
          )}
          {contact && (
            <p className="text-muted-foreground mt-4 text-xs">
              {fillLabel(texts.contact, { contact })}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
