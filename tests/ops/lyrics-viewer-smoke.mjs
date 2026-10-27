import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { expect } from "playwright/test";
import { fixtureLyrics, fixtureSlug } from "./lyrics-viewer-fixture.mjs";

// 실제 RSC·React·빌드 CSS를 사용하고 외부 YouTube IFrame API만 제어한다.
export async function assertLyricsViewer(browser, baseUrl) {
  const origin = new URL(baseUrl);
  assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));
  const artifacts = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "lyrics-viewer-smoke");
  await mkdir(artifacts, { recursive: true });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 1024 },
  ]) {
    const context = await browser.newContext({
      viewport,
      reducedMotion: viewport.width === 390 ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.lyricsHarness = { time: 0, players: 0, seeks: [] };
      window.YT = {
        PlayerState: { PLAYING: 1 },
        Player: function (_element, options) {
          window.lyricsHarness.players++;
          this.getCurrentTime = () => window.lyricsHarness.time;
          this.getDuration = () => 120;
          this.getVideoData = () => ({ video_id: options.videoId });
          this.getPlayerState = () => 1;
          this.seekTo = (time) => {
            window.lyricsHarness.time = time;
            window.lyricsHarness.seeks.push(time);
          };
          this.destroy = () => {};
          this.playVideo = () => options.events.onStateChange({ data: 1, target: this });
          setTimeout(() => options.events.onReady({ target: this }), 0);
        },
      };
    });
    try {
      assert.equal((await page.goto(new URL(`/songs/${fixtureSlug}`, origin).href)).status(), 200);
      const play = page.getByRole("button", { name: "영상 재생", exact: true });
      await expect(play).toBeEnabled();
      const region = page.getByRole("region", { name: "응원법 가사" });
      const lines = region.getByRole("button");
      await expect(lines).toHaveCount(fixtureLyrics.length);
      const appearance = (line) =>
        line.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            background: style.backgroundColor,
            marker: style.boxShadow,
            colors: [...el.querySelectorAll(":scope > span > span")].map(
              (seg) => getComputedStyle(seg).color,
            ),
          };
        });
      const inactive = await Promise.all([0, 1, 2, 3].map((index) => appearance(lines.nth(index))));
      await play.click();
      // 색상 문구만 있는 줄부터 검사해 aria-current만 올바른 회귀도 검출한다.
      for (const index of [2, 1, 0, 3]) {
        await page.evaluate((time) => {
          window.lyricsHarness.time = time;
        }, fixtureLyrics[index].startTime + 0.1);
        await expect(lines.nth(index)).toHaveAttribute("aria-current", "true");
        await expect(region.locator('[aria-current="true"]')).toHaveCount(1);
        await expect
          .poll(async () => (await appearance(lines.nth(index))).background, {
            message: `Cue ${index}: current row needs a visible background`,
          })
          .not.toBe(inactive[index].background);
        const active = await appearance(lines.nth(index));
        assert.notEqual(
          active.marker,
          inactive[index].marker,
          `Cue ${index}: current row needs a visible marker`,
        );
        if (index !== 0)
          assert.deepEqual(
            active.colors,
            inactive[index].colors,
            "Semantic cue colors must remain stable",
          );
      }
      const nameCall = lines.nth(3).locator(":scope > span > span");
      await expect(nameCall.nth(0)).toHaveCSS("text-decoration-line", "underline");
      await page.evaluate(() => {
        window.lyricsHarness.time = 8.1;
      });
      await expect(nameCall.nth(1)).toHaveCSS("text-decoration-line", "underline");
      await expect(nameCall.nth(0)).toHaveCSS("text-decoration-line", "none");
      await page.evaluate(() => {
        window.lyricsHarness.time = 25.1;
      });
      await expect(lines.last()).toHaveAttribute("aria-current", "true");
      await expect.poll(() => region.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
      await expect(lines.last()).toBeInViewport();
      await expect
        .poll(() => lines.nth(2).evaluate((el) => getComputedStyle(el).boxShadow))
        .toBe(inactive[2].marker);
      await page.getByRole("radio", { name: "페스티벌", exact: true }).focus();
      await page.keyboard.press("Space");
      await expect(page.getByRole("radio", { name: "페스티벌", exact: true })).toBeChecked();
      await expect(lines.last()).toHaveAttribute("aria-current", "true");
      assert.deepEqual(
        await page.evaluate(() => ({
          players: window.lyricsHarness.players,
          seeks: window.lyricsHarness.seeks,
        })),
        { players: 1, seeks: [] },
        "Mode switch must keep the player and time",
      );
      await lines.nth(2).focus();
      await page.keyboard.press("Enter");
      await expect(lines.nth(2)).toHaveAttribute("aria-current", "true");
      assert.deepEqual(await page.evaluate(() => window.lyricsHarness.seeks), [5]);
      assert.deepEqual(errors, [], "Lyrics browser runtime errors");
      await page.screenshot({ path: path.join(artifacts, `passed-${viewport.width}.png`) });
      await writeFile(
        path.join(artifacts, `passed-${viewport.width}.json`),
        JSON.stringify(
          { viewport, inactive, active: await appearance(lines.nth(2)), errors },
          null,
          2,
        ),
      );
    } catch (error) {
      await page.screenshot({ path: path.join(artifacts, `failed-${viewport.width}.png`) });
      throw error;
    } finally {
      await context.close();
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const browser = await chromium.launch();
  try {
    await assertLyricsViewer(browser, process.argv[2]);
  } finally {
    await browser.close();
  }
  console.log(
    "Lyrics viewer harness passed: visible current cues, semantic colors, segment timing, scroll, seek and mode continuity",
  );
}
