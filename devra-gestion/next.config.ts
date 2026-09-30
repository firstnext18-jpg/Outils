import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
