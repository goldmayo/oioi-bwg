import { useId } from "react";
import type { PublishedCheerGuide } from "@oioi-bwg/contracts/song";
import { Play } from "lucide-react";

const modeCopy = {
  CONCERT: { label: "콘서트", description: "네임콜부터 떼창까지, 응원법을 함께 즐겨요." },
  FESTIVAL: { label: "페스티벌", description: "쉽게 따라 할 수 있는 네임콜과 떼창 위주로 즐겨요." },
};
const badgeClass =
  "border-foreground/25 bg-foreground/10 text-foreground/90 rounded-md border px-3 py-1.5 text-sm font-medium";

export function CheerGuideInfo({
  guides,
  selected,
  onSelect,
}: {
  guides: PublishedCheerGuide[];
  selected: PublishedCheerGuide;
  onSelect: (id: string) => void;
}) {
  const name = useId();
  const sourceLabel = selected.sourceType === "OFFICIAL" ? "공식" : "팬덤";
  return (
    <div className="border-border border-t">
      <div className="flex min-h-16 items-center justify-between gap-3">
        {guides.length > 1 ? (
          <fieldset className="flex min-w-0 gap-6">
            <legend className="sr-only">응원법 종류</legend>
            {guides.map((guide) => (
              <label
                key={guide.id}
                className="cursor-pointer"
                title={modeCopy[guide.mode].description}
              >
                <input
                  className="peer sr-only"
                  type="radio"
                  name={name}
                  value={guide.id}
                  checked={guide.id === selected.id}
                  onChange={() => onSelect(guide.id)}
                />
                <span className="text-foreground/65 peer-checked:border-qwer-w peer-checked:text-foreground peer-focus-visible:outline-qwer-w hover:text-foreground flex min-h-12 items-center border-b-4 border-transparent pt-1 text-base font-bold transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 md:text-lg">
                  {modeCopy[guide.mode].label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : (
          <span
            className="border-qwer-w flex min-h-12 items-center border-b-4 pt-1 text-base font-bold md:text-lg"
            title={modeCopy[selected.mode].description}
          >
            {modeCopy[selected.mode].label}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {selected.guideVideoUrl && (
            <a
              href={selected.guideVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="응원법 영상 보기"
              title="응원법 영상 보기"
              className="text-foreground/80 hover:text-foreground focus-visible:outline-qwer-w inline-flex size-11 items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Play className="size-5" />
            </a>
          )}
          {selected.sourceUrl ? (
            <a
              href={selected.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${sourceLabel} 응원법 원본 보기`}
              title="원본 보기"
              className="focus-visible:outline-qwer-w inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <span className={badgeClass}>{sourceLabel}</span>
            </a>
          ) : (
            <span className={badgeClass} title="팬들 사이에서 자연스럽게 생겨난 응원법이에요.">
              {sourceLabel}
            </span>
          )}
        </div>
      </div>
      {selected.description && (
        <details className="text-foreground/75 pb-3 text-sm leading-relaxed">
          <summary className="focus-visible:outline-qwer-w flex min-h-11 cursor-pointer items-center focus-visible:outline-2">
            응원법 정보
          </summary>
          <p
            role="region"
            aria-label="응원법 설명"
            tabIndex={0}
            className="focus-visible:outline-qwer-w max-h-24 overflow-y-auto break-words whitespace-pre-wrap focus-visible:outline-2"
          >
            {selected.description}
          </p>
        </details>
      )}
    </div>
  );
}
