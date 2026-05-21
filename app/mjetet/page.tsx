"use client";

import { Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SegmentedTabs from "@/components/SegmentedTabs";
import VehiclesSection from "@/components/sections/VehiclesSection";
import DieselSection from "@/components/sections/DieselSection";
import ServicesSection from "@/components/sections/ServicesSection";
import { t } from "@/lib/translations";

const tabs = [
  { id: "mjetet", label: t.mjetetHub.tabVehicles },
  { id: "nafta", label: t.mjetetHub.tabDiesel },
  { id: "serviset", label: t.mjetetHub.tabServices },
];

function MjetetHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabParam = searchParams.get("tab");
  const active =
    tabParam === "nafta" || tabParam === "serviset" ? tabParam : "mjetet";

  const onTabChange = useCallback(
    (id: string) => {
      router.replace(`/mjetet?tab=${id}`, { scroll: false });
    },
    [router]
  );

  return (
    <div className="pb-4">
      <div className="px-4 pt-6 pb-3">
        <SegmentedTabs tabs={tabs} active={active} onChange={onTabChange} />
      </div>
      {active === "mjetet" && <VehiclesSection />}
      {active === "nafta" && <DieselSection />}
      {active === "serviset" && <ServicesSection />}
    </div>
  );
}

export default function MjetetPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-gray-500 font-medium">
          {t.common.loading}
        </div>
      }
    >
      <MjetetHubContent />
    </Suspense>
  );
}
