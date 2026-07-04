"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  UserCircle,
} from "lucide-react";
import { useAppRefreshVersion } from "@/components/AppRefreshProvider";
import { useRole } from "@/components/RoleProvider";
import { db } from "@/lib/db";
import { navHrefAllowedForRole } from "@/lib/roles";
import { countExpiredRegistrations } from "@/lib/vehicleRegistration";
import { t } from "@/lib/translations";

const navItems = [
  { href: "/", label: t.nav.dashboard, icon: LayoutDashboard, match: (p: string) => p === "/" },
  {
    href: "/personeli",
    label: t.nav.personnel,
    icon: Users,
    match: (p: string) => p.startsWith("/personeli"),
  },
  {
    href: "/mjetet",
    label: t.nav.vehiclesHub,
    icon: Truck,
    match: (p: string) => p.startsWith("/mjetet"),
    badgeKey: "vehicles" as const,
  },
  {
    href: "/stoku",
    label: t.nav.stock,
    icon: Package,
    match: (p: string) => p.startsWith("/stoku"),
  },
  {
    href: "/profili",
    label: t.nav.profile,
    icon: UserCircle,
    match: (p: string) => p.startsWith("/profili"),
  },
];

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  badgeCount,
  variant,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  isActive: boolean;
  badgeCount: number;
  variant: "mobile" | "desktop";
}) {
  const base =
    variant === "mobile"
      ? "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[60px]"
      : "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold";

  const active =
    variant === "mobile"
      ? "text-blue-600 bg-blue-50"
      : "text-blue-700 bg-blue-50";
  const inactive =
    variant === "mobile"
      ? "text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100"
      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50";

  return (
    <Link href={href} className={`${base} transition-colors ${isActive ? active : inactive}`}>
      <span className="relative inline-flex">
        <Icon
          className={
            variant === "mobile"
              ? `w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`
              : `w-5 h-5 shrink-0 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`
          }
        />
        {badgeCount > 0 && (
          <span
            className={`absolute rounded-full bg-red-600 text-white font-bold text-center shadow-sm border-2 border-white ${
              variant === "mobile"
                ? "-top-1.5 -right-2 min-w-[18px] h-[18px] px-1 text-[10px] leading-[18px]"
                : "-top-1 -right-1 min-w-[16px] h-4 px-1 text-[9px] leading-4"
            }`}
            aria-label={`${badgeCount} ${t.vehicles.expiredRegistrationBadge}`}
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </span>
      <span
        className={
          variant === "mobile"
            ? `text-[10px] font-semibold leading-tight text-center ${isActive ? "text-blue-600" : ""}`
            : "truncate"
        }
      >
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const refreshVersion = useAppRefreshVersion();
  const { role, isManagement } = useRole();
  const [expiredRegistrationCount, setExpiredRegistrationCount] = useState(0);

  const visibleNavItems =
    role === null
      ? navItems
      : navItems.filter((item) => navHrefAllowedForRole(item.href, role));

  useEffect(() => {
    if (!isManagement) return;

    let cancelled = false;

    const updateCount = async () => {
      try {
        const vehicles = await db.vehicles.getActive();
        if (!cancelled) {
          setExpiredRegistrationCount(countExpiredRegistrations(vehicles));
        }
      } catch {
        if (!cancelled) setExpiredRegistrationCount(0);
      }
    };

    updateCount();
    window.addEventListener("vehicles:updated", updateCount);
    return () => {
      cancelled = true;
      window.removeEventListener("vehicles:updated", updateCount);
    };
  }, [refreshVersion, isManagement]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <>
      <nav className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40 w-56 flex-col bg-white border-r-2 border-gray-200 shadow-sm">
        <div className="px-5 py-6 border-b border-gray-100 shrink-0">
          <p className="text-lg font-extrabold text-gray-900">{t.appShortName}</p>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{t.appName}</p>
        </div>
        <div className="flex-1 flex flex-col gap-1 p-3 overflow-y-auto">
          {visibleNavItems.map((item) => {
            const badgeCount =
              "badgeKey" in item && item.badgeKey === "vehicles"
                ? expiredRegistrationCount
                : 0;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={item.match(pathname)}
                badgeCount={badgeCount}
                variant="desktop"
              />
            );
          })}
        </div>
      </nav>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 shadow-lg">
        <div className="flex items-stretch max-w-lg mx-auto">
          {visibleNavItems.map((item) => {
            const badgeCount =
              "badgeKey" in item && item.badgeKey === "vehicles"
                ? expiredRegistrationCount
                : 0;
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={item.match(pathname)}
                badgeCount={badgeCount}
                variant="mobile"
              />
            );
          })}
        </div>
      </nav>
    </>
  );
}
