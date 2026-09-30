import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/app/(auth)/reinitialiser/reset-password-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Nouveau mot de passe" };

/**
 * Better Auth vérifie le lien reçu par email puis redirige ici avec
 * `?token=…` (ou `?error=INVALID_TOKEN` si le lien est expiré ou déjà utilisé).
 */
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reinitialiser">) {
  const { token, error } = await searchParams;
  if (typeof token !== "string" || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Lien invalide ou expiré</CardTitle>
          <CardDescription>
            Ce lien de réinitialisation n&apos;est plus valable. Les liens expirent après 1 heure et
            ne servent qu&apos;une fois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return <ResetPasswordForm token={token} />;
}
