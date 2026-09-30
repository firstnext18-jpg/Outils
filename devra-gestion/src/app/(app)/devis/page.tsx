import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Devis" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title="Devis" phase={4} />;
}
