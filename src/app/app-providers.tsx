"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { toast } from "sonner";

import { createQueryClient } from "@/shared/api/query/query-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() =>
    createQueryClient({ onMutationError: (message) => toast.error(message) }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
