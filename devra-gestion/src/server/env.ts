import { z } from "zod";

/**
 * Variables d'environnement, validées au premier accès (et non à l'import) pour
 * que `next build` fonctionne sans secrets. Voir `.env.example`.
 */
/** Texte facultatif : une valeur vide dans .env compte comme absente. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET doit contenir au moins 32 caractères"),
  DATABASE_URL: z.string().min(1),
  DATA_DIR: z.string().min(1).default("./data"),
  AUTH_IP_HEADER: z.string().min(1).default("x-forwarded-for"),
  AUTH_RATE_LIMIT: z.stringbool().default(true),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().min(1),
  /** Secret partagé avec le conteneur « cron » (route des tâches quotidiennes). */
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET doit contenir au moins 32 caractères")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  /**
   * Notifications Web Push (Windows, macOS, Android…) : paire de clés VAPID.
   * Facultatif : sans ces clés, les notifications sont simplement désactivées.
   */
  VAPID_PUBLIC_KEY: z.string().trim().optional(),
  VAPID_PRIVATE_KEY: z.string().trim().optional(),
  /** Contact transmis aux services de notification (https:// ou mailto:). */
  VAPID_SUBJECT: z.string().trim().optional(),
  /**
   * Section Mail : boîte relevée (IMAP) pour afficher les emails des clients.
   * Facultatif : sans elle, les emails partent mais les réponses ne sont pas relevées.
   */
  IMAP_HOST: optionalText,
  IMAP_PORT: z.coerce.number().int().positive().default(993),
  IMAP_SECURE: z.stringbool().default(true),
  IMAP_USER: optionalText,
  IMAP_PASSWORD: optionalText,
  IMAP_FOLDER: z.string().trim().min(1).default("INBOX"),
  /** Copie des emails envoyés dans « Envoyés » : auto (sauf Gmail, qui le fait déjà), oui, non. */
  IMAP_SAVE_SENT: z.enum(["auto", "oui", "non"]).default("auto"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")} : ${issue.message}`)
      .join("\n");
    throw new Error(`Configuration invalide (fichier .env) :\n${details}`);
  }
  cached = parsed.data;
  return cached;
}
