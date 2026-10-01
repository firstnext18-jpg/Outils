import { ArchiveIcon, Building2Icon, UserIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { countryName } from "@/domain/countries";
import type { ClientListRow } from "@/modules/clients/service";

function Location({ client }: { client: ClientListRow }) {
  const place = [client.postalCode, client.city].filter(Boolean).join(" ");
  const region = client.country === "CH" ? client.canton : countryName(client.country);
  if (!place && !region) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {place}
      {region && <span className="text-muted-foreground">{place ? ` (${region})` : region}</span>}
    </span>
  );
}

function KindIcon({ client }: { client: ClientListRow }) {
  const Icon = client.kind === "COMPANY" ? Building2Icon : UserIcon;
  return (
    <Icon
      className="text-muted-foreground size-4 shrink-0"
      aria-label={client.kind === "COMPANY" ? "Entreprise" : "Particulier"}
    />
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="font-normal">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

/** Liste des clients : tableau sur grand écran, cartes sur téléphone. */
export function ClientsList({ clients }: { clients: ClientListRow[] }) {
  return (
    <>
      <div className="hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Client</TableHead>
              <TableHead>Localité</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Type de site</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.map((client) => (
              <TableRow key={client.id} className="relative">
                <TableCell className="pl-4">
                  <div className="flex items-center gap-2">
                    <KindIcon client={client} />
                    <Link
                      href={`/clients/${client.id}`}
                      className="font-medium after:absolute after:inset-0 hover:underline"
                    >
                      {client.displayName}
                    </Link>
                    {client.archivedAt && (
                      <Badge variant="outline" className="gap-1">
                        <ArchiveIcon /> Archivé
                      </Badge>
                    )}
                  </div>
                  {client.contactName && (
                    <div className="text-muted-foreground pl-6 text-sm">{client.contactName}</div>
                  )}
                </TableCell>
                <TableCell>
                  <Location client={client} />
                </TableCell>
                <TableCell className="max-w-56">
                  <div className="truncate">
                    {client.email || <span className="text-muted-foreground">—</span>}
                  </div>
                  {client.phone && (
                    <div className="text-muted-foreground text-sm">{client.phone}</div>
                  )}
                </TableCell>
                <TableCell>
                  {client.siteType?.name ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="max-w-48 whitespace-normal">
                  <Tags tags={client.tags} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-2 md:hidden">
        {clients.map((client) => (
          <li key={client.id}>
            <Link
              href={`/clients/${client.id}`}
              className="hover:bg-accent block space-y-1 rounded-lg border p-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                <KindIcon client={client} />
                <span className="font-medium">{client.displayName}</span>
                {client.archivedAt && <Badge variant="outline">Archivé</Badge>}
              </div>
              <div className="text-sm">
                <Location client={client} />
              </div>
              {(client.email || client.phone) && (
                <div className="text-muted-foreground truncate text-sm">
                  {[client.email, client.phone].filter(Boolean).join(" · ")}
                </div>
              )}
              <Tags tags={client.tags} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
