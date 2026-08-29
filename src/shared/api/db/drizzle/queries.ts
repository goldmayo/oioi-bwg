import { getDb } from "./index";
import { Album, Song } from "./schema";

/**
 * 슬러그를 기반으로 곡 정보를 앨범 정보와 함께 조회하는 헬퍼 함수
 */
export async function getSongBySlug(slug: string) {
  const db = getDb();
  const song = await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
    with: {
      album: {
        with: {
          songs: true,
        },
      },
    },
  });

  if (!song?.title || !song.slug || song.youtubeId === null) {
    return undefined;
  }

  return {
    ...song,
    title: song.title,
    slug: song.slug,
    youtubeId: song.youtubeId,
    hasOfficialCheer: song.hasOfficialCheer ?? false,
    order: song.order ?? 0,
    album: {
      ...song.album,
      songs: song.album.songs.flatMap((albumSong) => {
        if (!albumSong.title || !albumSong.slug || albumSong.youtubeId === null) {
          return [];
        }

        return [
          {
            ...albumSong,
            title: albumSong.title,
            slug: albumSong.slug,
            youtubeId: albumSong.youtubeId,
            hasOfficialCheer: albumSong.hasOfficialCheer ?? false,
            order: albumSong.order ?? 0,
          },
        ];
      }),
    },
  };
}

/**
 * 관리자 가사 편집용 조회.
 * 운영 DB의 legacy nullable 필드는 빈 값으로 정규화해 관리자가 복구할 수 있게 한다.
 */
export async function getAdminSongBySlug(slug: string) {
  const db = getDb();
  const song = await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
    columns: {
      id: true,
      title: true,
      youtubeId: true,
      lyrics: true,
    },
  });

  if (!song) return undefined;

  return {
    ...song,
    title: song.title ?? "",
    youtubeId: song.youtubeId ?? "",
    lyrics: song.lyrics ?? [],
  };
}

/**
 * 관리자용: ID를 기반으로 곡 정보를 조회
 */
export async function getSongById(id: number): Promise<Song | undefined> {
  const db = getDb();
  return await db.query.song.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });
}

/**
 * 정렬 순서에 따른 전체 곡 목록 조회 (앨범 참조 ID 포함)
 * 사용자 대상: isVisible=true인 곡만 조회
 */
export async function getAllSongs() {
  const db = getDb();
  const songs = await db.query.song.findMany({
    where: (s, { eq }) => eq(s.isVisible, true),
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    orderBy: (s, { asc }) => [asc(s.order)],
  });

  return songs.flatMap((song) => {
    if (!song.title || !song.slug || !song.updatedAt) return [];

    return [
      {
        ...song,
        title: song.title,
        slug: song.slug,
        updatedAt: song.updatedAt,
        hasOfficialCheer: song.hasOfficialCheer ?? false,
        order: song.order ?? 0,
      },
    ];
  });
}

/**
 * 메인 페이지용: 전체 앨범 목록과 그에 속한 모든 곡을 배열 형태로 조회
 * - isVisible=true인 앨범만 조회
 * - 소속 곡도 isVisible=true인 곡만 포함
 * - 최신 발매일 순 (desc) 정렬
 */
export async function getAllAlbumsWithSongs() {
  const db = getDb();
  const albums = await db.query.album.findMany({
    where: (a, { eq }) => eq(a.isVisible, true),
    with: {
      songs: {
        where: (s, { eq }) => eq(s.isVisible, true),
        orderBy: (s, { asc }) => [asc(s.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
    orderBy: (a, { desc }) => [desc(a.releaseDate)],
  });

  return albums.map((album) => ({
    ...album,
    songs: album.songs.flatMap((song) => {
      if (!song.title || !song.slug || song.youtubeId === null) return [];

      return [
        {
          ...song,
          title: song.title,
          slug: song.slug,
          youtubeId: song.youtubeId,
          hasOfficialCheer: song.hasOfficialCheer ?? false,
        },
      ];
    }),
  }));
}

/**
 * 특정 슬러그를 가진 앨범 상세 정보 조회
 * 소속 곡은 isVisible=true인 곡만 포함
 */
export async function getAlbumBySlug(slug: string) {
  const db = getDb();
  const album = await db.query.album.findFirst({
    where: (a, { eq }) => eq(a.slug, slug),
    with: {
      songs: {
        where: (s, { eq }) => eq(s.isVisible, true),
        orderBy: (s, { asc }) => [asc(s.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
  });

  if (!album) return undefined;

  return {
    ...album,
    songs: album.songs.flatMap((song) => {
      if (!song.title || !song.slug || song.youtubeId === null) return [];

      return [
        {
          ...song,
          title: song.title,
          slug: song.slug,
          youtubeId: song.youtubeId,
          hasOfficialCheer: song.hasOfficialCheer ?? false,
        },
      ];
    }),
  };
}

/**
 * 관리자용: 전체 앨범 목록 조회 (isVisible 필터 없음)
 */
export async function getAllAlbums(): Promise<Album[]> {
  const db = getDb();
  return await db.query.album.findMany({
    orderBy: (a, { asc }) => [asc(a.releaseDate)],
  });
}

/**
 * 관리자용: 전체 곡 목록 + 앨범명 포함 조회 (isVisible 필터 없음)
 */
export async function getSongsWithAlbum() {
  const db = getDb();
  const songs = await db.query.song.findMany({
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      youtubeId: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    with: {
      album: {
        columns: { name: true },
      },
    },
    orderBy: (s, { asc }) => [asc(s.albumId), asc(s.order)],
  });

  return songs.map((song) => ({
    ...song,
    title: song.title ?? "",
    slug: song.slug ?? "",
    youtubeId: song.youtubeId ?? "",
    order: song.order ?? 0,
    updatedAt: song.updatedAt ?? "",
    hasOfficialCheer: song.hasOfficialCheer ?? false,
  }));
}
