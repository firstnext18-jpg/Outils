"use client";

import { PlayIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runDailyTasksAction } from "@/modules/tasks/actions";

export function RunTasksButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await runDailyTasksAction({});
          if (!result.ok) toast.error(result.error);
          else if (result.data.errors.length > 0)
            toast.error(`Tâches terminées avec des erreurs : ${result.data.errors.join(" ; ")}`);
          else toast.success("Tâches quotidiennes exécutées.");
        })
      }
    >
      <PlayIcon /> {pending ? "Exécution…" : "Lancer maintenant"}
    </Button>
  );
}
