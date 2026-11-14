import type { Metadata } from "next";
import Link from "next/link";
import { MovementForm } from "@/app/(app)/apports/movement-form";
import { todayIso } from "@/domain/dates";
import { partnerOptions } from "@/modules/partners/service";
import { displayCompanyName, getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Nouveau mouvement d'associé" };

export default async function NewPartnerMovementPage() {
  const user = await requireRole("ADMIN");
  const [partners, settings] = await Promise.all([partnerOptions(), getSettings()]);
  return (
    <>
      <div className="space-y-2">
        <Link href="/apports" className="text-muted-foreground text-sm hover:underline">
          ← Apports des associés
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau mouvement</h1>
      </div>
      <MovementForm
        partners={partners}
        companyName={displayCompanyName(settings)}
        defaultValues={{
          partnerId: partners.some((p) => p.id === user.id) ? user.id : "",
          kind: "CAPITAL_IN",
          date: todayIso(),
          amount: "",
          description: "",
          notes: "",
        }}
      />
    </>
  );
}
