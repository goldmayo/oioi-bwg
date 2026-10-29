import { afterEach, expect, it, vi } from "vitest";

import { createYouTubePeaksPlayer } from "./youtube-peaks-player";
const fixture = () => {
  let time = 10,
    state = 2,
    blocked = false;
  const player = {
    getCurrentTime: () => time,
    getDuration: () => 60,
    getVideoData: () => ({ video_id: "abcdefghijk", author: "", title: "" }),
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    getPlayerState: () => state,
    destroy: vi.fn(),
  };
  const update = vi.fn(),
    events = { emit: vi.fn() };
  const adapter = createYouTubePeaksPlayer(player, "abcdefghijk", 60, update, () => blocked);
  return {
    player,
    adapter,
    update,
    events,
    setTime: (value: number) => {
      time = value;
    },
    setState: (value: number) => {
      state = value;
    },
    block: () => {
      blocked = true;
    },
  };
};
afterEach(() => vi.useRealTimers());
it("seek 지연 중에는 실제 시각을 유지하며 IFrame 확인 뒤에만 seeked를 발행한다", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.init(f.events);
  f.adapter.seek(20);
  expect(f.player.seekTo).toHaveBeenCalledWith(20, true);
  expect(f.adapter.getCurrentTime()).toBe(10);
  vi.advanceTimersByTime(500);
  expect(f.events.emit).not.toHaveBeenCalledWith("player.seeked", 20);
  f.setTime(20);
  vi.advanceTimersByTime(100);
  expect(f.events.emit).toHaveBeenCalledWith("player.seeked", 20);
  expect(f.update).toHaveBeenLastCalledWith(20);
  f.adapter.destroy();
  expect(vi.getTimerCount()).toBe(0);
});
it("재생 상태는 실제 player를 따르고 광고 중 시간 갱신을 차단한다", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.init(f.events);
  await f.adapter.play();
  expect(f.player.playVideo).toHaveBeenCalledOnce();
  expect(f.adapter.isPlaying()).toBe(false);
  f.setState(1);
  vi.advanceTimersByTime(100);
  expect(f.events.emit).toHaveBeenCalledWith("player.playing", 10);
  f.block();
  f.setTime(30);
  vi.advanceTimersByTime(100);
  expect(f.adapter.getCurrentTime()).toBe(10);
  expect(f.adapter.isPlaying()).toBe(false);
  f.adapter.destroy();
});
it("범위를 벗어난 seek는 clamp하고 취소·destroy 이후의 호출은 전달하지 않는다", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.init(f.events);
  f.adapter.seek(-2);
  f.adapter.seek(90);
  f.adapter.seek(Number.NaN);
  expect(f.player.seekTo.mock.calls).toEqual([
    [0, true],
    [60, true],
  ]);
  f.adapter.destroy();
  f.adapter.seek(5);
  vi.advanceTimersByTime(1000);
  expect(f.player.seekTo).toHaveBeenCalledTimes(2);
});

it("영상 ID가 달라지면 시각 갱신과 seek를 차단한다", async () => {
  vi.useFakeTimers();
  const f = fixture();
  await f.adapter.init(f.events);
  f.player.getVideoData = () => ({ video_id: "other-video", author: "", title: "" });
  f.setTime(30);
  vi.advanceTimersByTime(200);
  f.adapter.seek(20);
  expect(f.adapter.getCurrentTime()).toBe(10);
  expect(f.player.seekTo).not.toHaveBeenCalled();
  f.adapter.destroy();
});
