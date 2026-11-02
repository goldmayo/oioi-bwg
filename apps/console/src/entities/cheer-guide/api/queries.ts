"use client";

import {
  adminCheerGuideEditorSchema,
  adminCheerGuideListSchema,
} from "@oioi-bwg/contracts/cheer-guide";
import { queryOptions } from "@tanstack/react-query";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";

import { cheerGuideQueryKeys } from "./query-keys";

export const cheerGuideQueries = {
  editor: (id: string) =>
    queryOptions({
      queryKey: cheerGuideQueryKeys.editor(id),
      queryFn: async ({ signal }) =>
        parseClientResponse(
          adminCheerGuideEditorSchema,
          await http.get(`/api/admin/cheer-guides/${encodeURIComponent(id)}/draft`, { signal }),
        ),
    }),
  adminList: () =>
    queryOptions({
      queryKey: cheerGuideQueryKeys.adminList(),
      staleTime: 30_000,
      queryFn: async ({ signal }) =>
        parseClientResponse(
          adminCheerGuideListSchema,
          await http.get("/api/admin/cheer-guides", { signal }),
        ),
    }),
};
