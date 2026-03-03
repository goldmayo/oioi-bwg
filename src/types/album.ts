export interface AlbumSong {
  title: string;
  slug: string; // 상세 페이지 연결을 위한 슬러그
  file: string;
  hasOfficial?: boolean;
  youtubeId: string;
}

export interface Album {
  name: string;
  songs: AlbumSong[];
  imageSlug: string;
  color: string;
  officialLink?: string; // 나중에 고도화 시 사용할 공식 카페/영상 링크
}

/**
 * 프로젝트 전체에서 사용하는 앨범 통합 설정 상수
 */
export const ALBUMS: Album[] = [
  {
    name: "1st Single Album: Harmony from Discord",
    imageSlug: "harmony-from-discord",
    color: "#E8A0B5",
    songs: [
      {
        title: "별의 하모니",
        slug: "harmony-of-stars",
        file: "QWER - Harmony of Stars.lrc",
        youtubeId: "1BTTbopyDWw",
      },
      { title: "Discord", slug: "discord", file: "QWER - Discord.lrc", youtubeId: "-kcZNuFYnns" },
      {
        title: "수수께끼 다이어리",
        slug: "secret-diary",
        file: "QWER - Secret Diary.lrc",
        youtubeId: "H6alWf2odU8",
      },
    ],
  },
  {
    name: "1st Mini Album: MANITO",
    imageSlug: "manito",
    color: "#E85A9A",
    songs: [
      { title: "고민중독", slug: "t-b-h", file: "QWER - T.B.H.lrc", youtubeId: "pbELDkeLdho" },
      { title: "SODA", slug: "soda", file: "QWER - SODA.lrc", youtubeId: "SKztjYndS_s" },
      {
        title: "자유선언",
        slug: "free-dumb",
        file: "QWER - Free-Dumb.lrc",
        youtubeId: "Tor2ElSVEAk",
      },
      { title: "지구정복", slug: "g9jb", file: "QWER - G9JB.lrc", youtubeId: "a0OkChjJWl8" },
      {
        title: "대관람차",
        slug: "ferris-wheel",
        file: "QWER - Ferris Wheel.lrc",
        youtubeId: "cmnJZFlKXUU",
      },
      {
        title: "불꽃놀이",
        slug: "make-our-highlight",
        file: "QWER - Make Our Highlight.lrc",
        youtubeId: "HBsU1GpsGKw",
      },
      { title: "마니또", slug: "manito", file: "QWER - Manito.lrc", youtubeId: "bjq3GHO_Cc0" },
    ],
  },
  {
    name: "2nd Mini Album: Algorithm's Blossom",
    imageSlug: "algorithm-blossom",
    color: "#F2D45C",
    songs: [
      {
        title: "가짜아이돌",
        slug: "fake-idol",
        file: "QWER - FAKE IDOL.lrc",
        youtubeId: "derG9wlkd40",
      },
      {
        title: "내 이름 맑음",
        slug: "my-name-is-malguem",
        file: "QWER - My Name is Malguem.lrc",
        hasOfficial: true,
        youtubeId: "9yfrVqCcrS0",
      },
      {
        title: "사랑하자",
        slug: "lets-love",
        file: "QWER - Let’s Love.lrc",
        youtubeId: "91Mn22CFvCE",
      },
      {
        title: "달리기",
        slug: "run-run-run",
        file: "QWER - run! run! run!.lrc",
        youtubeId: "txAakIbx4lA",
      },
      {
        title: "안녕 나의 슬픔",
        slug: "goodbye-my-sadness",
        file: "QWER - Goodbye My Sadness.lrc",
        youtubeId: "8ShYRkhBD2s",
      },
      { title: "메아리", slug: "rebound", file: "QWER - REBOUND.lrc", youtubeId: "5kf41s91RE8" },
    ],
  },
  {
    name: "3rd Mini Album: In a million noises, I'll be your harmony",
    imageSlug: "million-noises",
    color: "#D4735E",
    songs: [
      {
        title: "눈물참기",
        slug: "dear",
        file: "QWER - Dear.lrc",
        hasOfficial: true,
        youtubeId: "SUx0-btw2nQ",
      },
      {
        title: "행복해져라",
        slug: "be-happy",
        file: "QWER - Be Happy.lrc",
        hasOfficial: true,
        youtubeId: "PRH8JkIe0Ho",
      },
      {
        title: "검색어는 QWER",
        slug: "qwer-hashtag",
        file: "QWER - #QWER.lrc",
        youtubeId: "8-XjAXrS0bs",
      },
      {
        title: "OVERDRIVE",
        slug: "overdrive",
        file: "QWER - Overdrive.lrc",
        youtubeId: "kdPfMUAzmSo",
      },
      { title: "D-Day", slug: "d-day", file: "QWER - D-DAY.lrc", youtubeId: "YCaTtV9zu6A" },
      {
        title: "Yours Sincerely",
        slug: "yours-sincerely",
        file: "QWER - Yours Sincerely.lrc",
        youtubeId: "-Fz2vfp4BdY",
      },
    ],
  },
  {
    name: "Digital Single: Youth Promise",
    imageSlug: "youth-promise",
    color: "#06BDED",
    songs: [
      {
        title: "청춘서약",
        slug: "youth-promise",
        file: "QWER - Youth Promise.lrc",
        youtubeId: "CGvqj7bzCVY",
      },
    ],
  },
  {
    name: "Special LP Beyond the Discord",
    imageSlug: "beyond-the-discord",
    color: "#C3D773",
    songs: [
      {
        title: "흰수염고래",
        slug: "blue-whale",
        file: "QWER - Blue Whale.lrc",
        youtubeId: "h_S_Un3YoFo",
      },
    ],
  },
];

/**
 * 앨범 정렬 순서를 위한 헬퍼 상수
 */
export const ALBUM_ORDER = ALBUMS.map((a) => a.name);
