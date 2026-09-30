import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Clients" };

export default async function Page() {
  await requireUser();
  return <ComingSoon title="Clients" phase={2} />;
}
