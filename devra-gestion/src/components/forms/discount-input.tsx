"use client";

import { Input } from "@/components/ui/input";
import type { DiscountType } from "@/domain/totals";
import { cn } from "@/lib/utils";

/** Saisie d'une remise ou d'un acompte : valeur + choix « % » ou « CHF ». */
export function DiscountInput({
  type,
  value,
  onTypeChange,
  onValueChange,
  label,
  invalid,
  className,
}: {
  type: DiscountType;
  value: string;
  onTypeChange: (type: DiscountType) => void;
  onValueChange: (value: string) => void;
  label: string;
  invalid?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex", className)}>
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        inputMode="decimal"
        placeholder="0"
        aria-label={label}
        aria-invalid={invalid || undefined}
        className="min-w-0 rounded-r-none text-right tabular-nums"
      />
      <div
        className="flex rounded-r-md border border-l-0"
        role="group"
        aria-label="Pourcentage ou montant en CHF"
      >
        {(["PERCENT", "AMOUNT"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onTypeChange(option)}
            aria-pressed={type === option}
            className={cn(
              "px-2 text-xs font-medium transition-colors last:rounded-r-md",
              type === option
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {option === "PERCENT" ? "%" : "CHF"}
          </button>
        ))}
      </div>
    </div>
  );
}
