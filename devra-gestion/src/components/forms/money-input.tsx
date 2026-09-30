"use client";

import { Input } from "@/components/ui/input";
import { parseChfInput } from "@/domain/money";
import { formatAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Saisie d'un montant en francs. La valeur reste du texte pendant la frappe ;
 * en quittant le champ, un montant valable est remis en forme (« 1'490.00 »).
 */
export function MoneyInput({
  value,
  onChange,
  onBlur,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        CHF
      </span>
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => {
          const cents = parseChfInput(value);
          if (cents !== null) onChange(formatAmount(cents));
          onBlur?.(event);
        }}
        className={cn("pl-12 text-right tabular-nums", className)}
      />
    </div>
  );
}
