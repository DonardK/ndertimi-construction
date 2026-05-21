"use client";

export interface TabDef {
  id: string;
  label: string;
}

interface SegmentedTabsProps {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export default function SegmentedTabs({
  tabs,
  active,
  onChange,
  className = "",
}: SegmentedTabsProps) {
  return (
    <div
      className={`flex rounded-2xl bg-gray-100 p-1 gap-0.5 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 min-w-0 py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold transition-colors
            ${
              active === tab.id
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
        >
          <span className="block truncate text-center">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
