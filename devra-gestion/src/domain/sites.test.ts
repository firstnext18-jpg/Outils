import { describe, expect, it } from "vitest";
import { buildIcs, icsText } from "@/domain/ics";
import { monthGrid, parseMonth, shiftMonth } from "@/domain/calendar";
import {
  daysUntil,
  domainFromUrl,
  isUpStatus,
  normalizeSiteUrl,
  siteRenewals,
  uptimePercent,
} from "@/domain/sites";

describe("sites des clients", () => {
  it("complète et valide l'adresse surveillée", () => {
    expect(normalizeSiteUrl("atelier.ch")).toBe("https://atelier.ch");
    expect(normalizeSiteUrl("http://www.atelier.ch/")).toBe("http://www.atelier.ch");
    expect(normalizeSiteUrl("https://atelier.ch/boutique")).toBe("https://atelier.ch/boutique");
    expect(normalizeSiteUrl("pas une adresse")).toBeNull();
    expect(normalizeSiteUrl("ftp://atelier.ch")).toBeNull();
  });

  it("déduit le nom de domaine", () => {
    expect(domainFromUrl("https://www.atelier.ch")).toBe("atelier.ch");
    expect(domainFromUrl("https://shop.atelier.ch/panier")).toBe("atelier.ch");
    expect(domainFromUrl("https://www.example.co.uk")).toBe("example.co.uk");
  });

  it("considère en ligne les réponses correctes et les pages protégées", () => {
    expect(isUpStatus(200)).toBe(true);
    expect(isUpStatus(301)).toBe(true);
    expect(isUpStatus(401)).toBe(true);
    expect(isUpStatus(404)).toBe(false);
    expect(isUpStatus(503)).toBe(false);
  });

  it("calcule la disponibilité sur une période", () => {
    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-11T00:00:00Z");
    expect(uptimePercent([], from, to)).toBe(100);
    // 1 jour d'arrêt sur 10 jours.
    expect(
      uptimePercent(
        [
          {
            startedAt: new Date("2026-11-05T00:00:00Z"),
            endedAt: new Date("2026-11-06T00:00:00Z"),
          },
        ],
        from,
        to,
      ),
    ).toBe(90);
    // Incident en cours depuis 12 heures.
    expect(
      uptimePercent([{ startedAt: new Date("2026-11-10T12:00:00Z"), endedAt: null }], from, to),
    ).toBe(95);
  });

  it("compte les jours jusqu'à une échéance", () => {
    expect(daysUntil("2026-12-01", "2026-11-01")).toBe(30);
    expect(daysUntil("2026-10-30", "2026-11-01")).toBe(-2);
  });
});

describe("calendrier iCalendar", () => {
  it("échappe le texte", () => {
    expect(icsText("Devis D-1, client; test\nligne")).toBe("Devis D-1\\, client\\; test\\nligne");
  });

  it("produit des événements « journée entière »", () => {
    const ics = buildIcs(
      [
        {
          uid: "facture-1@gestion",
          date: "2026-11-30",
          title: "Échéance F-2026-001",
          url: "https://g.example/f/1",
        },
      ],
      { name: "Gestion", now: new Date("2026-11-13T10:00:00Z") },
    );
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261130\r\nDTEND;VALUE=DATE:20261201");
    expect(ics).toContain("SUMMARY:Échéance F-2026-001");
    expect(ics).toContain("DTSTAMP:20261113T100000Z");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("coupe les lignes trop longues", () => {
    const ics = buildIcs([{ uid: "x", date: "2026-11-30", title: "é".repeat(60) }], { name: "G" });
    const summary = ics.split("\r\n").filter((l) => l.startsWith("SUMMARY") || l.startsWith(" "));
    expect(summary.length).toBeGreaterThan(1);
    for (const line of summary)
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("échéances d'un site", () => {
  it("trie domaine, hébergement et certificat, la plus proche d'abord", () => {
    const renewals = siteRenewals(
      { domainExpiresAt: "2027-03-01", hostingRenewsAt: null, sslExpiresAt: "2026-12-01" },
      "2026-11-13",
    );
    expect(renewals.map((r) => [r.kind, r.days])).toEqual([
      ["ssl", 18],
      ["domain", 108],
    ]);
  });
});

describe("calendrier", () => {
  it("grille du mois en semaines complètes, du lundi au dimanche", () => {
    // Novembre 2026 : commence un dimanche, finit un lundi.
    const days = monthGrid("2026-11-01");
    expect(days[0]).toBe("2026-10-26");
    expect(days.at(-1)).toBe("2026-12-06");
    expect(days.length % 7).toBe(0);
    // Février 2027 : commence un lundi, finit un dimanche (4 semaines pile).
    expect(monthGrid("2027-02-01")).toHaveLength(28);
  });

  it("lit et décale les mois", () => {
    expect(parseMonth("2026-11")).toBe("2026-11-01");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth(["2026-11"])).toBeNull();
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
  });
});
