import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const origin = process.env.PREVIEW_URL ?? "http://127.0.0.1:3101";
const out = resolve(process.argv[2] ?? ".local/design-preview");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
const captures = [];
const checks = [];
try {
  for (const width of process.env.PREVIEW_CAPTURE === "0" ? [] : [1440, 1280, 768, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 390 ? 844 : 1000 },
      reducedMotion: "reduce",
    });
    page.on("pageerror", (error) => errors.push(error.message));
    for (const theme of ["dark", "light"]) {
      for (const screen of ["editor", "songs", "guide"]) {
        await page.goto(`${origin}/design-preview?screen=${screen}&theme=${theme}`, {
          waitUntil: "networkidle",
        });
        await page.locator(".oioi-preview-bar").waitFor();
        for (const artwork of await page.locator("img:visible").all()) {
          await artwork.scrollIntoViewIfNeeded();
          await artwork.evaluate((image) => image.decode());
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        const overflowing = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        assert.equal(overflowing, false, `${screen}/${theme}/${width}: document overflow`);
        const brokenImages = await page
          .locator("img:visible")
          .evaluateAll(
            (images) =>
              images.filter((image) => !image.complete || image.naturalWidth === 0).length,
          );
        assert.equal(brokenImages, 0, `${screen}/${theme}/${width}: artwork loading`);
        const name = `${screen}-${theme}-${width}.png`;
        await page.screenshot({ path: resolve(out, name), fullPage: true });
        captures.push(name);
      }
    }
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/design-preview?screen=songs`, { waitUntil: "networkidle" });
  await page.getByRole("textbox", { name: "곡명 또는 앨범명 검색" }).fill("고민중독");
  await page.waitForURL(/q=/);
  assert.equal(await page.locator(".oioi-catalog-row").count(), 1);
  await page.locator(".oioi-catalog-row").click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("textbox", { name: "곡명 또는 앨범명 검색" }).fill("없는곡검색");
  await page.getByRole("heading", { name: "찾는 곡이 없어요." }).waitFor();
  await page.getByRole("button", { name: "검색 조건 초기화", exact: true }).click();
  await page.waitForURL((url) => !url.searchParams.has("q"));
  assert.equal(await page.locator(".oioi-catalog-row").count(), 12);
  checks.push("곡명 검색·상세 열기·Escape 닫기·빈 결과·조건 초기화");

  await page.getByRole("button", { name: "콘서트", exact: true }).click();
  await page.waitForURL(/mode=/);
  assert.equal(await page.locator(".oioi-catalog-row").count(), 8);
  await page.getByLabel("응원법 출처").selectOption("공식");
  await page.waitForURL(/source=/);
  assert.equal(await page.locator(".oioi-catalog-row").count(), 2);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".oioi-catalog-row").count(), 2);
  checks.push("공연 종류·출처 필터와 URL·새로고침 상태 보존");

  await page.goto(`${origin}/design-preview?screen=editor`, { waitUntil: "networkidle" });
  const row = page.locator(".oioi-lyric-row").nth(4);
  const selectedFill = await row.evaluate((element) => getComputedStyle(element).backgroundColor);
  await row.hover();
  assert.equal(
    await row.evaluate((element) => getComputedStyle(element).backgroundColor),
    selectedFill,
  );
  await page.getByRole("textbox", { name: "응원 문구" }).fill("함께 외쳐요!");
  assert.match(await row.innerText(), /함께 외쳐요!/);
  await page.getByRole("button", { name: "+10 ms", exact: true }).click();
  assert.match(await row.innerText(), /00:14.270/);
  await page.getByRole("button", { name: "작업본 저장", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "이 탭에 저장" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "저장본 불러오기", exact: true }).click();
  assert.match(await page.locator(".oioi-lyric-row").nth(4).innerText(), /함께 외쳐요!/);
  checks.push("선택 호버 유지·문구와 시간 편집·탭 저장·새로고침 후 복원");
  await page.getByRole("button", { name: "모의 재생 시작", exact: true }).click();
  await page.getByRole("button", { name: "모의 재생 일시정지", exact: true }).waitFor();
  await page.getByRole("button", { name: "모의 재생 일시정지", exact: true }).click();
  await page.getByRole("button", { name: "미리보기", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "미리보기", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.getByRole("button", { name: "구간 추가", exact: true }).click();
  assert.equal(await page.locator(".oioi-lyric-row").count(), 9);
  const timeField = page.getByRole("spinbutton", { name: /시작 시간/ });
  await timeField.fill("30");
  await page.getByRole("button", { name: "작업본 저장", exact: true }).click();
  await page.getByText("28초 예시 범위 이내로 입력해 주세요.", { exact: true }).waitFor();
  await timeField.fill("28");
  await page.getByRole("button", { name: "+10 ms", exact: true }).click();
  assert.equal(await timeField.inputValue(), "28");
  checks.push("시간 범위 밖 저장 거절·28초 경계 증감 제한");
  await page.getByRole("textbox", { name: "응원 문구" }).fill("");
  await page.getByRole("button", { name: "작업본 저장", exact: true }).click();
  await page.getByText("응원 문구를 입력해 주세요.", { exact: true }).waitFor();
  await page.screenshot({ path: resolve(out, "editor-error-1440.png"), fullPage: true });
  checks.push("모의 재생·미리보기·포커스 복귀·구간 추가·저장 검증 오류");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/design-preview?screen=songs`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "필터", exact: true }).click();
  await page
    .getByRole("dialog")
    .evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
  const closeTarget = await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close" })
    .boundingBox();
  assert.ok(closeTarget.width >= 44 && closeTarget.height >= 44);
  await page.getByRole("dialog").getByRole("combobox", { name: "필터 출처" }).selectOption("공식");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".oioi-catalog-row").count(), 12);
  await page.getByRole("button", { name: "필터", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox", { name: "필터 출처" }).selectOption("공식");
  await page.getByRole("button", { name: "필터 적용", exact: true }).click();
  await page.waitForURL(/source=/);
  assert.equal(await page.locator(".oioi-catalog-row").count(), 3);
  checks.push("모바일 필터 초안 취소·적용과 결과 반영");
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(out, "browser-report.json"),
    JSON.stringify({ captures, checks, errors }, null, 2),
  );
  console.log(JSON.stringify({ captures: captures.length, checks, errors }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ checks, errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}
