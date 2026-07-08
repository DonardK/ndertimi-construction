"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useRole } from "@/components/RoleProvider";
import { createClient } from "@/utils/supabase/client";
import { db, COMPANIES } from "@/lib/db";
import { exportAttendanceMatrixPdf, type CompanyFilter } from "@/lib/attendanceExport";
import { t } from "@/lib/translations";
import PageHeader from "@/components/PageHeader";
import { FileDown, Loader2, LogOut } from "lucide-react";
import toast from "react-hot-toast";

export default function ProfiliPage() {
  const { email, role, loading } = useRole();
  const [signingOut, setSigningOut] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [companyFilter, setCompanyFilter] = useState<CompanyFilter>("all");
  const [exporting, setExporting] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/login";
    } catch {
      toast.error(t.auth.logoutError);
      setSigningOut(false);
    }
  };

  const handleExportAttendance = async () => {
    setExporting(true);
    try {
      const attendance = await db.attendance.getAll();
      const ok = await exportAttendanceMatrixPdf(
        attendance,
        selectedMonth,
        companyFilter,
        {
          workerColumn: t.profile.workerColumn,
          totalColumn: t.profile.totalColumn,
          pdfTitle: t.profile.pdfTitle,
          allCompaniesLabel: t.profile.allCompaniesLabel,
        }
      );
      if (!ok) {
        toast.error(t.profile.noAttendanceData);
      }
    } catch {
      toast.error(t.errors.loadError);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 pt-6 flex justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  const roleLabel =
    role === "management" ? t.auth.roleManagement : t.auth.roleStaff;

  return (
    <div className="px-4 pt-6 pb-8">
      <PageHeader title={t.auth.profileTitle} />

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          {t.auth.loggedInAs}
        </p>
        <p className="text-base font-semibold text-gray-900 break-all">
          {email ?? "—"}
        </p>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4 mb-1">
          {t.auth.roleLabel}
        </p>
        <p className="text-base font-semibold text-gray-900">{roleLabel}</p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="mt-4 w-full h-12 rounded-xl border-2 border-gray-200 font-bold text-gray-700 flex items-center justify-center gap-2 hover:bg-gray-50 disabled:opacity-50"
        >
          {signingOut ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <LogOut className="w-5 h-5" />
          )}
          {t.auth.signOut}
        </button>
      </div>

      <div className="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-base font-extrabold text-gray-900 mb-4">
          {t.profile.exportAttendanceTitle}
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t.profile.filterCompany}
            </label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value as CompanyFilter)}
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-blue-500 bg-white"
            >
              <option value="all">{t.profile.allCompanies}</option>
              {COMPANIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              {t.profile.selectMonth}
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) setSelectedMonth(e.target.value);
              }}
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-300 text-base font-medium text-gray-900 focus:outline-none focus:border-blue-500 bg-white"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportAttendance}
          disabled={exporting}
          className="w-full h-12 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-green-700 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FileDown className="w-5 h-5" />
          )}
          {t.profile.exportButton}
        </button>
      </div>
    </div>
  );
}
