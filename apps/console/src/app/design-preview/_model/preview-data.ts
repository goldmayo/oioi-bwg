export const albums = [
  { id: "ceremony", name: "CEREMONY", kind: "4th Mini Album" },
  { id: "youth-promise", name: "청춘서약", kind: "Digital Single" },
  { id: "million-noises", name: "난 네 편이야, 온 세상이 불협일지라도", kind: "3rd Mini Album" },
  { id: "algorithm-blossom", name: "Algorithm’s Blossom", kind: "2nd Mini Album" },
  { id: "manito", name: "MANITO", kind: "1st Mini Album" },
  { id: "harmony-from-discord", name: "Harmony from Discord", kind: "1st Single Album" },
] as const;

// 곡명과 앨범은 서비스 콘텐츠이며, 출처·모드 조합과 재생 길이는 화면 검토용 예시다.
export const songs = [
  {
    id: "t-b-h",
    title: "고민중독",
    album: "manito",
    source: "팬덤",
    mode: "콘서트",
    duration: "2:55",
  },
  {
    id: "ceremony",
    title: "CEREMONY",
    album: "ceremony",
    source: "공식",
    mode: "콘서트",
    duration: "3:12",
  },
  {
    id: "youth-promise",
    title: "청춘서약",
    album: "youth-promise",
    source: "팬덤",
    mode: "페스티벌",
    duration: "3:08",
  },
  {
    id: "dear",
    title: "눈물참기",
    album: "million-noises",
    source: "팬덤",
    mode: "콘서트",
    duration: "3:04",
  },
  {
    id: "my-name-is-malguem",
    title: "내 이름 맑음",
    album: "algorithm-blossom",
    source: "공식",
    mode: "콘서트",
    duration: "3:09",
  },
  {
    id: "discord",
    title: "Discord",
    album: "harmony-from-discord",
    source: "공식",
    mode: "페스티벌",
    duration: "2:47",
  },
  {
    id: "fake-idol",
    title: "가짜아이돌",
    album: "algorithm-blossom",
    source: "팬덤",
    mode: "페스티벌",
    duration: "2:41",
  },
  {
    id: "manito",
    title: "마니또",
    album: "manito",
    source: "팬덤",
    mode: "콘서트",
    duration: "3:21",
  },
  {
    id: "rebound",
    title: "메아리",
    album: "algorithm-blossom",
    source: "팬덤",
    mode: "콘서트",
    duration: "3:30",
  },
  {
    id: "ferris-wheel",
    title: "대관람차",
    album: "manito",
    source: "팬덤",
    mode: "콘서트",
    duration: "3:22",
  },
  {
    id: "run-run-run",
    title: "달리기",
    album: "algorithm-blossom",
    source: "팬덤",
    mode: "페스티벌",
    duration: "3:02",
  },
  {
    id: "harmony-of-stars",
    title: "별의 하모니",
    album: "harmony-from-discord",
    source: "팬덤",
    mode: "콘서트",
    duration: "3:16",
  },
] as const;
export type PreviewSong = (typeof songs)[number];
export type CueKind = "가사" | "떼창" | "네임콜" | "추임새";
export type PreviewCue = { time: number; text: string; kind: CueKind };
export const previewDuration = 28;
export const initialCues: PreviewCue[] = [
  { time: 0.37, text: "One! Two! Q-W-E-R", kind: "네임콜" },
  { time: 4, text: "어이! 어이! 어이! 어이!", kind: "추임새" },
  { time: 6.65, text: "어이! 어이! 어이! 어이!", kind: "추임새" },
  { time: 9.5, text: "어이! 어이! 어이! 어이!", kind: "추임새" },
  { time: 14.26, text: "어떤 인사가 괜찮을까", kind: "가사" },
  { time: 17.24, text: "천 번쯤 상상해 봤어", kind: "가사" },
  { time: 20.22, text: "안녕!", kind: "떼창" },
  { time: 23.18, text: "내 맘은 자꾸 고민 중", kind: "가사" },
];
export const cueKinds: CueKind[] = ["가사", "떼창", "네임콜", "추임새"];
export const cueClass: Record<CueKind, string> = {
  가사: "plain",
  떼창: "sing",
  네임콜: "call",
  추임새: "chant",
};
export function formatTime(seconds: number) {
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
