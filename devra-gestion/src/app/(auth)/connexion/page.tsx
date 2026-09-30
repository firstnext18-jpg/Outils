import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/(auth)/connexion/login-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/connexion">) {
  const { suite, reinitialise } = await searchParams;
  const next = safeRedirectPath(typeof suite === "string" ? suite : null);
  if (await getCurrentUser()) redirect(next);
  return <LoginForm next={next} passwordReset={reinitialise === "1"} />;
}
