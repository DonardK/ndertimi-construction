export type AppRole = "management" | "staff";

const MANAGEMENT_EMAILS = new Set([
  "donard@etnagroup-ks.com",
  "diellona@etnagroup-ks.com",
]);

const STAFF_EMAILS = new Set(["staff@etnagroup-ks.com"]);

/** Staff cannot open these routes (prefix match). */
export const STAFF_BLOCKED_PATH_PREFIXES = ["/mjetet", "/nafta", "/stoku"] as const;

export function normalizeEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function getRoleFromEmail(email: string | null | undefined): AppRole {
  const normalized = normalizeEmail(email);
  if (MANAGEMENT_EMAILS.has(normalized)) return "management";
  if (STAFF_EMAILS.has(normalized)) return "staff";
  // Unknown accounts default to staff (least privilege).
  return "staff";
}

export function canViewFinancials(role: AppRole): boolean {
  return role === "management";
}

export function isStaffBlockedPath(pathname: string): boolean {
  return STAFF_BLOCKED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function navHrefAllowedForRole(href: string, role: AppRole): boolean {
  if (role === "management") return true;
  if (href === "/" || href.startsWith("/personeli") || href.startsWith("/profili")) {
    return true;
  }
  return false;
}
