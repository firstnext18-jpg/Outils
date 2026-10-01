import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Redirection rapide vers la page de connexion quand aucun cookie de session
 * n'est présent. Ce n'est qu'un confort : la vraie vérification (session
 * valide, rôle) est faite côté serveur dans chaque page et chaque action.
 */
const PUBLIC_PATHS = [
  "/connexion",
  "/mot-de-passe-oublie",
  "/reinitialiser",
  "/invitation",
  // Page d'acceptation des devis en ligne : le jeton du lien fait office d'autorisation.
  "/devis-en-ligne",
];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || getSessionCookie(request)) return NextResponse.next();

  const url = new URL("/connexion", request.url);
  if (pathname !== "/") url.searchParams.set("suite", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf l'API (qui gère sa propre sécurité) et les fichiers statiques.
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webmanifest)$).*)",
  ],
};
