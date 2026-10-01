"use server";

import { revalidatePath } from "next/cache";
import { onlineAcceptSchema, onlineRefuseSchema } from "@/domain/online-quote";
import { onlineQuoteTexts, type OnlineQuoteTexts } from "@/i18n/online-quote";
import { decideOnline, quoteForToken } from "@/modules/online-quotes/service";
import { requestIp } from "@/server/request-ip";

/**
 * Décision du client sur la page publique du devis (sans compte : le jeton
 * du lien fait office d'autorisation). Les messages sont dans la langue du devis.
 */
export type OnlineDecisionResult = { ok: true } | { ok: false; error: string };

function invalidLink(): OnlineDecisionResult {
  return {
    ok: false,
    error: `${onlineQuoteTexts("FR").invalidLink} / ${onlineQuoteTexts("DE").invalidLink}`,
  };
}

function fieldError(texts: OnlineQuoteTexts, field: unknown): string {
  if (field === "accept") return texts.agreeRequired;
  if (field === "comment") return texts.commentTooLong;
  if (field === "token") return texts.invalidLink;
  return texts.nameRequired;
}

async function decide(
  input: unknown,
  decision: "ACCEPTED" | "REFUSED",
): Promise<OnlineDecisionResult> {
  const token = (input as { token?: unknown } | null)?.token;
  const found = typeof token === "string" ? await quoteForToken(token) : null;
  if (!found) return invalidLink();
  const texts = onlineQuoteTexts(found.quote.language);

  const parsed =
    decision === "ACCEPTED"
      ? onlineAcceptSchema.safeParse(input)
      : onlineRefuseSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: fieldError(texts, parsed.error.issues[0]?.path[0]) };
  }
  const data = parsed.data;
  const result = await decideOnline(
    data.token,
    "comment" in data
      ? { decision: "REFUSED", name: data.name, comment: data.comment }
      : { decision: "ACCEPTED", name: data.name },
    await requestIp(),
  );
  if (!result.ok) return { ok: false, error: result.state ? texts.closedError : texts.invalidLink };

  revalidatePath(`/devis-en-ligne/${data.token}`);
  revalidatePath(`/devis/${found.quote.id}`);
  revalidatePath("/devis");
  revalidatePath("/");
  return { ok: true };
}

export async function acceptQuoteOnlineAction(input: unknown): Promise<OnlineDecisionResult> {
  return decide(input, "ACCEPTED");
}

export async function refuseQuoteOnlineAction(input: unknown): Promise<OnlineDecisionResult> {
  return decide(input, "REFUSED");
}
