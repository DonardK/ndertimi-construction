"use client";

import { useState, useEffect, useCallback } from "react";
import { db, type Employee } from "@/lib/db";
import { t } from "@/lib/translations";
import {
  Fuel,
  Clock,
  CreditCard,
  Banknote,
  ChevronDown,
  Calendar,
  AlertCircle,
  FileDown,
  Euro,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";

type DatePreset =
  | "thisMonth"
  | "last3Months"
  | "last6Months"
  | "thisYear"
  | "lastYear"
  | "allTime"
  | "custom";

interface DateRange {
  from: string;
  to: string;
}

interface WorkerRow {
  id: number;
  name: string;
  hours: number;
  rate: number;
  total: number;
  paid: number;
  net: number;
  paymentMethod: "Cash" | "Bankë";
}

interface VehicleRow {
  name: string;
  liters: number;
  avgPricePerLiter: number;
  total: number;
}

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
    case "lastYear": {
      const lastYear = subYears(now, 1);
      return {
        from: format(startOfYear(lastYear), "yyyy-MM-dd"),
        to: format(endOfYear(lastYear), "yyyy-MM-dd"),
      };
    }
    case "allTime":
      return { from: "2000-01-01", to: "2099-12-31" };
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
  lastYear: t.dashboard.lastYear,
  allTime: t.dashboard.allTime,
  custom: t.dashboard.custom,
};

function eur(n: number) {
  return `€${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">
          {label}
        </p>
        <p className="text-lg font-extrabold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<DatePreset>("thisMonth");
  const [dateRange, setDateRange] = useState<DateRange>(getPresetRange("thisMonth"));
  const [showDateMenu, setShowDateMenu] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateRange.from);
  const [customTo, setCustomTo] = useState(dateRange.to);
  const [loading, setLoading] = useState(true);

  const [workerRows, setWorkerRows] = useState<WorkerRow[]>([]);
  const [vehicleRows, setVehicleRows] = useState<VehicleRow[]>([]);
  const [totalDiesel, setTotalDiesel] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [totalCashEur, setTotalCashEur] = useState(0);
  const [totalBankEur, setTotalBankEur] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const isInRange = useCallback(
    (dateStr: string) => {
      if (preset === "allTime") return true;
      try {
        const d = parseISO(dateStr);
        return isWithinInterval(d, {
          start: parseISO(dateRange.from),
          end: parseISO(dateRange.to),
        });
      } catch {
        return false;
      }
    },
    [dateRange, preset]
  );

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [dieselRecs, attRecs, emps, allPayments] = await Promise.all([
        db.diesel.getAll(),
        db.attendance.getAll(),
        db.employees.getAll(),
        db.workerPayments.getAll(),
      ]);
      setEmployees(emps);

      const filteredDiesel = dieselRecs.filter((r) => isInRange(r.date));
      const filteredAtt = attRecs.filter((r) => isInRange(r.date));

      // Build employee rate lookup
      const rateMap: Record<number, { rate: number; method: "Cash" | "Bankë"; name: string }> = {};
      emps.forEach((e) => {
        if (e.id !== undefined)
          rateMap[e.id] = {
            rate: e.cmimiOre,
            method: e.paymentMethod,
            name: `${e.emri} ${e.mbiemri}`,
          };
      });

      // Payments lookup: sum per employee in the period
      const paidMap: Record<number, number> = {};
      allPayments
        .filter((p) => isInRange(p.date))
        .forEach((p) => {
          paidMap[p.employeeId] = (paidMap[p.employeeId] || 0) + p.amount;
        });

      // --- Workers table ---
      const wMap: Record<number, { hours: number }> = {};
      filteredAtt.forEach((r) => {
        if (!wMap[r.employeeId]) wMap[r.employeeId] = { hours: 0 };
        wMap[r.employeeId].hours += r.hoursWorked;
      });
      const wRows: WorkerRow[] = Object.entries(wMap)
        .map(([idStr, { hours }]) => {
          const id = parseInt(idStr);
          const info = rateMap[id];
          const total = hours * (info?.rate ?? 0);
          const paid = paidMap[id] ?? 0;
          return {
            id,
            name: info?.name ?? `ID ${id}`,
            hours,
            rate: info?.rate ?? 0,
            total,
            paid,
            net: total - paid,
            paymentMethod: info?.method ?? "Cash",
          };
        })
        .sort((a, b) => b.total - a.total);
      setWorkerRows(wRows);

      // Payment totals
      const cashEur = wRows
        .filter((r) => r.paymentMethod === "Cash")
        .reduce((s, r) => s + r.total, 0);
      const bankEur = wRows
        .filter((r) => r.paymentMethod === "Bankë")
        .reduce((s, r) => s + r.total, 0);
      setTotalCashEur(cashEur);
      setTotalBankEur(bankEur);
      setTotalHours(filteredAtt.reduce((s, r) => s + r.hoursWorked, 0));

      // --- Vehicles table ---
      const vMap: Record<string, { liters: number; cost: number }> = {};
      filteredDiesel.forEach((r) => {
        if (!vMap[r.emriMjetit]) vMap[r.emriMjetit] = { liters: 0, cost: 0 };
        vMap[r.emriMjetit].liters += r.liters;
        vMap[r.emriMjetit].cost += r.totalPrice;
      });
      const vRows: VehicleRow[] = Object.entries(vMap)
        .map(([name, { liters, cost }]) => ({
          name,
          liters: Math.round(liters * 100) / 100,
          avgPricePerLiter: liters > 0 ? Math.round((cost / liters) * 1000) / 1000 : 0,
          total: Math.round(cost * 100) / 100,
        }))
        .sort((a, b) => b.total - a.total);
      setVehicleRows(vRows);
      setTotalDiesel(filteredDiesel.reduce((s, r) => s + r.totalPrice, 0));
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, [isInRange]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const applyPreset = (p: DatePreset) => {
    setPreset(p);
    if (p !== "custom") setDateRange(getPresetRange(p));
    setShowDateMenu(false);
  };

  const applyCustom = () => {
    if (customFrom && customTo && customFrom <= customTo) {
      setDateRange({ from: customFrom, to: customTo });
      setShowDateMenu(false);
    }
  };

  const periodLabel =
    preset === "allTime"
      ? t.dashboard.allTime
      : preset === "custom"
      ? `${format(parseISO(dateRange.from), "dd/MM/yy")} — ${format(parseISO(dateRange.to), "dd/MM/yy")}`
      : `${format(parseISO(dateRange.from), "dd/MM/yy")} — ${format(parseISO(dateRange.to), "dd/MM/yy")}`;

  const exportWorkersPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Punonjësit — Detajet", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periudha: ${periodLabel}`, 14, 26);

    const cashWorkers = workerRows.filter((r) => r.paymentMethod === "Cash");
    const bankWorkers = workerRows.filter((r) => r.paymentMethod === "Bankë");

    const makeRows = (rows: WorkerRow[]) =>
      rows.map((r) => [
        r.name,
        r.hours.toString(),
        `€${r.rate.toFixed(2)}`,
        `€${r.total.toFixed(2)}`,
        r.paid > 0 ? `€${r.paid.toFixed(2)}` : "—",
        `€${r.net.toFixed(2)}`,
      ]);

    let finalY = 30;

    if (cashWorkers.length > 0) {
      doc.setFontSize(11);
      doc.text("Cash", 14, finalY + 6);
      autoTable(doc, {
        startY: finalY + 10,
        head: [["Punonjësi", "Orë", "€/orë", "Fituar", "Paguar", "Mbetur"]],
        body: makeRows(cashWorkers),
        foot: [
          [
            "TOTAL CASH",
            cashWorkers.reduce((s, r) => s + r.hours, 0).toString(),
            "",
            `€${cashWorkers.reduce((s, r) => s + r.total, 0).toFixed(2)}`,
            `€${cashWorkers.reduce((s, r) => s + r.paid, 0).toFixed(2)}`,
            `€${cashWorkers.reduce((s, r) => s + r.net, 0).toFixed(2)}`,
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [22, 163, 74] },
        footStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: "bold" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalY = (doc as any).lastAutoTable.finalY + 8;
    }

    if (bankWorkers.length > 0) {
      doc.setFontSize(11);
      doc.text("Bankë", 14, finalY + 6);
      autoTable(doc, {
        startY: finalY + 10,
        head: [["Punonjësi", "Orë", "€/orë", "Fituar", "Paguar", "Mbetur"]],
        body: makeRows(bankWorkers),
        foot: [
          [
            "TOTAL BANKË",
            bankWorkers.reduce((s, r) => s + r.hours, 0).toString(),
            "",
            `€${bankWorkers.reduce((s, r) => s + r.total, 0).toFixed(2)}`,
            `€${bankWorkers.reduce((s, r) => s + r.paid, 0).toFixed(2)}`,
            `€${bankWorkers.reduce((s, r) => s + r.net, 0).toFixed(2)}`,
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235] },
        footStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalY = (doc as any).lastAutoTable.finalY + 8;
    }

    autoTable(doc, {
      startY: finalY + 4,
      body: [
        [
          "FITUAR GJITHSEJ", `${totalHours} orë`, "", eur(totalCashEur + totalBankEur),
          eur(workerRows.reduce((s, r) => s + r.paid, 0)),
          eur(workerRows.reduce((s, r) => s + r.net, 0)),
        ],
      ],
      theme: "plain",
      bodyStyles: { fontStyle: "bold", fontSize: 12, fillColor: [243, 244, 246] },
    });

    doc.save(`punonjesit-${dateRange.from}-${dateRange.to}.pdf`);
  };

  const exportVehiclesPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Mjetet — Nafta", 14, 18);
    doc.setFontSize(10);
    doc.text(`Periudha: ${periodLabel}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [["Mjeti", "Litrat", "Avg €/L", "Totali (€)"]],
      body: vehicleRows.map((r) => [
        r.name,
        `${r.liters} L`,
        `€${r.avgPricePerLiter.toFixed(3)}`,
        `€${r.total.toFixed(2)}`,
      ]),
      foot: [
        [
          "TOTALI",
          `${vehicleRows.reduce((s, r) => s + r.liters, 0).toFixed(2)} L`,
          "",
          `€${totalDiesel.toFixed(2)}`,
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [234, 88, 12] },
      footStyles: { fillColor: [234, 88, 12], textColor: 255, fontStyle: "bold" },
    });

    doc.save(`nafta-${dateRange.from}-${dateRange.to}.pdf`);
  };

  // suppress unused import
  void employees;

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">{t.dashboard.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{periodLabel}</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDateMenu(!showDateMenu)}
            className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-3 h-11 font-semibold text-gray-700 hover:bg-gray-50 shadow-sm text-sm"
          >
            <Calendar className="w-4 h-4 text-blue-500" />
            <span className="hidden sm:inline">{presetLabels[preset]}</span>
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
                  "lastYear",
                  "allTime",
                ] as DatePreset[]
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => applyPreset(p)}
                  className={`w-full text-left px-4 py-3 text-sm font-semibold transition-colors border-b border-gray-50
                    ${preset === p ? "bg-blue-50 text-blue-600" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  {presetLabels[p]}
                </button>
              ))}
              <div className="p-3">
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

      {showDateMenu && (
        <div className="fixed inset-0 z-20" onClick={() => setShowDateMenu(false)} />
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Fuel className="w-5 h-5 text-orange-600" />}
              label={t.dashboard.totalDieselCost}
              value={eur(totalDiesel)}
              color="bg-orange-100"
            />
            <StatCard
              icon={<Clock className="w-5 h-5 text-blue-600" />}
              label={t.dashboard.totalHoursWorked}
              value={`${totalHours} orë`}
              color="bg-blue-100"
            />
            <StatCard
              icon={<Banknote className="w-5 h-5 text-green-600" />}
              label={t.dashboard.totalCash}
              value={eur(totalCashEur)}
              color="bg-green-100"
            />
            <StatCard
              icon={<CreditCard className="w-5 h-5 text-purple-600" />}
              label={t.dashboard.totalBank}
              value={eur(totalBankEur)}
              color="bg-purple-100"
            />
          </div>

          {/* ── Workers table ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Euro className="w-4 h-4 text-blue-500" />
                {t.dashboard.workersTable}
              </h2>
              {workerRows.length > 0 && (
                <button
                  onClick={exportWorkersPdf}
                  className="flex items-center gap-1.5 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  PDF
                </button>
              )}
            </div>

            {workerRows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{t.dashboard.noDataForPeriod}</span>
              </div>
            ) : (
              <>
                {/* Cash workers */}
                {workerRows.filter((r) => r.paymentMethod === "Cash").length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-green-50 border-b border-green-100">
                      <span className="text-xs font-bold text-green-700 uppercase tracking-wide flex items-center gap-1">
                        <Banknote className="w-3.5 h-3.5" /> Cash
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left px-4 py-2 font-semibold">Punonjësi</th>
                          <th className="text-right px-3 py-2 font-semibold">Orë</th>
                          <th className="text-right px-3 py-2 font-semibold">€/orë</th>
                          <th className="text-right px-3 py-2 font-semibold">Fituar</th>
                          <th className="text-right px-3 py-2 font-semibold text-emerald-700">Paguar</th>
                          <th className="text-right px-4 py-2 font-semibold text-orange-700">Mbetur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerRows
                          .filter((r) => r.paymentMethod === "Cash")
                          .map((r) => (
                            <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{r.hours}</td>
                              <td className="px-3 py-3 text-right text-gray-500">€{r.rate.toFixed(2)}</td>
                              <td className="px-3 py-3 text-right font-bold text-gray-900">{eur(r.total)}</td>
                              <td className="px-3 py-3 text-right font-bold text-emerald-700">{r.paid > 0 ? eur(r.paid) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-700">{eur(r.net)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-green-50 border-t-2 border-green-200">
                          <td className="px-4 py-2 text-xs font-bold text-green-800 uppercase">Total Cash</td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-green-800">
                            {workerRows.filter((r) => r.paymentMethod === "Cash").reduce((s, r) => s + r.hours, 0)} orë
                          </td>
                          <td />
                          <td className="px-3 py-2 text-right font-extrabold text-green-800">
                            {eur(totalCashEur)}
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-emerald-800">
                            {eur(workerRows.filter((r) => r.paymentMethod === "Cash").reduce((s, r) => s + r.paid, 0))}
                          </td>
                          <td className="px-4 py-2 text-right font-extrabold text-orange-800">
                            {eur(workerRows.filter((r) => r.paymentMethod === "Cash").reduce((s, r) => s + r.net, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </div>
                )}

                {/* Bank workers */}
                {workerRows.filter((r) => r.paymentMethod === "Bankë").length > 0 && (
                  <div>
                    <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 border-t border-gray-100">
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5" /> Bankë
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left px-4 py-2 font-semibold">Punonjësi</th>
                          <th className="text-right px-3 py-2 font-semibold">Orë</th>
                          <th className="text-right px-3 py-2 font-semibold">€/orë</th>
                          <th className="text-right px-3 py-2 font-semibold">Fituar</th>
                          <th className="text-right px-3 py-2 font-semibold text-emerald-700">Paguar</th>
                          <th className="text-right px-4 py-2 font-semibold text-orange-700">Mbetur</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerRows
                          .filter((r) => r.paymentMethod === "Bankë")
                          .map((r) => (
                            <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                              <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{r.hours}</td>
                              <td className="px-3 py-3 text-right text-gray-500">€{r.rate.toFixed(2)}</td>
                              <td className="px-3 py-3 text-right font-bold text-gray-900">{eur(r.total)}</td>
                              <td className="px-3 py-3 text-right font-bold text-emerald-700">{r.paid > 0 ? eur(r.paid) : <span className="text-gray-300">—</span>}</td>
                              <td className="px-4 py-3 text-right font-bold text-orange-700">{eur(r.net)}</td>
                            </tr>
                          ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-50 border-t-2 border-blue-200">
                          <td className="px-4 py-2 text-xs font-bold text-blue-800 uppercase">Total Bankë</td>
                          <td className="px-3 py-2 text-right text-xs font-bold text-blue-800">
                            {workerRows.filter((r) => r.paymentMethod === "Bankë").reduce((s, r) => s + r.hours, 0)} orë
                          </td>
                          <td />
                          <td className="px-3 py-2 text-right font-extrabold text-blue-800">
                            {eur(totalBankEur)}
                          </td>
                          <td className="px-3 py-2 text-right font-extrabold text-emerald-800">
                            {eur(workerRows.filter((r) => r.paymentMethod === "Bankë").reduce((s, r) => s + r.paid, 0))}
                          </td>
                          <td className="px-4 py-2 text-right font-extrabold text-orange-800">
                            {eur(workerRows.filter((r) => r.paymentMethod === "Bankë").reduce((s, r) => s + r.net, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </div>
                )}

                {/* Grand total */}
                <div className="grid grid-cols-3 bg-gray-900 text-white">
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Fituar</p>
                    <p className="text-base font-extrabold">{eur(totalCashEur + totalBankEur)}</p>
                  </div>
                  <div className="px-4 py-3 border-x border-gray-700">
                    <p className="text-xs text-emerald-400 uppercase tracking-wide">Paguar</p>
                    <p className="text-base font-extrabold text-emerald-300">{eur(workerRows.reduce((s, r) => s + r.paid, 0))}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-xs text-orange-400 uppercase tracking-wide">Mbetur</p>
                    <p className="text-base font-extrabold text-orange-300">{eur(workerRows.reduce((s, r) => s + r.net, 0))}</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Vehicles / Nafta table ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-orange-500" />
                {t.dashboard.vehiclesTable}
              </h2>
              {vehicleRows.length > 0 && (
                <button
                  onClick={exportVehiclesPdf}
                  className="flex items-center gap-1.5 text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <FileDown className="w-4 h-4" />
                  PDF
                </button>
              )}
            </div>

            {vehicleRows.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                <AlertCircle className="w-5 h-5" />
                <span className="text-sm">{t.dashboard.noDataForPeriod}</span>
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="text-left px-4 py-2 font-semibold">Mjeti</th>
                      <th className="text-right px-3 py-2 font-semibold">Litrat</th>
                      <th className="text-right px-3 py-2 font-semibold">Avg €/L</th>
                      <th className="text-right px-4 py-2 font-semibold">Totali</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicleRows.map((r) => (
                      <tr key={r.name} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-900">{r.name}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{r.liters} L</td>
                        <td className="px-3 py-3 text-right text-gray-500">€{r.avgPricePerLiter.toFixed(3)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900">{eur(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-orange-50 border-t-2 border-orange-200">
                      <td className="px-4 py-2 text-xs font-bold text-orange-800 uppercase">Total</td>
                      <td className="px-3 py-2 text-right text-xs font-bold text-orange-800">
                        {vehicleRows.reduce((s, r) => s + r.liters, 0).toFixed(2)} L
                      </td>
                      <td />
                      <td className="px-4 py-2 text-right font-extrabold text-orange-800">
                        {eur(totalDiesel)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
