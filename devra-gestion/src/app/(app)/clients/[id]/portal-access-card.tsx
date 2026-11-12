"use client";

import {
  CopyIcon,
  KeyRoundIcon,
  MailIcon,
  MessagesSquareIcon,
  PowerIcon,
  PowerOffIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createPortalAccessAction,
  emailPortalCredentialsAction,
  regeneratePortalPasswordAction,
  setPortalAccessActiveAction,
} from "@/modules/portal/staff-actions";

export type PortalAccessView = {
  login: string;
  active: boolean;
  /** Dates déjà formatées. */
  createdAt: string;
  createdBy: string | null;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
};

type Credentials = { login: string; password: string };
type Confirm = "password" | "disable" | null;

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copié.`);
  } catch {
    toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
  }
}

function CredentialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="font-mono text-sm font-semibold break-all select-all">{value}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Copier : ${label}`}
        onClick={() => void copy(value, label)}
      >
        <CopyIcon />
      </Button>
    </div>
  );
}

/**
 * Accès du client à son espace (devis, factures, abonnements, discussion) :
 * création, identifiants affichés une seule fois, envoi par email, nouveau
 * mot de passe, désactivation.
 */
export function PortalAccessCard({
  clientId,
  clientEmail,
  portalAddress,
  access,
  discussionId,
  canEdit,
}: {
  clientId: string;
  clientEmail: string;
  portalAddress: string;
  access: PortalAccessView | null;
  discussionId: string | null;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [emailedTo, setEmailedTo] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  function show(result: Awaited<ReturnType<typeof createPortalAccessAction>>) {
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setEmailedTo(null);
    setCredentials(result.data);
  }

  function create() {
    startTransition(async () => show(await createPortalAccessAction({ clientId })));
  }

  function regenerate() {
    startTransition(async () => {
      show(await regeneratePortalPasswordAction({ clientId }));
      setConfirm(null);
    });
  }

  function setActive(active: boolean) {
    startTransition(async () => {
      const result = await setPortalAccessActiveAction({ clientId, active });
      if (result.ok) toast.success(active ? "Accès réactivé." : "Accès désactivé.");
      else toast.error(result.error);
      setConfirm(null);
    });
  }

  function sendEmail() {
    if (!credentials) return;
    startTransition(async () => {
      const result = await emailPortalCredentialsAction({
        clientId,
        password: credentials.password,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setEmailedTo(result.data.email);
      toast.success(`Identifiants envoyés à ${result.data.email}.`);
    });
  }

  const allText = credentials
    ? `Adresse : ${portalAddress}\nIdentifiant : ${credentials.login}\nMot de passe : ${credentials.password}`
    : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Espace client</CardTitle>
        <CardDescription>
          Le client y consulte ses devis, ses factures et ses abonnements, et vous écrit.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {access ? (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted-foreground">Identifiant</dt>
              <dd className="font-mono font-semibold">{access.login}</dd>
              <dt className="text-muted-foreground">Accès</dt>
              <dd>
                {access.active ? (
                  <Badge variant="secondary">Actif</Badge>
                ) : (
                  <Badge variant="outline">Désactivé</Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">Créé le</dt>
              <dd>
                {access.createdAt}
                {access.createdBy && ` par ${access.createdBy}`}
              </dd>
              <dt className="text-muted-foreground">Dernière connexion</dt>
              <dd>{access.lastLoginAt ?? "Jamais"}</dd>
              {access.passwordChangedAt && (
                <>
                  <dt className="text-muted-foreground">Mot de passe</dt>
                  <dd>changé par le client le {access.passwordChangedAt}</dd>
                </>
              )}
            </dl>
            {discussionId && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/discussions/${discussionId}`}>
                  <MessagesSquareIcon /> Discussion avec le client
                </Link>
              </Button>
            )}
            {canEdit && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || !access.active}
                  onClick={() => setConfirm("password")}
                >
                  <KeyRoundIcon /> Nouveau mot de passe
                </Button>
                {access.active ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setConfirm("disable")}
                  >
                    <PowerOffIcon /> Désactiver l&apos;accès
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => setActive(true)}
                  >
                    <PowerIcon /> Réactiver l&apos;accès
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Ce client n&apos;a pas encore d&apos;accès. Un identifiant et un mot de passe seront
              générés : vous pourrez les copier ou les lui envoyer par email.
            </p>
            {canEdit && (
              <Button size="sm" className="w-full" disabled={pending} onClick={create}>
                <UserRoundPlusIcon /> Créer l&apos;accès à l&apos;espace client
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Identifiants de l&apos;espace client</DialogTitle>
            <DialogDescription>
              Transmettez-les au client maintenant : le mot de passe ne sera plus affiché. Il pourra
              le changer une fois connecté.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-2">
              <CredentialRow label="Adresse" value={portalAddress} />
              <CredentialRow label="Identifiant" value={credentials.login} />
              <CredentialRow label="Mot de passe" value={credentials.password} />
              {!clientEmail && (
                <p className="text-muted-foreground text-xs">
                  Ajoutez une adresse email sur la fiche du client pour pouvoir les lui envoyer.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => void copy(allText, "Texte")}>
              <CopyIcon /> Tout copier
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              {clientEmail && (
                <Button
                  variant="outline"
                  disabled={pending || emailedTo !== null}
                  onClick={sendEmail}
                >
                  <MailIcon />
                  {emailedTo ? `Envoyé à ${emailedTo}` : `Envoyer par email à ${clientEmail}`}
                </Button>
              )}
              <Button onClick={() => setCredentials(null)}>Terminé</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "password"
                ? "Générer un nouveau mot de passe ?"
                : "Désactiver l'accès à l'espace client ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "password"
                ? "L'ancien mot de passe ne fonctionnera plus et le client sera déconnecté de ses appareils. L'identifiant ne change pas."
                : "Le client sera déconnecté et ne pourra plus se connecter. Ses documents et la discussion sont conservés : vous pourrez réactiver l'accès à tout moment."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                if (confirm === "password") regenerate();
                else setActive(false);
              }}
            >
              {confirm === "password" ? "Générer" : "Désactiver"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
