/**
 * Textes de la page publique d'acceptation des devis, dans la langue du devis.
 * Le type de DE impose exactement les mêmes clés qu'en français.
 */
const FR = {
  pageTitle: "Devis {number}",
  sentBy: "Devis de {company}",
  downloadPdf: "Télécharger le PDF",
  lines: "Prestations",
  conditions: "Conditions",
  acceptTitle: "Accepter le devis",
  acceptHelp:
    "En acceptant ce devis, vous confirmez la commande des prestations ci-dessus, aux conditions indiquées.",
  name: "Nom et prénom",
  agree: "J'ai lu ce devis et j'en accepte les conditions",
  acceptButton: "Accepter le devis",
  refuseToggle: "Je ne souhaite pas donner suite à ce devis",
  refuseTitle: "Refuser le devis",
  comment: "Commentaire (facultatif)",
  refuseButton: "Refuser le devis",
  back: "Retour",
  validUntilNotice: "Ce devis est valable jusqu'au {date}.",
  accepted: "Devis accepté le {date} par {name}. Merci pour votre confiance !",
  acceptedOffline: "Ce devis a été accepté. Merci pour votre confiance !",
  refused: "Ce devis a été refusé le {date}.",
  expired:
    "Ce devis n'est plus valable depuis le {date}. Contactez-nous pour en recevoir un nouveau.",
  unavailable:
    "Ce devis est en cours de modification : vous recevrez prochainement une nouvelle version.",
  contact: "Une question ? Contactez-nous : {contact}",
  closedError: "Ce devis ne peut plus être accepté ou refusé en ligne. Rechargez la page.",
  invalidLink: "Ce lien n'est pas valable ou a expiré.",
  notFoundTitle: "Lien non valable",
  notFoundText:
    "Ce lien n'est pas valable ou a expiré. Contactez l'expéditeur du devis pour en recevoir un nouveau.",
  sending: "Envoi…",
  nameRequired: "Indiquez votre nom et prénom.",
  agreeRequired: "Cochez la case pour accepter le devis.",
  commentTooLong: "Le commentaire est trop long (1000 caractères au plus).",
};

export type OnlineQuoteTexts = typeof FR;

const DE: OnlineQuoteTexts = {
  pageTitle: "Offerte {number}",
  sentBy: "Offerte von {company}",
  downloadPdf: "PDF herunterladen",
  lines: "Leistungen",
  conditions: "Bedingungen",
  acceptTitle: "Offerte annehmen",
  acceptHelp:
    "Mit der Annahme dieser Offerte bestellen Sie die oben aufgeführten Leistungen zu den angegebenen Bedingungen.",
  name: "Vor- und Nachname",
  agree: "Ich habe die Offerte gelesen und akzeptiere die Bedingungen",
  acceptButton: "Offerte annehmen",
  refuseToggle: "Ich möchte diese Offerte nicht annehmen",
  refuseTitle: "Offerte ablehnen",
  comment: "Kommentar (optional)",
  refuseButton: "Offerte ablehnen",
  back: "Zurück",
  validUntilNotice: "Diese Offerte ist gültig bis {date}.",
  accepted: "Offerte am {date} von {name} angenommen. Vielen Dank für Ihr Vertrauen!",
  acceptedOffline: "Diese Offerte wurde angenommen. Vielen Dank für Ihr Vertrauen!",
  refused: "Diese Offerte wurde am {date} abgelehnt.",
  expired:
    "Diese Offerte ist seit dem {date} nicht mehr gültig. Kontaktieren Sie uns für eine neue Offerte.",
  unavailable: "Diese Offerte wird gerade überarbeitet: Sie erhalten in Kürze eine neue Version.",
  contact: "Fragen? Kontaktieren Sie uns: {contact}",
  closedError:
    "Diese Offerte kann nicht mehr online angenommen oder abgelehnt werden. Laden Sie die Seite neu.",
  invalidLink: "Dieser Link ist ungültig oder abgelaufen.",
  notFoundTitle: "Ungültiger Link",
  notFoundText:
    "Dieser Link ist ungültig oder abgelaufen. Bitte wenden Sie sich an den Absender der Offerte.",
  sending: "Wird gesendet…",
  nameRequired: "Bitte geben Sie Ihren Vor- und Nachnamen an.",
  agreeRequired: "Bitte bestätigen Sie, dass Sie die Offerte annehmen.",
  commentTooLong: "Der Kommentar ist zu lang (höchstens 1000 Zeichen).",
};

export function onlineQuoteTexts(language: "FR" | "DE"): OnlineQuoteTexts {
  return language === "DE" ? DE : FR;
}
