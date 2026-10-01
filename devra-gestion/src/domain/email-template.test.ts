import { describe, expect, it } from "vitest";
import {
  parseRecipients,
  renderTemplate,
  textToHtmlParagraphs,
  unknownVariables,
} from "@/domain/email-template";

describe("modèles d'emails", () => {
  it("remplace les variables fournies et garde les autres", () => {
    const template = "Facture {numero} de {montant}, payable d'ici au {echeance}. {inconnue}";
    expect(renderTemplate(template, { montant: "CHF 1'490.00", echeance: "16.10.2026" })).toBe(
      "Facture {numero} de CHF 1'490.00, payable d'ici au 16.10.2026. {inconnue}",
    );
    expect(renderTemplate("{numero} / {numero}", { numero: "F-2026-001" })).toBe(
      "F-2026-001 / F-2026-001",
    );
  });

  it("remplace une variable vide par du texte vide ({lien} sans acceptation en ligne)", () => {
    expect(renderTemplate("Lien : {lien}.", { lien: "" })).toBe("Lien : .");
  });

  it("repère les variables mal écrites", () => {
    expect(unknownVariables("Bonjour {client}, devis {numéro} {Nombre} {Nombre}")).toEqual([
      "numéro",
      "Nombre",
    ]);
    expect(
      unknownVariables("{client} {numero} {montant} {echeance} {date} {lien} {entreprise}"),
    ).toEqual([]);
  });
});

describe("destinataires", () => {
  it("accepte plusieurs adresses, sans doublon, en minuscules", () => {
    expect(parseRecipients(" Anna@Example.ch ; marc@example.ch, anna@example.ch ")).toEqual({
      emails: ["anna@example.ch", "marc@example.ch"],
    });
  });

  it("refuse une liste vide, une adresse invalide ou trop d'adresses", () => {
    expect(parseRecipients("  ")).toEqual({ error: "Indiquez au moins un destinataire" });
    expect(parseRecipients("anna@example.ch, pas-une-adresse")).toEqual({
      error: "Adresse email invalide : pas-une-adresse",
    });
    expect(parseRecipients("a@x.ch b@x.ch c@x.ch d@x.ch e@x.ch f@x.ch")).toEqual({
      error: "5 destinataires au maximum",
    });
  });
});

describe("texte → HTML", () => {
  it("découpe en paragraphes et protège les caractères spéciaux", () => {
    expect(textToHtmlParagraphs("Bonjour,\r\n\r\nLigne 1\nLigne <2>\n\n\nFin & merci")).toEqual([
      "Bonjour,",
      "Ligne 1<br>Ligne &lt;2&gt;",
      "Fin &amp; merci",
    ]);
  });
});
