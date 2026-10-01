import Link from "next/link";
import { FileQuestionIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <EmptyState
        icon={FileQuestionIcon}
        title="Page introuvable"
        description="Cette page n'existe pas ou plus. L'élément a peut-être été supprimé."
        action={
          <Button asChild variant="outline">
            <Link href="/">Retour au tableau de bord</Link>
          </Button>
        }
      />
    </div>
  );
}
