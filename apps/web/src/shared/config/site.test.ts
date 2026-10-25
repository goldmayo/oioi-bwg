import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Web metadata environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(["development", "production"] as const)(
    "uses localhost for local metadata with NODE_ENV=%s",
    async (nodeEnvironment) => {
      vi.stubEnv("NODE_ENV", nodeEnvironment);
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
      const { DEFAULT_METADATA } = await import("./site");
      const { constructMetadata } = await import("../lib/metadata");

      expect(new URL(String(DEFAULT_METADATA.metadataBase)).href).toBe("http://localhost:3000/");
      expect(DEFAULT_METADATA.openGraph).toMatchObject({ url: "http://localhost:3000" });
      expect(constructMetadata().metadataBase?.toString()).toBe("http://localhost:3000/");
    },
  );

  it.each(["staging", "production", "development", "unexpected", "", undefined])(
    "uses the www public metadata URL for %s",
    async (appEnvironment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
      const { DEFAULT_METADATA } = await import("./site");
      const { constructMetadata } = await import("../lib/metadata");

      expect(new URL(String(DEFAULT_METADATA.metadataBase)).href).toBe(
        "https://www.oioibawige.com/",
      );
      expect(DEFAULT_METADATA.openGraph).toMatchObject({ url: "https://www.oioibawige.com" });
      expect(constructMetadata().metadataBase?.toString()).toBe("https://www.oioibawige.com/");
    },
  );
});

describe("public page SEO metadata", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  it("keeps canonical, OG identity and the persisted album image together", async () => {
    const { constructMetadata } = await import("../lib/metadata");
    const metadata = constructMetadata({
      title: "QWER 고민중독 응원법",
      path: "/songs/tbh",
      image: "https://assets.oioibawige.com/images/albums/persisted-id.webp",
    });
    expect(metadata.alternates).toEqual({ canonical: "https://www.oioibawige.com/songs/tbh" });
    expect(metadata.openGraph).toMatchObject({
      title: "QWER 고민중독 응원법 | 어이어이바위게",
      url: "https://www.oioibawige.com/songs/tbh",
      siteName: "어이어이바위게",
      type: "website",
      locale: "ko_KR",
      images: [{ url: "https://assets.oioibawige.com/images/albums/persisted-id.webp" }],
    });
    expect(metadata.twitter).not.toHaveProperty("creator");
  });

  it("uses the existing public R2 OG image and Korean brand in titles", async () => {
    const { SITE_CONFIG, DEFAULT_METADATA } = await import("./site");
    expect(SITE_CONFIG.ogImage).toBe("https://assets.oioibawige.com/images/og_oioibawige.webp");
    expect(DEFAULT_METADATA.title).toMatchObject({ template: "%s | 어이어이바위게" });
  });
});
