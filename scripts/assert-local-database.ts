import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const { hostname } = new URL(databaseUrl);
const allowedHosts = new Set(["localhost", "127.0.0.1", "postgres"]);

if (!allowedHosts.has(hostname)) {
  throw new Error(
    `Refusing database operation for non-local host: ${hostname}. Local DB operations only.`,
  );
}

console.log(`Local database guard passed: ${hostname}`);
