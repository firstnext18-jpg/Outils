"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/roles";
import { changeUserRoleAction, setUserActiveAction } from "@/modules/users/actions";

type UserRow = { id: string; name: string; email: string; role: Role; active: boolean };

export function UsersTable({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();

  function changeRole(user: UserRow, role: Role) {
    startTransition(async () => {
      const result = await changeUserRoleAction({ userId: user.id, role });
      if (result.ok) toast.success(`${user.name} est maintenant « ${ROLE_LABELS[role]} ».`);
      else toast.error(result.error);
    });
  }

  function setActive(user: UserRow, active: boolean) {
    startTransition(async () => {
      const result = await setUserActiveAction({ userId: user.id, active });
      if (result.ok)
        toast.success(active ? `${user.name} est réactivé.` : `${user.name} est désactivé.`);
      else toast.error(result.error);
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead className="w-44">Rôle</TableHead>
          <TableHead className="hidden w-28 sm:table-cell">Statut</TableHead>
          <TableHead className="w-32 text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <TableRow key={user.id} className={user.active ? undefined : "text-muted-foreground"}>
              <TableCell>
                <div className="font-medium">
                  {user.name} {isSelf && <span className="text-muted-foreground">(vous)</span>}
                </div>
                <div className="text-muted-foreground text-sm">{user.email}</div>
              </TableCell>
              <TableCell>
                {isSelf ? (
                  ROLE_LABELS[user.role]
                ) : (
                  <Select
                    value={user.role}
                    onValueChange={(role) => changeRole(user, role as Role)}
                    disabled={pending || !user.active}
                  >
                    <SelectTrigger size="sm" aria-label={`Rôle de ${user.name}`} className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {user.active ? (
                  <Badge variant="secondary">Actif</Badge>
                ) : (
                  <Badge variant="outline">Désactivé</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {!isSelf &&
                  (user.active ? (
                    <ConfirmButton
                      title={`Désactiver ${user.name} ?`}
                      description="Cette personne sera déconnectée immédiatement et ne pourra plus se connecter. Ses documents et son historique sont conservés. Vous pourrez la réactiver à tout moment."
                      confirmLabel="Désactiver"
                      destructive
                      disabled={pending}
                      onConfirm={() => setActive(user, false)}
                    >
                      Désactiver
                    </ConfirmButton>
                  ) : (
                    <ConfirmButton
                      title={`Réactiver ${user.name} ?`}
                      description="Cette personne pourra de nouveau se connecter avec son mot de passe actuel."
                      confirmLabel="Réactiver"
                      disabled={pending}
                      onConfirm={() => setActive(user, true)}
                    >
                      Réactiver
                    </ConfirmButton>
                  ))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
