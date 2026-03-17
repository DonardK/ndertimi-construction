"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarCheck, Truck, Fuel } from "lucide-react";
import { t } from "@/lib/translations";

const navItems = [
  { href: "/", label: t.nav.dashboard, icon: LayoutDashboard },
  { href: "/punonjesit", label: t.nav.employees, icon: Users },
  { href: "/pjesemarrja", label: t.nav.attendance, icon: CalendarCheck },
  { href: "/mjetet", label: t.nav.vehicles, icon: Truck },
  { href: "/nafta", label: t.nav.diesel, icon: Fuel },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-gray-200 shadow-lg">
      <div className="flex items-stretch max-w-lg mx-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
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
              <Icon className={`w-6 h-6 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className={`text-[10px] font-semibold leading-tight text-center ${isActive ? "text-blue-600" : ""}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
