"use client";

import {
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CatalogItemDialog,
  type CatalogDialogMode,
} from "@/app/(app)/catalogue/catalog-item-dialog";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatAmount } from "@/lib/format";
import { deleteCatalogItemAction, setCatalogItemActiveAction } from "@/modules/catalog/actions";
import { EMPTY_CATALOG_ITEM, type CatalogItemInput } from "@/modules/catalog/schemas";

export type CatalogItemForActions = {
  id: string;
  version: number;
  name: string;
  nameDe: string;
  description: string;
  descriptionDe: string;
  category: string;
  lineType: CatalogItemInput["lineType"];
  periodicity: CatalogItemInput["periodicity"];
  unit: CatalogItemInput["unit"];
  unitPriceCents: number;
  active: boolean;
};

function toInput(item: CatalogItemForActions): CatalogItemInput {
  return {
    name: item.name,
    nameDe: item.nameDe,
    description: item.description,
    descriptionDe: item.descriptionDe,
    category: item.category,
    lineType: item.lineType,
    periodicity: item.periodicity,
    unit: item.unit,
    unitPrice: formatAmount(item.unitPriceCents),
  };
}

/** Bouton « Nouvelle prestation ». */
export function NewCatalogItemButton({ categories }: { categories: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> Nouvelle prestation
      </Button>
      {open && (
        <CatalogItemDialog
          mode={{ kind: "create", defaults: EMPTY_CATALOG_ITEM }}
          open={open}
          onOpenChange={setOpen}
          categories={categories}
        />
      )}
    </>
  );
}

/** Menu d'actions d'une prestation : modifier, dupliquer, activer / désactiver, supprimer. */
export function CatalogItemActions({
  item,
  categories,
}: {
  item: CatalogItemForActions;
  categories: string[];
}) {
  const [dialog, setDialog] = useState<CatalogDialogMode | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggleActive() {
    startTransition(async () => {
      const result = await setCatalogItemActiveAction({ id: item.id, active: !item.active });
      if (result.ok)
        toast.success(item.active ? "Prestation désactivée." : "Prestation réactivée.");
      else toast.error(result.error);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteCatalogItemAction({ id: item.id });
      if (result.ok) toast.success(`« ${item.name} » supprimée.`);
      else toast.error(result.error);
      setConfirmDelete(false);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions pour ${item.name}`}
            disabled={pending}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              setDialog({
                kind: "edit",
                id: item.id,
                version: item.version,
                defaults: toInput(item),
              })
            }
          >
            <PencilIcon /> Modifier
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              setDialog({
                kind: "create",
                defaults: { ...toInput(item), name: `${item.name} (copie)` },
              })
            }
          >
            <CopyIcon /> Dupliquer
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleActive}>
            {item.active ? <EyeOffIcon /> : <EyeIcon />}
            {item.active ? "Désactiver" : "Réactiver"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2Icon /> Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog && (
        <CatalogItemDialog
          mode={dialog}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          categories={categories}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {item.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              La prestation disparaîtra du catalogue. Les devis et factures qui l&apos;utilisent ne
              sont pas modifiés. Pour simplement ne plus la proposer, désactivez-la plutôt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
