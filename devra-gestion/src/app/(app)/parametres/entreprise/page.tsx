import type { Metadata } from "next";
import { CompanyForm } from "@/app/(app)/parametres/entreprise/company-form";
import { LogoForm } from "@/app/(app)/parametres/entreprise/logo-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIban } from "@/domain/iban";
import { getSettings } from "@/modules/settings/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Entreprise" };

export default async function CompanySettingsPage() {
  await requireRole("ADMIN");
  const settings = await getSettings();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Affiché dans l&apos;application et en haut des devis et factures. PNG ou JPEG, 2 Mo
            maximum ; un fond transparent (PNG) donne le meilleur résultat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoForm logoFile={settings.logoFile} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informations de l&apos;entreprise</CardTitle>
          <CardDescription>
            Utilisées sur les devis, les factures et la QR-facture. L&apos;adresse doit être
            complète pour que la QR-facture soit valable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyForm
            defaultValues={{
              companyName: settings.companyName,
              companyStreet: settings.companyStreet,
              companyStreetNumber: settings.companyStreetNumber,
              companyPostalCode: settings.companyPostalCode,
              companyCity: settings.companyCity,
              companyCountry: settings.companyCountry,
              companyEmail: settings.companyEmail,
              companyPhone: settings.companyPhone,
              companyWebsite: settings.companyWebsite,
              iban: settings.iban ? formatIban(settings.iban) : "",
              qrIban: settings.qrIban ? formatIban(settings.qrIban) : "",
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
