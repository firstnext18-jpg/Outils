"use client";

import { ArrowDownIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import {
  useWatch,
  type Control,
  type UseFormSetValue,
  type UseFormGetValues,
} from "react-hook-form";
import { DiscountInput } from "@/components/forms/discount-input";
import { MoneyInput } from "@/components/forms/money-input";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedUnits,
  LINE_TYPE_LABELS,
  LINE_TYPES,
  PERIODICITIES,
  PERIODICITY_LABELS,
  type LineTypeCode,
  type PeriodicityCode,
} from "@/domain/catalog";
import { formatPercent } from "@/domain/percent";
import { UNIT_LABELS } from "@/domain/units";
import { formatChf } from "@/lib/format";
import type { QuoteData, QuoteInput } from "@/modules/quotes/schemas";

type Props = {
  index: number;
  count: number;
  control: Control<QuoteInput, unknown, QuoteData>;
  setValue: UseFormSetValue<QuoteInput>;
  getValues: UseFormGetValues<QuoteInput>;
  netCents: number;
  vatEnabled: boolean;
  vatRates: number[];
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
};

/** Une ligne de l'éditeur de devis. */
export function QuoteLineRow({
  index,
  count,
  control,
  setValue,
  getValues,
  netCents,
  vatEnabled,
  vatRates,
  onMove,
  onRemove,
}: Props) {
  const name = <K extends keyof QuoteInput["lines"][number]>(field: K) =>
    `lines.${index}.${field}` as const;
  const lineType = useWatch({ control, name: name("lineType") });
  const periodicity = useWatch({ control, name: name("periodicity") });
  const units = allowedUnits(lineType, lineType === "SUBSCRIPTION" ? periodicity : null);

  /** Garde une unité compatible quand le type ou la périodicité change. */
  function syncUnit(nextType: LineTypeCode, nextPeriodicity: PeriodicityCode | null) {
    const allowed = allowedUnits(nextType, nextPeriodicity);
    if (!allowed.includes(getValues(name("unit")))) setValue(name("unit"), allowed[0]!);
  }

  return (
    <li className="space-y-3 rounded-lg border p-3" aria-label={`Ligne ${index + 1}`}>
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground mt-2 w-5 shrink-0 text-right text-sm tabular-nums">
          {index + 1}
        </span>
        <FormField
          control={control}
          name={name("label")}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Désignation</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="Désignation"
                  aria-label={`Désignation de la ligne ${index + 1}`}
                  className="font-medium"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={name("lineType")}
          render={({ field }) => (
            <FormItem className="w-36 shrink-0">
              <Select
                value={field.value}
                onValueChange={(value) => {
                  if (!value) return;
                  const next = value as LineTypeCode;
                  field.onChange(next);
                  let nextPeriodicity = getValues(name("periodicity"));
                  if (next === "SUBSCRIPTION" && !nextPeriodicity) {
                    nextPeriodicity = "MONTHLY";
                    setValue(name("periodicity"), nextPeriodicity);
                  }
                  syncUnit(next, next === "SUBSCRIPTION" ? nextPeriodicity : null);
                }}
              >
                <FormControl>
                  <SelectTrigger className="w-full" aria-label={`Type de la ligne ${index + 1}`}>
                    <SelectValue>{LINE_TYPE_LABELS[field.value]}</SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LINE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LINE_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <div className="flex shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Monter la ligne ${index + 1}`}
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
          >
            <ArrowUpIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Descendre la ligne ${index + 1}`}
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Supprimer la ligne ${index + 1}`}
            onClick={onRemove}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="pl-7">
        <FormField
          control={control}
          name={name("description")}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  {...field}
                  rows={1}
                  placeholder="Description (facultatif)"
                  aria-label={`Description de la ligne ${index + 1}`}
                  className="min-h-9 text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-2 pl-7 sm:grid-cols-[5rem_8rem_9rem_10rem_1fr] sm:items-end">
        {lineType === "SUBSCRIPTION" && (
          <FormField
            control={control}
            name={name("periodicity")}
            render={({ field }) => (
              <FormItem className="col-span-2 sm:col-span-5">
                <FormLabel className="text-muted-foreground text-xs">Périodicité</FormLabel>
                <Select
                  value={field.value ?? undefined}
                  onValueChange={(value) => {
                    if (!value) return;
                    field.onChange(value);
                    syncUnit("SUBSCRIPTION", value as PeriodicityCode);
                  }}
                >
                  <FormControl>
                    <SelectTrigger
                      className="w-full sm:w-48"
                      aria-label={`Périodicité de la ligne ${index + 1}`}
                    >
                      <SelectValue placeholder="Choisir…" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PERIODICITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PERIODICITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={control}
          name={name("quantity")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground text-xs">Quantité</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="decimal"
                  aria-label={`Quantité de la ligne ${index + 1}`}
                  className="text-right tabular-nums"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={name("unit")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground text-xs">Unité</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => value && field.onChange(value)}
                disabled={units.length === 1}
              >
                <FormControl>
                  <SelectTrigger className="w-full" aria-label={`Unité de la ligne ${index + 1}`}>
                    <SelectValue>{UNIT_LABELS[field.value]?.name}</SelectValue>
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {UNIT_LABELS[unit].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={name("unitPrice")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground text-xs">Prix unitaire</FormLabel>
              <FormControl>
                <MoneyInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  aria-label={`Prix unitaire de la ligne ${index + 1}`}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={name("discountValue")}
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel className="text-muted-foreground text-xs">Remise</FormLabel>
              <FormField
                control={control}
                name={name("discountType")}
                render={({ field: typeField }) => (
                  <DiscountInput
                    label={`Remise de la ligne ${index + 1}`}
                    type={typeField.value}
                    value={field.value}
                    onTypeChange={typeField.onChange}
                    onValueChange={field.onChange}
                    invalid={Boolean(fieldState.error)}
                  />
                )}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="col-span-2 flex items-end justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
          {vatEnabled && (
            <FormField
              control={control}
              name={name("vatRateBps")}
              render={({ field }) => (
                <Select
                  value={field.value === null ? "0" : String(field.value)}
                  onValueChange={(value) => value && field.onChange(Number(value))}
                >
                  <SelectTrigger
                    size="sm"
                    className="w-28"
                    aria-label={`TVA de la ligne ${index + 1}`}
                  >
                    <SelectValue>TVA {formatPercent(field.value ?? 0)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {[...vatRates, 0].map((rate) => (
                      <SelectItem key={rate} value={String(rate)}>
                        {formatPercent(rate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
          <p className="ml-auto text-right">
            <span className="text-muted-foreground block text-xs">Total</span>
            <span
              className="font-medium whitespace-nowrap tabular-nums"
              aria-label={`Total de la ligne ${index + 1}`}
            >
              {formatChf(netCents)}
            </span>
          </p>
        </div>
      </div>
    </li>
  );
}
