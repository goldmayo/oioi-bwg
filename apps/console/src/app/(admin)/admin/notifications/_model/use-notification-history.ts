"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OnChangeFn, PaginationState } from "@tanstack/react-table";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

import { notificationQueries } from "@/entities/notification";

import { useNotificationActions } from "../../_model/use-notification-actions";

const queryState = {
  view: parseAsStringEnum(["all", "unread"]).withDefault("all"),
  result: parseAsStringEnum(["all", "WAVEFORM_SUCCEEDED", "WAVEFORM_FAILED"]).withDefault("all"),
  page: parseAsInteger.withDefault(1),
  size: parseAsInteger.withDefault(10),
};
export function useNotificationHistory(accountId: string, selectedId?: string) {
  const [filters, setFilters] = useQueryStates(queryState);
  const pageSize = [10, 20, 50].includes(filters.size) ? filters.size : 10;
  const pageIndex = Math.max(0, filters.page - 1);
  const input = {
    limit: pageSize,
    offset: pageIndex * pageSize,
    status: filters.view,
    type: filters.result === "all" ? undefined : filters.result,
  };
  const query = useQuery(notificationQueries.history(accountId, input));
  const actions = useNotificationActions(accountId, {
    selectedId,
    onReadAll: () => setFilters({ page: 1 }),
  });
  const totalCount = query.data?.totalCount ?? 0;
  useEffect(() => {
    if (!query.data) return;
    const lastPage = Math.max(1, Math.ceil(query.data.totalCount / pageSize));
    if (filters.page > lastPage || filters.page < 1)
      void setFilters({ page: Math.min(Math.max(1, filters.page), lastPage) });
  }, [filters.page, pageSize, query.data, setFilters]);
  const changePagination: OnChangeFn<PaginationState> = (update) => {
    const next = typeof update === "function" ? update({ pageIndex, pageSize }) : update;
    void setFilters({ page: next.pageIndex + 1, size: next.pageSize });
  };
  return {
    query,
    actions,
    filters,
    totalCount,
    items: query.data?.items ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    pagination: { pageIndex, pageSize },
    changePagination,
    changeView: (view: "all" | "unread") => {
      void setFilters({ view, page: 1 });
    },
    changeResult: (result: typeof filters.result) => setFilters({ result, page: 1 }),
  };
}
