import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import type { YouTubeEvent, YouTubePlayerInstance } from "../model/youtube";

import { YouTubePlayer } from "./YouTubePlayer";
afterEach(() => {
  vi.useRealTimers();
  delete window.YT;
});
it("참조 영상 교체 후 늦은 ready를 무시하고 정지 시각을 갱신하며 timer를 해제한다", () => {
  vi.useFakeTimers();
  const events: { onReady: (event: YouTubeEvent) => void }[] = [];
  const players = [0, 1].map(() => ({
    getCurrentTime: vi.fn(() => 4),
    getPlayerState: () => 2,
    destroy: vi.fn(),
  }));
  window.YT = {
    Player: vi.fn(function (_container: unknown, options: { events: (typeof events)[number] }) {
      events.push(options.events);
      return players[events.length - 1];
    }),
    PlayerState: { PLAYING: 1 },
  };
  const ready = vi.fn(),
    time = vi.fn();
  const view = render(
    <YouTubePlayer videoId="abcdefghijk" onTimeUpdate={time} onPlayerReady={ready} />,
  );
  view.rerender(<YouTubePlayer videoId="other-video" onTimeUpdate={time} onPlayerReady={ready} />);
  act(() => events[0].onReady({ target: players[0] as unknown as YouTubePlayerInstance, data: 2 }));
  expect(ready).not.toHaveBeenCalled();
  act(() => events[1].onReady({ target: players[1] as unknown as YouTubePlayerInstance, data: 2 }));
  expect(ready).toHaveBeenCalledOnce();
  players[1].getCurrentTime.mockReturnValue(12.5);
  act(() => {
    vi.advanceTimersByTime(100);
  });
  expect(time).toHaveBeenLastCalledWith(12.5);
  view.unmount();
  act(() => events[1].onReady({ target: players[1] as unknown as YouTubePlayerInstance, data: 2 }));
  expect(ready).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
