import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { formatDate } from "@/lib/format";
import { IMPORT_MAX_BYTES, IMPORT_MAX_ROWS } from "@/modules/clients/import-limits";

/**
 * Lecture et écriture de tableaux (CSV et Excel), pour l'import et l'export.
 */

export type SheetTable = { headers: string[]; rows: string[][] };

export class SpreadsheetError extends Error {}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/**
 * Décode un fichier texte : UTF-8 si possible, sinon Windows-1252 (encodage
 * des CSV enregistrés par Excel sous Windows). Supprime le BOM éventuel.
 */
export function decodeText(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, "");
}

/** Met en forme le tableau brut : en-têtes, lignes vides retirées, colonnes alignées. */
export function toSheetTable(matrix: string[][]): SheetTable {
  const cleaned = matrix
    .map((row) => row.map((value) => (value ?? "").toString().trim()))
    .filter((row) => row.some(Boolean));
  if (cleaned.length === 0) throw new SpreadsheetError("Le fichier est vide.");

  const width = Math.max(...cleaned.map((row) => row.length));
  // Retire les colonnes entièrement vides à droite.
  let lastUsed = 0;
  for (const row of cleaned) {
    row.forEach((value, i) => {
      if (value) lastUsed = Math.max(lastUsed, i);
    });
  }
  const columns = Math.min(width, lastUsed + 1);
  const pad = (row: string[]) => Array.from({ length: columns }, (_, i) => row[i] ?? "");

  const [headerRow, ...rows] = cleaned;
  const headers = pad(headerRow!).map((h, i) => h || `Colonne ${i + 1}`);
  if (rows.length === 0)
    throw new SpreadsheetError("Le fichier ne contient que la ligne d'en-têtes.");
  if (rows.length > IMPORT_MAX_ROWS) {
    throw new SpreadsheetError(
      `Le fichier contient plus de ${IMPORT_MAX_ROWS} lignes : découpez-le.`,
    );
  }
  return { headers, rows: rows.map(pad) };
}

/** CSV : séparateur détecté automatiquement (point-virgule, virgule, tabulation). */
export function parseCsv(bytes: Uint8Array): SheetTable {
  const text = decodeText(bytes);
  const result = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimitersToGuess: [";", ",", "\t", "|"],
  });
  if (result.data.length === 0) throw new SpreadsheetError("Le fichier est vide.");
  return toSheetTable(result.data);
}

function cellText(cell: ExcelJS.Cell): string {
  if (cell.value instanceof Date) return formatDate(cell.value);
  return cell.text ?? "";
}

/** Excel (.xlsx) : première feuille contenant des données. */
export async function parseXlsx(bytes: Uint8Array): Promise<SheetTable> {
  const workbook = new ExcelJS.Workbook();
  try {
    const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await workbook.xlsx.load(copy as unknown as ExcelJS.Buffer);
  } catch {
    throw new SpreadsheetError("Ce fichier Excel est illisible. Enregistrez-le au format .xlsx.");
  }
  const sheet = workbook.worksheets.find((ws) => ws.actualRowCount > 0);
  if (!sheet) throw new SpreadsheetError("Le fichier est vide.");
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      values[column - 1] = cellText(cell);
    });
    matrix.push(Array.from(values, (v) => v ?? ""));
  });
  return toSheetTable(matrix);
}

/** Lit un fichier importé selon son extension. */
export async function parseSpreadsheetFile(file: File): Promise<SheetTable> {
  if (file.size === 0) throw new SpreadsheetError("Le fichier est vide.");
  if (file.size > IMPORT_MAX_BYTES) throw new SpreadsheetError("Le fichier dépasse 5 Mo.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(bytes);
  if (name.endsWith(".xlsx")) return parseXlsx(bytes);
  if (name.endsWith(".xls")) {
    throw new SpreadsheetError(
      "Ancien format Excel (.xls) : enregistrez le fichier en .xlsx ou en .csv.",
    );
  }
  throw new SpreadsheetError("Format non pris en charge : utilisez un fichier .csv ou .xlsx.");
}

// ---------------------------------------------------------------------------
// Écriture
// ---------------------------------------------------------------------------

/**
 * Une cellule commençant par = + - ou @ serait interprétée comme une formule
 * par Excel (risque d'« injection CSV ») : on la préfixe d'une apostrophe.
 */
function protectFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * CSV compatible avec Excel en Suisse : séparateur point-virgule, fins de
 * ligne Windows et BOM UTF-8 (sinon les accents s'affichent mal).
 */
export function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (value: string) => {
    const safe = protectFormula(value);
    return /[";\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
  };
  const lines = [headers, ...rows].map((row) => row.map(escape).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Classeur Excel : en-têtes en gras, figés, avec filtres automatiques. */
export async function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: string[][],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.columns.forEach((column, i) => {
    const longest = Math.max(headers[i]?.length ?? 0, ...rows.map((r) => (r[i] ?? "").length));
    column.width = Math.min(50, Math.max(10, longest + 2));
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as unknown as ArrayBuffer);
}
