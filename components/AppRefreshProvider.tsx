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

  useEffect(() => {
    refreshingRef.current = refreshing;
  }, [refreshing]);

  useEffect(() => {
    const isAtTop = () => window.scrollY <= 1;

    const resetPull = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      pullRef.current = 0;
      setPull(0);
    };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !isAtTop()) return;
      const target = e.target as Element | null;
      if (target?.closest("[data-no-pull-refresh]")) return;
      isDraggingRef.current = true;
      setIsDragging(true);
      startY.current = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && isAtTop()) {
        const next = Math.min(dy * 0.45, MAX_PULL);
        pullRef.current = next;
        setPull(next);
        if (next > 10) e.preventDefault();
      } else {
        resetPull();
      }
    };

    const onEnd = () => {
      if (!isDraggingRef.current || refreshingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);
      const shouldRefresh = pullRef.current >= PULL_THRESHOLD;
      if (shouldRefresh) {
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        onRefresh();
        window.setTimeout(() => {
          setRefreshing(false);
          pullRef.current = 0;
          setPull(0);
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
  const showIndicator = pull > 0 || refreshing;

  return (
    <>
      <div
        className="fixed left-0 right-0 z-[60] mx-auto max-w-lg flex justify-center pointer-events-none"
        style={{
          top: 0,
          height: showIndicator ? (refreshing ? 52 : Math.max(pull, 0)) : 0,
          transition: isDragging ? "none" : "height 0.2s ease-out",
        }}
        aria-live="polite"
        aria-busy={refreshing}
      >
        <div className="flex h-12 items-center justify-center gap-2 text-blue-600">
          <Loader2
            className={`h-6 w-6 ${refreshing || progress >= 1 ? "animate-spin" : ""}`}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${progress * 360}deg)` }
            }
          />
          {refreshing && (
            <span className="text-sm font-semibold text-gray-600">
              {t.common.refreshing}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          transform: showIndicator
            ? `translateY(${refreshing ? 48 : pull}px)`
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
