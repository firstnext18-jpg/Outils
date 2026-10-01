import "server-only";
import { headers } from "next/headers";
import { env } from "@/server/env";

/**
 * Adresse IP du visiteur, transmise par le reverse proxy (Cloudflare Tunnel
 * ou Caddy) dans l'en-tête AUTH_IP_HEADER : la première adresse de la liste.
 */
export async function requestIp(): Promise<string> {
  const value = (await headers()).get(env().AUTH_IP_HEADER) ?? "";
  return value.split(",")[0]?.trim().slice(0, 64) ?? "";
}
