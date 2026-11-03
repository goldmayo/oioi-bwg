"use client";

import {
  adminCheerGuideDraftResultSchema,
  adminCheerGuideMutationResultSchema,
  type CreateAdminCheerGuide,
  type SaveAdminCheerGuideDraft,
} from "@oioi-bwg/contracts/cheer-guide";
import { mutationOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

export const cheerGuideMutations = {
  saveDraft: (id: string) =>
    mutationOptions({
      retry: false,
      mutationFn: async (input: SaveAdminCheerGuideDraft) =>
        parseClientResponse(
          adminCheerGuideDraftResultSchema,
          await http.patch(`/api/admin/cheer-guides/${encodeURIComponent(id)}/draft`, {
            json: input,
          }),
        ),
    }),
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
