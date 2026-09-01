import path from "node:path";

const PROJECT_LAYERS = new Set(["app", "widgets", "features", "entities", "shared", "server"]);
const SLICED_LAYERS = new Set(["widgets", "features", "entities"]);
const SLICE_SEGMENTS = new Set(["ui", "model", "api", "lib", "config"]);
const SHARED_SEGMENTS = new Set(["ui", "model", "api", "lib", "config", "contracts"]);
const ROUTE_SEGMENTS = new Set(["_ui", "_model", "_lib", "_config"]);

function getSourceParts(filename) {
  const normalized = filename.split(path.sep).join("/");
  const marker = "/src/";
  const index = normalized.lastIndexOf(marker);

  return index === -1 ? null : normalized.slice(index + marker.length).split("/");
}

function isHookFile(filename) {
  return /^use(?:-|[A-Z]).*\.[jt]sx?$/.test(filename);
}

function resolveImportedParts(sourceParts, importPath) {
  if (importPath.startsWith("@/")) {
    return importPath.slice(2).split("/");
  }

  if (!importPath.startsWith(".")) return null;

  return path.posix.normalize(path.posix.join(...sourceParts.slice(0, -1), importPath)).split("/");
}

function getPrivateRouteOwner(parts) {
  if (parts[0] !== "app") return null;

  const privateIndex = parts.findIndex((part, index) => index > 0 && part.startsWith("_"));

  return privateIndex === -1 ? null : parts.slice(0, privateIndex);
}

export const architectureRule = {
  meta: {
    type: "problem",
    docs: {
      description: "oioi-bwg의 FSD 및 Next App Router 배치 규칙을 검사합니다.",
    },
    schema: [],
    messages: {
      unknownLayer:
        "허용되지 않은 src 최상위 폴더 '{{layer}}'입니다. app/widgets/features/entities/shared/server 중 하나를 사용하세요.",
      invalidSliceRoot:
        "승격된 slice의 루트에는 public API인 index.ts만 둡니다. '{{file}}'은 ui/model/api/lib/config 중 책임에 맞는 segment로 이동하세요.",
      invalidSliceSegment:
        "FSD slice segment '{{segment}}'은 허용되지 않습니다. ui/model/api/lib/config만 사용하세요.",
      invalidHookSegment:
        "hook은 slice의 model 또는 lib segment에 둡니다. 현재 segment는 '{{segment}}'입니다.",
      invalidRouteSegment:
        "route-local private segment '{{segment}}'은 허용되지 않습니다. _ui/_model/_lib/_config만 사용하세요.",
      invalidRouteHookSegment:
        "route-local hook은 _model 또는 _lib segment에 둡니다. 현재 segment는 '{{segment}}'입니다.",
      invalidSharedSegment:
        "shared segment '{{segment}}'은 허용되지 않습니다. ui/model/api/lib/config/contracts 중 책임에 맞게 이동하세요.",
      deepSliceImport:
        "승격된 slice 내부를 직접 import하지 마세요. '{{layer}}/{{slice}}'의 index.ts public API를 사용하세요.",
      crossSliceImport:
        "같은 '{{layer}}' 레이어의 다른 slice('{{slice}}')를 참조하지 마세요. 공통 책임은 하위 레이어로 내리세요.",
      sameSliceAlias:
        "같은 slice 내부에서는 alias public API를 우회하지 말고 상대 경로를 사용하세요.",
      foreignRoutePrivateImport:
        "다른 route의 private segment를 import하지 마세요. 재사용이 필요하면 widgets/features/entities/shared로 승격하세요.",
      routePrivateAlias:
        "route private segment는 @/app alias로 import하지 말고 소유 route 안에서 상대 경로로만 사용하세요.",
    },
  },
  create(context) {
    const parts = getSourceParts(context.filename);

    if (!parts) return {};

    const [layer, slice, segment] = parts;
    const fileName = parts.at(-1) ?? "";

    const reportAtProgram = (messageId, data) => {
      context.report({ loc: { line: 1, column: 0 }, messageId, data });
    };

    const checkDependency = (sourceNode) => {
      const source = sourceNode?.value;

      if (typeof source !== "string") return;

      const importedParts = resolveImportedParts(parts, source);
      const [importedLayer, importedSlice] = importedParts ?? [];

      if (layer && slice && SLICED_LAYERS.has(layer) && importedLayer === layer && importedSlice) {
        if (importedSlice !== slice) {
          context.report({
            node: sourceNode,
            messageId: "crossSliceImport",
            data: { layer, slice: importedSlice },
          });
        } else if (source.startsWith("@/")) {
          context.report({ node: sourceNode, messageId: "sameSliceAlias" });
        }
      }

      const importedRouteOwner = importedParts ? getPrivateRouteOwner(importedParts) : null;

      if (importedRouteOwner) {
        if (source.startsWith("@/app/")) {
          context.report({ node: sourceNode, messageId: "routePrivateAlias" });
        } else {
          const ownsPrivateRoute = importedRouteOwner.every((part, index) => parts[index] === part);

          if (!ownsPrivateRoute) {
            context.report({ node: sourceNode, messageId: "foreignRoutePrivateImport" });
          }
        }
      }

      const match = source.match(/^@\/(widgets|features|entities)\/([^/]+)\/(.+)$/);

      const isSegmentPublicApi = match?.[3] === "api";

      if (match && !isSegmentPublicApi && !(layer === match[1] && slice === match[2])) {
        context.report({
          node: sourceNode,
          messageId: "deepSliceImport",
          data: { layer: match[1], slice: match[2] },
        });
      }
    };

    return {
      Program() {
        if (parts.length > 1 && layer && !PROJECT_LAYERS.has(layer)) {
          reportAtProgram("unknownLayer", { layer });
          return;
        }

        if (layer && SLICED_LAYERS.has(layer) && slice) {
          if (parts.length === 3 && fileName !== "index.ts") {
            reportAtProgram("invalidSliceRoot", { file: fileName });
          }

          if (parts.length > 3 && segment && !SLICE_SEGMENTS.has(segment)) {
            reportAtProgram("invalidSliceSegment", { segment });
          }

          if (
            parts.length > 3 &&
            segment &&
            isHookFile(fileName) &&
            !["model", "lib"].includes(segment)
          ) {
            reportAtProgram("invalidHookSegment", { segment });
          }
        }

        if (layer === "app") {
          const privateSegment = parts.slice(1, -1).find((part) => part.startsWith("_"));

          if (privateSegment && !ROUTE_SEGMENTS.has(privateSegment)) {
            reportAtProgram("invalidRouteSegment", { segment: privateSegment });
          }

          if (
            privateSegment &&
            isHookFile(fileName) &&
            !["_model", "_lib"].includes(privateSegment)
          ) {
            reportAtProgram("invalidRouteHookSegment", { segment: privateSegment });
          }
        }

        if (layer === "shared" && slice && !SHARED_SEGMENTS.has(slice)) {
          reportAtProgram("invalidSharedSegment", { segment: slice });
        }
      },

      ImportDeclaration(node) {
        checkDependency(node.source);
      },
      ExportNamedDeclaration(node) {
        checkDependency(node.source);
      },
      ExportAllDeclaration(node) {
        checkDependency(node.source);
      },
      ImportExpression(node) {
        checkDependency(node.source);
      },
    };
  },
};
