"use client";

import { useState, useEffect } from "react";
import { db, type Employee } from "@/lib/db";
import { t } from "@/lib/translations";
import { FormField, Input } from "@/components/FormField";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import { Plus, Pencil, Trash2, Users, Phone, X, UserCircle } from "lucide-react";

interface FormData {
  emri: string;
  mbiemri: string;
  telefoni: string;
}

interface FormErrors {
  emri?: string;
  mbiemri?: string;
  telefoni?: string;
}

const emptyForm: FormData = { emri: "", mbiemri: "", telefoni: "" };

export default function PunonjesitPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadEmployees = async () => {
    try {
      const data = await db.employees.orderBy("emri").toArray();
      setEmployees(data);
    } catch {
      toast.error(t.errors.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.emri.trim()) newErrors.emri = t.errors.requiredField;
    if (!form.mbiemri.trim()) newErrors.mbiemri = t.errors.requiredField;
    if (!form.telefoni.trim()) newErrors.telefoni = t.errors.requiredField;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const now = new Date().toISOString();
      if (editId !== null) {
        await db.employees.update(editId, {
          emri: form.emri.trim(),
          mbiemri: form.mbiemri.trim(),
          telefoni: form.telefoni.trim(),
          syncStatus: "local",
        });
        toast.success(t.success.updated);
      } else {
        await db.employees.add({
          emri: form.emri.trim(),
          mbiemri: form.mbiemri.trim(),
          telefoni: form.telefoni.trim(),
          createdAt: now,
          syncStatus: "local",
        });
        toast.success(t.success.saved);
      }
      setShowForm(false);
      setEditId(null);
      setForm(emptyForm);
      setErrors({});
      await loadEmployees();
    } catch {
      toast.error(t.errors.saveError);
    }
  };

  const handleEdit = (emp: Employee) => {
    setForm({ emri: emp.emri, mbiemri: emp.mbiemri, telefoni: emp.telefoni });
    setEditId(emp.id!);
    setErrors({});
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await db.employees.delete(deleteId);
      toast.success(t.success.deleted);
      setDeleteId(null);
      await loadEmployees();
    } catch {
      toast.error(t.errors.deleteError);
    }
  };

  const handleOpenAdd = () => {
    setForm(emptyForm);
    setEditId(null);
    setErrors({});
    setShowForm(true);
  };

  const handleChange = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.employees.title}
        subtitle={`${employees.length} ${t.employees.totalEmployees}`}
        action={
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
          >
            <Plus className="w-5 h-5" />
            {t.employees.addTitle}
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : employees.length === 0 ? (
        <EmptyState
          message={t.employees.noEmployees}
          icon={<Users className="w-10 h-10" />}
          action={
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 bg-blue-600 text-white font-bold px-6 h-12 rounded-xl text-base"
            >
              <Plus className="w-5 h-5" />
              {t.employees.addTitle}
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {employees.map((emp) => (
            <li
              key={emp.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <UserCircle className="w-7 h-7 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-gray-900 truncate">
                  {emp.emri} {emp.mbiemri}
                </p>
                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                  <Phone className="w-3.5 h-3.5" />
                  {emp.telefoni}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleEdit(emp)}
                  className="w-11 h-11 rounded-xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-600 flex items-center justify-center transition-colors"
                  aria-label={t.common.edit}
                >
                  <Pencil className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setDeleteId(emp.id!)}
                  className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 flex items-center justify-center transition-colors"
                  aria-label={t.common.delete}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold text-gray-900">
                {editId !== null ? t.employees.editTitle : t.employees.addTitle}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
              <FormField label={t.employees.emri} error={errors.emri} required>
                <Input
                  value={form.emri}
                  onChange={handleChange("emri")}
                  placeholder={t.employees.emriPlaceholder}
                  error={!!errors.emri}
                  autoFocus
                />
              </FormField>

              <FormField label={t.employees.mbiemri} error={errors.mbiemri} required>
                <Input
                  value={form.mbiemri}
                  onChange={handleChange("mbiemri")}
                  placeholder={t.employees.mbiemriPlaceholder}
                  error={!!errors.mbiemri}
                />
              </FormField>

              <FormField label={t.employees.telefoni} error={errors.telefoni} required>
                <Input
                  type="tel"
                  value={form.telefoni}
                  onChange={handleChange("telefoni")}
                  placeholder={t.employees.telefoniPlaceholder}
                  error={!!errors.telefoni}
                  inputMode="tel"
                />
              </FormField>

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
        message={t.employees.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
