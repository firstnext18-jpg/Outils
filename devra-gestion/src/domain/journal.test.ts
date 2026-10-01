import { describe, expect, it } from "vitest";
import { journalHref, journalSentence } from "@/domain/journal";

const sentence = (action: string, label: string | null, details: unknown = null) =>
  journalSentence({ action, label, details });

describe("phrases du journal d'activité", () => {
  it("nomme l'objet concerné", () => {
    expect(sentence("quote.emailed", "D-2026-004", { to: ["a@b.ch", "c@d.ch"] })).toBe(
      "a envoyé le devis D-2026-004 par email à a@b.ch, c@d.ch",
    );
    expect(sentence("quote.status_changed", "D-2026-004", { from: "SENT", to: "ACCEPTED" })).toBe(
      "a marqué le devis D-2026-004 comme accepté",
    );
    expect(sentence("invoice.issued", "F-2026-002")).toBe("a émis la facture F-2026-002");
    expect(
      sentence("payment.recorded", "F-2026-002", { amount: "CHF 990.00", method: "TWINT" }),
    ).toBe("a enregistré un paiement de CHF 990.00 (TWINT) sur la facture F-2026-002");
    expect(sentence("client.updated", "Café Lumière", { fields: ["adresse", "email"] })).toBe(
      "a modifié la fiche client « Café Lumière » : adresse, email",
    );
    expect(sentence("subscription.paused", "Hébergement")).toBe(
      "a mis l'abonnement « Hébergement » en pause",
    );
  });

  it("décrit les utilisateurs, les paramètres et les exports", () => {
    expect(sentence("user.invited", "lea@devra.ch", { role: "MEMBER" })).toBe(
      "a invité lea@devra.ch (Membre)",
    );
    expect(
      sentence("user.role_changed", "lea@devra.ch", { fromLabel: "Membre", toLabel: "Admin" }),
    ).toBe("a changé le rôle de lea@devra.ch : Membre → Admin");
    expect(sentence("settings.site_types_updated", "Blog", { operation: "deactivated" })).toBe(
      "a désactivé le type de site « Blog »",
    );
    expect(
      sentence("export.pdfs", null, { period: "du 01.01.2026 au 31.03.2026", count: 12 }),
    ).toBe("a téléchargé les PDF du 01.01.2026 au 31.03.2026 (12 fichier(s))");
  });

  it("distingue un brouillon de facture d'une facture émise", () => {
    expect(sentence("invoice.updated", "Brouillon de facture")).toBe(
      "a modifié un brouillon de facture",
    );
    expect(sentence("invoice.created", "Brouillon de facture", { fromQuote: "D-2026-001" })).toBe(
      "a créé une facture à partir du devis D-2026-001",
    );
  });

  it("garde une description pour une action inconnue", () => {
    expect(sentence("inconnue.action", null)).toBe("inconnue.action");
  });

  it("donne le lien de l'objet quand il a une page", () => {
    expect(journalHref("quote", "abc")).toBe("/devis/abc");
    expect(journalHref("invoice", "abc")).toBe("/factures/abc");
    expect(journalHref("settings", "abc")).toBeNull();
    expect(journalHref("client", null)).toBeNull();
  });
});
