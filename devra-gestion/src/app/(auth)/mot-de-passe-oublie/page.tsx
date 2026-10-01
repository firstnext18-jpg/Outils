import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/app/(auth)/mot-de-passe-oublie/forgot-password-form";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
