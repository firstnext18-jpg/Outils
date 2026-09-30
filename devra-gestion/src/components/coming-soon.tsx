import { ConstructionIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";

/** Page provisoire d'un module qui sera développé dans une prochaine phase. */
export function ComingSoon({ title, phase }: { title: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        icon={ConstructionIcon}
        title="Module en préparation"
        description={`Ce module sera disponible à la fin de la phase ${phase} du développement.`}
      />
    </>
  );
}
