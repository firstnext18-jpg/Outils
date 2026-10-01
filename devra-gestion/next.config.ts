import type { NextConfig } from "next";

const dev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HTTPS uniquement pendant un an (ignoré par les navigateurs tant que le site est en HTTP).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/**
 * Politique de sécurité du contenu des pages : uniquement des ressources de
 * l'application elle-même, pas d'intégration dans un cadre, formulaires vers
 * l'application seulement. Les scripts et styles « inline » restent permis :
 * Next.js et le thème clair/sombre en ont besoin au chargement.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Image Docker minimale : seul le serveur autonome est copié dans l'image finale.
  output: "standalone",
  poweredByHeader: false,
  // Pas de fichiers AGENTS.md / CLAUDE.md générés automatiquement par `next dev`.
  agentRules: false,
  // Module natif (binaire précompilé ARM64/x64) : ne pas l'empaqueter avec webpack/turbopack.
  serverExternalPackages: ["@node-rs/argon2", "pdfkit"],
  // PDFKit lit ses polices (fichiers .afm) sur le disque : à inclure dans l'image.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/pdfkit/js/data/**"],
  },
  experimental: {
    // Envoi du logo et des fichiers d'import via les actions serveur (limite par défaut : 1 Mo).
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Pas sur /api : les PDF y sont affichés par le lecteur intégré du navigateur.
      {
        source: "/:path((?!api/).*)",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
