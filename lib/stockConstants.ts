/** Inventory categories */
export const STOCK_CATEGORIES = [
  "Materiale ndërtimi",
  "Vegla",
  "Siguria",
  "Zyra",
  "Mjete",
  "Të tjera",
] as const;

export type StockCategory = (typeof STOCK_CATEGORIES)[number];

/** Office / expense categories (aligned with OCR office mode) */
export const OFFICE_EXPENSE_CATEGORIES = [
  "Zyra",
  "Ushqim",
  "Transport",
  "Shërbime",
  "Materiale",
  "Të tjera",
] as const;

export type OfficeExpenseCategory = (typeof OFFICE_EXPENSE_CATEGORIES)[number];

export function normalizeOfficeCategory(raw: string | null | undefined): OfficeExpenseCategory {
  if (!raw) return "Të tjera";
  const t = raw.trim();
  const hit = OFFICE_EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === t.toLowerCase());
  return hit ?? "Të tjera";
}
