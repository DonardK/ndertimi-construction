"use client";

import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <main
      className={
        isLogin
          ? "min-h-screen"
          : "w-full max-w-lg mx-auto min-h-screen pb-20 lg:max-w-none lg:mx-0 lg:ml-56 lg:pb-8 lg:px-8 xl:px-10"
      }
    >
      {children}
    </main>
  );
}
