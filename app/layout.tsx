import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import { Toaster } from "react-hot-toast";
import { t } from "@/lib/translations";

export const metadata: Metadata = {
  title: t.appName,
  description: "Aplikacion i menaxhimit të kompanisë së ndërtimit",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: t.appShortName,
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1d4ed8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sq">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={t.appShortName} />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="min-h-screen bg-slate-50">
        <ServiceWorkerRegistration />
        <main className="max-w-lg mx-auto min-h-screen pb-20">
          {children}
        </main>
        <BottomNav />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: "12px",
              fontWeight: "600",
              fontSize: "15px",
              maxWidth: "360px",
            },
            success: {
              style: {
                background: "#166534",
                color: "#fff",
              },
              iconTheme: {
                primary: "#fff",
                secondary: "#166534",
              },
            },
            error: {
              style: {
                background: "#991b1b",
                color: "#fff",
              },
              iconTheme: {
                primary: "#fff",
                secondary: "#991b1b",
              },
            },
          }}
        />
      </body>
    </html>
  );
}
