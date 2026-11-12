"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { z } from "zod";
import { MESSAGE_MAX } from "@/domain/discussions";
import { portalAcceptSchema, portalRefuseSchema } from "@/domain/online-quote";
import { fillLabel } from "@/i18n/documents";
import { onlineQuoteTexts } from "@/i18n/online-quote";
import { portalTexts, type PortalTexts } from "@/i18n/portal";
import { decideFromPortal } from "@/modules/online-quotes/service";
import * as auth from "@/modules/portal/auth";
import {
  portalChangePasswordSchema,
  portalForgotSchema,
  portalLanguageSchema,
  portalLoginSchema,
  portalMessageSchema,
  portalResetSchema,
} from "@/modules/portal/schemas";
import * as service from "@/modules/portal/service";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/modules/users/schemas";
import { getPortalSession, type PortalSession } from "@/server/portal-session";
import { requestIp } from "@/server/request-ip";

/**
 * Actions de l'espace client. Toutes celles qui lisent ou écrivent des
 * données exigent une session client valide ; les messages sont dans la
 * langue du client (ou de la page, avant la connexion).
 */
export type PortalResult = { ok: true } | { ok: false; error: string };

function failure(error: string): PortalResult {
  return { ok: false, error };
}

/** Premier champ en erreur d'une validation Zod. */
function firstField(error: z.ZodError): string {
  return String(error.issues[0]?.path[0] ?? "");
}

function passwordError(t: PortalTexts, error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue?.path[0] === "passwordConfirm") return t.passwordMismatch;
  if (issue?.code === "too_big") return fillLabel(t.passwordTooLong, { max: PASSWORD_MAX_LENGTH });
  return fillLabel(t.passwordTooShort, { min: PASSWORD_MIN_LENGTH });
}

function languageOf(input: unknown) {
  return portalLanguageSchema.parse((input as { language?: unknown } | null)?.language);
}

/** Exécute `handler` pour le client connecté, ou signale une session expirée. */
async function withSession(
  handler: (session: PortalSession, t: PortalTexts) => Promise<PortalResult>,
): Promise<PortalResult> {
  const session = await getPortalSession();
  if (!session)
    return failure(`${portalTexts("FR").sessionExpired} / ${portalTexts("DE").sessionExpired}`);
  const t = portalTexts(session.client.language);
  try {
    return await handler(session, t);
  } catch (error) {
    console.error(error);
    return failure(t.genericError);
  }
}

// ---------------------------------------------------------------------------
// Connexion et mot de passe
// ---------------------------------------------------------------------------

export async function portalLoginAction(input: unknown): Promise<PortalResult> {
  const t = portalTexts(languageOf(input));
  const parsed = portalLoginSchema.safeParse(input);
  if (!parsed.success) {
    return failure(firstField(parsed.error) === "login" ? t.loginRequired : t.passwordRequired);
  }
  const result = await auth.signIn(parsed.data.login, parsed.data.password, await requestIp());
  if (result === "limited") return failure(t.tooManyAttempts);
  if (result === "invalid") return failure(t.invalidCredentials);
  if (result === "disabled") return failure(t.accessDisabled);
  return { ok: true };
}

export async function portalLogoutAction(): Promise<void> {
  const session = await getPortalSession();
  await auth.signOut();
  redirect(`/espace-client/connexion${session?.client.language === "DE" ? "?langue=de" : ""}`);
}

export async function portalForgotPasswordAction(input: unknown): Promise<PortalResult> {
  const t = portalTexts(languageOf(input));
  const parsed = portalForgotSchema.safeParse(input);
  if (!parsed.success) return failure(t.loginOrEmailRequired);
  try {
    const result = await auth.requestPasswordReset(parsed.data.loginOrEmail, await requestIp());
    if (result === "limited") return failure(t.tooManyAttempts);
  } catch (error) {
    console.error(error);
    return failure(t.genericError);
  }
  return { ok: true };
}

export async function portalResetPasswordAction(input: unknown): Promise<PortalResult> {
  const t = portalTexts(languageOf(input));
  const parsed = portalResetSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      firstField(parsed.error) === "token" ? t.resetInvalid : passwordError(t, parsed.error),
    );
  }
  const result = await auth.resetPassword(
    parsed.data.token,
    parsed.data.password,
    await requestIp(),
  );
  if (result === "limited") return failure(t.tooManyAttempts);
  if (result === "invalid") return failure(t.resetInvalid);
  return { ok: true };
}

export async function portalChangePasswordAction(input: unknown): Promise<PortalResult> {
  return withSession(async (session, t) => {
    const parsed = portalChangePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        firstField(parsed.error) === "current" ? t.wrongPassword : passwordError(t, parsed.error),
      );
    }
    const result = await auth.changePassword(session, parsed.data.current, parsed.data.password);
    if (result === "limited") return failure(t.tooManyAttempts);
    if (result === "wrong") return failure(t.wrongPassword);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Discussion avec l'équipe
// ---------------------------------------------------------------------------

export async function portalPostMessageAction(input: unknown): Promise<PortalResult> {
  return withSession(async (session, t) => {
    const parsed = portalMessageSchema.safeParse(input);
    if (!parsed.success) {
      return failure(
        parsed.error.issues[0]?.code === "too_big"
          ? fillLabel(t.messageTooLong, { max: MESSAGE_MAX })
          : t.messageRequired,
      );
    }
    const { id } = await service.postClientMessage(session, parsed.data.body);
    after(() =>
      service.notifyTeamOfClientMessage(session, id, parsed.data.body).catch((error: unknown) => {
        console.error("Notifications du message du client impossibles", error);
      }),
    );
    return { ok: true };
  });
}

export async function portalMarkReadAction(): Promise<PortalResult> {
  return withSession(async (session) => {
    await service.markPortalRead(session.client.id);
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// Devis : acceptation ou refus
// ---------------------------------------------------------------------------

async function decide(input: unknown, decision: "ACCEPTED" | "REFUSED"): Promise<PortalResult> {
  return withSession(async (session, t) => {
    const texts = onlineQuoteTexts(session.client.language);
    const parsed =
      decision === "ACCEPTED"
        ? portalAcceptSchema.safeParse(input)
        : portalRefuseSchema.safeParse(input);
    if (!parsed.success) {
      const field = firstField(parsed.error);
      if (field === "quoteId") return failure(t.quoteNotFound);
      if (field === "accept") return failure(texts.agreeRequired);
      if (field === "comment") return failure(texts.commentTooLong);
      return failure(texts.nameRequired);
    }
    const data = parsed.data;
    const result = await decideFromPortal(
      session.client.id,
      data.quoteId,
      "comment" in data
        ? { decision: "REFUSED", name: data.name, comment: data.comment }
        : { decision: "ACCEPTED", name: data.name },
      await requestIp(),
    );
    if (!result.ok) return failure(result.state ? texts.closedError : t.quoteNotFound);
    revalidatePath(`/devis/${data.quoteId}`);
    revalidatePath("/devis");
    revalidatePath("/");
    return { ok: true };
  });
}

export async function portalAcceptQuoteAction(input: unknown): Promise<PortalResult> {
  return decide(input, "ACCEPTED");
}

export async function portalRefuseQuoteAction(input: unknown): Promise<PortalResult> {
  return decide(input, "REFUSED");
}
