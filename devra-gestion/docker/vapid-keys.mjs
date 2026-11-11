// Génère une paire de clés VAPID (notifications Web Push), au format du fichier .env :
//   docker compose run --rm --no-deps app node docker/vapid-keys.mjs >> .env
import { generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = privateKey.export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(jwk.x, "base64url"),
  Buffer.from(jwk.y, "base64url"),
]).toString("base64url");

console.log(
  `\n# Notifications (Web Push)\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${jwk.d}`,
);
