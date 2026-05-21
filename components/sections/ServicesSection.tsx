"use client";

import { useState, useEffect, useRef } from "react";
import {
  db,
  type Vehicle,
  type VehicleServiceEntry,
  type ServiceLineItem,
} from "@/lib/db";
import { t } from "@/lib/translations";
import { FormField, Input, Select } from "@/components/FormField";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  X,
  Camera,
  Upload,
  AlertCircle,
  Loader2,
  Truck,
  Euro,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { compressImage } from "@/lib/imageCompress";

const today = new Date().toISOString().split("T")[0];

function emptyLine(): ServiceLineItem {
  return { description: "", amount: 0 };
}

export default function ServicesSection() {
  const [records, setRecords] = useState<VehicleServiceEntry[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ServiceLineItem[]>([emptyLine()]);
  const [errors, setErrors] = useState<{
    vehicleId?: string;
    date?: string;
    items?: string;
  }>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrErrorDetail, setOcrErrorDetail] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | undefined>();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const parseNum = (val: string) => parseFloat(val.replace(",", "."));

  const lineTotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);

  const loadData = async () => {
    try {
      const [svc, vehs] = await Promise.all([
        db.vehicleServices.getAll(),
        db.vehicles.getAll(),
      ]);
      setRecords(svc);
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

  const resetForm = () => {
    setVehicleId("");
    setDate(today);
    setNotes("");
    setItems([emptyLine()]);
    setErrors({});
    setPhotoPreview(undefined);
    setOcrErrorDetail(null);
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!vehicleId) e.vehicleId = t.errors.requiredField;
    if (!date) e.date = t.errors.requiredField;
    const validItems = items.filter(
      (it) => it.description.trim() && (Number(it.amount) || 0) > 0
    );
    if (validItems.length === 0) e.items = t.services.needOneLine;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const vehicle = vehicles.find((v) => v.id === parseInt(vehicleId, 10));
    if (!vehicle) return;
    const cleanItems = items
      .filter((it) => it.description.trim() && (Number(it.amount) || 0) > 0)
      .map((it) => ({
        description: it.description.trim(),
        amount: Math.round(Number(it.amount) * 100) / 100,
      }));
    const total = cleanItems.reduce((s, it) => s + it.amount, 0);
    try {
      await db.vehicleServices.add({
        vehicleId: vehicle.id!,
        emriMjetit: vehicle.emriMjetit,
        date,
        notes: notes.trim(),
        items: cleanItems,
        totalPrice: total,
        photoBase64: photoPreview,
      });
      toast.success(t.success.saved);
      setShowForm(false);
      resetForm();
      await loadData();
    } catch {
      toast.error(t.errors.saveError);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await db.vehicleServices.delete(deleteId);
      toast.success(t.success.deleted);
      setDeleteId(null);
      await loadData();
    } catch {
      toast.error(t.errors.deleteError);
    }
  };

  const runOcr = async (imageBase64: string) => {
    setOcrLoading(true);
    setOcrErrorDetail(null);
    const loadingToast = toast.loading(t.diesel.aiExtracting);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mode: "mechanic" }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        detail?: string;
        date?: string | null;
        lineItems?: { description: string; amount: number }[];
        totalPrice?: number;
        notes?: string | null;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        toast.dismiss(loadingToast);
        setOcrErrorDetail(raw?.slice(0, 400) ?? "JSON");
        toast.error(t.diesel.aiError);
        return;
      }
      toast.dismiss(loadingToast);
      if (!res.ok || data.error) {
        if (data.detail) setOcrErrorDetail(data.detail);
        toast.error(data.error || t.diesel.aiError);
        return;
      }
      if (data.date) setDate(data.date);
      if (data.notes) setNotes((n) => (n ? `${n}\n${data.notes}` : data.notes!));
      if (data.lineItems && data.lineItems.length > 0) {
        setItems(
          data.lineItems.map((l) => ({
            description: l.description,
            amount: l.amount,
          }))
        );
      } else if (data.totalPrice != null && data.totalPrice > 0) {
        setItems([{ description: t.services.genericRepair, amount: data.totalPrice }]);
      }
      setOcrErrorDetail(null);
      toast.success(t.diesel.aiSuccess);
    } catch (e: unknown) {
      toast.dismiss(loadingToast);
      setOcrErrorDetail(e instanceof Error ? e.message : String(e));
      toast.error(t.diesel.aiError);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Ju lutem zgjidhni një skedar imazhi.");
      return;
    }
    try {
      setOcrErrorDetail(null);
      const compressed = await compressImage(file);
      setPhotoPreview(compressed);
      await runOcr(compressed);
    } catch {
      toast.error(t.errors.unknownError);
    }
  };

  const updateLine = (idx: number, field: keyof ServiceLineItem, value: string) => {
    setItems((rows) =>
      rows.map((r, i) => {
        if (i !== idx) return r;
        if (field === "amount") {
          const n = parseNum(value);
          return { ...r, amount: isNaN(n) ? 0 : n };
        }
        return { ...r, description: value };
      })
    );
  };

  const addLine = () => setItems((rows) => [...rows, emptyLine()]);
  const removeLine = (idx: number) =>
    setItems((rows) => (rows.length <= 1 ? rows : rows.filter((_, i) => i !== idx)));

  const toggleExpand = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="px-4 pt-6">
      <PageHeader
        title={t.services.title}
        action={
          vehicles.length > 0 ? (
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white font-bold px-5 h-12 rounded-xl text-base transition-colors shadow-md"
            >
              <Plus className="w-5 h-5" />
              {t.services.addTitle}
            </button>
          ) : null
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : vehicles.length === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 flex flex-col items-center gap-3">
          <AlertCircle className="w-10 h-10 text-amber-600" />
          <p className="text-amber-800 font-semibold text-center text-base">
            {t.services.noVehiclesWarning}
          </p>
          <Link
            href="/mjetet?tab=mjetet"
            className="flex items-center gap-2 bg-amber-600 text-white font-bold px-5 h-12 rounded-xl text-base"
          >
            {t.diesel.goToVehicles}
          </Link>
        </div>
      ) : records.length === 0 ? (
        <EmptyState
          message={t.services.noRecords}
          icon={<Wrench className="w-10 h-10" />}
          action={
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="flex items-center gap-2 bg-violet-600 text-white font-bold px-6 h-12 rounded-xl text-base"
            >
              <Plus className="w-5 h-5" />
              {t.services.addTitle}
            </button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {records.map((rec) => {
            const open = expanded[rec.id!];
            return (
              <li
                key={rec.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {rec.photoBase64 && (
                  <div className="h-24 overflow-hidden bg-gray-100 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rec.photoBase64}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(rec.id!)}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                      <Wrench className="w-7 h-7 text-violet-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-gray-500 shrink-0" />
                        <span className="truncate">{rec.emriMjetit}</span>
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(rec.date), "dd/MM/yyyy")}
                      </p>
                      <p className="text-lg font-extrabold text-violet-700 mt-1">
                        €
                        {rec.totalPrice.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    {open ? (
                      <ChevronUp className="w-6 h-6 text-gray-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-6 h-6 text-gray-400 shrink-0" />
                    )}
                  </button>
                  {open && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                      {rec.items.map((it, i) => (
                        <div
                          key={i}
                          className="flex justify-between gap-2 text-sm bg-gray-50 rounded-xl px-3 py-2"
                        >
                          <span className="text-gray-800 font-medium">{it.description}</span>
                          <span className="font-bold text-gray-900 shrink-0">
                            €{it.amount.toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {rec.notes && (
                        <p className="text-xs text-gray-600 italic px-1">{rec.notes}</p>
                      )}
                    </div>
                  )}
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => setDeleteId(rec.id!)}
                      className="w-11 h-11 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center"
                      aria-label={t.common.delete}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !ocrLoading && setShowForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 px-6 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-gray-900">{t.services.addTitle}</h2>
              <button
                type="button"
                onClick={() => !ocrLoading && setShowForm(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                disabled={ocrLoading}
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="px-6 pb-8 pt-4">
              <div className="mb-6">
                <p className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  {t.services.uploadReceipt}
                </p>
                {photoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border-2 border-purple-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoPreview}
                      alt=""
                      className="w-full max-h-40 object-contain bg-gray-50"
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
                        onClick={() => {
                          setPhotoPreview(undefined);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                          if (cameraInputRef.current) cameraInputRef.current.value = "";
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"
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
                      className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 text-purple-700 font-semibold"
                    >
                      <Camera className="w-7 h-7" />
                      <span className="text-sm">{t.diesel.takePhoto}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 text-gray-600 font-semibold"
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
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                  }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                  }}
                />
                {ocrErrorDetail && (
                  <div className="mt-3 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2 text-xs font-mono text-red-800 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                    {t.diesel.aiErrorTechnical} {ocrErrorDetail}
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <FormField label={t.diesel.selectVehicle} error={errors.vehicleId} required>
                  <Select
                    value={vehicleId}
                    onChange={(e) => {
                      setVehicleId(e.target.value);
                      setErrors((x) => ({ ...x, vehicleId: undefined }));
                    }}
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
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    error={!!errors.date}
                    disabled={ocrLoading}
                  />
                </FormField>

                <FormField label={t.services.notes} hint={t.common.optional}>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    disabled={ocrLoading}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-blue-500"
                    placeholder={t.services.notesPlaceholder}
                  />
                </FormField>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-base font-semibold text-gray-800">
                      {t.services.lineItems}
                    </span>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm font-bold text-violet-600"
                    >
                      + {t.services.addLine}
                    </button>
                  </div>
                  {errors.items && (
                    <p className="text-sm text-red-600 font-medium mb-2">{errors.items}</p>
                  )}
                  <div className="space-y-3">
                    {items.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-start bg-gray-50 rounded-xl p-3 border border-gray-100"
                      >
                        <div className="flex-1 min-w-0 space-y-2">
                          <Input
                            value={line.description}
                            onChange={(e) => updateLine(idx, "description", e.target.value)}
                            placeholder={t.services.lineDescPlaceholder}
                            disabled={ocrLoading}
                            className="h-12 text-base"
                          />
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                              €
                            </span>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={line.amount ? String(line.amount) : ""}
                              onChange={(e) => updateLine(idx, "amount", e.target.value)}
                              placeholder="0"
                              disabled={ocrLoading}
                              className="h-12 pl-8 text-base"
                            />
                          </div>
                        </div>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0 mt-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Euro className="w-4 h-4" />
                    {t.services.calculatedTotal}
                  </span>
                  <span className="text-xl font-extrabold text-violet-800">
                    €
                    {lineTotal.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    disabled={ocrLoading}
                    className="flex-1 h-14 rounded-xl border-2 border-gray-300 font-bold text-gray-700"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={ocrLoading}
                    className="flex-1 h-14 rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50"
                  >
                    {ocrLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : t.common.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        message={t.services.deleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
