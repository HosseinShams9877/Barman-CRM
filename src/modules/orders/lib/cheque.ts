import { toEnDigits } from "@core/formatting";

/** Demo core.js chqIncomplete: all identity/date fields must be present. */
export function isIncompleteCheque(cheque: { sayad: string; bank: string; owner: string; due: string }): boolean {
  return !/^\d{16}$/.test(toEnDigits(cheque.sayad).trim()) || !cheque.bank.trim() || !cheque.owner.trim() || !cheque.due;
}
