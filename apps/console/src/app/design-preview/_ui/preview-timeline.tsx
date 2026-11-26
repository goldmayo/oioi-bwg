"use client";
import {
  cueClass,
  cueKinds,
  formatTime,
  type PreviewCue,
  previewDuration,
} from "../_model/preview-data";
export function PreviewTimeline({
  cues,
  selected,
  position,
  onChooseCue,
}: {
  cues: PreviewCue[];
  selected: number;
  position: number;
  onChooseCue: (index: number) => void;
}) {
  return (
    <section className="oioi-timeline" aria-label="응원 타이밍 예시">
      <div className="oioi-timeline-heading">
        <h2>타임라인</h2>
        <span>예시 파형 · 모의 재생 · 0–{previewDuration}초</span>
        <span className="oioi-legend">
          <i className="oioi-cue-sing">떼창</i>
          <i className="oioi-cue-call">네임콜</i>
          <i className="oioi-cue-chant">추임새</i>
        </span>
      </div>
      <div className="oioi-timeline-scroll">
        <div className="oioi-timeline-canvas">
          <div className="oioi-ruler">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i}>{formatTime((i * previewDuration) / 7).slice(0, 5)}</span>
            ))}
          </div>
          <svg
            className="oioi-waveform"
            viewBox="0 0 800 60"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {Array.from({ length: 200 }, (_, i) => {
              const height = Math.round(6 + Math.abs(Math.sin(i * 0.67) * Math.cos(i * 0.13)) * 42);
              return (
                <rect key={i} x={i * 4} y={(60 - height) / 2} width="2" height={height} rx="1" />
              );
            })}
          </svg>
          {cueKinds.map((kind) => (
            <div className="oioi-timeline-lane" key={kind}>
              <span>{kind}</span>
              <div>
                {cues.map(
                  (item, index) =>
                    item.kind === kind && (
                      <button
                        key={index}
                        className={`oioi-timing-cue oioi-cue-${cueClass[kind]}`}
                        style={{
                          left: `${(item.time / previewDuration) * 100}%`,
                          transform:
                            item.time > previewDuration - 2 ? "translateX(-100%)" : undefined,
                          width: `${(Math.max(0.4, Math.min(4, (cues.filter((next) => next.kind === kind && next.time > item.time).sort((a, b) => a.time - b.time)[0]?.time ?? previewDuration) - item.time - 0.25)) / previewDuration) * 100}%`,
                        }}
                        title={item.text}
                        aria-pressed={selected === index}
                        aria-label={`${formatTime(item.time)} ${item.text} 구간 선택`}
                        onClick={() => onChooseCue(index)}
                      >
                        {item.text}
                      </button>
                    ),
                )}
              </div>
            </div>
          ))}
          <div
            className="oioi-playhead"
            style={{ left: `calc(68px + (100% - 68px) * ${position / previewDuration})` }}
            aria-hidden="true"
          >
            <span>{formatTime(position).slice(0, 5)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
