import type { Metadata } from "next";

import { Toaster } from "@/shared/ui/sonner";

import { AppProviders } from "./app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "어이어이 바위게 Console",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
