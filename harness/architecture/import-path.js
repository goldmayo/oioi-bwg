import path from "node:path";

export function getSourceParts(filename) {
  const normalized = filename.split(path.sep).join("/");
  const marker = "/src/";
  const index = normalized.lastIndexOf(marker);

  return index === -1 ? null : normalized.slice(index + marker.length).split("/");
}

export function resolveImportedParts(sourceParts, importPath) {
  if (importPath.startsWith("@/")) {
    return importPath.slice(2).split("/");
  }

  if (!importPath.startsWith(".")) return null;

  return path.posix.normalize(path.posix.join(...sourceParts.slice(0, -1), importPath)).split("/");
}
