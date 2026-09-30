/**
 * Seed de base, exécuté à chaque déploiement (idempotent) :
 *   - crée la ligne des paramètres si elle n'existe pas ;
 *   - crée le premier administrateur à partir de ADMIN_NAME / ADMIN_EMAIL /
 *     ADMIN_PASSWORD, uniquement si la base ne contient encore aucun utilisateur.
 *
 * Lancement : `npm run db:seed` (ou automatiquement par le conteneur `migrate`).
 */
import "dotenv/config";
import { z } from "zod";
import { createUserWithPassword } from "@/modules/users/create-user";
import { emailSchema, nameSchema, passwordSchema } from "@/modules/users/schemas";
import { db } from "@/server/db";

const adminSchema = z.object({
  ADMIN_NAME: nameSchema,
  ADMIN_EMAIL: emailSchema,
  ADMIN_PASSWORD: passwordSchema,
});

async function main() {
  await db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });

  const userCount = await db.user.count();
  if (userCount > 0) {
    console.log(`✓ ${userCount} utilisateur(s) déjà présent(s) : aucun admin créé.`);
    return;
  }

  const parsed = adminSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")} : ${i.message}`)
      .join("\n");
    throw new Error(
      `Impossible de créer le premier administrateur. Complétez le fichier .env :\n${problems}`,
    );
  }

  const admin = await createUserWithPassword(db, {
    name: parsed.data.ADMIN_NAME,
    email: parsed.data.ADMIN_EMAIL,
    password: parsed.data.ADMIN_PASSWORD,
    role: "ADMIN",
  });
  console.log(`✓ Administrateur créé : ${admin.email}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
