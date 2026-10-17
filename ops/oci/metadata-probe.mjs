import http from "node:http";

async function probe() {
  const results = [];
  for (const path of JSON.parse(process.argv[2])) {
    results.push(
      await new Promise((resolve) => {
        const request = http.get(
          {
            host: "169.254.169.254",
            path,
            headers: { Authorization: "Bearer Oracle" },
          },
          (response) => {
            response.destroy();
            resolve(false);
          },
        );
        const timer = setTimeout(
          () => request.destroy(Object.assign(new Error(), { code: "ETIMEDOUT" })),
          3000,
        );
        request.on("close", () => clearTimeout(timer));
        request.on("error", (error) =>
          resolve(
            ["ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENETUNREACH"].includes(error.code),
          ),
        );
      }),
    );
  }
  process.stdout.write(JSON.stringify({ blocked: results.every(Boolean) }));
}

probe().catch(() => process.exit(1));
