"use client";

import { useState, useEffect } from "react";
import { useAppRefreshVersion } from "@/components/AppRefreshProvider";
import { useRole } from "@/components/RoleProvider";
import {
  db,
  type Employee,
  type Attendance,
  type WorkLocation,
  type Company,
  COMPANIES,
  DEFAULT_COMPANY,
  COMPANY_LOCATIONS,
  defaultLocationForCompany,
  workLocationLabel,
} from "@/lib/db";
import { t } from "@/lib/translations";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import SegmentedTabs from "@/components/SegmentedTabs";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  CalendarCheck,
  Clock,
  CreditCard,
  Banknote,
  X,
  User,
  AlertCircle,
  Users,
  CheckSquare,
  Square,
  ArrowRight,
  MapPin,
  FileText,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import AiDailyReportModal from "@/components/AiDailyReportModal";

const COMPANY_STORAGE_KEY = "ndertimi-attendance-company";

type CompanyFilter = "all" | Company;

function loadStoredCompany(): Company {
  if (typeof window === "undefined") return DEFAULT_COMPANY;
  const stored = localStorage.getItem(COMPANY_STORAGE_KEY);
  if (stored && COMPANIES.includes(stored as Company)) return stored as Company;
  return DEFAULT_COMPANY;
}

interface BulkRow {
  employeeId: number;
  emri: string;
  mbiemri: string;
  paymentMethod: "Cash" | "Bankë";
  salaryType: "hourly" | "fixed";
  rate: number;
  fixedSalary: number | null;
  hours: string;
  location: WorkLocation;
  checked: boolean;
  alreadyRecorded: boolean;
  error?: string;
}

function existingEmployeeIdsForDate(
  records: Attendance[],
  date: string,
  company: Company
): Set<number> {
  return new Set(
    records
      .filter((r) => r.date === date && r.company === company)
      .map((r) => r.employeeId)
  );
}

function buildBulkRows(
  employees: Employee[],
  date: string,
  company: Company,
  records: Attendance[]
): BulkRow[] {
  const existing = existingEmployeeIdsForDate(records, date, company);
  const location = defaultLocationForCompany(company);
  return employees.map((e) => ({
    employeeId: e.id!,
    emri: e.emri,
    mbiemri: e.mbiemri,
    paymentMethod: e.paymentMethod,
    salaryType: e.salaryType ?? "hourly",
    rate: e.cmimiOre,
    fixedSalary: e.fixedSalary ?? null,
    hours: "",
    location,
    checked: false,
    alreadyRecorded: existing.has(e.id!),
  }));
}

const today = new Date().toISOString().split("T")[0];

export default function AttendanceSection() {
  const refreshVersion = useAppRefreshVersion();
  const { canViewFinancials } = useRole();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkDate, setBulkDate] = useState(today);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sameHours, setSameHours] = useState("");
  const [sameLocation, setSameLocation] = useState<WorkLocation>(
    defaultLocationForCompany(DEFAULT_COMPANY)
  );

  // Report dialog (opens after Ruaj)
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportContent, setReportContent] = useState("");
  const [reportError, setReportError] = useState<string | null>(null);
  const [pendingSelected, setPendingSelected] = useState<BulkRow[]>([]);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState(today);
  const [selectedCompany, setSelectedCompany] = useState<Company>(DEFAULT_COMPANY);
  const [filterCompany, setFilterCompany] = useState<CompanyFilter>("all");
  const [showAiModal, setShowAiModal] = useState(false);

  useBodyScrollLock(showBulk || showReportModal);

  useEffect(() => {
    setSelectedCompany(loadStoredCompany());
  }, []);

  const handleCompanyChange = (company: Company) => {
    setSelectedCompany(company);
    localStorage.setItem(COMPANY_STORAGE_KEY, company);
    const loc = defaultLocationForCompany(company);
    setSameLocation(loc);
    if (showBulk) {
      setBulkRows(buildBulkRows(activeEmployees, bulkDate, company, records));
    }
  };

  const loadData = async () => {
    try {
      const [atts, emps] = await Promise.all([
        db.attendance.getAll(),
        db.employees.getAll(),
      ]);
      setRecords(atts);
      setEmployees(emps);
    } catch {
      toast.error(t.errors.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [refreshVersion]);

  // ── Bulk modal ──
  const openBulk = () => {
    setBulkDate(filterDate);
    setSameHours("");
    setSameLocation(defaultLocationForCompany(selectedCompany));
    setReportError(null);
    setReportTitle("");
    setReportContent("");
    setBulkRows(buildBulkRows(activeEmployees, filterDate, selectedCompany, records));
    setShowBulk(true);
  };

  const handleBulkDateChange = (newDate: string) => {
    setBulkDate(newDate);
    setBulkRows((rows) =>
      rows.map((row) => {
        const existing = existingEmployeeIdsForDate(records, newDate, selectedCompany);
        return {
          ...row,
          alreadyRecorded: existing.has(row.employeeId),
          checked: existing.has(row.employeeId) ? false : row.checked,
        };
      })
    );
  };

  const toggleAll = (checked: boolean) => {
    setBulkRows((rows) =>
      rows.map((r) => ({ ...r, checked: r.alreadyRecorded ? false : checked }))
    );
  };

  const toggleRow = (idx: number) => {
    setBulkRows((rows) =>
      rows.map((r, i) =>
        i === idx && !r.alreadyRecorded ? { ...r, checked: !r.checked } : r
      )
    );
  };

  const setBulkHours = (idx: number, val: string) => {
    const normalized = val.replace(",", ".");
    setBulkRows((rows) =>
      rows.map((r, i) =>
        i === idx ? { ...r, hours: normalized, error: undefined } : r
      )
    );
  };

  const setBulkLocation = (idx: number, loc: WorkLocation) => {
    setBulkRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, location: loc } : r))
    );
  };

  // Apply the same hours to all currently checked rows
  const applyToAll = () => {
    const normalized = sameHours.replace(",", ".");
    setBulkRows((rows) =>
      rows.map((r) =>
        r.checked ? { ...r, hours: normalized, error: undefined } : r
      )
    );
  };

  const applyLocationToAll = () => {
    setBulkRows((rows) =>
      rows.map((r) => (r.checked ? { ...r, location: sameLocation } : r))
    );
  };

  // Step 1: validate hours, then open report dialog
  const handleBulkSave = async () => {
    const selected = bulkRows.filter((r) => r.checked && !r.alreadyRecorded);
    if (selected.length === 0) {
      toast.error(t.dashboard.bulkNoEmployees);
      return;
    }

    let hasErrors = false;
    setBulkRows((rows) =>
      rows.map((r) => {
        if (!r.checked) return r;
        const h = parseFloat(r.hours);
        if (!r.hours.trim() || isNaN(h) || h <= 0 || h > 24) {
          hasErrors = true;
          return { ...r, error: t.errors.invalidNumber };
        }
        return r;
      })
    );
    if (hasErrors) return;

    setPendingSelected(selected);
    setReportError(null);
    try {
      const existing = await db.dailyReports.getByDate(bulkDate, selectedCompany);
      setReportTitle(existing?.title ?? "");
      setReportContent(existing?.content ?? "");
    } catch {
      setReportTitle("");
      setReportContent("");
    }
    setShowReportModal(true);
  };

  // Step 2: save attendance + report together
  const handleReportSave = async () => {
    if (!reportTitle.trim() || !reportContent.trim()) {
      setReportError(t.dashboard.reportRequired);
      return;
    }
    setReportError(null);

    setBulkSaving(true);
    try {
      await db.dailyReports.upsert({
        date: bulkDate,
        title: reportTitle.trim(),
        content: reportContent.trim(),
        company: selectedCompany,
      });
      await db.attendance.addBatch(
        pendingSelected.map((r) => ({
          employeeId: r.employeeId,
          emri: r.emri,
          mbiemri: r.mbiemri,
          date: bulkDate,
          paymentMethod: r.paymentMethod,
          hoursWorked: parseFloat(r.hours),
          location: r.location,
          company: selectedCompany,
        }))
      );
      toast.success(`${pendingSelected.length} regjistrime u ruajtën!`);
      setShowReportModal(false);
      setShowBulk(false);
      setPendingSelected([]);
      setFilterDate(bulkDate);
      await loadData();
    } catch {
      toast.error(t.errors.saveError);
      await loadData();
    } finally {
      setBulkSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await db.attendance.delete(deleteId);
      toast.success(t.success.deleted);
      setDeleteId(null);
      await loadData();
    } catch {
      toast.error(t.errors.deleteError);
    }
  };

  const filteredRecords = records.filter(
    (r) =>
      r.date === filterDate &&
      (filterCompany === "all" || r.company === filterCompany)
  );
  const companyLocations = COMPANY_LOCATIONS[selectedCompany];
  const totalHours = filteredRecords.reduce((sum, r) => sum + r.hoursWorked, 0);
  const activeEmployees = employees.filter((e) => !e.archivedAt);

  const allChecked =
    bulkRows.filter((r) => !r.alreadyRecorded).length > 0 &&
    bulkRows.filter((r) => !r.alreadyRecorded).every((r) => r.checked);
  const checkedCount = bulkRows.filter((r) => r.checked && !r.alreadyRecorded).length;
  const duplicateCount = bulkRows.filter((r) => r.alreadyRecorded).length;

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.attendance.title}
        action={
          activeEmployees.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="sm:max-w-[300px]" title={t.attendance.selectCompany}>
                <SegmentedTabs
                  tabs={COMPANIES.map((c) => ({ id: c, label: c }))}
                  active={selectedCompany}
                  onChange={(id) => handleCompanyChange(id as Company)}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold px-4 h-12 rounded-xl text-sm transition-all shadow-md active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Regjistro me AI</span>
              </button>
              <button
                onClick={openBulk}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
              >
                <Plus className="w-5 h-5" />
                {t.dashboard.addMultiple}
              </button>
            </div>
          ) : null
        }
      />

      {/* Date + company filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <label className="block text-sm font-semibold text-gray-600 mb-1.5">
          {t.attendance.date}
        </label>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-lg font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
        />
        <label className="block text-sm font-semibold text-gray-600 mb-1.5 mt-3">
          {t.attendance.company}
        </label>
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value as CompanyFilter)}
          className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
        >
          <option value="all">{t.attendance.filterAllCompanies}</option>
          {COMPANIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {filteredRecords.length > 0 && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            <Clock className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">
              {t.attendance.totalHours}:{" "}
              <span className="text-blue-600">
                {totalHours} {t.dashboard.hours}
              </span>
            </span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : activeEmployees.length === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-amber-600" />
          <p className="text-amber-800 font-semibold text-center text-base">
            {t.attendance.noEmployeesWarning}
          </p>
          <Link
            href="/personeli?tab=employees"
            className="flex items-center gap-2 bg-amber-600 text-white font-bold px-5 h-12 rounded-xl text-base"
          >
            {t.attendance.goToEmployees}
          </Link>
        </div>
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          message={t.attendance.noAttendance}
          icon={<CalendarCheck className="w-10 h-10" />}
          action={
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => setShowAiModal(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 text-white font-bold px-5 h-12 rounded-xl text-sm shadow-md transition-all active:scale-[0.98]"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Regjistro me AI</span>
              </button>
              <button
                onClick={openBulk}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-sm"
              >
                <Users className="w-5 h-5" />
                {t.dashboard.addMultiple}
              </button>
            </div>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredRecords.map((rec) => {
            const emp = employees.find((e) => e.id === rec.employeeId);
            const earned = emp ? (rec.hoursWorked * emp.cmimiOre).toFixed(2) : null;
            return (
              <li
                key={rec.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-gray-900 truncate">
                    {rec.emri} {rec.mbiemri}
                  </p>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-sm text-gray-600">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {rec.hoursWorked} {t.dashboard.hours}
                    </span>
                    {canViewFinancials && (
                      <span
                        className={`flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                          rec.paymentMethod === "Bankë"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {rec.paymentMethod === "Bankë" ? (
                          <CreditCard className="w-3 h-3" />
                        ) : (
                          <Banknote className="w-3 h-3" />
                        )}
                        {rec.paymentMethod}
                      </span>
                    )}
                    <span
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-700"
                    >
                      {rec.company}
                    </span>
                    <span
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700"
                      title={workLocationLabel(rec.location)}
                    >
                      <MapPin className="w-3 h-3" />
                      {workLocationLabel(rec.location)}
                    </span>
                    {canViewFinancials && (
                      <span className="text-xs font-semibold text-gray-500">
                        {emp?.salaryType === "fixed" ? (
                          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold">
                            {t.employees.fixedBadge}
                          </span>
                        ) : earned ? (
                          `€${earned}`
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(rec.id!)}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                  aria-label={t.common.delete}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── BULK MODAL ── */}
      {showBulk && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          data-no-pull-refresh
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !bulkSaving && setShowBulk(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg lg:max-w-xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-extrabold text-gray-900">
                {t.dashboard.bulkTitle}
              </h2>
              <button
                onClick={() => !bulkSaving && setShowBulk(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                disabled={bulkSaving}
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Date + Same hours + Same location */}
            <div className="px-6 py-4 border-b border-gray-100 shrink-0 flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t.dashboard.bulkDate}
                </label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => handleBulkDateChange(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-lg font-medium text-gray-900 focus:outline-none focus:border-blue-500 bg-white"
                />
              </div>

              {/* Same hours for all */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t.dashboard.sameHours}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={sameHours}
                    onChange={(e) => setSameHours(e.target.value.replace(",", "."))}
                    placeholder={t.dashboard.sameHoursPlaceholder}
                    className="flex-1 h-11 px-4 rounded-xl border-2 border-blue-300 text-base font-bold text-gray-900 focus:outline-none focus:border-blue-600 bg-white"
                  />
                  <button
                    type="button"
                    onClick={applyToAll}
                    disabled={!sameHours.trim() || checkedCount === 0}
                    className="flex items-center gap-1.5 h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-40"
                  >
                    {t.dashboard.applyToAll}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {checkedCount === 0 && sameHours.trim() && (
                  <p className="text-xs text-amber-600 mt-1">
                    Zgjidhni punonjësit fillimisht
                  </p>
                )}
              </div>

              {/* Same location for all */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t.dashboard.sameLocation}
                </label>
                <div className="flex gap-2">
                  <select
                    value={sameLocation}
                    onChange={(e) => setSameLocation(e.target.value as WorkLocation)}
                    className="flex-1 h-11 px-3 rounded-xl border-2 border-indigo-300 text-base font-bold text-gray-900 focus:outline-none focus:border-indigo-600 bg-white"
                  >
                    {companyLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {workLocationLabel(loc)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyLocationToAll}
                    disabled={checkedCount === 0}
                    className="flex items-center gap-1.5 h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-colors shadow-sm disabled:opacity-40"
                  >
                    {t.dashboard.applyToAll}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Select all + count */}
            <div className="flex items-center justify-between px-6 py-2.5 border-b border-gray-100 bg-gray-50 shrink-0">
              <button
                onClick={() => toggleAll(!allChecked)}
                className="flex items-center gap-2 text-sm font-bold text-gray-700"
              >
                {allChecked ? (
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
                {allChecked ? t.dashboard.bulkDeselectAll : t.dashboard.bulkSelectAll}
              </button>
              <span className="text-xs font-semibold text-gray-500">
                {checkedCount} / {bulkRows.filter((r) => !r.alreadyRecorded).length} zgjedhur
              </span>
            </div>

            {duplicateCount > 0 && (
              <div className="px-6 py-2 bg-amber-50 border-b border-amber-100 text-xs font-semibold text-amber-800 shrink-0">
                {duplicateCount} punonjës kanë regjistrim për këtë datë dhe kompani — përjashtuar automatikisht.
              </div>
            )}

            {/* Employee list */}
            <div className="overflow-y-auto flex-1">
              {bulkRows.map((row, idx) => (
                <div
                  key={row.employeeId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${
                    row.alreadyRecorded
                      ? "bg-gray-50 opacity-60"
                      : row.checked
                        ? "bg-blue-50/50"
                        : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleRow(idx)}
                    className="shrink-0"
                    disabled={row.alreadyRecorded}
                    aria-label={`${row.emri} ${row.mbiemri}`}
                  >
                    {row.alreadyRecorded ? (
                      <CheckSquare className="w-5 h-5 text-gray-300" />
                    ) : row.checked ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300" />
                    )}
                  </button>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {row.emri} {row.mbiemri}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {row.alreadyRecorded && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Tashmë regjistruar
                        </span>
                      )}
                      {canViewFinancials && (
                        <>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              row.paymentMethod === "Bankë"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-green-100 text-green-700"
                            }`}
                          >
                            {row.paymentMethod}
                          </span>
                          <span className="text-xs text-gray-400">
                            {row.salaryType === "fixed" ? (
                              <span className="text-purple-600 font-semibold">{t.employees.fixedBadge}</span>
                            ) : (
                              `€${row.rate.toFixed(2)}/orë`
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Location selector */}
                  <div className="shrink-0 w-28">
                    <select
                      value={row.location}
                      onChange={(e) => setBulkLocation(idx, e.target.value as WorkLocation)}
                      disabled={!row.checked || row.alreadyRecorded}
                      title={workLocationLabel(row.location)}
                      className={`w-full h-11 px-2 rounded-xl border-2 text-xs font-bold text-center transition-colors focus:outline-none
                        ${
                          row.checked
                            ? "border-indigo-300 bg-white text-indigo-700 focus:border-indigo-600"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                        }`}
                    >
                      {companyLocations.map((loc) => (
                        <option key={loc} value={loc}>
                          {workLocationLabel(loc)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Hours input */}
                  <div className="shrink-0 w-24">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.hours}
                      onChange={(e) => setBulkHours(idx, e.target.value)}
                      placeholder="orë"
                      disabled={!row.checked || row.alreadyRecorded}
                      className={`w-full h-11 px-3 rounded-xl border-2 text-base font-bold text-center transition-colors focus:outline-none
                        ${
                          row.error
                            ? "border-red-400 bg-red-50"
                            : row.checked
                            ? "border-blue-400 bg-white focus:border-blue-600"
                            : "border-gray-200 bg-gray-50 text-gray-400"
                        }`}
                    />
                    {row.error && (
                      <p className="text-xs text-red-500 mt-0.5 text-center">✕</p>
                    )}
                    {row.checked && row.hours && !row.error && (
                      <p className="text-xs text-gray-400 mt-0.5 text-center">
                        {row.salaryType === "fixed" ? (
                          <span className="text-purple-600 font-bold">{t.employees.fixedBadge}</span>
                        ) : (
                          `€${(parseFloat(row.hours) * row.rate).toFixed(2)}`
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setShowBulk(false)}
                disabled={bulkSaving}
                className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleBulkSave}
                disabled={bulkSaving || checkedCount === 0}
                className="flex-1 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg transition-colors shadow-md disabled:opacity-50"
              >
                {bulkSaving
                  ? "Duke ruajtur..."
                  : `Ruaj${checkedCount > 0 ? ` (${checkedCount})` : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT MODAL (opens after Ruaj) ── */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          data-no-pull-refresh
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => !bulkSaving && setShowReportModal(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md lg:max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Raporti i ditës
              </h2>
              <button
                onClick={() => !bulkSaving && setShowReportModal(false)}
                disabled={bulkSaving}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-50"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 mb-3">
                {pendingSelected.length} punonjës · {bulkDate} · {selectedCompany}
              </p>

              <div className="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50 overflow-hidden">
                <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900 uppercase tracking-wide">
                  <span>Punonjësi</span>
                  <span className="flex items-center gap-3">
                    <span>Vendi</span>
                    <span>Orë</span>
                  </span>
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-amber-200">
                  {pendingSelected.map((row) => (
                    <div
                      key={row.employeeId}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="font-semibold text-gray-900 truncate pr-2">
                        {row.emri} {row.mbiemri}
                      </span>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-800 font-bold text-xs">
                          <MapPin className="w-3 h-3" />
                          {workLocationLabel(row.location)}
                        </span>
                        <span className="font-extrabold text-gray-900 tabular-nums w-10 text-right">
                          {row.hours}h
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 bg-amber-100 border-t border-amber-200 flex items-center justify-between text-xs font-bold text-amber-900">
                  <span>Gjithsej</span>
                  <span className="tabular-nums">
                    {pendingSelected
                      .reduce((sum, r) => sum + (Number(r.hours) || 0), 0)
                      .toFixed(2)
                      .replace(/\.?0+$/, "")}
                    h
                  </span>
                </div>
              </div>

              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t.dashboard.reportTitle} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => {
                  setReportTitle(e.target.value);
                  if (reportError) setReportError(null);
                }}
                placeholder={t.dashboard.reportTitlePlaceholder}
                autoFocus
                className={`w-full h-12 px-4 rounded-xl border-2 text-base font-bold text-gray-900 focus:outline-none bg-white mb-4 ${
                  reportError && !reportTitle.trim()
                    ? "border-red-400"
                    : "border-amber-300 focus:border-amber-600"
                }`}
              />

              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {t.dashboard.reportContent} <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reportContent}
                onChange={(e) => {
                  setReportContent(e.target.value);
                  if (reportError) setReportError(null);
                }}
                placeholder={t.dashboard.reportContentPlaceholder}
                rows={6}
                className={`w-full px-4 py-3 rounded-xl border-2 text-base font-medium text-gray-900 focus:outline-none bg-white resize-y ${
                  reportError && !reportContent.trim()
                    ? "border-red-400"
                    : "border-amber-300 focus:border-amber-600"
                }`}
              />
              {reportError && (
                <p className="text-sm font-semibold text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {reportError}
                </p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-3">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                disabled={bulkSaving}
                className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t.common.back}
              </button>
              <button
                onClick={handleReportSave}
                disabled={bulkSaving}
                className="flex-1 h-14 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-lg transition-colors shadow-md disabled:opacity-50"
              >
                {bulkSaving ? "Duke ruajtur..." : t.common.save}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        message={t.attendance.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      <AiDailyReportModal
        open={showAiModal}
        initialDate={filterDate}
        initialCompany={selectedCompany}
        employees={employees}
        onClose={() => setShowAiModal(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
}
