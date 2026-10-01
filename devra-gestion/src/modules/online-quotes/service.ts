import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { dbDateToIso, todayIso } from "@/domain/dates";
import {
  linkExpiry,
  onlineQuoteState,
  onlineTokenSchema,
  type OnlineQuoteState,
} from "@/domain/online-quote";
import { formatChf, formatDateTime } from "@/lib/format";
import { getQuote, type QuoteDetail } from "@/modules/quotes/service";
import type { ClientSnapshot } from "@/modules/settings/documents";
import { getSettings } from "@/modules/settings/service";
import { logActivity } from "@/server/activity";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { sendMail } from "@/server/mailer";

/** Empreinte enregistrée en base : le jeton lui-même n'est connu que du client. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Crée un lien d'acceptation pour le devis et renvoie son adresse complète
 * (APP_URL doit être joignable depuis Internet). Chaque envoi crée un lien ;
 * les liens précédents restent valables jusqu'à leur expiration.
 */
export async function createQuoteLink(quote: { id: string; validUntil: Date }): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.quoteLink.create({
    data: {
      quoteId: quote.id,
      tokenHash: hashToken(token),
      expiresAt: linkExpiry(dbDateToIso(quote.validUntil)),
    },
  });
  return `${env().APP_URL.replace(/\/+$/, "")}/devis-en-ligne/${token}`;
}

export type OnlineQuote = { quote: QuoteDetail; state: OnlineQuoteState };

/**
 * Devis d'un lien encore valable, ou `null` (lien inconnu, expiré, ou
 * acceptation en ligne désactivée entre-temps dans les paramètres).
 */
export async function quoteForToken(token: string): Promise<OnlineQuote | null> {
  if (!onlineTokenSchema.safeParse(token).success) return null;
  const [link, settings] = await Promise.all([
    db.quoteLink.findUnique({ where: { tokenHash: hashToken(token) } }),
    getSettings(),
  ]);
  if (!link || link.expiresAt <= new Date() || !settings.onlineAcceptance) return null;
  const quote = await getQuote(link.quoteId);
  if (!quote) return null;
  const state = onlineQuoteState(
    { status: quote.status, validUntil: dbDateToIso(quote.validUntil) },
    todayIso(),
  );
  return { quote, state };
}

export type OnlineDecision =
  { decision: "ACCEPTED"; name: string } | { decision: "REFUSED"; name: string; comment: string };

/**
 * Enregistre la décision du client : statut, date, nom saisi et adresse IP,
 * puis prévient l'équipe par email. Le devis est verrouillé le temps de
 * l'enregistrement : deux décisions simultanées ne peuvent pas aboutir.
 * Renvoie l'état du devis après coup (`open` si la décision a été prise).
 */
export async function decideOnline(
  token: string,
  input: OnlineDecision,
  ip: string,
): Promise<{ ok: true; quote: QuoteDetail } | { ok: false; state: OnlineQuoteState | null }> {
  const found = await quoteForToken(token);
  if (!found) return { ok: false, state: null };
  const { quote } = found;
  const today = todayIso();

  const decided = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "quote" WHERE id = ${quote.id} FOR UPDATE`;
    const current = await tx.quote.findUnique({
      where: { id: quote.id },
      select: { status: true, validUntil: true },
    });
    const state = current
      ? onlineQuoteState(
          { status: current.status, validUntil: dbDateToIso(current.validUntil) },
          today,
        )
      : null;
    if (state !== "open") return { ok: false as const, state };
    const comment = input.decision === "REFUSED" ? input.comment : "";
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        status: input.decision,
        decidedAt: new Date(),
        decidedOnline: true,
        decisionName: input.name,
        decisionIp: ip,
        decisionComment: comment,
        version: { increment: 1 },
      },
    });
    await logActivity(
      {
        userId: null,
        action: input.decision === "ACCEPTED" ? "quote.accepted_online" : "quote.refused_online",
        entityType: "quote",
        entityId: quote.id,
        label: quote.number,
        details: { onlineName: input.name, ip, ...(comment ? { comment } : {}) },
      },
      tx,
    );
    return { ok: true as const };
  });
  if (!decided.ok) return decided;

  await notifyTeam(quote, input).catch((error: unknown) =>
    console.error(`Notification de la décision sur ${quote.number} impossible`, error),
  );
  return { ok: true, quote };
}

/** Prévient les admins et les membres actifs de la décision du client. */
async function notifyTeam(quote: QuoteDetail, input: OnlineDecision) {
  const users = await db.user.findMany({
    where: { active: true, role: { in: ["ADMIN", "MEMBER"] } },
    select: { email: true },
  });
  if (users.length === 0) return;
  const client =
    (quote.clientSnapshot as ClientSnapshot | null)?.displayName || quote.client.displayName;
  const accepted = input.decision === "ACCEPTED";
  const verb = accepted ? "accepté" : "refusé";
  const lines = [
    "Bonjour,",
    "",
    `Le devis ${quote.number} (${client}, ${formatChf(quote.totalCents)}) a été ${verb} en ligne par ${input.name}, le ${formatDateTime(new Date())}.`,
  ];
  if (!accepted && input.comment) lines.push("", `Commentaire du client : ${input.comment}`);
  if (accepted) lines.push("", "Il peut maintenant être converti en facture.");
  lines.push("", `Voir le devis : ${env().APP_URL.replace(/\/+$/, "")}/devis/${quote.id}`);
  await sendMail({
    to: users.map((u) => u.email),
    subject: `Devis ${quote.number} ${verb} en ligne`,
    text: lines.join("\n"),
  });
}
