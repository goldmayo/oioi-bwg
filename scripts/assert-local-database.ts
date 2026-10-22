import { loadLocalDatabaseUrl } from "./local-database-environment";

const { hostname } = new URL(loadLocalDatabaseUrl(process.argv.slice(2)));
console.log(`Local database guard passed: ${hostname}`);
