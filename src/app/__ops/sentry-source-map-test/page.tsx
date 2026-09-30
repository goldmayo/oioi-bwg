import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SentrySourceMapProbe } from "./_ui/sentry-source-map-probe";

export const metadata: Metadata = {
  title: "Sentry source map verification",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SentrySourceMapTestPage() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "staging") notFound();

  return <SentrySourceMapProbe />;
}
