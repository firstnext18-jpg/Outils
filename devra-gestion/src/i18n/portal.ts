/**
 * Textes de l'espace client, dans la langue du client (fiche client → Langue).
 * Le type de DE impose exactement les mêmes clés qu'en français.
 */
const FR = {
  portalTitle: "Espace client",
  otherLanguage: "Deutsch",

  // Connexion
  loginDescription: "Consultez vos devis, vos factures et vos abonnements, et écrivez-nous.",
  login: "Identifiant",
  password: "Mot de passe",
  forgotPassword: "Mot de passe oublié ?",
  signIn: "Se connecter",
  signingIn: "Connexion…",
  loginRequired: "Saisissez votre identifiant.",
  passwordRequired: "Saisissez votre mot de passe.",
  invalidCredentials: "Identifiant ou mot de passe incorrect.",
  accessDisabled: "Votre accès à l'espace client est désactivé. Contactez-nous.",
  tooManyAttempts: "Trop de tentatives. Patientez quelques minutes, puis réessayez.",
  passwordResetDone: "Votre mot de passe a été modifié. Connectez-vous avec le nouveau.",
  noAccessHelp: "Pas encore d'accès ? Contactez-nous : {contact}",

  // Mot de passe oublié
  forgotTitle: "Mot de passe oublié",
  forgotHelp:
    "Indiquez votre identifiant ou votre adresse email : nous vous enverrons un lien pour choisir un nouveau mot de passe.",
  loginOrEmail: "Identifiant ou email",
  loginOrEmailRequired: "Saisissez votre identifiant ou votre adresse email.",
  sendLink: "Envoyer le lien",
  sending: "Envoi…",
  forgotSent:
    "Si un accès correspond, un email vient de vous être envoyé. Pensez à vérifier le dossier des indésirables.",
  backToLogin: "Retour à la connexion",

  // Nouveau mot de passe
  resetTitle: "Nouveau mot de passe",
  newPassword: "Nouveau mot de passe",
  confirmPassword: "Confirmation",
  savePassword: "Enregistrer le mot de passe",
  saving: "Enregistrement…",
  passwordTooShort: "{min} caractères minimum.",
  passwordTooLong: "{max} caractères maximum.",
  passwordMismatch: "Les deux mots de passe ne correspondent pas.",
  resetInvalid: "Ce lien n'est pas valable ou a expiré. Demandez-en un nouveau.",
  newLink: "Demander un nouveau lien",

  // Navigation
  navHome: "Accueil",
  navQuotes: "Devis",
  navInvoices: "Factures",
  navSubscriptions: "Abonnements",
  navDiscussion: "Discussion",
  navAccount: "Mon compte",
  signOut: "Se déconnecter",
  menu: "Menu",

  // Accueil
  welcome: "Bonjour {name}",
  toPayTitle: "À payer",
  toPayTotal: "Total à payer",
  nothingToPay: "Rien à payer pour le moment. Merci !",
  dueOn: "À payer d'ici au {date}",
  overdueSince: "En retard, échéance le {date}",
  payHelp: "Payez avec la QR-facture du PDF, ou par virement avec ces informations :",
  paymentAccount: "Compte",
  paymentReference: "Référence",
  paymentAmount: "Montant",
  quotesWaiting: "Devis en attente de votre réponse",
  newMessagesOne: "1 nouveau message de notre équipe",
  newMessagesMany: "{count} nouveaux messages de notre équipe",
  readMessages: "Lire",
  activeSubscriptions: "Abonnements en cours",
  seeAll: "Tout voir",

  // Listes
  number: "N°",
  date: "Date",
  subject: "Objet",
  amount: "Montant",
  balance: "Solde",
  status: "Statut",
  dueDate: "Échéance",
  validUntil: "Valable jusqu'au",
  downloadPdf: "Télécharger le PDF",
  open: "Ouvrir",
  noQuotes: "Aucun devis pour l'instant.",
  noInvoices: "Aucune facture pour l'instant.",
  noSubscriptions: "Aucun abonnement.",
  quotesHelp: "Vos devis : consultez-les, téléchargez-les et donnez-nous votre réponse en ligne.",
  invoicesHelp: "Vos factures et leur état de paiement.",
  subscriptionsHelp: "Vos abonnements (hébergement, maintenance…) et leur prochaine facture.",

  quoteSent: "En attente de votre réponse",
  quoteAccepted: "Accepté",
  quoteRefused: "Refusé",
  quoteExpired: "Expiré",

  invoiceOpen: "À payer",
  invoicePartiallyPaid: "Partiellement payée",
  invoicePaid: "Payée",
  invoiceCancelled: "Annulée",
  invoiceOverdue: "En retard",

  subscriptionActive: "Actif",
  subscriptionPaused: "En pause",
  subscriptionCancelled: "Résilié",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  yearly: "Annuel",
  perPeriod: "Montant par période",
  nextInvoice: "Prochaine facture le {date}",
  since: "Depuis le {date}",
  endedOn: "Résilié au {date}",
  exclVat: "hors TVA",

  // Devis
  backToQuotes: "← Devis",

  // Discussion
  discussionTitle: "Discussion avec {company}",
  discussionHelp:
    "Posez-nous vos questions ici : notre équipe vous répond dans les meilleurs délais.",
  messages: "Messages",
  messageLabel: "Votre message",
  messagePlaceholder: "Écrire un message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)",
  send: "Envoyer",
  noMessages: "Aucun message pour l'instant. Écrivez-nous !",
  you: "Vous",
  readByTeam: "Lu par l'équipe",
  notReadYet: "Pas encore lu",
  messageRequired: "Écrivez un message.",
  messageTooLong: "Message trop long ({max} caractères au plus).",

  // Mon compte
  accountTitle: "Mon compte",
  yourLogin: "Votre identifiant",
  changePassword: "Changer le mot de passe",
  changePasswordHelp:
    "Choisissez un mot de passe d'au moins {min} caractères. Les autres appareils connectés seront déconnectés.",
  currentPassword: "Mot de passe actuel",
  wrongPassword: "Le mot de passe actuel est incorrect.",
  passwordChanged: "Votre mot de passe a été modifié.",

  // Projets
  navProjects: "Projets",
  projectsHelp: "L'avancement de vos projets, étape par étape.",
  noProjects: "Aucun projet pour l'instant.",
  projectActive: "En cours",
  projectPaused: "En pause",
  projectDone: "Terminé",
  stepsDone: "{done} étape(s) terminée(s) sur {total}",
  projectDue: "Échéance : {date}",
  timeSpent: "Temps passé : {time}",
  timeBudget: "{time} sur {budget} prévues",
  hoursDetail: "Détail des heures",
  projectsProgress: "Avancement de vos projets",
  stepDoneOn: "terminée le {date}",

  // Fichiers
  navFiles: "Fichiers",
  filesHelp: "Les documents que nous partageons avec vous, et ceux que vous nous envoyez.",
  noFiles: "Aucun fichier pour l'instant.",
  sendFiles: "Envoyer des fichiers",
  filesSent: "Fichiers envoyés. Merci !",
  sentByYou: "Envoyé par vous",
  tooManyFiles: "{max} fichiers au plus à la fois.",
  fileTooBig: "« {name} » dépasse {max}.",
  fileEmpty: "« {name} » est vide.",
  attachFiles: "Joindre des fichiers",
  removeFile: "Retirer {name}",

  // Erreurs
  genericError: "Une erreur est survenue. Réessayez dans un instant.",
  sessionExpired: "Votre session a expiré. Reconnectez-vous.",
  quoteNotFound: "Ce devis n'existe pas ou n'est plus disponible.",

  // Emails
  emailGreeting: "Bonjour,",
  credentialsSubject: "{company} — Votre accès à l'espace client",
  credentialsIntro:
    "Vous avez désormais accès à votre espace client : vous pouvez y consulter vos devis, vos factures et vos abonnements, et nous écrire.",
  credentialsChange: "Vous pourrez changer ce mot de passe dans « Mon compte », une fois connecté.",
  credentialsKeep:
    "Conservez cet email en lieu sûr, ou supprimez-le après avoir changé votre mot de passe.",
  openPortal: "Ouvrir mon espace client",
  address: "Adresse",
  messageSubject: "{company} — Nouveau message dans votre espace client",
  messageIntro: "{author} vous a écrit dans votre espace client :",
  messageOutro: "Connectez-vous pour lire la suite et nous répondre.",
  readMessage: "Lire le message",
  resetSubject: "{company} — Nouveau mot de passe pour votre espace client",
  resetIntro:
    "Vous avez demandé à choisir un nouveau mot de passe pour votre espace client (identifiant : {login}).",
  resetValidity: "Ce lien est valable 1 heure et ne peut être utilisé qu'une seule fois.",
  resetAction: "Choisir un nouveau mot de passe",
  resetIgnore: "Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email.",
};

export type PortalTexts = typeof FR;

const DE: PortalTexts = {
  portalTitle: "Kundenportal",
  otherLanguage: "Français",

  loginDescription:
    "Sehen Sie Ihre Offerten, Rechnungen und Abonnemente ein und schreiben Sie uns.",
  login: "Benutzername",
  password: "Passwort",
  forgotPassword: "Passwort vergessen?",
  signIn: "Anmelden",
  signingIn: "Anmeldung…",
  loginRequired: "Bitte geben Sie Ihren Benutzernamen ein.",
  passwordRequired: "Bitte geben Sie Ihr Passwort ein.",
  invalidCredentials: "Benutzername oder Passwort falsch.",
  accessDisabled: "Ihr Zugang zum Kundenportal ist deaktiviert. Bitte kontaktieren Sie uns.",
  tooManyAttempts:
    "Zu viele Versuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut.",
  passwordResetDone: "Ihr Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.",
  noAccessHelp: "Noch kein Zugang? Kontaktieren Sie uns: {contact}",

  forgotTitle: "Passwort vergessen",
  forgotHelp:
    "Geben Sie Ihren Benutzernamen oder Ihre E-Mail-Adresse ein: Wir senden Ihnen einen Link, um ein neues Passwort festzulegen.",
  loginOrEmail: "Benutzername oder E-Mail",
  loginOrEmailRequired: "Bitte geben Sie Ihren Benutzernamen oder Ihre E-Mail-Adresse ein.",
  sendLink: "Link senden",
  sending: "Wird gesendet…",
  forgotSent:
    "Falls ein Zugang dazu passt, haben wir Ihnen soeben eine E-Mail gesendet. Bitte prüfen Sie auch Ihren Spam-Ordner.",
  backToLogin: "Zurück zur Anmeldung",

  resetTitle: "Neues Passwort",
  newPassword: "Neues Passwort",
  confirmPassword: "Bestätigung",
  savePassword: "Passwort speichern",
  saving: "Wird gespeichert…",
  passwordTooShort: "Mindestens {min} Zeichen.",
  passwordTooLong: "Höchstens {max} Zeichen.",
  passwordMismatch: "Die beiden Passwörter stimmen nicht überein.",
  resetInvalid: "Dieser Link ist ungültig oder abgelaufen. Fordern Sie einen neuen an.",
  newLink: "Neuen Link anfordern",

  navHome: "Übersicht",
  navQuotes: "Offerten",
  navInvoices: "Rechnungen",
  navSubscriptions: "Abonnemente",
  navDiscussion: "Nachrichten",
  navAccount: "Mein Konto",
  signOut: "Abmelden",
  menu: "Menü",

  welcome: "Guten Tag {name}",
  toPayTitle: "Zu bezahlen",
  toPayTotal: "Total zu bezahlen",
  nothingToPay: "Zurzeit ist nichts zu bezahlen. Vielen Dank!",
  dueOn: "Zahlbar bis {date}",
  overdueSince: "Überfällig, fällig am {date}",
  payHelp: "Bezahlen Sie mit der QR-Rechnung im PDF oder per Überweisung mit diesen Angaben:",
  paymentAccount: "Konto",
  paymentReference: "Referenz",
  paymentAmount: "Betrag",
  quotesWaiting: "Offerten, die auf Ihre Antwort warten",
  newMessagesOne: "1 neue Nachricht von unserem Team",
  newMessagesMany: "{count} neue Nachrichten von unserem Team",
  readMessages: "Lesen",
  activeSubscriptions: "Laufende Abonnemente",
  seeAll: "Alle anzeigen",

  number: "Nr.",
  date: "Datum",
  subject: "Betreff",
  amount: "Betrag",
  balance: "Offen",
  status: "Status",
  dueDate: "Fällig",
  validUntil: "Gültig bis",
  downloadPdf: "PDF herunterladen",
  open: "Öffnen",
  noQuotes: "Noch keine Offerten.",
  noInvoices: "Noch keine Rechnungen.",
  noSubscriptions: "Keine Abonnemente.",
  quotesHelp: "Ihre Offerten: ansehen, herunterladen und uns online Ihre Antwort geben.",
  invoicesHelp: "Ihre Rechnungen und ihr Zahlungsstand.",
  subscriptionsHelp: "Ihre Abonnemente (Hosting, Wartung…) und ihre nächste Rechnung.",

  quoteSent: "Wartet auf Ihre Antwort",
  quoteAccepted: "Angenommen",
  quoteRefused: "Abgelehnt",
  quoteExpired: "Abgelaufen",

  invoiceOpen: "Offen",
  invoicePartiallyPaid: "Teilweise bezahlt",
  invoicePaid: "Bezahlt",
  invoiceCancelled: "Storniert",
  invoiceOverdue: "Überfällig",

  subscriptionActive: "Aktiv",
  subscriptionPaused: "Pausiert",
  subscriptionCancelled: "Gekündigt",
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  yearly: "Jährlich",
  perPeriod: "Betrag pro Periode",
  nextInvoice: "Nächste Rechnung am {date}",
  since: "Seit {date}",
  endedOn: "Gekündigt per {date}",
  exclVat: "exkl. MWST",

  backToQuotes: "← Offerten",

  discussionTitle: "Nachrichten mit {company}",
  discussionHelp:
    "Stellen Sie uns hier Ihre Fragen: Unser Team antwortet Ihnen so rasch wie möglich.",
  messages: "Nachrichten",
  messageLabel: "Ihre Nachricht",
  messagePlaceholder: "Nachricht schreiben… (Enter zum Senden, Umschalt+Enter für eine neue Zeile)",
  send: "Senden",
  noMessages: "Noch keine Nachrichten. Schreiben Sie uns!",
  you: "Sie",
  readByTeam: "Vom Team gelesen",
  notReadYet: "Noch nicht gelesen",
  messageRequired: "Bitte schreiben Sie eine Nachricht.",
  messageTooLong: "Nachricht zu lang (höchstens {max} Zeichen).",

  accountTitle: "Mein Konto",
  yourLogin: "Ihr Benutzername",
  changePassword: "Passwort ändern",
  changePasswordHelp:
    "Wählen Sie ein Passwort mit mindestens {min} Zeichen. Andere angemeldete Geräte werden abgemeldet.",
  currentPassword: "Aktuelles Passwort",
  wrongPassword: "Das aktuelle Passwort ist falsch.",
  passwordChanged: "Ihr Passwort wurde geändert.",

  navProjects: "Projekte",
  projectsHelp: "Der Fortschritt Ihrer Projekte, Schritt für Schritt.",
  noProjects: "Noch keine Projekte.",
  projectActive: "In Arbeit",
  projectPaused: "Pausiert",
  projectDone: "Abgeschlossen",
  stepsDone: "{done} von {total} Schritten erledigt",
  projectDue: "Termin: {date}",
  timeSpent: "Aufgewendete Zeit: {time}",
  timeBudget: "{time} von {budget} geplant",
  hoursDetail: "Stundendetails",
  projectsProgress: "Fortschritt Ihrer Projekte",
  stepDoneOn: "erledigt am {date}",

  navFiles: "Dateien",
  filesHelp: "Die Dokumente, die wir mit Ihnen teilen, und die Dateien, die Sie uns senden.",
  noFiles: "Noch keine Dateien.",
  sendFiles: "Dateien senden",
  filesSent: "Dateien gesendet. Vielen Dank!",
  sentByYou: "Von Ihnen gesendet",
  tooManyFiles: "Höchstens {max} Dateien auf einmal.",
  fileTooBig: "«{name}» ist grösser als {max}.",
  fileEmpty: "«{name}» ist leer.",
  attachFiles: "Dateien anhängen",
  removeFile: "{name} entfernen",

  genericError: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es in einem Moment erneut.",
  sessionExpired: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  quoteNotFound: "Diese Offerte existiert nicht oder ist nicht mehr verfügbar.",

  emailGreeting: "Guten Tag",
  credentialsSubject: "{company} — Ihr Zugang zum Kundenportal",
  credentialsIntro:
    "Ab sofort haben Sie Zugang zu Ihrem Kundenportal: Dort können Sie Ihre Offerten, Rechnungen und Abonnemente einsehen und uns schreiben.",
  credentialsChange: "Sie können dieses Passwort nach der Anmeldung unter «Mein Konto» ändern.",
  credentialsKeep:
    "Bewahren Sie diese E-Mail sicher auf oder löschen Sie sie, nachdem Sie Ihr Passwort geändert haben.",
  openPortal: "Kundenportal öffnen",
  address: "Adresse",
  messageSubject: "{company} — Neue Nachricht in Ihrem Kundenportal",
  messageIntro: "{author} hat Ihnen in Ihrem Kundenportal geschrieben:",
  messageOutro: "Melden Sie sich an, um weiterzulesen und uns zu antworten.",
  readMessage: "Nachricht lesen",
  resetSubject: "{company} — Neues Passwort für Ihr Kundenportal",
  resetIntro:
    "Sie haben ein neues Passwort für Ihr Kundenportal angefordert (Benutzername: {login}).",
  resetValidity: "Dieser Link ist 1 Stunde gültig und kann nur einmal verwendet werden.",
  resetAction: "Neues Passwort festlegen",
  resetIgnore: "Falls Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.",
};

export type PortalLanguage = "FR" | "DE";

export function portalTexts(language: PortalLanguage): PortalTexts {
  return language === "DE" ? DE : FR;
}

/**
 * Langue des pages de connexion (le client n'est pas encore identifié) :
 * celle demandée dans l'adresse (?langue=de), sinon celle du navigateur.
 */
export function loginLanguage(param: unknown, acceptLanguage: string | null): PortalLanguage {
  if (param === "de") return "DE";
  if (param === "fr") return "FR";
  const preferred = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return preferred.startsWith("de") ? "DE" : "FR";
}

/** Erreur de taille ou de nombre de fichiers, dans la langue du client (ou `null`). */
export function portalUploadProblem(
  t: PortalTexts,
  files: { name: string; size: number }[],
  limits: { maxFiles: number; maxBytes: number; maxLabel: string },
): string | null {
  if (files.length > limits.maxFiles)
    return t.tooManyFiles.replace("{max}", String(limits.maxFiles));
  const tooBig = files.find((f) => f.size > limits.maxBytes);
  if (tooBig) return t.fileTooBig.replace("{name}", tooBig.name).replace("{max}", limits.maxLabel);
  const empty = files.find((f) => f.size === 0);
  if (empty) return t.fileEmpty.replace("{name}", empty.name);
  return null;
}
