import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Catalogue" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title="Catalogue" phase={3} />;
}
