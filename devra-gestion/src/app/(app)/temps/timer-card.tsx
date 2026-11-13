"use client";

import { PlayIcon, SquareIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ClientPicker } from "@/components/documents/editor/client-picker";
import type { ProjectOption } from "@/components/time/time-entry-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { elapsedMinutes, formatDuration } from "@/domain/time";
import { startTimerAction, stopTimerAction } from "@/modules/time/actions";
import type { PickerClient } from "@/modules/clients/service";

const NO_PROJECT = "__aucun__";

/** Durée écoulée, mise à jour toutes les 30 secondes. */
function Elapsed({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return <>{formatDuration(elapsedMinutes(new Date(startedAt), new Date(now)))}</>;
}

/** Chronomètre : un seul en cours par personne ; l'arrêter enregistre le temps. */
export function TimerCard({
  running,
  projects,
}: {
  running: {
    startedAt: string;
    client: string;
    project: string | null;
    description: string;
  } | null;
  projects: ProjectOption[];
}) {
  const [client, setClient] = useState<PickerClient | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const clientProjects = projects.filter((p) => p.clientId === client?.id);

  function start() {
    if (!client) return toast.error("Choisissez un client.");
    startTransition(async () => {
      const result = await startTimerAction({ clientId: client.id, projectId, description });
      if (result.ok) {
        toast.success("Chronomètre démarré.");
        setDescription("");
      } else toast.error(result.error);
    });
  }

  function stop() {
    startTransition(async () => {
      const result = await stopTimerAction({});
      if (result.ok && result.data) {
        toast.success(`${formatDuration(result.data.minutes)} enregistrées.`);
      } else if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chronomètre</CardTitle>
        <CardDescription>
          {running
            ? "En cours : arrêtez-le pour enregistrer le temps."
            : "Démarrez-le en commençant une tâche."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {running ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-3xl font-semibold tabular-nums" role="timer">
                <Elapsed startedAt={running.startedAt} />
              </div>
              <div className="text-sm">
                {[running.client, running.project].filter(Boolean).join(" · ")}
              </div>
              {running.description && (
                <div className="text-muted-foreground text-sm">{running.description}</div>
              )}
            </div>
            <Button variant="destructive" disabled={pending} onClick={stop}>
              <SquareIcon /> Arrêter
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.5fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="timer-client">Client</Label>
              <ClientPicker
                id="timer-client"
                value={client}
                onChange={(picked) => {
                  setClient(picked);
                  setProjectId(null);
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timer-project">Projet</Label>
              <Select
                value={projectId ?? NO_PROJECT}
                onValueChange={(v) => setProjectId(v === NO_PROJECT ? null : v)}
                disabled={!client}
              >
                <SelectTrigger id="timer-project" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROJECT}>Sans projet</SelectItem>
                  {clientProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="timer-description">Tâche</Label>
              <Input
                id="timer-description"
                value={description}
                maxLength={500}
                placeholder="ex. Maquette de la page d'accueil"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <Button disabled={pending} onClick={start}>
              <PlayIcon /> Démarrer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
