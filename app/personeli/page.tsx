"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useCallback } from "react";
import SegmentedTabs from "@/components/SegmentedTabs";
import EmployeesSection from "@/components/sections/EmployeesSection";
import AttendanceSection from "@/components/sections/AttendanceSection";
import { t } from "@/lib/translations";

const tabs = [
  { id: "employees", label: t.personeli.tabEmployees },
  { id: "attendance", label: t.personeli.tabAttendance },
];

function PersoneliContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const active = tabParam === "attendance" ? "attendance" : "employees";

  const onTabChange = useCallback(
    (id: string) => {
      router.replace(`/personeli?tab=${id}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="pb-4">
      <div className="px-4 pt-6 pb-3">
        <SegmentedTabs tabs={tabs} active={active} onChange={onTabChange} />
      </div>
      {active === "employees" ? <EmployeesSection /> : <AttendanceSection />}
    </div>
  );
}

export default function PersoneliPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-gray-500 font-medium">
          {t.common.loading}
        </div>
      }
    >
      <PersoneliContent />
    </Suspense>
  );
}
