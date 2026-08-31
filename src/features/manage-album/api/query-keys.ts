import { createQueryKeys } from "@lukemorales/query-key-factory";

/** RSC service seed와 Client Query가 공유하는 관리자 Album cache identity다. */
export const adminAlbumQueryKeys = createQueryKeys("admin", {
  albums: null,
});
