"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAppRefreshVersion } from "@/components/AppRefreshProvider";
import { useRole } from "@/components/RoleProvider";
import {
  db,
  type DailyReport,
  type Company,
  COMPANIES,
  DEFAULT_COMPANY,
  workLocationLabel,
  type WorkLocation,
} from "@/lib/db";
import { t } from "@/lib/translations";
import toast from "react-hot-toast";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  Fuel,
  Users as UsersIcon,
  CreditCard,
  Banknote,
  AlertCircle,
  FileDown,
  Euro,
  FileText,
  X,
  Printer,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  format,
  isWithinInterval,
  parseISO,
} from "date-fns";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

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
  emriBankes: string;
  llogariaBankes: string;
}

interface VehicleRow {
  name: string;
  liters: number;
  avgPricePerLiter: number;
  total: number;
}

type CompanyFilter = "all" | Company;

interface ReportWorkerRow {
  employeeId: number;
  name: string;
  location: WorkLocation;
  hours: number;
  company: Company;
}

function matchesCompanyFilter(company: Company, filter: CompanyFilter): boolean {
  return filter === "all" || company === filter;
}

function reportBreakdownKey(date: string, company: Company): string {
  return `${date}|${company}`;
}

function getMonthRange(ym: string): DateRange {
  const [year, month] = ym.split("-").map((n) => parseInt(n, 10));
  const start = new Date(year, month - 1, 1);
  return {
    from: format(startOfMonth(start), "yyyy-MM-dd"),
    to: format(endOfMonth(start), "yyyy-MM-dd"),
  };
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-").map((n) => parseInt(n, 10));
  const d = new Date(year, month - 1, 1);
  return format(d, "MMMM yyyy");
}

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
  const refreshVersion = useAppRefreshVersion();
  const { canViewFinancials, loading: roleLoading } = useRole();
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<CompanyFilter>("all");
  // Memoized: a fresh object each render would recreate isInRange/loadStats
  // and re-trigger the data-loading effect in an infinite loop.
  const dateRange = useMemo(() => getMonthRange(selectedMonth), [selectedMonth]);
  const [loading, setLoading] = useState(true);

  const [workerRows, setWorkerRows] = useState<WorkerRow[]>([]);
  const [vehicleRows, setVehicleRows] = useState<VehicleRow[]>([]);
  const [totalDiesel, setTotalDiesel] = useState(0);
  const [totalHours, setTotalHours] = useState(0);
  const [workerCount, setWorkerCount] = useState(0);
  const [totalCashEur, setTotalCashEur] = useState(0);
  const [totalBankEur, setTotalBankEur] = useState(0);

  // Reports state
  const [showReports, setShowReports] = useState(false);
  const [reportsList, setReportsList] = useState<DailyReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [reportLocations, setReportLocations] = useState<
    Record<string, ReportWorkerRow[]>
  >({});
  const [reportFormMode, setReportFormMode] = useState<"create" | "edit" | null>(
    null
  );
  const [reportFormDate, setReportFormDate] = useState("");
  const [reportFormCompany, setReportFormCompany] =
    useState<Company>(DEFAULT_COMPANY);
  const [reportFormTitle, setReportFormTitle] = useState("");
  const [reportFormContent, setReportFormContent] = useState("");
  const [reportFormError, setReportFormError] = useState<string | null>(null);
  const [reportFormSaving, setReportFormSaving] = useState(false);
  const [deleteReportId, setDeleteReportId] = useState<number | null>(null);

  useBodyScrollLock(showReports);

  const isInRange = useCallback(
    (dateStr: string) => {
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
    [dateRange]
  );

  const loadStats = useCallback(async () => {
    if (!canViewFinancials) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dieselRecs, attRecs, emps, allPayments] = await Promise.all([
        db.diesel.getAll(),
        db.attendance.getAll(),
        db.employees.getAll(),
        db.workerPayments.getAll(),
      ]);

      const filteredDiesel = dieselRecs.filter((r) => isInRange(r.date));
      const filteredAtt = attRecs.filter(
        (r) => isInRange(r.date) && matchesCompanyFilter(r.company, selectedCompanyFilter)
      );

      // Build employee rate lookup
      const rateMap: Record<
        number,
        {
          rate: number;
          method: "Cash" | "Bankë";
          name: string;
          emriBankes: string;
          llogariaBankes: string;
        }
      > = {};
      emps.forEach((e) => {
        if (e.id !== undefined)
          rateMap[e.id] = {
            rate: e.cmimiOre,
            method: e.paymentMethod,
            name: `${e.emri} ${e.mbiemri}`,
            emriBankes: e.emriBankes ?? "",
            llogariaBankes: e.llogariaBankes ?? "",
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
            emriBankes: info?.emriBankes ?? "",
            llogariaBankes: info?.llogariaBankes ?? "",
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
      setWorkerCount(new Set(filteredAtt.map((r) => r.employeeId)).size);

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
      toast.error(t.errors.loadError);
    } finally {
      setLoading(false);
    }
  }, [isInRange, canViewFinancials, selectedCompanyFilter]);

  useEffect(() => {
    if (roleLoading) return;
    loadStats();
  }, [loadStats, refreshVersion, roleLoading]);

  const periodLabel = formatMonthLabel(selectedMonth);
  const companyLabel =
    selectedCompanyFilter === "all" ? null : selectedCompanyFilter;
  const pageLoading = roleLoading || (canViewFinancials && loading);

  const exportWorkersPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const useLandscape = workerRows.some((r) => r.paymentMethod === "Bankë");
    const doc = new jsPDF(useLandscape ? { orientation: "landscape" } : {});

    const pdfTitle =
      selectedCompanyFilter === "all"
        ? "Punonjësit — Detajet"
        : `Punonjësit — ${selectedCompanyFilter}`;
    doc.setFontSize(16);
    doc.text(pdfTitle, 14, 18);
    doc.setFontSize(10);
    doc.text(`Periudha: ${periodLabel}`, 14, 26);
    if (companyLabel) {
      doc.text(`Kompania: ${companyLabel}`, 14, 32);
    }

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

    let finalY = companyLabel ? 36 : 30;

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

    const makeBankPdfRows = (rows: WorkerRow[]) =>
      rows.map((r) => [
        r.name,
        r.emriBankes || "—",
        r.llogariaBankes || "—",
        r.hours.toString(),
        `€${r.rate.toFixed(2)}`,
        `€${r.total.toFixed(2)}`,
        r.paid > 0 ? `€${r.paid.toFixed(2)}` : "—",
        `€${r.net.toFixed(2)}`,
      ]);

    if (bankWorkers.length > 0) {
      doc.setFontSize(11);
      doc.text("Bankë", 14, finalY + 6);
      autoTable(doc, {
        startY: finalY + 10,
        head: [
          [
            "Punonjësi",
            "Emri i bankës",
            "Llogaria e bankës",
            "Orë",
            "€/orë",
            "Fituar",
            "Paguar",
            "Mbetur",
          ],
        ],
        body: makeBankPdfRows(bankWorkers),
        foot: [
          [
            "TOTAL BANKË",
            "",
            "",
            bankWorkers.reduce((s, r) => s + r.hours, 0).toString(),
            "",
            `€${bankWorkers.reduce((s, r) => s + r.total, 0).toFixed(2)}`,
            `€${bankWorkers.reduce((s, r) => s + r.paid, 0).toFixed(2)}`,
            `€${bankWorkers.reduce((s, r) => s + r.net, 0).toFixed(2)}`,
          ],
        ],
        theme: "striped",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
        footStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold", fontSize: 8 },
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

    const pdfSuffix =
      selectedCompanyFilter === "all"
        ? ""
        : `-${selectedCompanyFilter.replace(/\s+/g, "-").toLowerCase()}`;
    doc.save(`punonjesit-${dateRange.from}-${dateRange.to}${pdfSuffix}.pdf`);
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

  // ── Reports ──
  const loadReports = useCallback(async (ym: string, companyFilter: CompanyFilter) => {
    if (!ym) return;
    setReportsLoading(true);
    try {
      const [year, month] = ym.split("-").map((n) => parseInt(n));
      const [reports, atts] = await Promise.all([
        db.dailyReports.getByMonth(year, month),
        db.attendance.getAll(),
      ]);
      const filteredReports = reports.filter((r) =>
        matchesCompanyFilter(r.company, companyFilter)
      );
      setReportsList(filteredReports);

      const mm = String(month).padStart(2, "0");
      const monthPrefix = `${year}-${mm}-`;
      const breakdown: Record<string, ReportWorkerRow[]> = {};
      atts
        .filter(
          (a) =>
            a.date.startsWith(monthPrefix) &&
            matchesCompanyFilter(a.company, companyFilter)
        )
        .forEach((a) => {
          const key = reportBreakdownKey(a.date, a.company);
          if (!breakdown[key]) breakdown[key] = [];
          const rows = breakdown[key];
          const existing = rows.find(
            (r) =>
              r.employeeId === a.employeeId &&
              r.location === a.location &&
              r.company === a.company
          );
          if (existing) {
            existing.hours += a.hoursWorked;
          } else {
            rows.push({
              employeeId: a.employeeId,
              name: `${a.emri} ${a.mbiemri}`,
              location: a.location,
              hours: a.hoursWorked,
              company: a.company,
            });
          }
        });
      Object.keys(breakdown).forEach((d) => {
        breakdown[d].sort((a, b) => a.name.localeCompare(b.name));
      });
      setReportLocations(breakdown);
    } catch {
      setReportsList([]);
      setReportLocations({});
    } finally {
      setReportsLoading(false);
    }
  }, []);

  const openReports = () => {
    setSelectedReport(null);
    setReportFormMode(null);
    setShowReports(true);
  };

  const closeReports = () => {
    setShowReports(false);
    setSelectedReport(null);
    setReportFormMode(null);
    setReportFormError(null);
  };

  const defaultReportDate = (ym: string) => {
    const today = format(new Date(), "yyyy-MM-dd");
    return today.startsWith(`${ym}-`) ? today : `${ym}-01`;
  };

  const openCreateReport = () => {
    setSelectedReport(null);
    setReportFormError(null);
    setReportFormDate(defaultReportDate(selectedMonth));
    setReportFormCompany(
      selectedCompanyFilter === "all" ? DEFAULT_COMPANY : selectedCompanyFilter
    );
    setReportFormTitle("");
    setReportFormContent("");
    setReportFormMode("create");
    setShowReports(true);
  };

  const openEditReport = (r: DailyReport) => {
    setReportFormError(null);
    setReportFormDate(r.date);
    setReportFormCompany(r.company);
    setReportFormTitle(r.title);
    setReportFormContent(r.content);
    setReportFormMode("edit");
    setSelectedReport(r);
    setShowReports(true);
  };

  const handleReportFormSave = async () => {
    if (!reportFormDate || !reportFormTitle.trim() || !reportFormContent.trim()) {
      setReportFormError(t.dashboard.reportRequired);
      return;
    }
    setReportFormError(null);
    setReportFormSaving(true);
    const payload = {
      date: reportFormDate,
      title: reportFormTitle.trim(),
      content: reportFormContent.trim(),
      company: reportFormCompany,
    };
    try {
      if (reportFormMode === "create") {
        const existing = await db.dailyReports.getByDate(
          payload.date,
          payload.company
        );
        if (existing) {
          setReportFormError(t.dashboard.reportExists);
          return;
        }
        await db.dailyReports.upsert(payload);
        toast.success(t.success.saved);
      } else if (reportFormMode === "edit" && selectedReport?.id != null) {
        const existing = await db.dailyReports.getByDate(
          payload.date,
          payload.company
        );
        if (existing && existing.id !== selectedReport.id) {
          setReportFormError(t.dashboard.reportExists);
          return;
        }
        await db.dailyReports.update(selectedReport.id, payload);
        toast.success(t.success.updated);
      }
      setReportFormMode(null);
      await loadReports(selectedMonth, selectedCompanyFilter);
      const saved = await db.dailyReports.getByDate(payload.date, payload.company);
      setSelectedReport(saved);
    } catch {
      toast.error(t.errors.saveError);
    } finally {
      setReportFormSaving(false);
    }
  };

  const handleDeleteReport = async () => {
    if (deleteReportId == null) return;
    try {
      await db.dailyReports.delete(deleteReportId);
      toast.success(t.success.deleted);
      setDeleteReportId(null);
      setSelectedReport(null);
      await loadReports(selectedMonth, selectedCompanyFilter);
    } catch {
      toast.error(t.errors.deleteError);
    }
  };

  useEffect(() => {
    if (showReports || !canViewFinancials) {
      loadReports(selectedMonth, selectedCompanyFilter);
    }
  }, [
    showReports,
    selectedMonth,
    selectedCompanyFilter,
    loadReports,
    canViewFinancials,
    refreshVersion,
  ]);

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const printReport = (r: DailyReport) => {
    const workers =
      reportLocations[reportBreakdownKey(r.date, r.company)] ?? [];
    const dateLabel = format(parseISO(r.date), "dd/MM/yyyy");
    const rows = workers
      .map(
        (w) =>
          `<tr><td>${escapeHtml(w.name)}</td><td style="text-align:center">${escapeHtml(
            workLocationLabel(w.location)
          )}</td><td style="text-align:right">${
            w.hours
          } orë</td></tr>`
      )
      .join("");
    const totalH = workers.reduce((s, w) => s + w.hours, 0);
    const companyMeta = `<div class="meta">Kompania: <b>${escapeHtml(r.company)}</b></div>`;
    const html = `<!doctype html>
<html lang="sq"><head><meta charset="utf-8"><title>Raport ${escapeHtml(r.title)} — ${dateLabel}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:24px;max-width:780px;margin:0 auto}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#555;font-size:13px;margin-bottom:18px}
  .content{background:#f8fafc;padding:14px 16px;border-radius:8px;border:1px solid #e5e7eb;white-space:pre-wrap;font-size:14px;line-height:1.5;margin-bottom:22px}
  h2{font-size:14px;text-transform:uppercase;letter-spacing:0.05em;color:#374151;margin:18px 0 8px}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border:1px solid #e5e7eb;padding:8px 10px}
  th{background:#f1f5f9;text-align:left}
  tfoot td{font-weight:bold;background:#f1f5f9}
  @media print {body{padding:0}}
</style></head><body>
  <h1>${escapeHtml(r.title)}</h1>
  <div class="meta">Data: <b>${dateLabel}</b></div>
  ${companyMeta}
  <h2>Përshkrimi</h2>
  <div class="content">${escapeHtml(r.content)}</div>
  <h2>Punonjësit (${workers.length})</h2>
  <table>
    <thead><tr><th>Punonjësi</th><th style="text-align:center">Vendi</th><th style="text-align:right">Orët</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="3" style="text-align:center;color:#888">—</td></tr>`}</tbody>
    <tfoot><tr><td colspan="2">Totali</td><td style="text-align:right">${totalH} orë</td></tr></tfoot>
  </table>
  <script>window.onload=()=>{window.print();}</script>
</body></html>`;
    const w = window.open("", "_blank", "width=820,height=900");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="px-4 pt-6 pb-4 lg:px-0 min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5 lg:mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">{t.dashboard.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {periodLabel}
            {companyLabel ? ` · ${companyLabel}` : ""}
          </p>
        </div>
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:min-w-[220px]">
          <div className="w-full sm:min-w-[200px]">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t.dashboard.filterCompany}
            </label>
            <select
              value={selectedCompanyFilter}
              onChange={(e) =>
                setSelectedCompanyFilter(e.target.value as CompanyFilter)
              }
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base lg:text-lg font-medium text-gray-900 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="all">{t.dashboard.allCompanies}</option>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full sm:min-w-[220px]">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {t.dashboard.selectMonth}
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              // Clearing the picker emits "" — would crash month parsing.
              if (e.target.value) setSelectedMonth(e.target.value);
            }}
            className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base lg:text-lg font-medium text-gray-900 focus:outline-none focus:border-blue-500 bg-white"
          />
          </div>
        </div>
      </div>

      {pageLoading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : !canViewFinancials ? (
        <div className="flex flex-col gap-5">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                {t.dashboard.reportsTitle}
              </h2>
              <button
                onClick={openCreateReport}
                className="flex items-center gap-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t.dashboard.addReport}
              </button>
            </div>
            {reportsLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reportsList.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                <AlertCircle className="w-8 h-8" />
                <span className="text-sm">{t.dashboard.noReports}</span>
                <button
                  onClick={openCreateReport}
                  className="text-sm font-bold text-amber-700 hover:text-amber-900"
                >
                  {t.dashboard.addReport}
                </button>
              </div>
            ) : (
              <ul>
                {reportsList.map((r) => (
                  <li key={r.id ?? `${r.date}-${r.company}`}>
                    <button
                      onClick={() => {
                        setSelectedReport(r);
                        setReportFormMode(null);
                        setShowReports(true);
                      }}
                      className="w-full flex items-center gap-3 px-6 py-3 border-b border-gray-100 hover:bg-amber-50 transition-colors text-left"
                    >
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-xs font-bold text-amber-700 uppercase">
                          {format(parseISO(r.date), "MMM")}
                        </p>
                        <p className="text-xl font-extrabold text-gray-900 leading-none">
                          {format(parseISO(r.date), "dd")}
                        </p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{r.title}</p>
                        <p className="text-xs text-gray-500 truncate">{r.content}</p>
                        <span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                          {r.company}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 lg:gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            <StatCard
              icon={<Fuel className="w-5 h-5 text-orange-600" />}
              label={t.dashboard.totalDieselCost}
              value={eur(totalDiesel)}
              color="bg-orange-100"
            />
            <StatCard
              icon={<UsersIcon className="w-5 h-5 text-blue-600" />}
              label={t.dashboard.workersThisMonth}
              value={`${workerCount}`}
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

          {/* ── Raportet button ── */}
          <button
            onClick={openReports}
            className="w-full sm:w-auto sm:self-start flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold h-14 px-8 rounded-2xl text-base transition-colors shadow-md"
          >
            <FileText className="w-5 h-5" />
            {t.dashboard.reports}
          </button>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 lg:gap-6 min-w-0">
          {/* ── Workers table ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-w-0">
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
                          <th className="text-left px-3 py-2 font-semibold min-w-[6rem]">
                            {t.dashboard.bankNameCol}
                          </th>
                          <th className="text-left px-3 py-2 font-semibold min-w-[6rem]">
                            {t.dashboard.bankAccountCol}
                          </th>
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
                              <td className="px-3 py-3 text-left text-gray-700 text-xs max-w-[8rem] truncate" title={r.emriBankes}>
                                {r.emriBankes || "—"}
                              </td>
                              <td className="px-3 py-3 text-left text-gray-700 text-xs max-w-[9rem] truncate font-mono" title={r.llogariaBankes}>
                                {r.llogariaBankes || "—"}
                              </td>
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
                          <td colSpan={2} />
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-w-0">
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
                <div className="overflow-x-auto">
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
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ── REPORTS MODAL ── */}
      {showReports && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          data-no-pull-refresh
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeReports}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  {reportFormMode === "create"
                    ? t.dashboard.addReport
                    : reportFormMode === "edit"
                      ? t.dashboard.editReport
                      : t.dashboard.reportsTitle}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {periodLabel}
                  {companyLabel ? ` · ${companyLabel}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!reportFormMode && !selectedReport && (
                  <button
                    onClick={openCreateReport}
                    className="flex items-center gap-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t.common.add}
                  </button>
                )}
                <button
                  onClick={closeReports}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {reportFormMode ? (
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {t.dashboard.reportDate}
                    </label>
                    <input
                      type="date"
                      value={reportFormDate}
                      onChange={(e) => setReportFormDate(e.target.value)}
                      className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-amber-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {t.dashboard.filterCompany}
                    </label>
                    <select
                      value={reportFormCompany}
                      onChange={(e) =>
                        setReportFormCompany(e.target.value as Company)
                      }
                      className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-amber-500 bg-white"
                    >
                      {COMPANIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {t.dashboard.reportTitle} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reportFormTitle}
                      onChange={(e) => setReportFormTitle(e.target.value)}
                      placeholder={t.dashboard.reportTitlePlaceholder}
                      className={`w-full h-12 px-4 rounded-xl border-2 text-base font-medium text-gray-900 focus:outline-none bg-white ${
                        reportFormError && !reportFormTitle.trim()
                          ? "border-red-400"
                          : "border-gray-300 focus:border-amber-500"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                      {t.dashboard.reportContent} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={reportFormContent}
                      onChange={(e) => setReportFormContent(e.target.value)}
                      placeholder={t.dashboard.reportContentPlaceholder}
                      rows={6}
                      className={`w-full px-4 py-3 rounded-xl border-2 text-base text-gray-900 focus:outline-none bg-white resize-y ${
                        reportFormError && !reportFormContent.trim()
                          ? "border-red-400"
                          : "border-gray-300 focus:border-amber-500"
                      }`}
                    />
                  </div>
                  {reportFormError && (
                    <p className="text-sm font-semibold text-red-600">{reportFormError}</p>
                  )}
                </div>
                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setReportFormMode(null);
                      setReportFormError(null);
                    }}
                    disabled={reportFormSaving}
                    className="flex-1 h-12 rounded-xl border-2 border-gray-300 text-gray-700 font-bold hover:bg-gray-50 disabled:opacity-50"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleReportFormSave}
                    disabled={reportFormSaving}
                    className="flex-1 h-12 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
                  >
                    {reportFormSaving ? t.common.loading : t.common.save}
                  </button>
                </div>
              </div>
            ) : selectedReport ? (
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-amber-50">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="text-sm font-bold text-amber-800 hover:text-amber-900"
                  >
                    ← {t.common.back}
                  </button>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                      onClick={() => openEditReport(selectedReport)}
                      className="flex items-center gap-1.5 text-sm font-bold text-amber-800 bg-white hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      {t.common.edit}
                    </button>
                    <button
                      onClick={() =>
                        selectedReport.id != null &&
                        setDeleteReportId(selectedReport.id)
                      }
                      className="flex items-center gap-1.5 text-sm font-bold text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t.common.delete}
                    </button>
                    <button
                      onClick={() => printReport(selectedReport)}
                      className="flex items-center gap-1.5 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Printer className="w-4 h-4" />
                      {t.dashboard.print}
                    </button>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    {format(parseISO(selectedReport.date), "dd/MM/yyyy")}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <h3 className="text-lg font-extrabold text-gray-900">
                      {selectedReport.title}
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      {selectedReport.company}
                    </span>
                  </div>
                  <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
                    {selectedReport.content}
                  </div>

                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-5 mb-2">
                    Punonjësit
                  </h4>
                  {(reportLocations[
                    reportBreakdownKey(
                      selectedReport.date,
                      selectedReport.company
                    )
                  ] ?? []).length === 0 ? (
                    <p className="text-sm text-gray-400 italic">—</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                          <th className="text-left px-2 py-2 font-semibold">Emri</th>
                          <th className="text-center px-2 py-2 font-semibold">{t.dashboard.locationCol}</th>
                          <th className="text-right px-2 py-2 font-semibold">Orë</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportLocations[
                          reportBreakdownKey(
                            selectedReport.date,
                            selectedReport.company
                          )
                        ] ?? []).map((w) => (
                          <tr
                            key={`${w.employeeId}-${w.location}-${w.company}`}
                            className="border-t border-gray-100"
                          >
                            <td className="px-2 py-2 font-semibold text-gray-900">{w.name}</td>
                            <td className="px-2 py-2 text-center">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                {workLocationLabel(w.location)}
                              </span>
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-gray-700">
                              {w.hours}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {reportsLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : reportsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-400">
                    <AlertCircle className="w-8 h-8" />
                    <span className="text-sm">{t.dashboard.noReports}</span>
                    <button
                      onClick={openCreateReport}
                      className="text-sm font-bold text-amber-700 hover:text-amber-900"
                    >
                      {t.dashboard.addReport}
                    </button>
                  </div>
                ) : (
                  <ul>
                    {reportsList.map((r) => (
                      <li key={r.id ?? `${r.date}-${r.company}`}>
                        <button
                          onClick={() => setSelectedReport(r)}
                          className="w-full flex items-center gap-3 px-6 py-3 border-b border-gray-100 hover:bg-amber-50 transition-colors text-left"
                        >
                          <div className="w-14 shrink-0 text-center">
                            <p className="text-xs font-bold text-amber-700 uppercase">
                              {format(parseISO(r.date), "MMM")}
                            </p>
                            <p className="text-xl font-extrabold text-gray-900 leading-none">
                              {format(parseISO(r.date), "dd")}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">
                              {r.title}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {r.content}
                            </p>
                            <span className="inline-block mt-1 text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                              {r.company}
                            </span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteReportId !== null}
        message={t.dashboard.deleteReportConfirm}
        onConfirm={handleDeleteReport}
        onCancel={() => setDeleteReportId(null)}
      />
    </div>
  );
}
