import { useRef } from "react";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { albumQueries } from "@/entities/album/api";
import { type AdminSongSummary, songQueryKeys } from "@/entities/song";
import { songMutations, songQueries } from "@/entities/song/api";

import { type SongEditValues, toAdminSongUpdate } from "./schemas";

export function useSongScreen(id?: string, onMutationError?: (error: unknown) => void) {
  const client = useQueryClient();
  const savedId = useRef<string | null>(null);
  const information = useQuery({ ...songQueries.adminInformation(id ?? ""), enabled: !!id });
  const {
    data: { items: albums },
  } = useSuspenseQuery(albumQueries.adminList());
  const create = useMutation({ ...songMutations.create(), onError: onMutationError });
  const update = useMutation({ ...songMutations.update(), onError: onMutationError });
  async function submit(values: SongEditValues, guideWrite?: AdminSongSummary["guideWrite"]) {
    const result = id
      ? await update.mutateAsync({ id, input: { ...toAdminSongUpdate(values), guideWrite } })
      : await create.mutateAsync({ ...values, lrcText: values.lrcText ?? "" });
    savedId.current = result.id;
    // 재조회 실패가 저장 성공을 실패로 바꾸거나 재제출을 유도하지 않게 한다.
    void client.invalidateQueries({ queryKey: songQueryKeys.adminList() });
    void client.invalidateQueries({ queryKey: songQueryKeys.adminInformation(result.id) });
  }
  return {
    information,
    albums,
    submit,
    saved: () => {
      if (savedId.current) window.location.replace(`/admin/songs/${savedId.current}`);
    },
  };
}
