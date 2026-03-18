"use client";

import { useState, useEffect, useRef } from "react";
import { db, type Vehicle, type DieselEntry } from "@/lib/db";
import { t } from "@/lib/translations";
import { FormField, Input, Select } from "@/components/FormField";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  Fuel,
  X,
  Camera,
  Upload,
  AlertCircle,
  Loader2,
  Truck,
  Droplets,
  Euro,
  Sparkles,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

interface FormData {
  vehicleId: string;
  date: string;
  liters: string;
  cmimiLiter: string;
  photoBase64?: string;
}

interface FormErrors {
  vehicleId?: string;
  date?: string;
  liters?: string;
  cmimiLiter?: string;
}

const today = new Date().toISOString().split("T")[0];
const emptyForm: FormData = {
  vehicleId: "",
  date: today,
  liters: "",
  cmimiLiter: "",
  photoBase64: undefined,
};

export default function NaftaPage() {
  const [records, setRecords] = useState<DieselEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const parseNum = (val: string) => parseFloat(val.replace(",", "."));

  // Calculated total shown as preview
  const calculatedTotal =
    parseNum(form.liters) > 0 && parseNum(form.cmimiLiter) > 0
      ? parseNum(form.liters) * parseNum(form.cmimiLiter)
      : null;

  const loadData = async () => {
    try {
      const [dieselRecs, vehs] = await Promise.all([
        db.diesel.getAll(),
        db.vehicles.getAll(),
      ]);
      setRecords(dieselRecs);
      setVehicles(vehs);
    } catch {
      toast.error(t.errors.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.vehicleId) newErrors.vehicleId = t.errors.requiredField;
    if (!form.date) newErrors.date = t.errors.requiredField;
    const liters = parseNum(form.liters);
    if (!form.liters.trim()) {
      newErrors.liters = t.errors.requiredField;
    } else if (isNaN(liters) || liters <= 0) {
      newErrors.liters = t.errors.invalidNumber;
    }
    const rate = parseNum(form.cmimiLiter);
    if (!form.cmimiLiter.trim()) {
      newErrors.cmimiLiter = t.errors.requiredField;
    } else if (isNaN(rate) || rate <= 0) {
      newErrors.cmimiLiter = t.errors.invalidNumber;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const vehicle = vehicles.find((v) => v.id === parseInt(form.vehicleId));
      if (!vehicle) return;

      const liters = parseNum(form.liters);
      const cmimiLiter = parseNum(form.cmimiLiter);
      const totalPrice = liters * cmimiLiter;

      await db.diesel.add({
        vehicleId: vehicle.id!,
        emriMjetit: vehicle.emriMjetit,
        date: form.date,
        liters,
        totalPrice,
        photoBase64: form.photoBase64,
      });
      toast.success(t.success.saved);
      setShowForm(false);
      setForm(emptyForm);
      setErrors({});
      setPhotoPreview(undefined);
      await loadData();
    } catch {
      toast.error(t.errors.saveError);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await db.diesel.delete(deleteId);
      toast.success(t.success.deleted);
      setDeleteId(null);
      await loadData();
    } catch {
      toast.error(t.errors.deleteError);
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX = 1024;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) {
              height = (height * MAX) / width;
              width = MAX;
            } else {
              width = (width * MAX) / height;
              height = MAX;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Ju lutem zgjidhni një skedar imazhi.");
      return;
    }
    try {
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      setForm((prev) => ({ ...prev, photoBase64: compressed }));
      await runOcr(compressed);
    } catch {
      toast.error(t.errors.unknownError);
    }
  };

  const runOcr = async (imageBase64: string) => {
    setOcrLoading(true);
    const loadingToast = toast.loading(t.diesel.aiExtracting);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      toast.dismiss(loadingToast);
      if (!res.ok || data.error) {
        toast.error(data.error || t.diesel.aiError);
        return;
      }
      const updates: Partial<FormData> = {};
      if (data.date) updates.date = data.date;
      if (data.liters != null) updates.liters = String(data.liters);
      // If OCR returns a unit price, use it; otherwise derive from totalPrice if available
      if (data.cmimiLiter != null) {
        updates.cmimiLiter = String(data.cmimiLiter);
      } else if (data.totalPrice != null && data.liters != null && data.liters > 0) {
        updates.cmimiLiter = String(
          (Math.round((data.totalPrice / data.liters) * 100) / 100).toFixed(4)
        );
      }
      setForm((prev) => ({ ...prev, ...updates }));
      setErrors({});
      toast.success(t.diesel.aiSuccess);
    } catch {
      toast.dismiss(loadingToast);
      toast.error(t.diesel.aiError);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleChange =
    (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof FormErrors])
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

  const removePhoto = () => {
    setPhotoPreview(undefined);
    setForm((prev) => ({ ...prev, photoBase64: undefined }));
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.diesel.title}
        action={
          vehicles.length > 0 ? (
            <button
              onClick={() => {
                setForm(emptyForm);
                setErrors({});
                setPhotoPreview(undefined);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              {t.diesel.addTitle}
            </button>
          ) : null
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-500 font-medium">{t.common.loading}</span>
          </div>
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-amber-600" />
          <p className="text-amber-800 font-semibold text-center text-base">
            {t.diesel.noVehiclesWarning}
          </p>
          <Link
            href="/mjetet"
            className="flex items-center gap-2 bg-amber-600 text-white font-bold px-5 h-12 rounded-xl text-base"
          >
            {t.diesel.goToVehicles}
          </Link>
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          message={t.diesel.noDiesel}
          icon={<Fuel className="w-10 h-10" />}
          action={
            <button
              onClick={() => {
                setForm(emptyForm);
                setErrors({});
                setPhotoPreview(undefined);
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-blue-600 text-white font-bold px-6 h-12 rounded-xl text-base"
            >
              <Plus className="w-5 h-5" />
              {t.diesel.addTitle}
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((rec) => {
            const perLiter =
              rec.liters > 0
                ? (rec.totalPrice / rec.liters).toFixed(2)
                : null;
            return (
              <li
                key={rec.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {rec.photoBase64 && (
                  <div className="h-28 overflow-hidden bg-gray-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rec.photoBase64}
                      alt="Fatura"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Fatura
                    </div>
                  </div>
                )}
                <div className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                    <Fuel className="w-7 h-7 text-orange-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold text-gray-900 truncate flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-gray-500" />
                      {rec.emriMjetit}
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {rec.date
                        ? format(new Date(rec.date), "dd/MM/yyyy")
                        : rec.date}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-sm text-gray-700 font-semibold">
                        <Droplets className="w-3.5 h-3.5 text-blue-500" />
                        {rec.liters} L
                      </span>
                      {perLiter && (
                        <span className="text-xs text-gray-500 font-medium">
                          €{perLiter}/L
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-sm text-gray-700 font-semibold">
                        <Euro className="w-3.5 h-3.5 text-green-600" />
                        {rec.totalPrice.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteId(rec.id!)}
                    className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                    aria-label={t.common.delete}
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
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
            onClick={() => !ocrLoading && setShowForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-extrabold text-gray-900">
                  {t.diesel.addTitle}
                </h2>
                <button
                  onClick={() => !ocrLoading && setShowForm(false)}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                  disabled={ocrLoading}
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="px-6 pb-8 pt-4">
              {/* Photo Upload Section */}
              <div className="mb-6">
                <p className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Ngarko Faturën (AI e lexon automatikisht)
                </p>

                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-purple-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt="Pamja e faturës"
                      className="w-full max-h-48 object-contain bg-gray-50"
                    />
                    {ocrLoading && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                        <span className="text-white font-semibold text-sm">
                          {t.diesel.aiExtracting}
                        </span>
                      </div>
                    )}
                    {!ocrLoading && (
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 font-semibold transition-colors"
                    >
                      <Camera className="w-7 h-7" />
                      <span className="text-sm">{t.diesel.takePhoto}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-600 font-semibold transition-colors"
                    >
                      <Upload className="w-7 h-7" />
                      <span className="text-sm">{t.diesel.uploadBill}</span>
                    </button>
                  </div>
                )}

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageFile(file);
                  }}
                />

                {!photoPreview && (
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    ose plotësoni të dhënat manualisht më poshtë
                  </p>
                )}
              </div>

              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                <FormField
                  label={t.diesel.selectVehicle}
                  error={errors.vehicleId}
                  required
                >
                  <Select
                    value={form.vehicleId}
                    onChange={handleChange("vehicleId")}
                    error={!!errors.vehicleId}
                    disabled={ocrLoading}
                  >
                    <option value="">{t.diesel.selectVehiclePlaceholder}</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.emriMjetit} — {v.targa}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField label={t.diesel.date} error={errors.date} required>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={handleChange("date")}
                    error={!!errors.date}
                    disabled={ocrLoading}
                  />
                </FormField>

                <FormField label={t.diesel.liters} error={errors.liters} required>
                  <Input
                    type="number"
                    value={form.liters}
                    onChange={handleChange("liters")}
                    placeholder={t.diesel.litersPlaceholder}
                    error={!!errors.liters}
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    disabled={ocrLoading}
                  />
                </FormField>

                <FormField
                  label={t.diesel.cmimiLiter}
                  error={errors.cmimiLiter}
                  required
                >
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg pointer-events-none">
                      €
                    </span>
                    <Input
                      type="number"
                      value={form.cmimiLiter}
                      onChange={handleChange("cmimiLiter")}
                      placeholder={t.diesel.cmimiLiterPlaceholder}
                      error={!!errors.cmimiLiter}
                      min="0"
                      step="0.001"
                      inputMode="decimal"
                      disabled={ocrLoading}
                      className="pl-8"
                    />
                  </div>
                </FormField>

                {/* Calculated total preview */}
                {calculatedTotal !== null && (
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Fuel className="w-4 h-4 text-orange-500" />
                      {t.diesel.totalPrice}
                    </span>
                    <span className="text-xl font-extrabold text-orange-700">
                      €
                      {calculatedTotal.toLocaleString("de-DE", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setPhotoPreview(undefined);
                    }}
                    disabled={ocrLoading}
                    className="flex-1 h-14 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={ocrLoading}
                    className="flex-1 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-lg transition-colors shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {ocrLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {t.common.loading}
                      </>
                    ) : (
                      t.common.save
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        message={t.diesel.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
