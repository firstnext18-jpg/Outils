import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteMovementButton } from "@/app/(app)/apports/[id]/delete-movement-button";
import { MovementForm } from "@/app/(app)/apports/movement-form";
import { Receipts } from "@/components/files/receipts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { dbDateToIso } from "@/domain/dates";
import { PARTNER_KIND_LABELS } from "@/domain/partners";
import { formatAmount, formatChf, formatDateTime } from "@/lib/format";
import { addPartnerReceiptsAction } from "@/modules/partners/actions";
import { getPartnerMovement, partnerOptions } from "@/modules/partners/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Mouvement d'associé" };

export default async function PartnerMovementPage({ params }: PageProps<"/apports/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const movement = /^[0-9a-f-]{36}$/i.test(id) ? await getPartnerMovement(id) : null;
  if (!movement) notFound();
  const partners = await partnerOptions(movement.partnerId);

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Link href="/apports" className="text-muted-foreground text-sm hover:underline">
            ← Apports des associés
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {PARTNER_KIND_LABELS[movement.kind]} · {movement.partner.name}
          </h1>
          <p className="text-muted-foreground text-sm">
            {formatChf(movement.amountCents)} · enregistré le {formatDateTime(movement.createdAt)}
            {movement.createdBy && ` par ${movement.createdBy.name}`}
          </p>
        </div>
        <DeleteMovementButton id={movement.id} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MovementForm
            movementId={movement.id}
            partners={partners}
            defaultValues={{
              partnerId: movement.partnerId,
              kind: movement.kind,
              date: dbDateToIso(movement.date),
              amount: formatAmount(movement.amountCents),
              description: movement.description,
              notes: movement.notes,
            }}
          />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Justificatifs</CardTitle>
            <CardDescription>
              Relevé bancaire, contrat de prêt… Visibles par les admins seulement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Receipts
              ownerId={movement.id}
              addAction={addPartnerReceiptsAction}
              canEdit
              receipts={movement.receipts.map((r) => ({
                id: r.id,
                name: r.name,
                size: r.size,
                meta: formatDateTime(r.createdAt),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
