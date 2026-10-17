import { act, cleanup, renderHook } from "@testing-library/react";
import gsap from "gsap";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAdWatcher } from "./useAdWatcher";
import type { YouTubePlayerInstance } from "./youtube";

const callbacks = new Set<Parameters<typeof gsap.ticker.add>[0]>();
function makePlayer(id: string, duration: number): YouTubePlayerInstance {
  return {
    getDuration: () => duration,
    getVideoData: () => ({ video_id: id, author: "fixture", title: "fixture" }),
    getCurrentTime: () => 8.5,
    seekTo: vi.fn(),
    playVideo: vi.fn(),
    pauseVideo: vi.fn(),
    getPlayerState: () => 1,
    destroy: vi.fn(),
  };
}
function tick() {
  act(() => {
    for (const callback of [...callbacks]) callback(0, 0, 0, 0);
  });
}
beforeEach(() => {
  vi.useFakeTimers();
  callbacks.clear();
  vi.spyOn(gsap.ticker, "add").mockImplementation((callback) => {
    callbacks.add(callback);
    return callback;
  });
  vi.spyOn(gsap.ticker, "remove").mockImplementation((callback) => {
    callbacks.delete(callback);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("useAdWatcher video lifetime", () => {
  it.each([false, true])(
    "accepts a different duration after video replacement (same player: %s)",
    (samePlayer) => {
      const player = makePlayer("first", 120);
      const { result, rerender } = renderHook(({ player, id }) => useAdWatcher(player, id), {
        initialProps: { player, id: "first" },
      });
      act(() => {
        vi.runOnlyPendingTimers();
      });
      tick();
      expect(result.current).toBe(false);
      const replacement = makePlayer("second", 240);
      if (samePlayer) Object.assign(player, replacement);
      rerender({ player: samePlayer ? player : replacement, id: "second" });
      act(() => {
        vi.runOnlyPendingTimers();
      });
      tick();
      expect(result.current).toBe(false);
    },
  );

  it("keeps one watcher across dependency changes and removes it on unmount", () => {
    const { rerender, unmount } = renderHook(({ player, id }) => useAdWatcher(player, id), {
      initialProps: { player: makePlayer("first", 120), id: "first" },
    });
    rerender({ player: makePlayer("second", 240), id: "second" });
    expect(callbacks.size).toBe(1);
    unmount();
    expect(callbacks.size).toBe(0);
  });

  it("blocks mismatched video IDs and resumes when the target video returns", () => {
    const player = makePlayer("first", 120);
    const { result } = renderHook(() => useAdWatcher(player, "first"));
    act(() => {
      vi.runOnlyPendingTimers();
    });
    tick();
    Object.assign(player, makePlayer("advertisement", 15));
    tick();
    expect(result.current).toBe(true);
    Object.assign(player, makePlayer("first", 120));
    tick();
    expect(result.current).toBe(false);
  });
});
