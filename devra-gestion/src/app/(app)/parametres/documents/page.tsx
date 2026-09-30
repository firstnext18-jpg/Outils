import type { Metadata } from "next";
import { DocumentTextsForm } from "@/app/(app)/parametres/documents/document-texts-form";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Documents" };

export default async function DocumentSettingsPage() {
  await requireRole("ADMIN");
  const s = await getSettings();
  return (
    <DocumentTextsForm
      defaultValues={{
        quoteIntroFr: s.quoteIntroFr,
        quoteIntroDe: s.quoteIntroDe,
        quoteConditionsFr: s.quoteConditionsFr,
        quoteConditionsDe: s.quoteConditionsDe,
        documentFooterFr: s.documentFooterFr,
        documentFooterDe: s.documentFooterDe,
      }}
    />
  );
}
