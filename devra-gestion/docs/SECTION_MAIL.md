# Section Mail

La section **Mail** (menu de gauche) sert à écrire aux clients depuis l'outil et à lire leurs
réponses, rangées par client.

- **Écrire** : Mail → « Nouvel email », ou fiche du client → carte « Mails » → « Écrire ».
  Objet, message, pièces jointes (5 fichiers, 20 Mo au total). La signature de l'entreprise
  (Paramètres → Entreprise) est ajoutée automatiquement.
- **Répondre** : dans la conversation d'un client, le formulaire du bas reprend l'objet
  (« Re: … ») et garde le fil de la conversation.
- **Réponses des clients** : tout email arrivé dans la boîte relevée depuis l'adresse d'un client
  enregistré (champ « Email » de sa fiche) apparaît dans sa conversation, avec ses pièces jointes.
  Les autres emails de la boîte (publicités, fournisseurs…) sont ignorés.
- **Non lus** : petit carré blanc dans le menu « Mail » et dans la liste ; notification sur
  l'ordinateur et le téléphone (applications) à chaque nouvel email d'un client.
- **Fiche client** : carte « Mails » avec les derniers emails échangés.
- **Droits** : membres et admins écrivent ; la lecture seule consulte.

Le texte des emails reçus est affiché tel quel (sans mise en forme HTML, pour la sécurité) ; le
message cité sous une réponse se déplie avec « Afficher le message cité ».

## Fonctionnement

- Les emails partent par le serveur d'envoi déjà configuré (`SMTP_*` dans `.env`), avec
  l'adresse de la boîte relevée en **« Répondre à »** : les réponses des clients y arrivent.
- Le conteneur `cron` relève la boîte **toutes les 2 minutes** (`MAIL_MINUTES`), en IMAP. La
  relève **ne supprime rien et ne marque rien comme lu** : la boîte reste utilisable normalement
  (Gmail, Outlook, téléphone). Bouton « Relever les mails » pour une relève immédiate.
- Première relève : les emails des clients des 60 derniers jours ; ensuite, seulement les
  nouveaux.
- Copie dans « Envoyés » : Gmail l'enregistre déjà quand il sert aussi à envoyer ; avec un autre
  serveur d'envoi, l'outil dépose une copie dans le dossier « Envoyés » de la boîte
  (`IMAP_SAVE_SENT`).
- Les emails et leurs pièces jointes sont gardés dans l'outil (et donc dans les sauvegardes) ;
  supprimer un client supprime ses emails.

## Mise en place (administrateur, une fois)

### 1. Mot de passe d'application Google (boîte Gmail)

Gmail refuse le mot de passe du compte aux logiciels : il faut un « mot de passe
d'application ».

1. Se connecter au compte Google de la boîte, ouvrir <https://myaccount.google.com/security> et
   activer la **Validation en deux étapes** si ce n'est pas fait.
2. Ouvrir <https://myaccount.google.com/apppasswords>, saisir le nom « Gestion », cliquer sur
   **Créer**.
3. Copier les **16 lettres** affichées (les espaces ne comptent pas). Ce mot de passe ne donne
   accès qu'aux emails ; il se révoque à tout moment depuis la même page.

### 2. Configuration sur le serveur

L'agent dépose le kit à jour (voir [DEPLOIEMENT_SERVEUR.md](DEPLOIEMENT_SERVEUR.md), étape 1),
puis l'administrateur lance, en root :

```bash
sudo bash /home/claude/devra-gestion-kit/deploy/serveur/boite-mail.sh
```

Le script demande l'adresse de la boîte, le serveur IMAP (`imap.gmail.com` proposé pour Gmail)
et le mot de passe d'application (saisie masquée), les écrit dans `/opt/devra-gestion/.env`,
redémarre l'application et lance une première relève. Si elle échoue (mot de passe refusé…), la
configuration est annulée et le message d'erreur est affiché.

Autre fournisseur (Infomaniak, Outlook…) : même script, avec son serveur IMAP (ex.
`mail.infomaniak.com`) et le mot de passe de la boîte.

### Envoyer depuis cette même adresse (facultatif)

Les emails partent avec l'expéditeur `SMTP_FROM`. Pour qu'ils partent aussi de l'adresse Gmail,
mettre dans `.env` : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`,
`SMTP_USER=<adresse Gmail>`, `SMTP_PASSWORD=<mot de passe d'application>` et
`SMTP_FROM=<Nom> <<adresse Gmail>>`, puis `sudo /usr/local/sbin/claude-devra start`. Cela vaut
alors pour tous les emails de l'outil (devis, factures, relances).

## En cas de problème

La page Mail affiche l'état de la relève (dernière relève, ou l'erreur) :

- « Identifiants refusés » : mot de passe d'application révoqué ou mal copié → en créer un
  nouveau et relancer `boite-mail.sh`.
- « Serveur injoignable » : vérifier le nom du serveur IMAP et l'accès à internet du serveur.
- Un email d'un client n'apparaît pas : vérifier que son adresse d'expédition est exactement celle
  de la fiche du client (champ « Email »).
