"use client";

import { useState, useEffect, useRef, useMemo, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { db, type StockItem, type OfficeExpense } from "@/lib/db";
import { t } from "@/lib/translations";
import {
  STOCK_CATEGORIES,
  OFFICE_EXPENSE_CATEGORIES,
  normalizeOfficeCategory,
} from "@/lib/stockConstants";
import SegmentedTabs from "@/components/SegmentedTabs";
import { FormField, Input, Select } from "@/components/FormField";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import toast from "react-hot-toast";
import {
  Plus,
  Trash2,
  X,
  Package,
  Camera,
  Upload,
  Loader2,
  Sparkles,
  Euro,
  Receipt,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompress";
import { format } from "date-fns";

const today = new Date().toISOString().split("T")[0];

const mainTabs = [
  { id: "inventory", label: t.stoku.tabInventory },
  { id: "expenses", label: t.stoku.tabExpenses },
];

function StokuContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const section = searchParams.get("p") === "expenses" ? "expenses" : "inventory";

  const setSection = useCallback(
    (id: string) => {
      router.replace(id === "expenses" ? "/stoku?p=expenses" : "/stoku", { scroll: false });
    },
    [router]
  );

  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [expenses, setExpenses] = useState<OfficeExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>("__all__");

  const [showStockForm, setShowStockForm] = useState(false);
  const [stockEditId, setStockEditId] = useState<number | null>(null);
  const [stockForm, setStockForm] = useState<{
    category: string;
    name: string;
    quantity: string;
    unit: string;
    notes: string;
  }>({
    category: STOCK_CATEGORIES[0],
    name: "",
    quantity: "",
    unit: "",
    notes: "",
  });

  const [showExpForm, setShowExpForm] = useState(false);
  const [expForm, setExpForm] = useState<{
    date: string;
    category: string;
    title: string;
    amount: string;
    notes: string;
  }>({
    date: today,
    category: OFFICE_EXPENSE_CATEGORIES[0],
    title: "",
    amount: "",
    notes: "",
  });
  const [expPhoto, setExpPhoto] = useState<string | undefined>();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrDetail, setOcrDetail] = useState<string | null>(null);
  const [deleteStockId, setDeleteStockId] = useState<number | null>(null);
  const [deleteExpId, setDeleteExpId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const parseNum = (v: string) => parseFloat(v.replace(",", "."));

  const loadAll = async () => {
    try {
      const [s, e] = await Promise.all([db.stock.getAll(), db.officeExpenses.getAll()]);
      setStockItems(s);
      setExpenses(e);
    } catch {
      toast.error(t.errors.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredStock = useMemo(() => {
    let list = stockItems;
    if (categoryFilter !== "__all__") {
      list = list.filter((i) => i.category === categoryFilter);
    }
    return [...list].sort((a, b) => {
      const c = a.category.localeCompare(b.category);
      return c !== 0 ? c : a.name.localeCompare(b.name);
    });
  }, [stockItems, categoryFilter]);

  const grouped = useMemo(() => {
    const m = new Map<string, StockItem[]>();
    for (const it of filteredStock) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return m;
  }, [filteredStock]);

  const openStockAdd = () => {
    setStockEditId(null);
    setStockForm({
      category: STOCK_CATEGORIES[0],
      name: "",
      quantity: "",
      unit: "",
      notes: "",
    });
    setShowStockForm(true);
  };

  const openStockEdit = (it: StockItem) => {
    setStockEditId(it.id!);
    setStockForm({
      category: STOCK_CATEGORIES.includes(it.category as (typeof STOCK_CATEGORIES)[number])
        ? it.category
        : STOCK_CATEGORIES[0],
      name: it.name,
      quantity: String(it.quantity),
      unit: it.unit,
      notes: it.notes,
    });
    setShowStockForm(true);
  };

  const saveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockForm.name.trim()) {
      toast.error(t.errors.requiredField);
      return;
    }
    const q = parseNum(stockForm.quantity);
    if (stockForm.quantity.trim() === "" || isNaN(q)) {
      toast.error(t.errors.invalidNumber);
      return;
    }
    try {
      if (stockEditId !== null) {
        await db.stock.update(stockEditId, {
          category: stockForm.category,
          name: stockForm.name.trim(),
          quantity: q,
          unit: stockForm.unit,
          notes: stockForm.notes,
        });
        toast.success(t.success.updated);
      } else {
        await db.stock.add({
          category: stockForm.category,
          name: stockForm.name.trim(),
          quantity: q,
          unit: stockForm.unit,
          notes: stockForm.notes,
        });
        toast.success(t.success.saved);
      }
      setShowStockForm(false);
      await loadAll();
    } catch {
      toast.error(t.errors.saveError);
    }
  };

  const runExpenseOcr = async (imageBase64: string) => {
    setOcrLoading(true);
    setOcrDetail(null);
    const loadingToast = toast.loading(t.diesel.aiExtracting);
    try {
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mode: "office" }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        detail?: string;
        date?: string | null;
        title?: string | null;
        totalAmount?: number | null;
        categoryGuess?: string | null;
      } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        toast.dismiss(loadingToast);
        setOcrDetail(raw?.slice(0, 400) ?? "");
        toast.error(t.diesel.aiError);
        return;
      }
      toast.dismiss(loadingToast);
      if (!res.ok || data.error) {
        if (data.detail) setOcrDetail(data.detail);
        toast.error(data.error || t.diesel.aiError);
        return;
      }
      if (data.date) setExpForm((f) => ({ ...f, date: data.date! }));
      if (data.title) setExpForm((f) => ({ ...f, title: data.title! }));
      if (data.totalAmount != null)
        setExpForm((f) => ({ ...f, amount: String(data.totalAmount) }));
      if (data.categoryGuess)
        setExpForm((f) => ({
          ...f,
          category: normalizeOfficeCategory(data.categoryGuess),
        }));
      toast.success(t.diesel.aiSuccess);
    } catch (err: unknown) {
      toast.dismiss(loadingToast);
      setOcrDetail(err instanceof Error ? err.message : String(err));
      toast.error(t.diesel.aiError);
    } finally {
      setOcrLoading(false);
    }
  };

  const onExpImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    try {
      const c = await compressImage(file);
      setExpPhoto(c);
      await runExpenseOcr(c);
    } catch {
      toast.error(t.errors.unknownError);
    }
  };

  const saveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNum(expForm.amount);
    if (!expForm.title.trim() || !expForm.amount.trim() || isNaN(amt) || amt <= 0) {
      toast.error(t.errors.requiredField);
      return;
    }
    try {
      await db.officeExpenses.add({
        date: expForm.date,
        category: expForm.category,
        title: expForm.title.trim(),
        amount: amt,
        notes: expForm.notes.trim(),
        photoBase64: expPhoto,
      });
      toast.success(t.success.saved);
      setShowExpForm(false);
      setExpForm({
        date: today,
        category: OFFICE_EXPENSE_CATEGORIES[0],
        title: "",
        amount: "",
        notes: "",
      });
      setExpPhoto(undefined);
      setOcrDetail(null);
      await loadAll();
    } catch {
      toast.error(t.errors.saveError);
    }
  };

  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="mb-4">
        <SegmentedTabs tabs={mainTabs} active={section} onChange={setSection} />
      </div>

      {section === "inventory" && (
        <>
          <PageHeader
            title={t.stoku.inventoryTitle}
            action={
              <button
                type="button"
                onClick={openStockAdd}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 h-11 rounded-xl text-sm shadow-md"
              >
                <Plus className="w-5 h-5" />
                {t.stoku.addItem}
              </button>
            }
          />

          <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1 px-1 scrollbar-thin">
            <button
              type="button"
              onClick={() => setCategoryFilter("__all__")}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors ${
                categoryFilter === "__all__"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "bg-white border-gray-200 text-gray-700"
              }`}
            >
              {t.stoku.allCategories}
            </button>
            {STOCK_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategoryFilter(c)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border-2 transition-colors whitespace-nowrap ${
                  categoryFilter === c
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {filteredStock.length === 0 ? (
            <EmptyState
              message={t.stoku.noStock}
              icon={<Package className="w-10 h-10" />}
              action={
                <button
                  type="button"
                  onClick={openStockAdd}
                  className="flex items-center gap-2 bg-emerald-600 text-white font-bold px-6 h-12 rounded-xl"
                >
                  <Plus className="w-5 h-5" />
                  {t.stoku.addItem}
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-6">
              {Array.from(grouped.entries()).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="text-sm font-extrabold text-emerald-800 uppercase tracking-wide mb-2 px-1">
                    {cat}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {items.map((it) => (
                      <li
                        key={it.id}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
                      >
                        <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                          <Package className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{it.name}</p>
                          <p className="text-sm text-gray-600">
                            {it.quantity}
                            {it.unit ? ` ${it.unit}` : ""}
                          </p>
                          {it.notes && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{it.notes}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openStockEdit(it)}
                          className="text-sm font-bold text-blue-600 px-2"
                        >
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteStockId(it.id!)}
                          className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {section === "expenses" && (
        <>
          <PageHeader
            title={t.stoku.expensesTitle}
            subtitle={`${t.common.total}: €${totalExpenses.toFixed(2)}`}
            action={
              <button
                type="button"
                onClick={() => {
                  setExpForm({
                    date: today,
                    category: OFFICE_EXPENSE_CATEGORIES[0],
                    title: "",
                    amount: "",
                    notes: "",
                  });
                  setExpPhoto(undefined);
                  setOcrDetail(null);
                  setShowExpForm(true);
                }}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 text-white font-bold px-4 h-11 rounded-xl text-sm"
              >
                <Plus className="w-5 h-5" />
                {t.stoku.addExpense}
              </button>
            }
          />

          {expenses.length === 0 ? (
            <EmptyState
              message={t.stoku.noExpenses}
              icon={<Receipt className="w-10 h-10" />}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {expenses.map((ex) => (
                <li
                  key={ex.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
                >
                  {ex.photoBase64 && (
                    <div className="h-24 bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ex.photoBase64} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="p-4 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                      <Euro className="w-5 h-5 text-slate-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{ex.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(ex.date), "dd/MM/yyyy")} · {ex.category}
                      </p>
                      {ex.notes && (
                        <p className="text-sm text-gray-600 mt-1">{ex.notes}</p>
                      )}
                      <p className="text-lg font-extrabold text-slate-800 mt-2">
                        €{ex.amount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteExpId(ex.id!)}
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Stock modal */}
      {showStockForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStockForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold">
                {stockEditId !== null ? t.stoku.editItem : t.stoku.addItem}
              </h2>
              <button
                type="button"
                onClick={() => setShowStockForm(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveStock} className="flex flex-col gap-4">
              <FormField label={t.stoku.category} required>
                <Select
                  value={stockForm.category}
                  onChange={(e) =>
                    setStockForm((f) => ({ ...f, category: e.target.value }))
                  }
                >
                  {STOCK_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label={t.stoku.itemName} required>
                <Input
                  value={stockForm.name}
                  onChange={(e) => setStockForm((f) => ({ ...f, name: e.target.value }))}
                />
              </FormField>
              <FormField label={t.stoku.quantity} required>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={stockForm.quantity}
                  onChange={(e) => setStockForm((f) => ({ ...f, quantity: e.target.value }))}
                />
              </FormField>
              <FormField label={t.stoku.unit} hint={t.common.optional}>
                <Input
                  value={stockForm.unit}
                  onChange={(e) => setStockForm((f) => ({ ...f, unit: e.target.value }))}
                  placeholder="p.sh. kg, copë"
                />
              </FormField>
              <FormField label={t.stoku.notes} hint={t.common.optional}>
                <Input
                  value={stockForm.notes}
                  onChange={(e) => setStockForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </FormField>
              <button
                type="submit"
                className="h-14 rounded-xl bg-emerald-600 text-white font-bold text-lg"
              >
                {t.common.save}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {showExpForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !ocrLoading && setShowExpForm(false)}
          />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b flex justify-between items-center z-10">
              <h2 className="text-xl font-extrabold">{t.stoku.addExpense}</h2>
              <button
                type="button"
                disabled={ocrLoading}
                onClick={() => setShowExpForm(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pb-8 pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                {t.stoku.scanReceipt}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => camRef.current?.click()}
                  className="h-24 rounded-2xl border-2 border-dashed border-purple-300 bg-purple-50 flex flex-col items-center justify-center gap-1 text-purple-700 font-semibold text-sm"
                >
                  <Camera className="w-6 h-6" />
                  {t.diesel.takePhoto}
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="h-24 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-600 font-semibold text-sm"
                >
                  <Upload className="w-6 h-6" />
                  {t.diesel.uploadBill}
                </button>
              </div>
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onExpImage(f);
                }}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onExpImage(f);
                }}
              />
              {expPhoto && (
                <div className="relative rounded-xl overflow-hidden border mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={expPhoto} alt="" className="w-full max-h-36 object-contain bg-gray-50" />
                  {ocrLoading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  )}
                </div>
              )}
              {ocrDetail && (
                <p className="text-xs font-mono text-red-700 bg-red-50 p-2 rounded-lg mb-4 break-all max-h-24 overflow-y-auto">
                  {ocrDetail}
                </p>
              )}

              <form onSubmit={saveExpense} className="flex flex-col gap-4">
                <FormField label={t.stoku.expenseCategory} required>
                  <Select
                    value={expForm.category}
                    onChange={(e) =>
                      setExpForm((f) => ({ ...f, category: e.target.value }))
                    }
                  >
                    {OFFICE_EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={t.stoku.expenseTitle} required>
                  <Input
                    value={expForm.title}
                    onChange={(e) => setExpForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder={t.stoku.expenseTitlePh}
                  />
                </FormField>
                <FormField label={t.diesel.date} required>
                  <Input
                    type="date"
                    value={expForm.date}
                    onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </FormField>
                <FormField label={t.stoku.expenseAmount} required>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                      €
                    </span>
                    <Input
                      className="pl-8"
                      inputMode="decimal"
                      value={expForm.amount}
                      onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </div>
                </FormField>
                <FormField label={t.stoku.notes} hint={t.common.optional}>
                  <textarea
                    className="w-full min-h-[80px] px-4 py-3 rounded-xl border-2 border-gray-300 text-base"
                    value={expForm.notes}
                    onChange={(e) => setExpForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </FormField>
                <button
                  type="submit"
                  disabled={ocrLoading}
                  className="h-14 rounded-xl bg-slate-800 text-white font-bold disabled:opacity-50"
                >
                  {t.common.save}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteStockId !== null}
        message={t.stoku.deleteStockConfirm}
        onConfirm={async () => {
          if (deleteStockId === null) return;
          try {
            await db.stock.delete(deleteStockId);
            toast.success(t.success.deleted);
            setDeleteStockId(null);
            await loadAll();
          } catch {
            toast.error(t.errors.deleteError);
          }
        }}
        onCancel={() => setDeleteStockId(null)}
      />

      <ConfirmDialog
        open={deleteExpId !== null}
        message={t.stoku.deleteExpenseConfirm}
        onConfirm={async () => {
          if (deleteExpId === null) return;
          try {
            await db.officeExpenses.delete(deleteExpId);
            toast.success(t.success.deleted);
            setDeleteExpId(null);
            await loadAll();
          } catch {
            toast.error(t.errors.deleteError);
          }
        }}
        onCancel={() => setDeleteExpId(null)}
      />
    </div>
  );
}

export default function StokuPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-24 text-gray-500">{t.common.loading}</div>
      }
    >
      <StokuContent />
    </Suspense>
  );
}
