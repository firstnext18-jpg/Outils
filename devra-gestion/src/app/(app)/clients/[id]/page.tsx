import type { Metadata } from "next";
import {
  ArchiveIcon,
  FilePlusIcon,
  Building2Icon,
  FileTextIcon,
  GlobeIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  ReceiptTextIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientActions } from "@/app/(app)/clients/[id]/client-actions";
import { InvoicesList } from "@/components/documents/invoices-list";
import { QuotesList } from "@/components/documents/quotes-list";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { describeActivity } from "@/domain/activity";
import { cantonName } from "@/domain/cantons";
import { CLIENT_KIND_LABELS, LANGUAGE_LABELS } from "@/domain/clients";
import { countryName } from "@/domain/countries";
import { canEdit } from "@/domain/roles";
import { formatChf, formatDate, formatDateTime } from "@/lib/format";
import { getClient, getClientActivity } from "@/modules/clients/service";
import { clientInvoiceSummary, listClientInvoices } from "@/modules/invoices/service";
import { listClientQuotes } from "@/modules/quotes/service";
import { requireUser } from "@/server/session";

export async function generateMetadata({ params }: PageProps<"/clients/[id]">): Promise<Metadata> {
  const client = await getClient((await params).id);
  return { title: client?.displayName ?? "Client" };
}

/** Lien cliquable vers le site actuel du client (ajoute https:// si besoin). */
function websiteHref(website: string): string {
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function Row({ icon: Icon, children }: { icon: typeof MailIcon; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export default async function ClientPage({ params }: PageProps<"/clients/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const [client, activity, quotes, invoices, summary] = await Promise.all([
    getClient(id),
    getClientActivity(id),
    listClientQuotes(id),
    listClientInvoices(id),
    clientInvoiceSummary(id),
  ]);
  if (!client) notFound();

  const address = [
    [client.street, client.streetNumber].filter(Boolean).join(" "),
    [client.postalCode, client.city].filter(Boolean).join(" "),
    client.country === "CH"
      ? client.canton && `Canton de ${cantonName(client.canton)}`
      : countryName(client.country),
  ].filter(Boolean);
  const KindIcon = client.kind === "COMPANY" ? Building2Icon : UserIcon;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/clients" className="text-muted-foreground text-sm hover:underline">
            ← Clients
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{client.displayName}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <KindIcon /> {CLIENT_KIND_LABELS[client.kind]}
            </Badge>
            {client.archivedAt && (
              <Badge variant="outline" className="gap-1">
                <ArchiveIcon /> Archivé le {formatDate(client.archivedAt)}
              </Badge>
            )}
          </div>
        </div>
        {canEdit(user.role) && (
          <div className="flex gap-2">
            <ClientActions
              client={{
                id: client.id,
                displayName: client.displayName,
                archived: Boolean(client.archivedAt),
              }}
            />
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.contactName && <Row icon={UserIcon}>{client.contactName}</Row>}
              {address.length > 0 && (
                <Row icon={MapPinIcon}>
                  {address.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </Row>
              )}
              {client.email && (
                <Row icon={MailIcon}>
                  <a href={`mailto:${client.email}`} className="hover:underline">
                    {client.email}
                  </a>
                </Row>
              )}
              {client.phone && (
                <Row icon={PhoneIcon}>
                  <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="hover:underline">
                    {client.phone}
                  </a>
                </Row>
              )}
              {client.website && (
                <Row icon={GlobeIcon}>
                  <a
                    href={websiteHref(client.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {client.website}
                  </a>
                </Row>
              )}
              {!client.contactName &&
                address.length === 0 &&
                !client.email &&
                !client.phone &&
                !client.website && (
                  <p className="text-muted-foreground">Aucune coordonnée renseignée.</p>
                )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-muted-foreground">Type de site</dt>
                <dd>{client.siteType?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Langue</dt>
                <dd>{LANGUAGE_LABELS[client.language]}</dd>
              </dl>
              {client.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {client.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">
                      <Link href={`/clients?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ["Total facturé", summary.invoicedCents],
              ["Encaissé", summary.paidCents],
              ["Impayé", summary.unpaidCents],
            ].map(([label, amount]) => (
              <Card key={label} className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardDescription>{label}</CardDescription>
                </CardHeader>
                <CardContent className="px-4 text-xl font-semibold tabular-nums">
                  {formatChf(amount as number)}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Devis</CardTitle>
              {canEdit(user.role) && !client.archivedAt && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/devis/nouveau?client=${client.id}`}>
                    <FilePlusIcon /> Nouveau devis
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="text-sm">
              {quotes.length > 0 ? (
                <QuotesList quotes={quotes} showClient={false} />
              ) : (
                <div className="text-muted-foreground flex items-center gap-3 rounded-md border border-dashed p-4">
                  <FileTextIcon className="size-5" /> Aucun devis pour ce client.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle>Factures</CardTitle>
              {canEdit(user.role) && !client.archivedAt && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/factures/nouvelle?client=${client.id}`}>
                    <FilePlusIcon /> Nouvelle facture
                  </Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="text-sm">
              {invoices.length > 0 ? (
                <InvoicesList invoices={invoices} showClient={false} />
              ) : (
                <div className="text-muted-foreground flex items-center gap-3 rounded-md border border-dashed p-4">
                  <ReceiptTextIcon className="size-5" /> Aucune facture pour ce client.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique de la fiche</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-sm">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex flex-col sm:flex-row sm:gap-3">
                    <time className="text-muted-foreground shrink-0 tabular-nums sm:w-36">
                      {formatDateTime(entry.createdAt)}
                    </time>
                    <span>
                      <span className="font-medium">{entry.user?.name ?? "Système"}</span>{" "}
                      {describeActivity(entry.action, entry.details)}
                    </span>
                  </li>
                ))}
                {activity.length === 0 && (
                  <li className="text-muted-foreground">
                    Fiche créée le {formatDateTime(client.createdAt)}
                    {client.createdBy && ` par ${client.createdBy.name}`}.
                  </li>
                )}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
