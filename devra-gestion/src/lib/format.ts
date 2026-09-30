/**
 * Formats suisses utilisés dans toute l'application :
 *   - dates « JJ.MM.AAAA » (fuseau Europe/Zurich) ;
 *   - montants « CHF 1'250.00 » (apostrophe droite comme séparateur de milliers).
 */

const TIME_ZONE = "Europe/Zurich";

const dateFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("de-CH", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** 30.09.2026 */
export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** 30.09.2026 14:05 */
export function formatDateTime(date: Date): string {
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

/**
 * Montant en centimes → « 1'250.00 ». Les centimes étant des entiers, aucun
 * arrondi n'intervient ici (l'arrondi aux 5 centimes se fait dans les calculs).
 */
export function formatAmount(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Montant invalide : ${cents} (entier en centimes attendu)`);
  }
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const francs = Math.floor(abs / 100).toString();
  const centimes = (abs % 100).toString().padStart(2, "0");
  const grouped = francs.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `${sign}${grouped}.${centimes}`;
}

/** Montant en centimes → « CHF 1'250.00 ». */
export function formatChf(cents: number): string {
  return `CHF ${formatAmount(cents)}`;
}
