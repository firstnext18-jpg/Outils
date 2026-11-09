import { describe, expect, it } from "vitest";
import type { AppSettings } from "@/modules/settings/service";
import { brandingFooter } from "@/server/emails/branding";
import { renderDocumentEmail } from "@/server/emails/document-email";
import { renderSimpleEmail, type EmailBranding } from "@/server/emails/layout";

const branding: EmailBranding = {
  name: "Atelier Léman",
  footer: ["Rue du Lac 12, 1003 Lausanne", "contact@atelier.example · 021 555 00 00"],
  logo: null,
};

const LINK = "https://gestion.example.ch/devis-en-ligne/AbC_123-xyz";

const quoteEmail = (body: string) =>
  renderDocumentEmail({
    language: "FR",
    branding,
    subject: "Devis D-2026-004",
    body,
    summary: {
      title: "Devis D-2026-004",
      amount: "CHF 4'200.00",
      dateLabel: "Valable jusqu'au",
      date: "31.12.2026",
      attachmentLabel: "PDF joint",
    },
    onlineLink: { label: "Consulter le devis en ligne", url: LINK },
  });

describe("emails des documents", () => {
  it("garde le texte saisi tel quel et ajoute le récapitulatif en HTML", () => {
    const body = `Bonjour,\n\nVeuillez trouver ci-joint notre devis.\n\nVous pouvez l'accepter en ligne : ${LINK}\n\nMeilleures salutations\nAtelier Léman`;
    const { text, html } = quoteEmail(body);
    expect(text).toBe(body);
    expect(html).toContain('<html lang="fr">');
    expect(html).toContain('Devis <span style="white-space:nowrap;">D-2026-004</span>');
    expect(html).toContain("CHF 4&#39;200.00");
    expect(html).toContain(
      'Valable jusqu&#39;au <span style="white-space:nowrap;">31.12.2026</span> · PDF joint',
    );
    // Pied : coordonnées de l'entreprise.
    expect(html).toContain("Rue du Lac 12, 1003 Lausanne");
  });

  it("remplace le lien d'acceptation par un bouton, à sa place dans le texte", () => {
    const { html } = quoteEmail(`Bonjour,\n\nVous pouvez l'accepter en ligne : ${LINK}\n\nMerci.`);
    expect(html).toContain("Vous pouvez l&#39;accepter en ligne :</p>");
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain(">Consulter le devis en ligne</a>");
    expect(html.indexOf("Consulter le devis en ligne")).toBeLessThan(html.indexOf("Merci."));
    // Le lien n'apparaît plus en clair dans le texte du message.
    expect(html).not.toContain(`>${LINK}<`);
  });

  it("sans le lien dans le texte (retiré par l'utilisateur), pas de bouton", () => {
    const { html } = quoteEmail("Bonjour,\n\nVeuillez trouver ci-joint notre devis.");
    expect(html).not.toContain("Consulter le devis en ligne");
  });

  it("échappe le texte saisi et rend les autres adresses web cliquables", () => {
    const { html } = quoteEmail(
      '<script>alert("x")</script>\n\nNotre site : https://atelier.example/a?b=1&c=2.',
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain(
      '<a href="https://atelier.example/a?b=1&amp;c=2" style="color:#18181b;text-decoration:underline;word-break:break-all;">https://atelier.example/a?b=1&amp;c=2</a>.',
    );
  });

  it("affiche le logo joint, à sa taille, à la place du nom", () => {
    const { html } = renderDocumentEmail({
      language: "DE",
      branding: { ...branding, logo: { cid: "logo@test", width: 154, height: 48 } },
      subject: "Rechnung F-2026-001",
      body: "Guten Tag",
      summary: {
        title: "Rechnung F-2026-001",
        amount: "CHF 500.00",
        dateLabel: "Zahlbar bis",
        date: "24.11.2026",
        attachmentLabel: "PDF im Anhang",
      },
    });
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('src="cid:logo@test" width="154" height="48" alt="Atelier Léman"');
  });
});

describe("emails simples (invitation, mot de passe, notification)", () => {
  it("texte inchangé, bouton et lien de secours en HTML", () => {
    const url = "https://gestion.example.ch/reinitialiser?token=a&b";
    const { text, html } = renderSimpleEmail({
      branding,
      title: "Réinitialisation",
      greeting: "Bonjour Léa,",
      paragraphs: ["Vous avez demandé à réinitialiser votre mot de passe."],
      action: { label: "Choisir un nouveau mot de passe", url },
      footnote: "Sinon, ignorez cet email.",
    });
    expect(text).toBe(
      [
        "Bonjour Léa,",
        "",
        "Vous avez demandé à réinitialiser votre mot de passe.",
        "",
        `Choisir un nouveau mot de passe : ${url}`,
        "",
        "Sinon, ignorez cet email.",
        "",
        "— Atelier Léman",
      ].join("\n"),
    );
    expect(html).toContain('href="https://gestion.example.ch/reinitialiser?token=a&amp;b"');
    expect(html).toContain(">Choisir un nouveau mot de passe</a>");
    expect(html).toContain("Si le bouton ne fonctionne pas");
  });
});

describe("pied des emails", () => {
  const settings = {
    companyStreet: "Rue du Lac",
    companyStreetNumber: "12",
    companyPostalCode: "1003",
    companyCity: "Lausanne",
    companyEmail: "contact@atelier.example",
    companyPhone: "",
    companyWebsite: "atelier.example",
  } as AppSettings;

  it("assemble l'adresse et les contacts renseignés", () => {
    expect(brandingFooter(settings)).toEqual([
      "Rue du Lac 12, 1003 Lausanne",
      "contact@atelier.example · atelier.example",
    ]);
  });

  it("n'affiche rien pour une entreprise sans coordonnées", () => {
    expect(
      brandingFooter({
        ...settings,
        companyStreet: "",
        companyStreetNumber: "",
        companyPostalCode: "",
        companyCity: "",
        companyEmail: "",
        companyWebsite: "",
      }),
    ).toEqual([]);
  });
});
