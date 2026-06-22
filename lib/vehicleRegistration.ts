import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import type { Vehicle } from "@/lib/db";

export type RegistrationStatus = "valid" | "expiringSoon" | "expired" | "unknown";

export function getRegistrationStatus(
  expiresAt: string | null | undefined,
  now = new Date()
): RegistrationStatus {
  if (!expiresAt) return "unknown";
  try {
    const exp = startOfDay(parseISO(expiresAt));
    const today = startOfDay(now);
    const daysLeft = differenceInCalendarDays(exp, today);
    if (daysLeft < 0) return "expired";
    if (daysLeft <= 7) return "expiringSoon";
    return "valid";
  } catch {
    return "unknown";
  }
}

export function formatRegistrationDate(expiresAt: string): string {
  return format(parseISO(expiresAt), "dd-MM-yyyy");
}

export function countExpiredRegistrations(vehicles: Vehicle[]): number {
  return vehicles.filter(
    (v) =>
      !v.archivedAt &&
      v.registrationExpiresAt &&
      getRegistrationStatus(v.registrationExpiresAt) === "expired"
  ).length;
}

export const registrationBadgeClass: Record<
  Exclude<RegistrationStatus, "unknown">,
  string
> = {
  valid: "bg-gray-100 text-gray-600",
  expiringSoon: "bg-amber-100 text-amber-800",
  expired: "bg-red-100 text-red-700",
};
