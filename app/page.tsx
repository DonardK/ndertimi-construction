"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/db";
import { t } from "@/lib/translations";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Fuel,
  Clock,
  CreditCard,
  Banknote,
  ChevronDown,
  Calendar,
  AlertCircle,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";

type DatePreset = "thisMonth" | "last3Months" | "last6Months" | "thisYear" | "custom";

interface DateRange {
  from: string;
  to: string;
}

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

function getPresetRange(preset: DatePreset): DateRange {
  const now = new Date();
  switch (preset) {
    case "thisMonth":
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "last3Months":
      return {
        from: format(startOfMonth(subMonths(now, 2)), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "last6Months":
      return {
        from: format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    case "thisYear":
      return {
        from: format(startOfYear(now), "yyyy-MM-dd"),
        to: format(endOfYear(now), "yyyy-MM-dd"),
      };
    default:
      return {
        from: format(startOfMonth(now), "yyyy-MM-dd"),
        to: format(endOfMonth(now), "yyyy-MM-dd"),
      };
  }
}

const presetLabels: Record<DatePreset, string> = {
  thisMonth: t.dashboard.thisMonth,
  last3Months: t.dashboard.last3Months,
  last6Months: t.dashboard.last6Months,
  thisYear: t.dashboard.thisYear,
  custom: t.dashboard.custom,
};

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shrink-0`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xl font-extrabold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  unit?: string;
}

function CustomTooltip({ active, payload, label, unit }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-semibold shadow-lg">
        <p className="text-gray-300 text-xs mb-0.5">{label}</p>
        <p>
          {unit === "€"
            ? `€${payload[0].value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : `${payload[0].value.toLocaleString("sq-AL")} ${unit}`}
        </p>
      </div>
    );
  }
  return null;
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange("thisMonth"));
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateRange.from);
  const [customTo, setCustomTo] = useState(dateRange.to);
  const [loading, setLoading] = useState(true);

  const [dieselByVehicle, setDieselByVehicle] = useState<
    { name: string; total: number }[]
  >([]);
  const [hoursByEmployee, setHoursByEmployee] = useState<
    { name: string; hours: number }[]
  >([]);
  const [paymentSplit, setPaymentSplit] = useState<
    { name: string; value: number }[]
  >([]);
  const [totalDiesel, setTotalDiesel] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalCashEur, setTotalCashEur] = useState(0);
  const [totalBankEur, setTotalBankEur] = useState(0);

  const isInRange = (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      return isWithinInterval(d, {
        start: parseISO(dateRange.from),
        end: parseISO(dateRange.to),
      });
    } catch {
      return false;
    }
  };

  const loadStats = async () => {
    setLoading(true);
    try {
      const [dieselRecs, attRecs, employees] = await Promise.all([
        db.diesel.getAll(),
        db.attendance.getAll(),
        db.employees.getAll(),
      ]);

      const filteredDiesel = dieselRecs.filter((r) => isInRange(r.date));
      const filteredAtt = attRecs.filter((r) => isInRange(r.date));

      // Build employee rate lookup map
      const rateMap: Record<number, number> = {};
      employees.forEach((e) => {
        if (e.id !== undefined) rateMap[e.id] = e.cmimiOre;
      });

      // Diesel by vehicle
      const dvMap: Record<string, number> = {};
      filteredDiesel.forEach((r) => {
        dvMap[r.emriMjetit] = (dvMap[r.emriMjetit] || 0) + r.totalPrice;
      });
      setDieselByVehicle(
        Object.entries(dvMap).map(([name, total]) => ({
          name,
          total: Math.round(total * 100) / 100,
        }))
      );
      setTotalDiesel(filteredDiesel.reduce((s, r) => s + r.totalPrice, 0));

      // Hours by employee
      const heMap: Record<string, number> = {};
      filteredAtt.forEach((r) => {
        const key = `${r.emri} ${r.mbiemri}`;
        heMap[key] = (heMap[key] || 0) + r.hoursWorked;
      });
      setHoursByEmployee(
        Object.entries(heMap).map(([name, hours]) => ({ name, hours }))
      );
      setTotalHours(filteredAtt.reduce((s, r) => s + r.hoursWorked, 0));

      // Payment split — amounts in EUR (hours × rate)
      const calcEur = (records: typeof filteredAtt) =>
        records.reduce((s, r) => {
          const rate = rateMap[r.employeeId] ?? 0;
          return s + r.hoursWorked * rate;
        }, 0);

      const cashAtt = filteredAtt.filter((r) => r.paymentMethod === "Cash");
      const bankAtt = filteredAtt.filter((r) => r.paymentMethod === "Bankë");
      const cashEur = calcEur(cashAtt);
      const bankEur = calcEur(bankAtt);

      setTotalCashEur(cashEur);
      setTotalBankEur(bankEur);
      setPaymentSplit(
        [
          { name: t.attendance.cash, value: Math.round(cashEur * 100) / 100 },
          { name: t.attendance.bank, value: Math.round(bankEur * 100) / 100 },
        ].filter((d) => d.value > 0)
      );
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p !== "custom") {
      setDateRange(getPresetRange(p));
    }
    setShowDateMenu(false);
  };

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setDateRange({ from: customFrom, to: customTo });
      setShowDateMenu(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            {t.dashboard.title}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {format(parseISO(dateRange.from), "dd/MM/yyyy")} —{" "}
            {format(parseISO(dateRange.to), "dd/MM/yyyy")}
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDateMenu(!showDateMenu)}
            className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-4 h-11 font-semibold text-gray-700 hover:bg-gray-50 shadow-sm text-sm"
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            {presetLabels[preset]}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>

          {showDateMenu && (
            <div className="absolute right-0 top-12 bg-white rounded-2xl shadow-2xl border border-gray-100 z-30 w-64 overflow-hidden">
              {(
                [
                  "thisMonth",
                  "last3Months",
                  "last6Months",
                  "thisYear",
                ] as DatePreset[]
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors
                    ${
                      preset === p
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  {presetLabels[p]}
                </button>
              ))}
              <div className="border-t border-gray-100 p-3">
                <p className="text-xs font-bold text-gray-500 mb-2 uppercase">
                  {t.dashboard.custom}
                </p>
                <div className="flex flex-col gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => {
                      setPreset("custom");
                      applyCustom();
                    }}
                    className="w-full h-10 bg-blue-600 text-white rounded-xl font-bold text-sm"
                  >
                    {t.dashboard.applyFilter}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click outside to close menu */}
      {showDateMenu && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setShowDateMenu(false)}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Fuel className="w-6 h-6 text-orange-600" />}
              label={t.dashboard.totalDieselCost}
              value={`€${totalDiesel.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color="bg-orange-100"
            />
            <StatCard
              icon={<Clock className="w-6 h-6 text-blue-600" />}
              label={t.dashboard.totalHoursWorked}
              value={`${totalHours} ${t.dashboard.hours}`}
              color="bg-blue-100"
            />
            <StatCard
              icon={<Banknote className="w-6 h-6 text-green-600" />}
              label={t.dashboard.totalCash}
              value={`€${totalCashEur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color="bg-green-100"
            />
            <StatCard
              icon={<CreditCard className="w-6 h-6 text-purple-600" />}
              label={t.dashboard.totalBank}
              value={`€${totalBankEur.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              color="bg-purple-100"
            />
          </div>

          {/* Diesel by vehicle chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <Fuel className="w-5 h-5 text-orange-500" />
              {t.dashboard.dieselPerVehicle}
            </h2>
            {dieselByVehicle.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{t.dashboard.noDataForPeriod}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={dieselByVehicle}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip unit="€" />}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                    {dieselByVehicle.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Hours by employee chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              {t.dashboard.hoursPerEmployee}
            </h2>
            {hoursByEmployee.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{t.dashboard.noDataForPeriod}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={hoursByEmployee}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fontWeight: 600, fill: "#64748b" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={<CustomTooltip unit="orë" />}
                    cursor={{ fill: "#f8fafc" }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]}>
                    {hoursByEmployee.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[(index + 2) % COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment split pie chart */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <h2 className="text-base font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-500" />
              {t.dashboard.paymentSplit}
            </h2>
            {paymentSplit.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{t.dashboard.noDataForPeriod}</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentSplit}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentSplit.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={index === 0 ? "#10b981" : "#3b82f6"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [
                      `€${Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      "",
                    ]}
                    contentStyle={{
                      borderRadius: "12px",
                      fontWeight: 600,
                      border: "none",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#374151",
                        }}
                      >
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
