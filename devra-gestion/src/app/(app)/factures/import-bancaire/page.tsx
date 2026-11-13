import type { Metadata } from "next";
import Link from "next/link";
import { BankImportWizard } from "@/app/(app)/factures/import-bancaire/bank-import-wizard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { lastBankImports } from "@/modules/bank/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Import bancaire" };

export default async function BankImportPage() {
  await requireRole("MEMBER");
  const imports = await lastBankImports();
  return (
    <>
      <div className="space-y-2">
        <Link href="/factures" className="text-muted-foreground text-sm hover:underline">
          ← Factures
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Importer un relevé bancaire</h1>
        <p className="text-muted-foreground">
          Téléchargez dans votre e-banking le relevé de compte (camt.053) ou les avis de crédit
          (camt.054) au format ISO 20022 / XML. Les paiements faits avec la QR-facture sont reconnus
          à leur référence ; une même opération n&apos;est jamais enregistrée deux fois.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <BankImportWizard />
        </CardContent>
      </Card>
      {imports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Derniers imports</CardTitle>
            <CardDescription>Fichier, crédits confirmés et paiements enregistrés.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {imports.map((i) => (
                <li key={i.id} className="flex flex-wrap gap-x-4 py-2">
                  <span className="text-muted-foreground tabular-nums">
                    {formatDateTime(i.createdAt)}
                  </span>
                  <span className="flex-1 truncate">{i.fileName}</span>
                  <span>
                    {i.paymentCount}/{i.credits} paiement(s)
                    {i.createdBy && ` · ${i.createdBy.name}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
