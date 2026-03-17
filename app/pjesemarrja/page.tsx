"use client";

import { useState, useEffect } from "react";
import { db, type Employee, type Attendance } from "@/lib/db";
import { t } from "@/lib/translations";
import { FormField, Input, Select } from "@/components/FormField";
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
  Info,
} from "lucide-react";
import Link from "next/link";

interface FormData {
  employeeId: string;
  date: string;
  hoursWorked: string;
}

interface FormErrors {
  employeeId?: string;
  date?: string;
  hoursWorked?: string;
}

const today = new Date().toISOString().split("T")[0];

const emptyForm: FormData = {
  employeeId: "",
  date: today,
  hoursWorked: "",
};

export default function PjesemarrjaPage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
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

  const selectedEmployee = employees.find(
    (e) => e.id === parseInt(form.employeeId)
  );

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.employeeId) newErrors.employeeId = t.errors.requiredField;
    if (!form.date) newErrors.date = t.errors.requiredField;
    const hours = parseFloat(form.hoursWorked);
    if (!form.hoursWorked.trim()) {
      newErrors.hoursWorked = t.errors.requiredField;
    } else if (isNaN(hours) || hours <= 0 || hours > 24) {
      newErrors.hoursWorked = t.errors.invalidNumber;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const emp = employees.find((e) => e.id === parseInt(form.employeeId));
      if (!emp) return;

      await db.attendance.add({
        employeeId: emp.id!,
        emri: emp.emri,
        mbiemri: emp.mbiemri,
        date: form.date,
        paymentMethod: emp.paymentMethod,
        hoursWorked: parseFloat(form.hoursWorked),
      });
      toast.success(t.success.saved);
      setShowForm(false);
      setForm({ ...emptyForm, date: form.date });
      setErrors({});
      await loadData();
    } catch {
      toast.error(t.errors.saveError);
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

  const handleChange =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof FormErrors])
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.attendance.title}
        action={
          employees.length > 0 ? (
            <button
              onClick={() => {
                setForm({ ...emptyForm, date: filterDate });
                setErrors({});
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              {t.attendance.addTitle}
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
              onClick={() => {
                setForm({ ...emptyForm, date: filterDate });
                setErrors({});
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white font-bold px-6 h-12 rounded-xl text-base"
            >
              <Plus className="w-5 h-5" />
              {t.attendance.addTitle}
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
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                  <User className="w-7 h-7 text-green-600" />
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

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold text-gray-900">
                {t.attendance.addTitle}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              <FormField
                label={t.attendance.selectEmployee}
                error={errors.employeeId}
                required
              >
                <Select
                  value={form.employeeId}
                  onChange={handleChange("employeeId")}
                  error={!!errors.employeeId}
                >
                  <option value="">{t.attendance.selectEmployeePlaceholder}</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.emri} {emp.mbiemri}
                    </option>
                  ))}
                </Select>
              </FormField>

              {/* Auto payment method indicator */}
              {selectedEmployee && (
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
                    selectedEmployee.paymentMethod === "Bankë"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <Info
                    className={`w-4 h-4 shrink-0 ${
                      selectedEmployee.paymentMethod === "Bankë"
                        ? "text-blue-600"
                        : "text-green-600"
                    }`}
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-gray-700">
                      {t.attendance.autoPayment}:{" "}
                    </span>
                    <span
                      className={`font-bold ${
                        selectedEmployee.paymentMethod === "Bankë"
                          ? "text-blue-700"
                          : "text-green-700"
                      }`}
                    >
                      {selectedEmployee.paymentMethod === "Bankë" ? (
                        <span className="inline-flex items-center gap-1">
                          <CreditCard className="w-3.5 h-3.5" />
                          Bankë
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Banknote className="w-3.5 h-3.5" />
                          Cash
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 ml-2">
                      · €{selectedEmployee.cmimiOre.toFixed(2)}/orë
                    </span>
                  </div>
                </div>
              )}

              <FormField label={t.attendance.date} error={errors.date} required>
                <Input
                  type="date"
                  value={form.date}
                  onChange={handleChange("date")}
                  error={!!errors.date}
                />
              </FormField>

              <FormField
                label={t.attendance.hoursWorked}
                error={errors.hoursWorked}
                required
              >
                <Input
                  type="number"
                  value={form.hoursWorked}
                  onChange={handleChange("hoursWorked")}
                  placeholder={t.attendance.hoursPlaceholder}
                  error={!!errors.hoursWorked}
                  min="0"
                  max="24"
                  step="0.5"
                  inputMode="decimal"
                />
              </FormField>

              {/* Earnings preview */}
              {selectedEmployee && form.hoursWorked && parseFloat(form.hoursWorked) > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 flex items-center justify-between">
                  <span>Pagesa e llogaritur:</span>
                  <span className="text-blue-700 font-extrabold text-base">
                    €
                    {(
                      parseFloat(form.hoursWorked) * selectedEmployee.cmimiOre
                    ).toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-lg transition-colors shadow-md"
                >
                  {t.common.save}
                </button>
              </div>
            </form>
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
