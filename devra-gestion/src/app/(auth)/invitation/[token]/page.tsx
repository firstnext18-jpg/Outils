import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationForm } from "@/app/(auth)/invitation/[token]/accept-invitation-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { findInvitationByToken } from "@/modules/users/service";

export const metadata: Metadata = { title: "Invitation" };

const MESSAGES = {
  invalid:
    "Ce lien d'invitation n'est pas valide. Il a peut-être été remplacé par une invitation plus récente.",
  expired:
    "Ce lien d'invitation a expiré. Demandez à un administrateur de vous renvoyer l'invitation.",
  used: "Cette invitation a déjà été utilisée. Vous pouvez vous connecter.",
} as const;

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const lookup = await findInvitationByToken(token);

  if (lookup.status !== "valid") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Invitation</CardTitle>
          <CardDescription>{MESSAGES[lookup.status]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full" variant="outline">
            <Link href="/connexion">Aller à la connexion</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <AcceptInvitationForm
      token={token}
      email={lookup.invitation.email}
      defaultName={lookup.invitation.name}
    />
  );
}
