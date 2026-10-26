import {
  guideImportFailure,
  parseGuideImportArguments,
  runGuideImport,
} from "../tools/repository/src/operators/import-cheer-guides";
import { loadLocalDatabaseUrl } from "./local-database-environment";

try {
  const request = parseGuideImportArguments(process.argv.slice(2));
  process.env.DATABASE_URL = loadLocalDatabaseUrl(request.envArgs);
  const result = await runGuideImport(request);
  console.log(JSON.stringify({ success: true, ...result }));
} catch (error) {
  console.error(JSON.stringify({ success: false, code: guideImportFailure(error) }));
  process.exitCode = 1;
}
