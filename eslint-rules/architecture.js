import path from "node:path";

const PROJECT_LAYERS = new Set(["app", "widgets", "features", "entities", "shared", "server"]);
const SLICED_LAYERS = new Set(["widgets", "features", "entities"]);
const SLICE_SEGMENTS = new Set(["ui", "model", "api", "lib", "config"]);
const ROUTE_SEGMENTS = new Set(["_ui", "_model", "_lib", "_config"]);

function getSourceParts(filename) {
  const normalized = filename.split(path.sep).join("/");
  const marker = "/src/";
  const index = normalized.lastIndexOf(marker);

  return index === -1 ? null : normalized.slice(index + marker.length).split("/");
}

function isHookFile(filename) {
  return /^use(?:-|[A-Z]).*\.tsx?$/.test(filename);
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
        "shared segment '{{segment}}'은 허용되지 않습니다. ui/model/api/lib/config 중 책임에 맞게 이동하세요.",
      deepSliceImport:
        "승격된 slice 내부를 직접 import하지 마세요. '{{layer}}/{{slice}}'의 index.ts public API를 사용하세요.",
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

        if (layer === "shared" && slice && !SLICE_SEGMENTS.has(slice)) {
          reportAtProgram("invalidSharedSegment", { segment: slice });
        }
      },

      ImportDeclaration(node) {
        const source = node.source.value;

        if (typeof source !== "string") return;

        const match = source.match(/^@\/(widgets|features|entities)\/([^/]+)\/(.+)$/);

        if (match) {
          context.report({
            node: node.source,
            messageId: "deepSliceImport",
            data: { layer: match[1], slice: match[2] },
          });
        }
      },
    };
  },
};
