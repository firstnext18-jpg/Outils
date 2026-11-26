import "server-only";
import { ImapFlow } from "imapflow";
import { env } from "@/server/env";

/**
 * Boîte mail relevée par la section Mail (IMAP, ex. Gmail avec un mot de passe
 * d'application). Configuration dans .env : IMAP_HOST, IMAP_USER, IMAP_PASSWORD…
 */
export function mailboxConfig() {
  const e = env();
  if (!e.IMAP_HOST || !e.IMAP_USER || !e.IMAP_PASSWORD) return null;
  return {
    host: e.IMAP_HOST,
    port: e.IMAP_PORT,
    secure: e.IMAP_SECURE,
    user: e.IMAP_USER,
    password: e.IMAP_PASSWORD,
    folder: e.IMAP_FOLDER,
  };
}

/** Adresse de la boîte relevée (« Répondre à » des emails envoyés), si c'est une adresse email. */
export function mailboxAddress(): string | null {
  const user = mailboxConfig()?.user ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user) ? user : null;
}

/** Ouvre une connexion à la boîte, exécute `task`, puis se déconnecte. */
export async function withMailbox<T>(task: (client: ImapFlow) => Promise<T>): Promise<T> {
  const config = mailboxConfig();
  if (!config) throw new Error("Boîte mail non configurée (IMAP_HOST, IMAP_USER, IMAP_PASSWORD).");
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    logger: false,
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    socketTimeout: 120_000,
  });
  // Erreur de connexion après coup : signalée par la tâche en cours, sans arrêter le serveur.
  client.on("error", (error: unknown) => console.error("Boîte mail (IMAP)", error));
  await client.connect();
  try {
    return await task(client);
  } finally {
    await client.logout().catch(() => client.close());
  }
}

/** Message d'erreur lisible pour l'équipe (identifiants refusés, serveur injoignable…). */
export function mailboxErrorMessage(error: unknown): string {
  const e = error as { authenticationFailed?: boolean; code?: string; message?: string };
  if (e?.authenticationFailed) {
    return "Identifiants refusés par la boîte mail (pour Gmail : mot de passe d'application).";
  }
  if (e?.code === "ENOTFOUND" || e?.code === "ECONNREFUSED" || e?.code === "ETIMEDOUT") {
    return `Serveur de la boîte mail injoignable (${e.code}).`;
  }
  return (e?.message || String(error)).slice(0, 300);
}
