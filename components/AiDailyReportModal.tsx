"use client";

import { useState } from "react";
import {
  db,
  type Employee,
  type Company,
  type WorkLocation,
  COMPANY_LOCATIONS,
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
  company: Company;
  location: WorkLocation;
  hours: number;
  task: string;
  checked: boolean;
  confidence: "high" | "medium" | "low";
}

export interface ParsedSiteReport {
  location: WorkLocation;
  locationLabel: string;
  workDescription: string;
}

export interface CompanyDailyReportData {
  title: string;
  formattedReport: string;
  siteReports: ParsedSiteReport[];
}

interface AiDailyReportModalProps {
  open: boolean;
  initialDate?: string;
  initialCompany?: Company;
  employees: Employee[];
  onClose: () => void;
  onSuccess: () => void;
}

const SAMPLE_REPORT_TEXT = `Raporti ditor 04.09.2026:

Etna Group:
- Prishtinë:
  * Artan Berisha 8 orë (punime suvatimi në katin e dytë)
  * Besnik Krasniqi 8.5 orë (suvatim dhe bartje materiali)
  Puna: U përfundua suvatimi i korridorit në katin 2 dhe u bë pastrimi i përgjithshëm.
- Prizren:
  * Valon Gashi 8 orë (shtruarje pllaka)
  * Dardan Morina 8 orë (fugim dhe përgatitje sipërfaqe)
  Puna: Filloi shtrimi i pllakave të banjove në katin përdhesë.

Dervisholli:
- Residio 8:
  * Enver Hoxha 9 orë (eskavator dhe gërmim themeli)
  * Shaban Bytyqi 8 orë (armaturë pllakë)
  Puna: Përfundoi gërmimi i bazamentit dhe u vendos hekuri i pllakës.
- Residio 10:
  * Agim Kastrati 8 orë (muratim mure ndarëse)
  Puna: Filloi ndërtimi i mureve ndarëse të katit të parë.`;

export default function AiDailyReportModal({
  open,
  initialDate = new Date().toISOString().split("T")[0],
  employees,
  onClose,
  onSuccess,
}: AiDailyReportModalProps) {
  useBodyScrollLock(open);

  const [step, setStep] = useState<"input" | "review">("input");
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [inputTab, setInputTab] = useState<"text" | "image">("text");

  // Input states
  const [reportText, setReportText] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Review states: Per-company report details
  const [companyReports, setCompanyReports] = useState<Record<Company, CompanyDailyReportData>>({
    "Etna Group": { title: "", formattedReport: "", siteReports: [] },
    Dervisholli: { title: "", formattedReport: "", siteReports: [] },
  });
  const [activeReportTab, setActiveReportTab] = useState<Company>("Etna Group");

  // Worker hours review state
  const [workerRows, setWorkerRows] = useState<ParsedWorkerRow[]>([]);
  const [workerFilter, setWorkerFilter] = useState<"all" | Company>("all");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const activeEmployees = employees.filter((e) => !e.archivedAt);

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
      const res = await fetch("/api/ai/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: reportText.trim(),
          imageBase64: imageBase64 || undefined,
          date: selectedDate,
          employees: activeEmployees.map((e) => ({
            id: e.id,
            emri: e.emri,
            mbiemri: e.mbiemri,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Përpunimi i raportit dështoi.");
      }

      // Populate company daily reports
      const rawEtna = data.companyReports?.["Etna Group"];
      const rawDerv = data.companyReports?.["Dervisholli"];

      const updatedCompanyReports: Record<Company, CompanyDailyReportData> = {
        "Etna Group": {
          title: rawEtna?.title || `Raporti ditor - Etna Group - ${selectedDate}`,
          formattedReport: rawEtna?.formattedReport || "",
          siteReports: (rawEtna?.siteReports || []).map(
            (sr: { location: string; locationLabel?: string; workDescription?: string }) => ({
              location: (sr.location as WorkLocation) || "Pr",
              locationLabel: sr.locationLabel || workLocationLabel(sr.location),
              workDescription: sr.workDescription || "",
            })
          ),
        },
        Dervisholli: {
          title: rawDerv?.title || `Raporti ditor - Dervisholli - ${selectedDate}`,
          formattedReport: rawDerv?.formattedReport || "",
          siteReports: (rawDerv?.siteReports || []).map(
            (sr: { location: string; locationLabel?: string; workDescription?: string }) => ({
              location: (sr.location as WorkLocation) || "R8",
              locationLabel: sr.locationLabel || workLocationLabel(sr.location),
              workDescription: sr.workDescription || "",
            })
          ),
        },
      };

      setCompanyReports(updatedCompanyReports);

      // Choose active tab: prefer the one with data
      if (
        !updatedCompanyReports["Etna Group"].formattedReport &&
        updatedCompanyReports.Dervisholli.formattedReport
      ) {
        setActiveReportTab("Dervisholli");
      } else {
        setActiveReportTab("Etna Group");
      }

      // Convert worker hours to editable rows
      interface ApiWorkerHour {
        tempId?: string;
        employeeId?: number | null;
        name?: string;
        rawName?: string;
        company?: Company;
        location?: WorkLocation;
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

        const comp: Company =
          wh.company === "Dervisholli" || wh.location === "R8" || wh.location === "R10"
            ? "Dervisholli"
            : "Etna Group";

        const validLoc: WorkLocation =
          comp === "Dervisholli"
            ? wh.location === "R10"
              ? "R10"
              : "R8"
            : wh.location === "Pz" || wh.location === "M" || wh.location === "Pr"
            ? wh.location
            : "Pr";

        return {
          tempId: wh.tempId || `w_${idx + 1}`,
          employeeId: matchedEmp ? matchedEmp.id! : null,
          name: matchedEmp
            ? `${matchedEmp.emri} ${matchedEmp.mbiemri}`
            : wh.name || wh.rawName || `Punonjës ${idx + 1}`,
          rawName: wh.rawName || wh.name || "",
          company: comp,
          location: validLoc,
          hours: wh.hours || 8,
          task: wh.task || "",
          checked: true,
          confidence: wh.confidence || (matchedEmp ? "high" : "low"),
        };
      });

      setWorkerRows(rows);
      setStep("review");
      toast.success("Raporti u analizua dhe u nda me sukses midis kompanive!");
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
      const target = { ...copy[idx], ...updates };

      // Ensure company and location consistency
      if (updates.location) {
        if (updates.location === "R8" || updates.location === "R10") {
          target.company = "Dervisholli";
        } else {
          target.company = "Etna Group";
        }
      } else if (updates.company && updates.company !== copy[idx].company) {
        target.location = updates.company === "Dervisholli" ? "R8" : "Pr";
      }

      copy[idx] = target;
      return copy;
    });
  };

  const removeWorker = (idx: number) => {
    setWorkerRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const addEmptyWorker = () => {
    const firstEmp = activeEmployees[0];
    const defaultComp: Company =
      workerFilter === "all" ? activeReportTab : workerFilter;
    const defaultLoc: WorkLocation = defaultComp === "Dervisholli" ? "R8" : "Pr";

    setWorkerRows((prev) => [
      ...prev,
      {
        tempId: `w_manual_${Date.now()}`,
        employeeId: firstEmp ? firstEmp.id! : null,
        name: firstEmp ? `${firstEmp.emri} ${firstEmp.mbiemri}` : "",
        rawName: "",
        company: defaultComp,
        location: defaultLoc,
        hours: 8,
        task: "",
        checked: true,
        confidence: "high",
      },
    ]);
  };

  const updateCompanyReport = (
    company: Company,
    field: "title" | "formattedReport",
    val: string
  ) => {
    setCompanyReports((prev) => ({
      ...prev,
      [company]: {
        ...prev[company],
        [field]: val,
      },
    }));
  };

  const updateSiteReport = (company: Company, idx: number, desc: string) => {
    setCompanyReports((prev) => {
      const sites = [...prev[company].siteReports];
      sites[idx] = { ...sites[idx], workDescription: desc };
      return {
        ...prev,
        [company]: {
          ...prev[company],
          siteReports: sites,
        },
      };
    });
  };

  // Save parsed data to Supabase for both Etna Group and Dervisholli
  const handleSaveToSystem = async () => {
    const selectedRows = workerRows.filter((r) => r.checked);
    if (selectedRows.length === 0) {
      toast.error("Ju lutem zgjidhni të paktën një punonjës për regjistrim.");
      return;
    }

    // Verify all checked rows have valid employeeId
    const missingEmp = selectedRows.find((r) => !r.employeeId);
    if (missingEmp) {
      toast.error(
        `Zgjidhni punonjësin zyrtar për: ${missingEmp.name || "punonjësin e panjohur"}`
      );
      return;
    }

    setSaving(true);
    try {
      const etnaWorkers = selectedRows.filter((r) => r.company === "Etna Group");
      const dervWorkers = selectedRows.filter((r) => r.company === "Dervisholli");

      let etnaSaved = false;
      let dervSaved = false;

      // 1. Process Etna Group
      const etnaReport = companyReports["Etna Group"];
      const etnaHasContent =
        etnaReport.formattedReport.trim().length > 0 ||
        etnaReport.siteReports.some((s) => s.workDescription.trim().length > 0);

      if (etnaWorkers.length > 0 || etnaHasContent) {
        const contentToSave =
          etnaReport.formattedReport.trim() ||
          etnaReport.siteReports
            .map((sr) => `### ${sr.locationLabel}\n${sr.workDescription}`)
            .join("\n\n");

        await db.dailyReports.upsert({
          date: selectedDate,
          company: "Etna Group",
          title: etnaReport.title.trim() || `Raporti ditor - Etna Group - ${selectedDate}`,
          content: contentToSave.trim() || "Raporti ditor i punimeve - Etna Group.",
        });

        if (etnaWorkers.length > 0) {
          const attendanceBatch = etnaWorkers.map((r) => {
            const emp = activeEmployees.find((e) => e.id === r.employeeId)!;
            return {
              employeeId: emp.id!,
              emri: emp.emri,
              mbiemri: emp.mbiemri,
              date: selectedDate,
              paymentMethod: emp.paymentMethod,
              hoursWorked: r.hours,
              location: r.location,
              company: "Etna Group" as Company,
            };
          });
          await db.attendance.addBatch(attendanceBatch);
        }
        etnaSaved = true;
      }

      // 2. Process Dervisholli
      const dervReport = companyReports.Dervisholli;
      const dervHasContent =
        dervReport.formattedReport.trim().length > 0 ||
        dervReport.siteReports.some((s) => s.workDescription.trim().length > 0);

      if (dervWorkers.length > 0 || dervHasContent) {
        const contentToSave =
          dervReport.formattedReport.trim() ||
          dervReport.siteReports
            .map((sr) => `### ${sr.locationLabel}\n${sr.workDescription}`)
            .join("\n\n");

        await db.dailyReports.upsert({
          date: selectedDate,
          company: "Dervisholli",
          title: dervReport.title.trim() || `Raporti ditor - Dervisholli - ${selectedDate}`,
          content: contentToSave.trim() || "Raporti ditor i punimeve - Dervisholli.",
        });

        if (dervWorkers.length > 0) {
          const attendanceBatch = dervWorkers.map((r) => {
            const emp = activeEmployees.find((e) => e.id === r.employeeId)!;
            return {
              employeeId: emp.id!,
              emri: emp.emri,
              mbiemri: emp.mbiemri,
              date: selectedDate,
              paymentMethod: emp.paymentMethod,
              hoursWorked: r.hours,
              location: r.location,
              company: "Dervisholli" as Company,
            };
          });
          await db.attendance.addBatch(attendanceBatch);
        }
        dervSaved = true;
      }

      const summaryParts = [];
      if (etnaSaved) summaryParts.push(`${etnaWorkers.length} punonjës për Etna Group`);
      if (dervSaved) summaryParts.push(`${dervWorkers.length} punonjës për Dervisholli`);

      toast.success(`U regjistruan me sukses: ${summaryParts.join(" dhe ")}!`);
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

  const etnaWorkersCount = checkedWorkers.filter((r) => r.company === "Etna Group").length;
  const dervWorkersCount = checkedWorkers.filter((r) => r.company === "Dervisholli").length;

  const filteredWorkerRows =
    workerFilter === "all"
      ? workerRows
      : workerRows.filter((r) => r.company === workerFilter);

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
                Ngjit raportin ditor: AI ndan automatikisht punimet dhe orët për Etna Group dhe
                Dervisholli
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
              {/* Date & Multi-Company Badge */}
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
                    <Building2 className="w-4 h-4 text-purple-600" />
                    Kompanitë e Përfshira
                  </label>
                  <div className="h-12 px-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 flex items-center justify-between text-xs font-bold">
                    <span className="text-indigo-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                      Etna Group (Pr, Pz, M)
                    </span>
                    <span className="text-purple-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block" />
                      Dervisholli (R8, R10)
                    </span>
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
                  Ngjit Tekstin e Plotë të Raportit
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
                  Ngarko Foto / Skanim Raporti
                </button>
              </div>

              {inputTab === "text" ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-bold text-gray-800">
                      Teksti i raportit ditor (mund t&apos;i përmbajë të dyja kompanitë):
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
                    placeholder="Ngjitni këtu raportin e plotë ditor nga WhatsApp/Viber me të gjitha vendpunimet dhe punëtorët..."
                    className="w-full p-4 rounded-2xl border-2 border-gray-200 text-sm font-medium text-gray-900 focus:outline-none focus:border-indigo-600 font-mono resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    💡 <strong>Këshillë:</strong> Mund të ngjitni raportin e plotë ku janë të
                    përziera punimet e Etna Group dhe Dervisholli. AI do t&apos;i ndajë automatikisht
                    sipas vendpunimit (Prishtinë, Prizren, Residio 8, Residio 10, etj.).
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-indigo-500 transition-colors">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-700 mb-1">
                      Ngarkoni foton e fletës së raportit ditor
                    </p>
                    <p className="text-xs text-gray-500 mb-4">
                      Mbështet formate JPG, PNG, WEBP (kompresohet automatikisht)
                    </p>
                    <label className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm cursor-pointer shadow-md transition-colors">
                      <Upload className="w-4 h-4" />
                      <span>Zgjidh Foto nga Pajisja</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {imageBase64 && (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
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
              {/* Dual-Company Summary Banner */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-6 h-6 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900">
                      AI ndau me sukses të dhënat midis dy kompanive!
                    </h4>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Rishikoni dhe modifikoni raportet dhe orët para se t&apos;i regjistroni në sistem.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-extrabold bg-blue-100 text-blue-800 px-3 py-1 rounded-full border border-blue-200">
                    Etna Group: {etnaWorkersCount} punëtorë
                  </span>
                  <span className="text-xs font-extrabold bg-purple-100 text-purple-800 px-3 py-1 rounded-full border border-purple-200">
                    Dervisholli: {dervWorkersCount} punëtorë
                  </span>
                </div>
              </div>

              {/* SECTION A: SEPARATED REPORTS BY COMPANY & SITE */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-indigo-600" />
                    Raportet Ditore të Punimeve (Sipas Kompanisë)
                  </h3>
                  {/* Company Switcher Tabs */}
                  <div className="flex bg-gray-200 p-1 rounded-xl gap-1">
                    {COMPANIES.map((comp) => {
                      const count = companyReports[comp].siteReports.length;
                      const isEtna = comp === "Etna Group";
                      return (
                        <button
                          key={comp}
                          type="button"
                          onClick={() => setActiveReportTab(comp)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            activeReportTab === comp
                              ? isEtna
                                ? "bg-blue-600 text-white shadow-sm"
                                : "bg-purple-600 text-white shadow-sm"
                              : "text-gray-700 hover:text-gray-900"
                          }`}
                        >
                          <span>{comp}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                              activeReportTab === comp
                                ? "bg-white/30 text-white"
                                : "bg-gray-300 text-gray-700"
                            }`}
                          >
                            {count} vendpunime
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Active Company Report Content */}
                <div className="p-4 space-y-4">
                  {/* Title of active company report */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">
                      Titulli i Raportit ({activeReportTab})
                    </label>
                    <input
                      type="text"
                      value={companyReports[activeReportTab].title}
                      onChange={(e) =>
                        updateCompanyReport(activeReportTab, "title", e.target.value)
                      }
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  {/* Individual site cards */}
                  {companyReports[activeReportTab].siteReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {companyReports[activeReportTab].siteReports.map((sr, idx) => (
                        <div
                          key={sr.location + idx}
                          className={`rounded-xl p-3 border ${
                            activeReportTab === "Etna Group"
                              ? "bg-blue-50/50 border-blue-100"
                              : "bg-purple-50/50 border-purple-100"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full text-white ${
                                activeReportTab === "Etna Group" ? "bg-blue-600" : "bg-purple-600"
                              }`}
                            >
                              <MapPin className="w-3 h-3" />
                              {sr.locationLabel}
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={sr.workDescription}
                            onChange={(e) =>
                              updateSiteReport(activeReportTab, idx, e.target.value)
                            }
                            className="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-indigo-600"
                            placeholder="Përshkrimi i punës në këtë vend..."
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-500 font-medium">
                      Nuk u gjetën punime specifike për {activeReportTab} në këtë raport.
                    </div>
                  )}

                  {/* Full Markdown Preview / Editor */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide block mb-1">
                      Përmbajtja e Raportit Ditor për {activeReportTab}
                    </label>
                    <textarea
                      rows={4}
                      value={companyReports[activeReportTab].formattedReport}
                      onChange={(e) =>
                        updateCompanyReport(activeReportTab, "formattedReport", e.target.value)
                      }
                      placeholder={`Shkruani përmbledhjen e punimeve për ${activeReportTab}...`}
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
                  <div className="flex items-center gap-2">
                    {/* Filter buttons */}
                    <div className="flex bg-gray-200 p-0.5 rounded-lg text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setWorkerFilter("all")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          workerFilter === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"
                        }`}
                      >
                        Të gjithë ({workerRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkerFilter("Etna Group")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          workerFilter === "Etna Group"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-600"
                        }`}
                      >
                        Etna ({workerRows.filter((r) => r.company === "Etna Group").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setWorkerFilter("Dervisholli")}
                        className={`px-2.5 py-1 rounded-md transition-colors ${
                          workerFilter === "Dervisholli"
                            ? "bg-purple-600 text-white shadow-sm"
                            : "text-gray-600"
                        }`}
                      >
                        Dervisholli ({workerRows.filter((r) => r.company === "Dervisholli").length})
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={addEmptyWorker}
                      className="flex items-center gap-1 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Shto Punonjës
                    </button>
                  </div>
                </div>

                {filteredWorkerRows.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    Nuk ka punonjës në këtë kategori. Shtoni manualisht duke klikuar &quot;Shto
                    Punonjës&quot;.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredWorkerRows.map((row) => {
                      const originalIdx = workerRows.findIndex((r) => r.tempId === row.tempId);
                      const matchedEmp = activeEmployees.find((e) => e.id === row.employeeId);
                      const isUnmatched = !row.employeeId;
                      const isFixed = matchedEmp?.salaryType === "fixed";
                      const isDervisholli = row.company === "Dervisholli";

                      return (
                        <div
                          key={row.tempId || originalIdx}
                          className={`p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center gap-3 transition-colors ${
                            !row.checked ? "opacity-50 bg-gray-50" : "bg-white hover:bg-gray-50/70"
                          } ${isUnmatched ? "border-l-4 border-l-amber-500" : ""}`}
                        >
                          {/* Checkbox */}
                          <div className="flex items-center gap-3 shrink-0">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={(e) =>
                                updateWorker(originalIdx, { checked: e.target.checked })
                              }
                              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                isDervisholli
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              <User className="w-4 h-4" />
                            </div>
                          </div>

                          {/* Employee Select */}
                          <div className="flex-1 min-w-[180px] w-full">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Punonjësi {row.rawName ? `(Gjetur: ${row.rawName})` : ""}
                            </label>
                            <select
                              value={row.employeeId || ""}
                              onChange={(e) => {
                                const id = e.target.value ? parseInt(e.target.value, 10) : null;
                                const emp = activeEmployees.find((em) => em.id === id);
                                updateWorker(originalIdx, {
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

                          {/* Company & Location Selector */}
                          <div className="w-full md:w-44 shrink-0">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5 flex items-center justify-between">
                              <span>Vendi & Kompania</span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold ${
                                  isDervisholli
                                    ? "bg-purple-100 text-purple-700"
                                    : "bg-blue-100 text-blue-700"
                                }`}
                              >
                                {row.company}
                              </span>
                            </label>
                            <select
                              value={row.location}
                              onChange={(e) => {
                                const loc = e.target.value as WorkLocation;
                                updateWorker(originalIdx, { location: loc });
                              }}
                              className={`w-full h-10 px-2 rounded-xl border-2 text-xs font-bold text-gray-800 bg-white focus:outline-none ${
                                isDervisholli
                                  ? "border-purple-200 focus:border-purple-600"
                                  : "border-blue-200 focus:border-blue-600"
                              }`}
                            >
                              <optgroup label="Etna Group">
                                {COMPANY_LOCATIONS["Etna Group"].map((loc) => (
                                  <option key={loc} value={loc}>
                                    {workLocationLabel(loc)} (Etna)
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Dervisholli">
                                {COMPANY_LOCATIONS.Dervisholli.map((loc) => (
                                  <option key={loc} value={loc}>
                                    {workLocationLabel(loc)} (Dervisholli)
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {/* Hours Input with Stepper */}
                          <div className="w-full md:w-32 shrink-0">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">
                              Orët e Punës
                            </label>
                            <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden h-10 bg-white">
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorker(originalIdx, {
                                    hours: Math.max(0, (row.hours || 0) - 0.5),
                                  })
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
                                  updateWorker(originalIdx, {
                                    hours: Math.max(0, parseFloat(e.target.value) || 0),
                                  })
                                }
                                className="w-full text-center text-sm font-extrabold text-gray-900 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateWorker(originalIdx, { hours: (row.hours || 0) + 0.5 })
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
                              onChange={(e) =>
                                updateWorker(originalIdx, { task: e.target.value })
                              }
                              placeholder="p.sh. Suvatim"
                              className="w-full h-10 px-3 rounded-xl border-2 border-gray-200 text-xs font-medium text-gray-800 bg-white focus:outline-none focus:border-indigo-600"
                            />
                          </div>

                          {/* Delete Row */}
                          <button
                            type="button"
                            onClick={() => removeWorker(originalIdx)}
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
                    <span>Duke analizuar & ndarë me AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-300" />
                    <span>Analizo & Ndaj me AI</span>
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
                    <span>Duke ruajtur në sistem...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      Regjistro të Gjitha në Sistem ({checkedWorkers.length} punonjës)
                    </span>
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
