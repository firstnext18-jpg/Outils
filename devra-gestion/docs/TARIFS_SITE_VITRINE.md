# Tarifs publics pour le site vitrine

L'application publie ses tarifs à l'adresse :

```
https://gestion-devra.leonj.ch/tarif.php
```

(ou `<APP_URL>/tarif.php` sur une autre installation). Le site vitrine lit cette adresse pour
afficher des prix toujours à jour : il suffit de modifier le **catalogue de prestations** dans
l'application, le site suit.

- **Contenu** : toutes les prestations **actives** du catalogue (nom, description, prix,
  catégorie, en français et en allemand). Pour retirer une prestation du site : la
  **désactiver** dans le catalogue. Une prestation désactivée ou supprimée disparaît de la liste.
- **Public** : pas de connexion ni de clé. Rien d'autre que le catalogue actif n'y figure (ni
  clients, ni devis, ni factures).
- **Format** : JSON (UTF-8). Lisible depuis le serveur du site (PHP…) comme depuis le navigateur
  (JavaScript : l'adresse autorise les appels depuis n'importe quel site).
- **Fraîcheur** : les navigateurs peuvent garder la réponse 5 minutes. Un site en PHP peut aussi
  la garder en cache de son côté (exemple ci-dessous).
- L'adresse se termine par `.php` pour le site vitrine, mais l'application n'est pas en PHP : la
  réponse est générée par l'application elle-même.

## Exemple de réponse

```json
{
  "entreprise": "Devra",
  "devise": "CHF",
  "tva": { "assujettie": false, "taux": null, "prixHorsTva": false },
  "miseAJour": "2026-11-11T10:42:00.000Z",
  "nombrePrestations": 11,
  "categories": [
    {
      "categorie": "Sites internet",
      "prestations": [
        {
          "id": "0199…",
          "nom": "Site vitrine (jusqu'à 5 pages)",
          "nomDe": "Website (bis 5 Seiten)",
          "description": "Conception, intégration et mise en ligne…",
          "descriptionDe": "Konzept, Umsetzung und Aufschaltung…",
          "type": "FLAT",
          "typeLibelle": "Forfait",
          "prix": 1490,
          "prixCentimes": 149000,
          "prixTexte": "CHF 1'490.00",
          "prixTexteDe": "CHF 1'490.00",
          "unite": "FLAT",
          "uniteLibelle": "forfait",
          "uniteLibelleDe": "Pauschale",
          "periodicite": null,
          "periodiciteLibelle": null,
          "periodiciteLibelleDe": null
        }
      ]
    },
    {
      "categorie": "Abonnements",
      "prestations": [
        {
          "nom": "Hébergement + maintenance",
          "prix": 29,
          "prixTexte": "CHF 29.00 par mois",
          "prixTexteDe": "CHF 29.00 pro Monat",
          "periodicite": "MONTHLY",
          "…": "…"
        }
      ]
    }
  ]
}
```

## Champs

| Champ                                                       | Contenu                                                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `entreprise`, `devise`                                      | nom de l'entreprise (Paramètres → Entreprise), `CHF`                                          |
| `tva.assujettie`                                            | `true` : les prix sont **hors TVA** (`tva.taux` en %, ex. `8.1`) ; `false` : prix finaux      |
| `miseAJour`                                                 | date de la dernière modification d'une prestation publiée (ISO 8601)                          |
| `categories[].categorie`                                    | catégorie du catalogue, dans l'ordre alphabétique ; `null` = sans catégorie (en dernier)      |
| `nom`, `nomDe`, `description`, `descriptionDe`              | textes en français et en allemand (sans traduction, la version allemande reprend le français) |
| `prix`, `prixCentimes`                                      | prix unitaire en francs (nombre) et en centimes (entier, pour les calculs)                    |
| `prixTexte`, `prixTexteDe`                                  | prix prêt à afficher : `CHF 1'490.00`, `CHF 90.00 / h`, `CHF 29.00 par mois`                  |
| `type`, `typeLibelle`                                       | `FLAT` (forfait), `HOURLY` (à l'heure), `EXTRA` (option), `SUBSCRIPTION` (abonnement)         |
| `unite`, `uniteLibelle`, `uniteLibelleDe`                   | `FLAT`, `HOUR`, `PIECE`, `PAGE`, `DAY`, `MONTH`, `QUARTER`, `YEAR` et leurs libellés          |
| `periodicite`, `periodiciteLibelle`, `periodiciteLibelleDe` | abonnements : `MONTHLY`, `QUARTERLY`, `YEARLY` (« par mois »…) ; `null` sinon                 |
| `id`                                                        | identifiant stable de la prestation (pour retrouver une prestation précise)                   |

## Exemple en PHP (site vitrine)

```php
<?php
// Tarifs à jour depuis l'application, gardés 10 minutes en cache sur le site.
function tarifs(): array {
    $cache = sys_get_temp_dir() . '/tarifs-devra.json';
    if (is_file($cache) && filemtime($cache) > time() - 600) {
        return json_decode(file_get_contents($cache), true);
    }
    $json = @file_get_contents('https://gestion-devra.leonj.ch/tarif.php');
    $data = $json ? json_decode($json, true) : null;
    if (!$data) { // application injoignable : dernière version connue
        return is_file($cache) ? json_decode(file_get_contents($cache), true) : ['categories' => []];
    }
    file_put_contents($cache, $json);
    return $data;
}

foreach (tarifs()['categories'] as $categorie) {
    echo '<h2>' . htmlspecialchars($categorie['categorie'] ?? 'Autres prestations') . '</h2><ul>';
    foreach ($categorie['prestations'] as $p) {
        echo '<li>' . htmlspecialchars($p['nom']) . ' — ' . htmlspecialchars($p['prixTexte']) . '</li>';
    }
    echo '</ul>';
}
```

## Exemple en JavaScript (site statique)

```html
<div id="tarifs">Chargement des tarifs…</div>
<script>
  fetch("https://gestion-devra.leonj.ch/tarif.php")
    .then((response) => response.json())
    .then(({ categories }) => {
      const element = document.getElementById("tarifs");
      element.replaceChildren(
        ...categories.flatMap(({ categorie, prestations }) => {
          const titre = document.createElement("h2");
          titre.textContent = categorie ?? "Autres prestations";
          const liste = document.createElement("ul");
          for (const p of prestations) {
            const ligne = document.createElement("li");
            ligne.textContent = `${p.nom} — ${p.prixTexte}`;
            liste.append(ligne);
          }
          return [titre, liste];
        }),
      );
    });
</script>
```

(`textContent` et `htmlspecialchars` évitent qu'un texte du catalogue soit interprété comme du
HTML.)
