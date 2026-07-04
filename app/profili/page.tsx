"use client";

import { useState } from "react";
import { useRole } from "@/components/RoleProvider";
import { createClient } from "@/utils/supabase/client";
import { t } from "@/lib/translations";
import PageHeader from "@/components/PageHeader";
import { Loader2, LogOut } from "lucide-react";
import toast from "react-hot-toast";

export default function ProfiliPage() {
  const { email, role, loading } = useRole();
  const [signingOut, setSigningOut] = useState(false);

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
    </div>
  );
}
