import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreatePointMarkerOptions, PointMarker } from "peaks.js";

/** 시안의 Cue 하단 라벨을 Peaks 공식 marker factory로 그린다. */
export function createCuePointMarker(options: CreatePointMarkerOptions): PointMarker {
  const line = new Line({ stroke: options.color, strokeWidth: 1 });
  const badge = new Rect({
    x: 5,
    height: 27,
    fill: "#202c35",
    stroke: options.color,
    strokeWidth: 1,
    cornerRadius: 4,
  });
  const label = new Text({
    x: 11,
    height: 20,
    text: options.point.labelText,
    fontFamily: options.fontFamily,
    fontSize: 11,
    fill: "#e4edf4",
    wrap: "none",
    ellipsis: true,
  });
  let group: Group | undefined;
  const fitToView = () => {
    const height = options.layer.getHeight();
    const width = Math.max(58, Math.min(160, (group?.getStage()?.width() ?? 800) / 8));
    line.points([0.5, 20, 0.5, height - 56]);
    badge.y(height - 53);
    badge.width(width);
    label.y(height - 45);
    label.width(width - 12);
  };
  return {
    init: (target) => {
      group = target as Group;
      group.add(line, badge, label);
      fitToView();
    },
    fitToView,
    update: (value) => {
      if (value.labelText !== undefined) label.text(value.labelText);
      if (value.color) {
        line.stroke(value.color);
        badge.stroke(value.color);
      }
    },
  };
}
