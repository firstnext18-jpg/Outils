import { createECDH, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import webpush from "web-push";

// Clés VAPID de test (sans valeur ailleurs), comme dans tests/e2e/fixtures.ts.
const VAPID = {
  subject: "mailto:test@example.ch",
  publicKey:
    "BIELAdX7eaaw55gZUrTvd-M9sXKQZlEzw0s8GH9o_DU9tRRJVT4-61yV4QyyyvcSj95Jl-s_Mu5TcVAye_ENwW0",
  privateKey: "ChK1Hod3Lk7QC-lW1W08_hpBAfBpDBYcw95s3TWV8O4",
};

/** Déchiffrement côté navigateur (RFC 8291), par la bibliothèque qu'utilise web-push. */
const ece = createRequire(import.meta.url)("http_ece") as {
  decrypt: (
    body: Buffer,
    options: { version: string; privateKey: ReturnType<typeof createECDH>; authSecret: Buffer },
  ) => Buffer;
};

describe("notifications Web Push", () => {
  it("chiffre le contenu attendu par le service worker pour le seul navigateur abonné", () => {
    const browser = createECDH("prime256v1");
    browser.generateKeys();
    const authSecret = randomBytes(16);
    const payload = {
      title: "Studio Horizon · Choix du thème",
      body: "Léa Martin : Plutôt clair, plus lisible.",
      url: "/discussions/0199a1b2-0000-7000-8000-000000000000",
      tag: "discussion-0199a1b2-0000-7000-8000-000000000000",
    };

    const request = webpush.generateRequestDetails(
      {
        endpoint: "https://push.example/abonnement",
        keys: {
          p256dh: browser.getPublicKey("base64url"),
          auth: authSecret.toString("base64url"),
        },
      },
      JSON.stringify(payload),
      { vapidDetails: VAPID, TTL: 86400 },
    );

    expect(request.method).toBe("POST");
    expect(request.headers.TTL).toBe(86400);
    expect(String(request.headers.Authorization)).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    const body = request.body as Buffer;
    expect(body.toString()).not.toContain("Plutôt clair");
    const clear = ece.decrypt(body, { version: "aes128gcm", privateKey: browser, authSecret });
    expect(JSON.parse(clear.toString("utf8"))).toEqual(payload);
  });
});
