import { afterEach, describe, expect, it, vi } from "vitest";

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
    "preserves the existing public metadata URL for %s",
    async (appEnvironment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
      const { DEFAULT_METADATA } = await import("./site");
      const { constructMetadata } = await import("../lib/metadata");

      expect(new URL(String(DEFAULT_METADATA.metadataBase)).href).toBe("https://oioibawige.com/");
      expect(DEFAULT_METADATA.openGraph).toMatchObject({ url: "https://oioibawige.com" });
      expect(constructMetadata().metadataBase?.toString()).toBe("https://oioibawige.com/");
    },
  );
});
