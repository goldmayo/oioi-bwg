import path from "node:path";

/** Each app validates this shared policy against its own NextConfig type. */
export function createNextConfig(appDirectory: string) {
  return {
    output: "standalone" as const,
    transpilePackages: ["@oioi-bwg/contracts", "@oioi-bwg/server"],
    outputFileTracingRoot: path.resolve(appDirectory, "../.."),
    experimental: {
      turbopackFileSystemCacheForBuild: process.env.OIOI_EPHEMERAL_BUILD !== "true",
    },
    reactCompiler: true,
    allowedDevOrigins: ["localhost", "127.0.0.1"],
    images: {
      unoptimized: true,
      remotePatterns: [
        {
          protocol: "https" as const,
          hostname: "assets.oioibawige.com",
          port: "",
          pathname: "/**",
        },
      ],
    },
    logging: {
      fetches: {
        fullUrl: true,
      },
    },
    serverExternalPackages: ["postgres"],
  };
}
