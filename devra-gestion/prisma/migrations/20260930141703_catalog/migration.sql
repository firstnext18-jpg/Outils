-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('FLAT', 'HOURLY', 'EXTRA', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "Periodicity" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('FLAT', 'HOUR', 'PIECE', 'PAGE', 'DAY', 'MONTH', 'QUARTER', 'YEAR');

-- CreateTable
CREATE TABLE "catalog_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "descriptionDe" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "lineType" "LineType" NOT NULL,
    "unit" "Unit" NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "periodicity" "Periodicity",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "searchText" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "catalog_item_active_idx" ON "catalog_item"("active");

-- CreateIndex
CREATE INDEX "catalog_item_category_idx" ON "catalog_item"("category");

-- AddForeignKey
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_item" ADD CONSTRAINT "catalog_item_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Données par défaut. Une migration ne s'exécute qu'une fois par base : ce qui
-- est ensuite supprimé dans l'interface ne réapparaît pas au déploiement suivant.
-- ---------------------------------------------------------------------------

-- Types de sites (si la liste est encore vide).
INSERT INTO "site_type" ("id", "name", "position", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid(), t.name, t.position, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (VALUES
  ('Vitrine', 0),
  ('E-commerce', 1),
  ('Landing page', 2),
  ('Blog', 3),
  ('Portfolio', 4),
  ('Refonte', 5),
  ('Sur mesure', 6)
) AS t(name, position)
WHERE NOT EXISTS (SELECT 1 FROM "site_type");

-- Exemples de prestations, avec des prix fictifs à ajuster dans l'interface.
INSERT INTO "catalog_item" ("id", "name", "nameDe", "description", "descriptionDe", "category", "lineType", "unit", "unitPriceCents", "periodicity", "searchText", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'Site vitrine (jusqu''à 5 pages)', 'Website (bis 5 Seiten)', 'Conception, rédaction assistée par IA, mise en ligne et optimisation pour mobile.', 'Konzeption, KI-gestützte Texte, Veröffentlichung und Optimierung für Mobilgeräte.', 'Sites internet', 'FLAT', 'FLAT', 149000, NULL, 'site vitrine (jusqu''a 5 pages) website (bis 5 seiten) conception, redaction assistee par ia, mise en ligne et optimisation pour mobile. konzeption, ki-gestutzte texte, veroffentlichung und optimierung fur mobilgerate. sites internet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Landing page', 'Landingpage', 'Page unique orientée conversion, avec formulaire de contact.', 'Einzelne, auf Conversion ausgerichtete Seite mit Kontaktformular.', 'Sites internet', 'FLAT', 'FLAT', 79000, NULL, 'landing page landingpage page unique orientee conversion, avec formulaire de contact. einzelne, auf conversion ausgerichtete seite mit kontaktformular. sites internet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Boutique en ligne', 'Onlineshop', 'Catalogue de produits, paiement en ligne et gestion des commandes.', 'Produktkatalog, Online-Zahlung und Bestellverwaltung.', 'Sites internet', 'FLAT', 'FLAT', 390000, NULL, 'boutique en ligne onlineshop catalogue de produits, paiement en ligne et gestion des commandes. produktkatalog, online-zahlung und bestellverwaltung. sites internet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Refonte d''un site existant', 'Redesign einer bestehenden Website', 'Nouveau design et reprise des contenus existants.', 'Neues Design und Übernahme der bestehenden Inhalte.', 'Sites internet', 'FLAT', 'FLAT', 119000, NULL, 'refonte d''un site existant redesign einer bestehenden website nouveau design et reprise des contenus existants. neues design und ubernahme der bestehenden inhalte. sites internet', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Page supplémentaire', 'Zusätzliche Seite', '', '', 'Options', 'EXTRA', 'PAGE', 15000, NULL, 'page supplementaire zusatzliche seite options', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Formulaire de contact', 'Kontaktformular', '', '', 'Options', 'EXTRA', 'PIECE', 12000, NULL, 'formulaire de contact kontaktformular options', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Version bilingue (français / allemand)', 'Zweisprachige Version (Französisch / Deutsch)', 'Traduction et mise en place de la deuxième langue.', 'Übersetzung und Einrichtung der zweiten Sprache.', 'Options', 'EXTRA', 'FLAT', 39000, NULL, 'version bilingue (francais / allemand) zweisprachige version (franzosisch / deutsch) traduction et mise en place de la deuxieme langue. ubersetzung und einrichtung der zweiten sprache. options', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Modification sur demande', 'Änderungen auf Anfrage', 'Modifications de contenu ou de mise en page, facturées à l''heure.', 'Inhalts- oder Layoutänderungen, nach Aufwand verrechnet.', 'Prestations à l''heure', 'HOURLY', 'HOUR', 9000, NULL, 'modification sur demande anderungen auf anfrage modifications de contenu ou de mise en page, facturees a l''heure. inhalts- oder layoutanderungen, nach aufwand verrechnet. prestations a l''heure', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Hébergement + maintenance', 'Hosting + Wartung', 'Hébergement en Suisse, mises à jour, sauvegardes et assistance.', 'Hosting in der Schweiz, Updates, Backups und Support.', 'Abonnements', 'SUBSCRIPTION', 'MONTH', 2900, 'MONTHLY', 'hebergement + maintenance hosting + wartung hebergement en suisse, mises a jour, sauvegardes et assistance. hosting in der schweiz, updates, backups und support. abonnements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Hébergement + maintenance (annuel)', 'Hosting + Wartung (jährlich)', 'Hébergement en Suisse, mises à jour, sauvegardes et assistance.', 'Hosting in der Schweiz, Updates, Backups und Support.', 'Abonnements', 'SUBSCRIPTION', 'YEAR', 29000, 'YEARLY', 'hebergement + maintenance (annuel) hosting + wartung (jahrlich) hebergement en suisse, mises a jour, sauvegardes et assistance. hosting in der schweiz, updates, backups und support. abonnements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Nom de domaine .ch', 'Domainname .ch', 'Réservation et renouvellement du nom de domaine.', 'Registrierung und Verlängerung des Domainnamens.', 'Abonnements', 'SUBSCRIPTION', 'YEAR', 2500, 'YEARLY', 'nom de domaine .ch domainname .ch reservation et renouvellement du nom de domaine. registrierung und verlangerung des domainnamens. abonnements', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
