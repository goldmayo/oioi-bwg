import type { Metadata } from "next";

import { Toaster } from "@/shared/ui/sonner";

import { AppProviders } from "./app-providers";

import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "어이어이 관리", statusBarStyle: "default" },
  icons: { icon: "/notification-icon.png", apple: "/apple-icon.png" },
  title: "어이어이 바위게 Console",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <AppProviders>
          {children}
          <Toaster />
        </AppProviders>
      </body>
    </html>
  );
}
