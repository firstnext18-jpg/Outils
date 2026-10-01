"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatAmount, formatChf } from "@/lib/format";

export type MonthPoint = { label: string; invoicedCents: number; paidCents: number };

/** « 12'500 » : francs entiers pour l'axe vertical. */
function axisAmount(cents: number) {
  return formatAmount(Math.round(cents / 100) * 100).slice(0, -3);
}

/**
 * Évolution du chiffre d'affaires sur 12 mois (facturé et encaissé). Les mêmes
 * chiffres figurent dans un tableau lu par les lecteurs d'écran.
 */
export function RevenueChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="h-72 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={axisAmount}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            formatter={(value, name) => [
              formatChf(Number(value)),
              name === "invoicedCents" ? "Facturé" : "Encaissé",
            ]}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--popover-foreground)", fontWeight: 500 }}
          />
          <Bar dataKey="invoicedCents" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="paidCents" fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
