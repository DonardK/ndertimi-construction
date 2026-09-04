"use client";

import { useState } from "react";
import {
  db,
  type Employee,
  type Company,
  type WorkLocation,
  COMPANY_LOCATIONS,
  defaultLocationForCompany,
  workLocationLabel,
  COMPANIES,
} from "@/lib/db";
import { compressImage } from "@/lib/imageCompress";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import toast from "react-hot-toast";
import {
  Sparkles,
  X,
  Upload,
  Calendar,
  Clock,
  MapPin,
  Trash2,
  Plus,
  CheckCircle2,
  Building2,
  FileText,
  User,
  Minus,
} from "lucide-react";

export interface ParsedWorkerRow {
  tempId: string;
  employeeId: number | null;
  name: string;
  rawName: string;
  location: WorkLocation;
  hours: number;
  task: string;
  checked: boolean;
  confidence: "high" | "medium" | "low";
}

export interface ParsedSiteReport {
  location: string;
  locationLabel: string;
  workDescription: string;
}

interface AiDailyReportModalProps {
  open: boolean;
  initialDate?: string;
  initialCompany?: Company;
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_REPORT_TEXT = `Prishtinë:
- Artan Berisha 8 orë (punime suvatimi në katin e dytë)
- Besnik Krasniqi 8.5 orë (suvatim dhe bartje materiali)
- Enver Hoxha 9 orë (eskavator dhe pastrim i dheut)
Puna e kryer: U përfundua suvatimi i korridorit në katin 2 dhe u bë pastrimi i përgjithshëm i objektit.

Prizren:
- Valon Gashi 8 orë (shtruarje pllaka)
- Dardan Morina 8 orë (fugim dhe përgatitje sipërfaqe)
Puna e kryer: Filloi shtrimi i pllakave të banjove në katin përdhesë.`;

export default function AiDailyReportModal({
  open,
  initialDate = new Date().toISOString().split("T")[0],
  initialCompany = "Etna Group",
  employees,
  onClose,
  onSuccess,
}: AiDailyReportModalProps) {
  useBodyScrollLock(open);

  const [step, setStep] = useState<"input" | "review">("input");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedCompany, setSelectedCompany] = useState<Company>(initialCompany);
  const [inputTab, setInputTab] = useState<"text" | "image">("text");

  // Input states
  const [reportText, setReportText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Review states
  const [reportTitle, setReportTitle] = useState("");
  const [formattedContent, setFormattedContent] = useState("");
  const [siteReports, setSiteReports] = useState<ParsedSiteReport[]>([]);
  const [workerRows, setWorkerRows] = useState<ParsedWorkerRow[]>([]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const activeEmployees = employees.filter((e) => !e.archivedAt);
  const companyLocations = COMPANY_LOCATIONS[selectedCompany];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFileName(file.name);
    try {
      const base64 = await compressImage(file);
      setImageBase64(base64);
      toast.success("Fotoja u ngarkua dhe u kompresua!");
    } catch {
      toast.error("Ngarkimi i fotos dështoi. Provoni përsëri.");
    }
  };

  const handleAnalyze = async () => {
    if (!reportText.trim() && !imageBase64) {
      toast.error("Ju lutem shkruani raportin ose ngarkoni një foto.");
      return;
    }

    setAnalyzing(true);
    try {
      const locationList = companyLocations.map((loc) => ({
        code: loc,
        label: workLocationLabel(loc),
      }));

      const res = await fetch("/api/ai/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: reportText.trim(),
          imageBase64: imageBase64 || undefined,
          date: selectedDate,
          company: selectedCompany,
          employees: activeEmployees.map((e) => ({
            id: e.id,
            emri: e.emri,
            mbiemri: e.mbiemri,
          })),
          locations: locationList,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Përpunimi i raportit dështoi.");
      }

      setReportTitle(data.title || `Raporti ditor - ${selectedDate}`);
      setFormattedContent(data.formattedReport || "");
      setSiteReports(data.siteReports || []);

      // Convert worker hours to editable rows
      interface ApiWorkerHour {
        tempId?: string;
        employeeId?: number | null;
        name?: string;
        rawName?: string;
        location?: string;
        hours?: number;
        task?: string;
        confidence?: "high" | "medium" | "low";
      }
      const rows: ParsedWorkerRow[] = (
        (data.workerHours as ApiWorkerHour[]) || []
      ).map((wh, idx: number) => {
        let matchedEmp: Employee | undefined;
        if (wh.employeeId) {
          matchedEmp = activeEmployees.find((e) => e.id === wh.employeeId);
        }
        if (!matchedEmp && wh.name) {
          // Fallback search in active employees
          const query = wh.name.toLowerCase();
          matchedEmp = activeEmployees.find(
            (e) =>
              `${e.emri} ${e.mbiemri}`.toLowerCase() === query ||
              e.emri.toLowerCase() === query
          );
        }

        const validLoc = companyLocations.includes(wh.location as WorkLocation)
          ? (wh.location as WorkLocation)
          : defaultLocationForCompany(selectedCompany);

        return {
          tempId: wh.tempId || `w_${idx + 1}`,
          employeeId: matchedEmp ? matchedEmp.id! : null,
          name: matchedEmp ? `${matchedEmp.emri} ${matchedEmp.mbiemri}` : (wh.name || wh.rawName || `Punonjës ${idx + 1}`),
          rawName: wh.rawName || wh.name || "",
          location: validLoc,
          hours: wh.hours || 8,
          task: wh.task || "",
          checked: true,
          confidence: wh.confidence || (matchedEmp ? "high" : "low"),
        };
      });

      setWorkerRows(rows);
      setStep("review");
      toast.success("Raporti u analizua me sukses!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gabim gjatë thirrjes së AI.";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Row update handlers
  const updateWorker = (idx: number, updates: Partial<ParsedWorkerRow>) => {
    setWorkerRows((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updates };
      return copy;
    });
  };

  const removeWorker = (idx: number) => {
    setWorkerRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEmptyWorker = () => {
    const firstEmp = activeEmployees[0];
    setWorkerRows((prev) => [
      ...prev,
      {
        tempId: `w_manual_${Date.now()}`,
        employeeId: firstEmp ? firstEmp.id! : null,
        name: firstEmp ? `${firstEmp.emri} ${firstEmp.mbiemri}` : "",
        rawName: "",
        location: defaultLocationForCompany(selectedCompany),
        hours: 8,
        task: "",
        checked: true,
        confidence: "high",
      },
    ]);
  };

  const updateSiteReport = (idx: number, desc: string) => {
    setSiteReports((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], workDescription: desc };
      return copy;
    });
  };

  // Save parsed data to Supabase
  const handleSaveToSystem = async () => {
    const selectedRows = workerRows.filter((r) => r.checked);
    if (selectedRows.length === 0) {
      toast.error("Ju lutem zgjidhni të paktën një punonjës për regjistrim.");
      return;
    }

    // Verify all checked rows have valid employeeId
    const missingEmp = selectedRows.find((r) => !r.employeeId);
    if (missingEmp) {
      toast.error(`Zgjidhni punonjësin zyrtar për: ${missingEmp.name || "punonjësin e panjohur"}`);
      return;
    }

    setSaving(true);
    try {
      // 1. Upsert daily report
      const contentToSave =
        formattedContent.trim() ||
        siteReports
          .map((sr) => `### ${sr.locationLabel}\n${sr.workDescription}`)
          .join("\n\n");

      await db.dailyReports.upsert({
        date: selectedDate,
        company: selectedCompany,
        title: reportTitle.trim() || `Raporti ditor - ${selectedDate}`,
        content: contentToSave.trim() || "Raporti ditor i punimeve.",
      });

      // 2. Add attendance batch
      const attendanceBatch = selectedRows.map((r) => {
        const emp = activeEmployees.find((e) => e.id === r.employeeId)!;
        return {
          employeeId: emp.id!,
          emri: emp.emri,
          mbiemri: emp.mbiemri,
          date: selectedDate,
          paymentMethod: emp.paymentMethod,
          hoursWorked: r.hours,
          location: r.location,
          company: selectedCompany,
        };
      });

      await db.attendance.addBatch(attendanceBatch);

      toast.success(
        `U regjistruan me sukses ${attendanceBatch.length} punonjës dhe raporti ditor!`
      );
      onSuccess();
      onClose();
    } catch {
      toast.error("Dështoi ruajtja në sistem. Provoni përsëri.");
    } finally {
      setSaving(false);
    }
  };

  const checkedWorkers = workerRows.filter((r) => r.checked);
  const totalLoggedHours = checkedWorkers.reduce((s, r) => s + (r.hours || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      data-no-pull-refresh
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !analyzing && !saving && onClose()}
      />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <span>Raporti Ditor me AI</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  {step === "input" ? "Analizo" : "Rishiko & Modifiko"}
                </span>
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Pastro raportin ditor, ndaj sipas vendpunimeve dhe regjistro orët automatikisht
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={analyzing || saving}
            className="w-9 h-9 rounded-xl bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 transition-colors shadow-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {step === "input" ? (
            /* ──────────────── STEP 1: INPUT ──────────────── */
            <div className="space-y-5">
              {/* Top Controls: Date and Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    Data e Raportit
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full h-12 px-3 rounded-xl border-2 border-gray-200 text-base font-bold text-gray-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-1.5 mb-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    Kompania
                  </label>
                  <div className="flex gap-2">
                    {COMPANIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedCompany(c)}
                        className={`flex-1 h-12 rounded-xl border-2 font-bold text-sm transition-colors
                          ${
                            selectedCompany === c
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Input Mode Tabs */}
              <div className="flex border-b border-gray-200 gap-4">
                <button
                  type="button"
                  onClick={() => setInputTab("text")}
                  className={`pb-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                    ${
                      inputTab === "text"
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  Ngjit Tekstin e Raportit
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab("image")}
                  className={`pb-2 text-sm font-bold border-b-2 transition-colors flex items-center gap-2
                    ${
                      inputTab === "image"
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                >
                  <Upload className="w-4 h-4" />
                  Ngarko Foto / Skanim Fature
                </button>
              </div>

              {inputTab === "text" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-800">
                      Teksti i raportit ditor:
                    </label>
                    <button
                      type="button"
                      onClick={() => setReportText(SAMPLE_REPORT_TEXT)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      Përdor shembull
                    </button>
                  </div>
                  <textarea
                    rows={10}
                    value={reportText}
                    onChange={(e) => setReportText(e.target.value)}
                    placeholder={`Ngjitni raportin e plotë ditor këtu...\n\nShembull:\nPrishtinë:\n- Artan Berisha 8 orë\n- Besnik Krasniqi 8.5 orë (suvatim)\nPuna: Përfunduar suvatimi në katin 2.\n\nPrizren:\n- Valon Gashi 8 orë`}
                    className="w-full p-4 rounded-2xl border-2 border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition-colors"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="text-sm font-bold text-gray-800">
                    Ngarkoni foton e fletës së raportit:
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-6 text-center hover:border-indigo-500 transition-colors bg-gray-50">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      id="ai-report-image"
                      className="hidden"
                    />
                    <label
                      htmlFor="ai-report-image"
                      className="cursor-pointer flex flex-col items-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <Upload className="w-7 h-7" />
                      </div>
                      <div>
                        <p className="text-base font-bold text-gray-800">
                          Kliko për të zgjedhur foto ose bëj foto me kamerë
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, JPEG (kompresohet automatikisht)
                        </p>
                      </div>
                    </label>
                  </div>

                  {imageBase64 && (
                    <div className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                        <span className="text-xs font-semibold text-gray-800 truncate">
                          {imageFileName || "Foto e ngarkuar"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setImageBase64(null);
                          setImageFileName("");
                        }}
                        className="text-xs font-bold text-red-600 hover:text-red-800"
                      >
                        Fshi
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ──────────────── STEP 2: REVIEW & EDIT ──────────────── */
            <div className="space-y-6">
              {/* Success Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-emerald-900">
                    AI analizoi dhe ndau me sukses të dhënat!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Mund të modifikoni orët, punonjësin, vendpunimin ose përshkrimin e punës para
                    se t&apos;i regjistroni në sistem.
                  </p>
                </div>
              </div>

              {/* SECTION A: SEPARATED REPORTS BY SITE */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Raporti i Punimeve sipas Vendpunimeve
                  </h3>
                  <span className="text-xs font-semibold text-gray-500">
                    {siteReports.length} lokacione
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* Title of report */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">
                      Titulli i Raportit Ditor
                    </label>
                    <input
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* Individual site cards */}
                  {siteReports.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {siteReports.map((sr, idx) => (
                        <div
                          key={sr.location + idx}
                          className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                              <MapPin className="w-3 h-3" />
                              {sr.locationLabel}
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={sr.workDescription}
                            onChange={(e) => updateSiteReport(idx, e.target.value)}
                            className="w-full p-2 bg-white rounded-lg border border-indigo-200 text-xs text-gray-800 focus:outline-none focus:border-indigo-600"
                            placeholder="Përshkrimi i punës në këtë vend..."
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Markdown Preview / Editor */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">
                      Përmbajtja e Plotë e Raportit Ditor (E bashkuar)
                    </label>
                    <textarea
                      rows={4}
                      value={formattedContent}
                      onChange={(e) => setFormattedContent(e.target.value)}
                      className="w-full p-3 rounded-xl border border-gray-300 text-xs font-mono text-gray-800 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION B: WORKER HOURS TABLE (EDITABLE!) */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Orët e Punonjësve (Plotësisht e Modifikueshme)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {checkedWorkers.length} punonjës të zgjedhur · Gjithsej {totalLoggedHours} orë
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addEmptyWorker}
                    className="flex items-center gap-1 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Shto Punonjës
                  </button>
                </div>

                {workerRows.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Nuk u zbulua asnjë punonjës nga raporti. Shtoni manualisht duke klikuar &quot;Shto
                    Punonjës&quot;.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {workerRows.map((row, idx) => {
                      const matchedEmp = activeEmployees.find((e) => e.id === row.employeeId);
                      const isUnmatched = !row.employeeId;
                      const isFixed = matchedEmp?.salaryType === "fixed";

                      return (
                        <div
                          key={row.tempId || idx}
                          className={`p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center gap-3 transition-colors ${
                            !row.checked ? "opacity-50 bg-gray-50" : "bg-white hover:bg-gray-50/70"
                          } ${isUnmatched ? "border-l-4 border-l-amber-500" : ""}`}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center gap-3 shrink-0">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={(e) => updateWorker(idx, { checked: e.target.checked })}
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Employee Select */}
                          <div className="flex-1 min-w-[200px] w-full">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Punonjësi {row.rawName ? `(Gjetur: ${row.rawName})` : ""}
                            </label>
                            <select
                              value={row.employeeId || ""}
                              onChange={(e) => {
                                const id = e.target.value ? parseInt(e.target.value, 10) : null;
                                const emp = activeEmployees.find((em) => em.id === id);
                                updateWorker(idx, {
                                  employeeId: id,
                                  name: emp ? `${emp.emri} ${emp.mbiemri}` : row.name,
                                });
                              }}
                              className={`w-full h-10 px-2.5 rounded-xl border-2 text-sm font-bold text-gray-900 focus:outline-none ${
                                isUnmatched
                                  ? "border-amber-400 bg-amber-50 focus:border-amber-600"
                                  : "border-gray-200 bg-white focus:border-blue-600"
                              }`}
                            >
                              <option value="">-- Zgjidhni Punonjësin --</option>
                              {activeEmployees.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {e.emri} {e.mbiemri} {e.salaryType === "fixed" ? "(Fikse)" : ""}
                                </option>
                              ))}
                            </select>
                            {isFixed && (
                              <span className="text-[10px] text-purple-700 font-bold mt-0.5 inline-block">
                                ★ Pagë Fikse
                              </span>
                            )}
                          </div>

                          {/* Location Select */}
                          <div className="w-full md:w-36 shrink-0">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Vendi
                            </label>
                            <select
                              value={row.location}
                              onChange={(e) =>
                                updateWorker(idx, { location: e.target.value as WorkLocation })
                              }
                              className="w-full h-10 px-2 rounded-xl border-2 border-gray-200 text-xs font-bold text-gray-800 bg-white focus:outline-none focus:border-blue-600"
                            >
                              {companyLocations.map((loc) => (
                                <option key={loc} value={loc}>
                                  {workLocationLabel(loc)}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Hours Input with Stepper */}
                          <div className="w-full md:w-36 shrink-0">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Orët e Punës
                            </label>
                            <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden h-10 bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorker(idx, { hours: Math.max(0, (row.hours || 0) - 0.5) })
                                }
                                className="w-8 h-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={row.hours}
                                onChange={(e) =>
                                  updateWorker(idx, {
                                    hours: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full text-center text-sm font-extrabold text-gray-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorker(idx, { hours: (row.hours || 0) + 0.5 })
                                }
                                className="w-8 h-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 font-bold"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Task Description */}
                          <div className="w-full md:w-44 shrink-0">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Puna / Detyra
                            </label>
                            <input
                              type="text"
                              value={row.task}
                              onChange={(e) => updateWorker(idx, { task: e.target.value })}
                              placeholder="p.sh. Suvatim"
                              className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 text-xs font-medium text-gray-800 bg-white focus:outline-none focus:border-blue-600"
                            />
                          </div>

                          {/* Delete Row */}
                          <button
                            type="button"
                            onClick={() => removeWorker(idx)}
                            className="w-9 h-9 rounded-xl text-red-500 hover:bg-red-50 flex items-center justify-center shrink-0 self-end md:self-center transition-colors"
                            title="Hiq këtë rresht"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-3">
          {step === "input" ? (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={analyzing}
                className="h-12 px-6 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors"
              >
                Anulo
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="h-12 px-8 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-base shadow-lg flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Duke analizuar me AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Analizo me AI</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("input")}
                disabled={saving}
                className="h-12 px-5 rounded-xl border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-100 flex items-center gap-1.5 transition-colors"
              >
                ← Kthehu te Teksti
              </button>
              <button
                type="button"
                onClick={handleSaveToSystem}
                disabled={saving}
                className="h-12 px-8 rounded-xl bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-bold text-base shadow-lg flex items-center gap-2 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Duke ruajtur...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Regjistro në Sistem ({checkedWorkers.length} punonjës)</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
