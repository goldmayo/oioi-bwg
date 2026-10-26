import { useId } from "react";
import type { PublishedCheerGuide } from "@oioi-bwg/contracts/song";

const modeCopy = {
  CONCERT: { label: "콘서트용", description: "네임콜부터 떼창까지, 응원법을 함께 즐겨요." },
  FESTIVAL: {
    label: "페스티벌용",
    description: "쉽게 따라 할 수 있는 네임콜과 떼창 위주로 즐겨요.",
  },
};
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
  return (
    <div className="space-y-3 pb-4">
      {guides.length > 1 ? (
        <fieldset className="flex gap-1 rounded-lg bg-white/10 p-1">
          <legend className="sr-only">응원법 종류</legend>
          {guides.map((guide) => (
            <label key={guide.id} className="min-w-0 flex-1 cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name={name}
                value={guide.id}
                checked={guide.id === selected.id}
                onChange={() => onSelect(guide.id)}
              />
              <span className="flex min-h-11 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold text-white/75 transition-colors peer-checked:bg-white peer-checked:text-black peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-white hover:bg-white/10 peer-checked:hover:bg-white">
                {modeCopy[guide.mode].label}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm font-semibold text-white">{modeCopy[selected.mode].label}</p>
      )}
      <p className="text-sm leading-relaxed text-white/75">{modeCopy[selected.mode].description}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="rounded-md bg-white/10 px-2 py-1 font-semibold text-white">
          {selected.sourceType === "OFFICIAL" ? "공식" : "팬덤"}
        </span>
        {selected.sourceUrl && (
          <a
            href={selected.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            원본 보기
          </a>
        )}
        {selected.guideVideoUrl && (
          <a
            href={selected.guideVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            응원법 영상 보기
          </a>
        )}
      </div>
    </div>
  );
}
