"use client";

import {
  adminCheerGuideMutationResultSchema,
  type CreateAdminCheerGuide,
} from "@oioi-bwg/contracts/cheer-guide";
import { mutationOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

export const cheerGuideMutations = {
  create: () =>
    mutationOptions({
      retry: false,
      mutationFn: async (input: CreateAdminCheerGuide) =>
        parseClientResponse(
          adminCheerGuideMutationResultSchema,
          await http.post("/api/admin/cheer-guides", { json: input }),
        ),
      meta: { skipGlobalError: true },
    }),
  delete: () =>
    mutationOptions({
      retry: false,
      mutationFn: (id: string) => http.delete(`/api/admin/cheer-guides/${encodeURIComponent(id)}`),
      meta: { skipGlobalError: true },
    }),
};
