"use client";

import { useState, useEffect } from "react";
import { db, type Employee, type Attendance } from "@/lib/db";
import { t } from "@/lib/translations";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
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
} from "lucide-react";
import Link from "next/link";

interface BulkRow {
  employeeId: number;
  name: string;
  paymentMethod: "Cash" | "Bankë";
  rate: number;
  hours: string;
  checked: boolean;
  error?: string;
}

const today = new Date().toISOString().split("T")[0];

export default function PjesemarrjaPage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showBulk, setShowBulk] = useState(false);
  const [bulkDate, setBulkDate] = useState(today);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [sameHours, setSameHours] = useState("");

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState(today);

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
  }, []);

  // ── Bulk modal ──
  const openBulk = () => {
    setBulkDate(filterDate);
    setSameHours("");
    setBulkRows(
      employees.map((e) => ({
        employeeId: e.id!,
        name: `${e.emri} ${e.mbiemri}`,
        paymentMethod: e.paymentMethod,
        rate: e.cmimiOre,
        hours: "",
        checked: false,
      }))
    );
    setShowBulk(true);
  };

  const toggleAll = (checked: boolean) => {
    setBulkRows((rows) => rows.map((r) => ({ ...r, checked })));
  };

  const toggleRow = (idx: number) => {
    setBulkRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, checked: !r.checked } : r))
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

  // Apply the same hours to all currently checked rows
  const applyToAll = () => {
    const normalized = sameHours.replace(",", ".");
    setBulkRows((rows) =>
      rows.map((r) =>
        r.checked ? { ...r, hours: normalized, error: undefined } : r
      )
    );
  };

  const handleBulkSave = async () => {
    const selected = bulkRows.filter((r) => r.checked);
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

    setBulkSaving(true);
    try {
      await Promise.all(
        selected.map((r) =>
          db.attendance.add({
            employeeId: r.employeeId,
            emri: r.name.split(" ")[0],
            mbiemri: r.name.split(" ").slice(1).join(" "),
            date: bulkDate,
            paymentMethod: r.paymentMethod,
            hoursWorked: parseFloat(r.hours),
          })
        )
      );
      toast.success(`${selected.length} regjistrime u ruajtën!`);
      setShowBulk(false);
      setFilterDate(bulkDate);
      await loadData();
    } catch {
      toast.error(t.errors.saveError);
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

  const filteredRecords = records.filter((r) => r.date === filterDate);
  const totalHours = filteredRecords.reduce((sum, r) => sum + r.hoursWorked, 0);

  const allChecked = bulkRows.length > 0 && bulkRows.every((r) => r.checked);
  const checkedCount = bulkRows.filter((r) => r.checked).length;

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.attendance.title}
        action={
          employees.length > 0 ? (
            <button
              onClick={openBulk}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              {t.dashboard.addMultiple}
            </button>
          ) : null
        }
      />

      {/* Date filter */}
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
      ) : employees.length === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-amber-600" />
          <p className="text-amber-800 font-semibold text-center text-base">
            {t.attendance.noEmployeesWarning}
          </p>
          <Link
            href="/punonjesit"
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
            <button
              onClick={openBulk}
              className="flex items-center gap-2 bg-blue-600 text-white font-bold px-6 h-12 rounded-xl text-base"
            >
              <Users className="w-5 h-5" />
              {t.dashboard.addMultiple}
            </button>
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
                    {earned && (
                      <span className="text-xs font-semibold text-gray-500">
                        €{earned}
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !bulkSaving && setShowBulk(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
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

            {/* Date + Same hours */}
            <div className="px-6 py-4 border-b border-gray-100 shrink-0 flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t.dashboard.bulkDate}
                </label>
                <input
                  type="date"
                  value={bulkDate}
                  onChange={(e) => setBulkDate(e.target.value)}
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
                {checkedCount} / {bulkRows.length} zgjedhur
              </span>
            </div>

            {/* Employee list */}
            <div className="overflow-y-auto flex-1">
              {bulkRows.map((row, idx) => (
                <div
                  key={row.employeeId}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 transition-colors ${
                    row.checked ? "bg-blue-50/50" : ""
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleRow(idx)}
                    className="shrink-0"
                    aria-label={row.name}
                  >
                    {row.checked ? (
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300" />
                    )}
                  </button>

                  {/* Name + badge */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {row.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
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
                        €{row.rate.toFixed(2)}/orë
                      </span>
                    </div>
                  </div>

                  {/* Hours input */}
                  <div className="shrink-0 w-24">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.hours}
                      onChange={(e) => setBulkHours(idx, e.target.value)}
                      placeholder="orë"
                      disabled={!row.checked}
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
                        €{(parseFloat(row.hours) * row.rate).toFixed(2)}
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

      <ConfirmDialog
        open={deleteId !== null}
        message={t.attendance.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
