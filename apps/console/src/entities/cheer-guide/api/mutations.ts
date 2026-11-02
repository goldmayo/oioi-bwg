"use client";

import { mutationOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";

export const cheerGuideMutations = {
  delete: () =>
    mutationOptions({
      retry: false,
      mutationFn: (id: string) => http.delete(`/api/admin/cheer-guides/${encodeURIComponent(id)}`),
      meta: { skipGlobalError: true },
    }),
};
