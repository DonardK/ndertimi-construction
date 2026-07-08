"use client";

import { useEffect } from "react";

let lockCount = 0;
let originalOverflow: string | null = null;

/** Locks body scroll while `active`; supports nested modals via ref-count. */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (lockCount === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.overflow = originalOverflow ?? "";
        originalOverflow = null;
      }
    };
  }, [active]);
}
