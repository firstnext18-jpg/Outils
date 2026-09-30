"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, type Role } from "@/domain/roles";
import { formatDate } from "@/lib/format";
import { resendInvitationAction, revokeInvitationAction } from "@/modules/users/actions";

type InvitationRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  expiresAt: Date;
  expired: boolean;
  invitedBy: { name: string };
};

export function InvitationsTable({ invitations }: { invitations: InvitationRow[] }) {
  const [pending, startTransition] = useTransition();

  function resend(invitation: InvitationRow) {
    startTransition(async () => {
      const result = await resendInvitationAction({ invitationId: invitation.id });
      if (result.ok) toast.success(`Invitation renvoyée à ${invitation.email}.`);
      else toast.error(result.error);
    });
  }

  function revoke(invitation: InvitationRow) {
    startTransition(async () => {
      const result = await revokeInvitationAction({ invitationId: invitation.id });
      if (result.ok) toast.success("Invitation annulée.");
      else toast.error(result.error);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Personne invitée</TableHead>
          <TableHead className="hidden sm:table-cell">Rôle</TableHead>
          <TableHead className="hidden md:table-cell">Validité</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invitations.map((invitation) => {
          return (
            <TableRow key={invitation.id}>
              <TableCell>
                <div className="font-medium">{invitation.name}</div>
                <div className="text-muted-foreground text-sm">{invitation.email}</div>
                <div className="text-muted-foreground text-xs">
                  Invité par {invitation.invitedBy.name}
                </div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{ROLE_LABELS[invitation.role]}</TableCell>
              <TableCell className="hidden md:table-cell">
                {invitation.expired ? (
                  <Badge variant="outline">Expirée</Badge>
                ) : (
                  <span className="text-sm">Jusqu&apos;au {formatDate(invitation.expiresAt)}</span>
                )}
              </TableCell>
              <TableCell className="space-x-1 text-right whitespace-nowrap">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => resend(invitation)}
                >
                  Renvoyer
                </Button>
                <ConfirmButton
                  title="Annuler l'invitation ?"
                  description={`Le lien envoyé à ${invitation.email} ne fonctionnera plus.`}
                  confirmLabel="Annuler l'invitation"
                  destructive
                  disabled={pending}
                  onConfirm={() => revoke(invitation)}
                >
                  Annuler
                </ConfirmButton>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
