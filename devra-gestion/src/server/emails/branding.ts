import "server-only";
import type Mail from "nodemailer/lib/mailer";
import { fitWithin, imageInfo } from "@/domain/image-size";
import { displayCompanyName, type AppSettings } from "@/modules/settings/service";
import type { EmailBranding } from "@/server/emails/layout";
import { readUpload } from "@/server/storage";

const LOGO_CID = "logo@devra-gestion";
/** Cadre du logo dans l'en-tête des emails, en pixels. */
const LOGO_BOX = { width: 200, height: 48 };

/** Coordonnées du pied : « Rue 12, 1003 Lausanne », puis « email · téléphone · site ». */
export function brandingFooter(settings: AppSettings): string[] {
  const street = [settings.companyStreet, settings.companyStreetNumber]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const city = [settings.companyPostalCode, settings.companyCity]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  const address = [street, city].filter(Boolean).join(", ");
  const contact = [settings.companyEmail, settings.companyPhone, settings.companyWebsite]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
  return [address, contact].filter(Boolean);
}

/**
 * Identité de l'entreprise pour les emails (Paramètres → Entreprise) et, si un
 * logo est enregistré, la pièce jointe « en ligne » qui l'affiche en tête.
 */
export async function emailBranding(
  settings: AppSettings,
): Promise<{ branding: EmailBranding; attachments: Mail.Attachment[] }> {
  const branding: EmailBranding = {
    name: displayCompanyName(settings),
    footer: brandingFooter(settings),
    logo: null,
  };
  const content = settings.logoFile ? await readUpload(settings.logoFile) : null;
  const info = content ? imageInfo(content) : null;
  if (!content || !info) return { branding, attachments: [] };

  branding.logo = { cid: LOGO_CID, ...fitWithin(info, LOGO_BOX) };
  return {
    branding,
    attachments: [
      {
        filename: `logo.${info.type === "png" ? "png" : "jpg"}`,
        content,
        contentType: info.type === "png" ? "image/png" : "image/jpeg",
        cid: LOGO_CID,
        contentDisposition: "inline",
      },
    ],
  };
}
