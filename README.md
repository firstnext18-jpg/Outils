# Jour après jour

Un petit outil du quotidien pour noter **ce qu'il y a à faire aujourd'hui** et **suivre ses habitudes** (boire de l'eau, bouger, lire…), jour après jour.

Il fonctionne dans n'importe quel navigateur, sur ordinateur comme sur téléphone, sans installation ni compte.

## Ce que ça fait

**À faire**
- Ajoutez une tâche, cochez-la quand c'est fait, supprimez-la avec ×. Une suppression peut être annulée pendant quelques secondes.
- Ce qui n'est pas fait passe automatiquement au lendemain, avec une étiquette « depuis hier », « depuis lundi »…
- Les tâches faites les jours précédents disparaissent : chaque matin, la liste repart propre.

**Habitudes**
- Chaque habitude affiche les 7 derniers jours. Touchez un jour pour le cocher ou le décocher (utile si vous avez oublié hier).
- Deux jours cochés d'affilée sont reliés : le but est de ne pas casser la chaîne.
- Le compteur 🔥 donne la série en cours. Elle n'est pas perdue tant que la journée n'est pas finie.
- Sous chaque habitude : combien de jours sur les 7 derniers, et votre record.

**En haut** : la date, le numéro de semaine et l'avancement de la journée.

## L'utiliser

### Sur votre ordinateur
1. Téléchargez le dépôt (bouton **Code → Download ZIP** sur GitHub) et décompressez-le.
2. Double-cliquez sur `index.html`. C'est tout.

### Sur votre téléphone (recommandé)
Publiez le site gratuitement avec GitHub Pages :
1. Sur GitHub, ouvrez le dépôt → **Settings** → **Pages**.
2. Dans *Branch*, choisissez la branche principale et le dossier `/ (root)`, puis **Save**.
3. Après une minute, l'adresse du site s'affiche (du type `https://<votre-nom>.github.io/Outils/`).
4. Ouvrez-la sur le téléphone, puis **Ajouter à l'écran d'accueil**. L'appli s'ouvre alors comme une vraie application.

## Où sont mes données ?

Tout est enregistré **dans votre navigateur** (`localStorage`), sur l'appareil que vous utilisez. Rien n'est envoyé sur Internet.

Conséquences à connaître :
- Les données de l'ordinateur et celles du téléphone sont séparées.
- Vider les données de navigation du site efface aussi vos tâches et habitudes.

Si la page est ouverte comme Artifact sur claude.ai, elle enregistre en plus vos données dans votre compte Claude. Vous les retrouvez alors sur tous vos appareils. Le bas de la page indique où vos données sont enregistrées.

## Structure du projet

| Fichier | Rôle |
| --- | --- |
| `index.html` | La structure de la page |
| `style.css` | L'apparence (thème clair et sombre automatique) |
| `app.js` | Toute la logique : tâches, habitudes, séries, sauvegarde |
| `manifest.webmanifest`, `icon.svg` | Nom et icône quand on l'ajoute à l'écran d'accueil |

Pas de framework, pas de dépendance, pas d'étape de compilation : on modifie un fichier, on recharge la page.

## Idées pour la suite

- Modifier le texte d'une tâche après l'avoir créée.
- Choisir des habitudes seulement certains jours (ex. sport lundi, mercredi, vendredi).
- Un calendrier du mois pour chaque habitude.
- Exporter / importer ses données dans un fichier.
- Un rappel (notification) le soir pour les habitudes pas encore cochées.
