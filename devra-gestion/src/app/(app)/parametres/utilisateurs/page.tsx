import type { Metadata } from "next";
import { InvitationsTable } from "@/app/(app)/parametres/utilisateurs/invitations-table";
import { InviteUserDialog } from "@/app/(app)/parametres/utilisateurs/invite-user-dialog";
import { UsersTable } from "@/app/(app)/parametres/utilisateurs/users-table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listUsersAndInvitations } from "@/modules/users/service";
import { requireRole } from "@/server/session";

export const metadata: Metadata = { title: "Paramètres · Utilisateurs" };

export default async function UsersSettingsPage() {
  const currentUser = await requireRole("ADMIN");
  const { users, invitations } = await listUsersAndInvitations();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Utilisateurs</CardTitle>
          <CardDescription>
            Admin : accès complet · Membre : gère clients, devis et factures · Lecture seule :
            consulte sans modifier.
          </CardDescription>
          <CardAction>
            <InviteUserDialog />
          </CardAction>
        </CardHeader>
        <CardContent>
          <UsersTable users={users} currentUserId={currentUser.id} />
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Invitations en attente</CardTitle>
            <CardDescription>
              La personne invitée active son compte en cliquant sur le lien reçu par email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvitationsTable invitations={invitations} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
