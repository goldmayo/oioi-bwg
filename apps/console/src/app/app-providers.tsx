"use client";

import { useState } from "react";
import { QueryClientProvider, QueryErrorResetBoundary } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";

import { createQueryClient } from "@/shared/api/query/query-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({ onMutationError: (message) => toast.error(message) }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <QueryErrorResetBoundary>
        <ThemeProvider attribute="class" defaultTheme="dark">
          {children}
        </ThemeProvider>
      </QueryErrorResetBoundary>
    </QueryClientProvider>
  );
}
