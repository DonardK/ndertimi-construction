"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { t } from "@/lib/translations";

const PULL_THRESHOLD = 64;
const MAX_PULL = 96;
const MIN_VISIBLE_PULL = 20;

type AppRefreshContextValue = {
  version: number;
  trigger: () => void;
};

const AppRefreshContext = createContext<AppRefreshContextValue | null>(null);

export function useAppRefreshVersion(): number {
  return useContext(AppRefreshContext)?.version ?? 0;
}

function PullToRefresh({
  children,
  onRefresh,
}: {
  children: ReactNode;
  onRefresh: () => void;
}) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const touchActiveRef = useRef(false);

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const isAtTop = () => window.scrollY <= 1;

    const resetPull = () => {
      touchActiveRef.current = false;
      isDraggingRef.current = false;
      setIsDragging(false);
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !isAtTop()) return;
      const target = e.target as Element | null;
      if (target?.closest("[data-no-pull-refresh]")) return;
      touchActiveRef.current = true;
      startY.current = e.touches[0].clientY;
      pullRef.current = 0;
      setPull(0);
    };

    const onMove = (e: TouchEvent) => {
      if (!touchActiveRef.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && isAtTop()) {
        const next = Math.min(dy * 0.45, MAX_PULL);
        pullRef.current = next;
        setPull(next);
        if (next >= MIN_VISIBLE_PULL) {
          isDraggingRef.current = true;
          setIsDragging(true);
        }
        if (next > 10) e.preventDefault();
      } else {
        resetPull();
      }
    };

    const onEnd = () => {
      touchActiveRef.current = false;
      if (refreshingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD;
      if (shouldRefresh) {
        setRefreshing(true);
        setPull(0);
        pullRef.current = 0;
        onRefresh();
        window.setTimeout(() => {
          setRefreshing(false);
        }, 700);
      } else {
        resetPull();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const progress = Math.min(pull / PULL_THRESHOLD, 1);
  const showPullBar = isDragging && pull >= MIN_VISIBLE_PULL && !refreshing;
  const showSpinner = refreshing;

  return (
    <>
      {showPullBar && (
        <div
          className="fixed left-0 right-0 z-[60] mx-auto max-w-lg px-4 pointer-events-none"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="h-1 rounded-full bg-blue-100 overflow-hidden">
            <div
              className="h-full bg-blue-600"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      )}
      {showSpinner && (
        <div
          className="fixed left-0 right-0 z-[60] mx-auto max-w-lg flex h-12 items-center justify-center pointer-events-none"
          style={{ top: "env(safe-area-inset-top, 0px)" }}
          aria-live="polite"
          aria-busy
        >
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="sr-only">{t.common.refreshing}</span>
        </div>
      )}
      <div
        style={{
          transform: showSpinner
            ? "translateY(48px)"
            : showPullBar
              ? `translateY(${Math.min(pull * 0.25, 24)}px)`
              : undefined,
          transition: isDragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </>
  );
}

export default function AppRefreshProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const trigger = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <AppRefreshContext.Provider value={{ version, trigger }}>
      <PullToRefresh onRefresh={trigger}>{children}</PullToRefresh>
    </AppRefreshContext.Provider>
  );
}
