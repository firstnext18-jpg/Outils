/**
 * Références de paiement de la QR-facture suisse.
 *
 * - Avec un QR-IBAN : référence QRR, 27 chiffres dont le dernier est une clé
 *   de contrôle (modulo 10 récursif, comme l'ancien BVR).
 * - Avec un IBAN classique : référence créancier SCOR (ISO 11649),
 *   « RF » + 2 chiffres de contrôle (modulo 97) + jusqu'à 21 caractères.
 *
 * Les deux sont construites à partir du numéro de la facture : elles sont donc
 * uniques et permettent de rapprocher un paiement de sa facture.
 */
import { mod97 } from "@/domain/iban";

/** Table du modulo 10 récursif (SIX, « Implementation Guidelines QR-bill », annexe). */
const MOD10_TABLE = [0, 9, 4, 6, 8, 2, 7, 1, 3, 5];

/** Chiffre de contrôle modulo 10 récursif d'une suite de chiffres. */
export function mod10Recursive(digits: string): number {
  let carry = 0;
  for (const digit of digits) {
    carry = MOD10_TABLE[(carry + Number(digit)) % 10]!;
  }
  return (10 - carry) % 10;
}

/** Préfixe éventuel imposé par la banque (chiffres seulement, 10 au maximum). */
export const MAX_QRR_PREFIX_LENGTH = 10;

export function isValidQrrPrefix(prefix: string): boolean {
  return new RegExp(`^\\d{0,${MAX_QRR_PREFIX_LENGTH}}$`).test(prefix);
}

/**
 * Référence QRR d'une facture : [préfixe banque][zéros][année sur 4][numéro sur 6] + clé.
 * Ex. facture n° 14 de 2026, sans préfixe → « 00 00000 00000 00002 02600 00140 ».
 */
export function qrrReference(year: number, sequence: number, prefix = ""): string {
  if (!isValidQrrPrefix(prefix)) throw new Error(`Préfixe QRR invalide : ${prefix}`);
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new Error("Année invalide");
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 999_999) {
    throw new Error("Numéro de facture hors limites pour une référence QRR");
  }
  const invoicePart = `${year}${String(sequence).padStart(6, "0")}`;
  const body = prefix + invoicePart.padStart(26 - prefix.length, "0");
  return body + mod10Recursive(body);
}

export function isValidQrrReference(reference: string): boolean {
  const value = reference.replace(/\s/g, "");
  return /^\d{27}$/.test(value) && mod10Recursive(value.slice(0, 26)) === Number(value[26]);
}

/**
 * Référence SCOR (ISO 11649) construite sur le numéro de la facture :
 * « F-2026-014 » → « RF.. F2026014 » (seuls les lettres et chiffres sont gardés).
 */
export function scorReference(invoiceNumber: string): string {
  const body = invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (body.length === 0 || body.length > 21) {
    throw new Error(`Numéro de facture inutilisable pour une référence SCOR : ${invoiceNumber}`);
  }
  const check = 98 - mod97(`${body}RF00`);
  return `RF${String(check).padStart(2, "0")}${body}`;
}

export function isValidScorReference(reference: string): boolean {
  const value = reference.replace(/\s/g, "").toUpperCase();
  if (!/^RF\d{2}[A-Z0-9]{1,21}$/.test(value)) return false;
  return mod97(value.slice(4) + value.slice(0, 4)) === 1;
}

/** Affichage par groupes : QRR « 21 00000 00003 … », SCOR « RF18 5390 0754 7034 ». */
export function formatReference(reference: string): string {
  const value = reference.replace(/\s/g, "");
  if (/^\d{27}$/.test(value))
    return `${value.slice(0, 2)} ${value.slice(2).replace(/(.{5})(?=.)/g, "$1 ")}`;
  return value.replace(/(.{4})(?=.)/g, "$1 ");
}
