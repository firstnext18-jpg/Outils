"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OnlineQuoteTexts } from "@/i18n/online-quote";
import { acceptQuoteOnlineAction, refuseQuoteOnlineAction } from "@/modules/online-quotes/actions";
import { portalAcceptQuoteAction, portalRefuseQuoteAction } from "@/modules/portal/actions";

/**
 * Acceptation (nom + case à cocher) ou refus (nom + commentaire facultatif)
 * du devis : depuis le lien envoyé par email (jeton) ou depuis l'espace client.
 */
export function QuoteDecisionForm({
  target,
  texts,
}: {
  target: { token: string } | { quoteId: string };
  texts: OnlineQuoteTexts;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"accept" | "refuse">("accept");
  const [name, setName] = useState("");
  const [agree, setAgree] = useState(false);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError(texts.nameRequired);
    if (mode === "accept" && !agree) return setError(texts.agreeRequired);
    startTransition(async () => {
      const result =
        "token" in target
          ? mode === "accept"
            ? await acceptQuoteOnlineAction({ token: target.token, name, accept: true })
            : await refuseQuoteOnlineAction({ token: target.token, name, comment })
          : mode === "accept"
            ? await portalAcceptQuoteAction({ quoteId: target.quoteId, name, accept: true })
            : await portalRefuseQuoteAction({ quoteId: target.quoteId, name, comment });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">
          {mode === "accept" ? texts.acceptTitle : texts.refuseTitle}
        </h2>
        {mode === "accept" && <p className="text-muted-foreground text-sm">{texts.acceptHelp}</p>}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="decision-name">{texts.name}</Label>
        <Input
          id="decision-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          maxLength={120}
          required
        />
      </div>
      {mode === "accept" ? (
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={agree}
            onCheckedChange={(value) => setAgree(value === true)}
            aria-label={texts.agree}
            className="mt-0.5"
          />
          <span>{texts.agree}</span>
        </label>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="decision-comment">{texts.comment}</Label>
          <Textarea
            id="decision-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={3}
            maxLength={1000}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {mode === "accept" ? (
          <>
            <Button type="submit" disabled={pending}>
              {pending ? texts.sending : texts.acceptButton}
            </Button>
            <Button type="button" variant="link" onClick={() => setMode("refuse")}>
              {texts.refuseToggle}
            </Button>
          </>
        ) : (
          <>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? texts.sending : texts.refuseButton}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("accept")}>
              {texts.back}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
