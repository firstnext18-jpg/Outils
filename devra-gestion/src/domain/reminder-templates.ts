/**
 * Textes des relances par défaut (modifiables dans Paramètres → Relances).
 * Le même texte sert de corps à l'email et de lettre sur le PDF de la relance.
 * Variables : voir src/domain/email-template.ts ({montant} = montant à payer,
 * frais de relance compris ; {echeance} = nouveau délai ; {date} = date de la facture).
 */
import type { ReminderLevel } from "@/domain/reminders";

export type ReminderTemplate = { subject: string; text: string };
export type ReminderTemplates = Record<
  `level${ReminderLevel}`,
  Record<"FR" | "DE", ReminderTemplate>
>;

export const DEFAULT_REMINDER_TEMPLATES: ReminderTemplates = {
  level1: {
    FR: {
      subject: "Rappel – facture {numero}",
      text: "Bonjour,\n\nSauf erreur de notre part, notre facture {numero} du {date} n'a pas encore été réglée. Nous vous serions reconnaissants de bien vouloir verser le montant de {montant} d'ici au {echeance}.\n\nSi votre paiement a croisé ce rappel, nous vous prions de ne pas en tenir compte.\n\nMeilleures salutations\n{entreprise}",
    },
    DE: {
      subject: "Zahlungserinnerung – Rechnung {numero}",
      text: "Guten Tag\n\nGemäss unserer Buchhaltung ist unsere Rechnung {numero} vom {date} noch offen. Wir bitten Sie, den Betrag von {montant} bis zum {echeance} zu überweisen.\n\nSollte sich Ihre Zahlung mit dieser Erinnerung gekreuzt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.\n\nFreundliche Grüsse\n{entreprise}",
    },
  },
  level2: {
    FR: {
      subject: "2e rappel – facture {numero}",
      text: "Bonjour,\n\nMalgré notre premier rappel, notre facture {numero} du {date} reste impayée. Nous vous prions de verser le montant de {montant} d'ici au {echeance}.\n\nSi vous rencontrez une difficulté, n'hésitez pas à nous contacter.\n\nMeilleures salutations\n{entreprise}",
    },
    DE: {
      subject: "2. Mahnung – Rechnung {numero}",
      text: "Guten Tag\n\nTrotz unserer Zahlungserinnerung ist unsere Rechnung {numero} vom {date} noch nicht beglichen. Wir bitten Sie, den Betrag von {montant} bis zum {echeance} zu überweisen.\n\nBei Fragen stehen wir Ihnen gerne zur Verfügung.\n\nFreundliche Grüsse\n{entreprise}",
    },
  },
  level3: {
    FR: {
      subject: "Mise en demeure – facture {numero}",
      text: "Madame, Monsieur,\n\nMalgré nos rappels, notre facture {numero} du {date} n'a toujours pas été réglée. Nous vous mettons en demeure de verser le montant de {montant} d'ici au {echeance}.\n\nSans paiement dans ce délai, nous nous réservons le droit d'engager une procédure de recouvrement, sans autre avis.\n\nMeilleures salutations\n{entreprise}",
    },
    DE: {
      subject: "Letzte Mahnung – Rechnung {numero}",
      text: "Sehr geehrte Damen und Herren\n\nTrotz unserer Mahnungen ist unsere Rechnung {numero} vom {date} noch immer offen. Wir fordern Sie letztmals auf, den Betrag von {montant} bis zum {echeance} zu überweisen.\n\nOhne Zahlungseingang innerhalb dieser Frist behalten wir uns vor, ohne weitere Mitteilung das Inkassoverfahren einzuleiten.\n\nFreundliche Grüsse\n{entreprise}",
    },
  },
};
