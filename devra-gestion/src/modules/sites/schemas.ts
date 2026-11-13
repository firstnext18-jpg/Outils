import { z } from "zod";
import { isValidIsoDate } from "@/domain/dates";
import { domainFromUrl, normalizeSiteUrl } from "@/domain/sites";

const id = z.uuid("Identifiant invalide");
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || isValidIsoDate(v), "Date invalide")
  .transform((v) => v || null);

export const siteInputSchema = z
  .object({
    clientId: z.uuid("Choisissez un client"),
    name: z
      .string()
      .trim()
      .min(1, "Indiquez un nom (ex. Site vitrine)")
      .max(120, "120 caractères maximum"),
    url: z.string().trim().max(500),
    domain: z.string().trim().toLowerCase().max(253),
    registrar: z.string().trim().max(120),
    domainExpiresAt: optionalDate,
    domainExpiryAuto: z.boolean(),
    hostingProvider: z.string().trim().max(120),
    hostingRenewsAt: optionalDate,
    notes: z.string().trim().max(2000),
    monitor: z.boolean(),
    showStatusToClient: z.boolean(),
  })
  .superRefine((site, ctx) => {
    if (!normalizeSiteUrl(site.url)) {
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "Adresse invalide (ex. https://www.exemple.ch)",
      });
    }
    if (site.domain && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site.domain)) {
      ctx.addIssue({
        code: "custom",
        path: ["domain"],
        message: "Nom de domaine invalide (ex. exemple.ch)",
      });
    }
  })
  .transform((site) => {
    const url = normalizeSiteUrl(site.url) ?? site.url;
    return { ...site, url, domain: site.domain || domainFromUrl(url) };
  });
export type SiteInput = z.input<typeof siteInputSchema>;
export type SiteData = z.output<typeof siteInputSchema>;

export const createSiteSchema = z.object({ site: siteInputSchema });
export const updateSiteSchema = z.object({ id, site: siteInputSchema });
export const siteIdSchema = z.object({ id });
