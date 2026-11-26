"use client";
import type { RefObject } from "react";
import type { UseFormReturn } from "react-hook-form";
import { CircleHelp, Headphones, RotateCcw } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { cueKinds, type PreviewCue, previewDuration } from "../_model/preview-data";
import type { Draft } from "../_model/use-preview-editor";
export function PreviewInspector({
  form,
  selected,
  cue,
  inspector,
  restoreDraft,
  resetDraft,
}: {
  form: UseFormReturn<Draft>;
  selected: number;
  cue: PreviewCue;
  inspector: RefObject<HTMLElement | null>;
  restoreDraft: () => void;
  resetDraft: () => void;
}) {
  return (
    <aside className="oioi-inspector" ref={inspector} aria-labelledby="oioi-inspector-title">
      <div className="oioi-panel-heading">
        <h2 id="oioi-inspector-title">선택 구간</h2>
        <span className="oioi-muted">{String(selected + 1).padStart(2, "0")}</span>
      </div>
      <div className="oioi-inspector-form">
        <label className="oioi-field">
          응원 문구
          <textarea
            {...form.register(`cues.${selected}.text`, {
              required: "응원 문구를 입력해 주세요.",
              validate: (value) => value.trim().length > 0 || "응원 문구를 입력해 주세요.",
              maxLength: { value: 200, message: "200자 이내로 입력해 주세요." },
            })}
            aria-invalid={!!form.formState.errors.cues?.[selected]?.text}
            aria-describedby="oioi-text-error"
            rows={3}
          />
          <span id="oioi-text-error" className="oioi-error">
            {form.formState.errors.cues?.[selected]?.text?.message}
          </span>
        </label>
        <label className="oioi-field">
          시작 시간 <span className="oioi-muted">초</span>
          <input
            type="number"
            step="0.01"
            {...form.register(`cues.${selected}.time`, {
              valueAsNumber: true,
              required: "시작 시간을 입력해 주세요.",
              min: { value: 0, message: "0초 이상으로 입력해 주세요." },
              max: {
                value: previewDuration,
                message: `${previewDuration}초 예시 범위 이내로 입력해 주세요.`,
              },
            })}
            aria-invalid={!!form.formState.errors.cues?.[selected]?.time}
            aria-describedby="oioi-time-error"
          />
          <span id="oioi-time-error" className="oioi-error">
            {form.formState.errors.cues?.[selected]?.time?.message}
          </span>
        </label>
        <div className="oioi-time-adjust">
          <Button
            variant="secondary"
            className="oioi-button"
            onClick={() =>
              form.setValue(
                `cues.${selected}.time`,
                Math.min(previewDuration, Math.max(0, Math.round((cue.time - 0.01) * 1000) / 1000)),
                { shouldDirty: true },
              )
            }
          >
            −10 ms
          </Button>
          <Button
            variant="secondary"
            className="oioi-button"
            onClick={() =>
              form.setValue(
                `cues.${selected}.time`,
                Math.min(previewDuration, Math.max(0, Math.round((cue.time + 0.01) * 1000) / 1000)),
                {
                  shouldDirty: true,
                },
              )
            }
          >
            +10 ms
          </Button>
        </div>
        <label className="oioi-field">
          구간 유형
          <select {...form.register(`cues.${selected}.kind`)}>
            {cueKinds.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <p className="oioi-inspector-help">
          <CircleHelp size={14} /> 문구와 시작 시간은 작업본 저장 시 함께 반영됩니다.
        </p>
      </div>
      <div className="oioi-reference">
        <Headphones size={16} />
        <div>
          <strong>기준 영상</strong>
          <p>타이밍 검토용 예시 구간</p>
          <span className="oioi-muted">실제 영상·음원 연결 전</span>
        </div>
      </div>
      <div className="oioi-inspector-bottom">
        <Button variant="ghost" className="oioi-button" onClick={restoreDraft}>
          저장본 불러오기
        </Button>
        <Button variant="ghost" className="oioi-button" onClick={resetDraft}>
          <RotateCcw /> 예시 초기화
        </Button>
      </div>
    </aside>
  );
}
