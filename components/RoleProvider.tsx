"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";
import {
  canViewFinancials,
  getRoleFromEmail,
  type AppRole,
} from "@/lib/roles";

type RoleContextValue = {
  role: AppRole | null;
  email: string | null;
  loading: boolean;
  canViewFinancials: boolean;
  isManagement: boolean;
  isStaff: boolean;
};

const RoleContext = createContext<RoleContextValue>({
  role: null,
  email: null,
  loading: true,
  canViewFinancials: false,
  isManagement: false,
  isStaff: false,
});

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}

export default function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AppRole | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        const userEmail = user?.email ?? null;
        setEmail(userEmail);
        setRole(getRoleFromEmail(userEmail));
      } catch {
        if (!cancelled) {
          setEmail(null);
          setRole("staff");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<RoleContextValue>(() => {
    const resolvedRole = role ?? "staff";
    return {
      role,
      email,
      loading,
      canViewFinancials: canViewFinancials(resolvedRole),
      isManagement: resolvedRole === "management",
      isStaff: resolvedRole === "staff",
    };
  }, [role, email, loading]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}
