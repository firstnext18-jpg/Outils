"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLIENT_INDICATORS, type ClientIndicator } from "@/domain/client-stage";
import { cn } from "@/lib/utils";
import { setClientStageAction } from "@/modules/clients/actions";

const NONE = "__aucun__";

/** Indicateurs automatiques : devis à accepter, facture à envoyer, facture en retard. */
export function ClientIndicators({
  indicators,
  className,
}: {
  indicators: ClientIndicator[];
  className?: string;
}) {
  if (indicators.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {indicators.map((indicator) => (
        <Badge
          key={indicator}
          variant={indicator === "facture-en-retard" ? "destructive" : "outline"}
          className="font-normal"
        >
          {CLIENT_INDICATORS[indicator]}
        </Badge>
      ))}
    </div>
  );
}

/** Choix de l'état du client, sur sa fiche. */
export function ClientStageSelect({
  clientId,
  stageId,
  stages,
  disabled,
}: {
  clientId: string;
  stageId: string | null;
  stages: { id: string; name: string; active: boolean }[];
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={stageId ?? NONE}
      disabled={disabled || pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setClientStageAction({
            id: clientId,
            stageId: value === NONE ? null : value,
          });
          if (result.ok) toast.success("État du client enregistré.");
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger size="sm" aria-label="État du client" className="min-w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Sans état</SelectItem>
        {stages.map((stage) => (
          <SelectItem key={stage.id} value={stage.id}>
            {stage.name}
            {!stage.active && " (désactivé)"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
