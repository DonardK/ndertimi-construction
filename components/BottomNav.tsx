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
import { db } from "@/lib/db";
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

export default function BottomNav() {
  const pathname = usePathname();
  const refreshVersion = useAppRefreshVersion();
  const [expiredRegistrationCount, setExpiredRegistrationCount] = useState(0);

  useEffect(() => {
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
  }, [refreshVersion]);

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 shadow-lg">
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map((item) => {
          const { href, label, icon: Icon, match } = item;
          const isActive = match(pathname);
          const badgeCount =
            "badgeKey" in item && item.badgeKey === "vehicles"
              ? expiredRegistrationCount
              : 0;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[60px] transition-colors
                ${isActive
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                }`}
            >
              <span className="relative inline-flex">
                <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                {badgeCount > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold leading-[18px] text-center shadow-sm border-2 border-white"
                    aria-label={`${badgeCount} ${t.vehicles.expiredRegistrationBadge}`}
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-semibold leading-tight text-center ${isActive ? "text-blue-600" : ""}`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
