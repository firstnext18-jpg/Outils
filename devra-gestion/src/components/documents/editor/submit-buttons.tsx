import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Boutons d'enregistrement : dans la colonne de droite sur grand écran… */
export function EditorSidebarButtons({
  label,
  cancelHref,
  pending,
}: {
  label: string;
  cancelHref: string;
  pending: boolean;
}) {
  return (
    <>
      <div className="hidden gap-2 lg:flex">
        <Button type="submit" className="flex-1" disabled={pending}>
          {label}
        </Button>
      </div>
      <Button asChild variant="ghost" className="hidden w-full lg:flex">
        <Link href={cancelHref}>Annuler</Link>
      </Button>
    </>
  );
}

/** …et en barre collée en bas de l'écran sur téléphone et tablette. */
export function EditorMobileBar({
  label,
  cancelHref,
  pending,
}: {
  label: string;
  cancelHref: string;
  pending: boolean;
}) {
  return (
    <div className="bg-background/95 sticky bottom-0 -mx-4 flex justify-end gap-2 border-t px-4 py-3 backdrop-blur md:-mx-6 md:px-6 lg:hidden">
      <Button asChild variant="ghost">
        <Link href={cancelHref}>Annuler</Link>
      </Button>
      <Button type="submit" disabled={pending}>
        {label}
      </Button>
    </div>
  );
}
