import { useId, useState } from "react";
import type { PublishedCheerGuide } from "@oioi-bwg/contracts/song";
import { ChevronDown, ExternalLink, Share2 } from "lucide-react";
import Link from "next/link";

const modeCopy = {
  CONCERT: { label: "콘서트", description: "네임콜부터 떼창까지, 응원법을 함께 즐겨요." },
  FESTIVAL: { label: "페스티벌", description: "쉽게 따라 할 수 있는 네임콜과 떼창 위주로 즐겨요." },
};
const iconClass =
  "text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-ring inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50";

export function CheerGuideInfo({
  guides,
  selected,
  onSelect,
  title,
  album,
  onShare,
  isSharing,
}: {
  guides: PublishedCheerGuide[];
  selected?: PublishedCheerGuide;
  onSelect: (id: string) => void;
  title: string;
  album?: { name: string; imageSlug: string };
  onShare: () => void;
  isSharing: boolean;
}) {
  const name = useId();
  const informationId = useId();
  const [expanded, setExpanded] = useState(false);
  const sourceLabel = selected?.sourceType === "OFFICIAL" ? "공식" : "팬덤";
  const links = [
    ...(selected?.guideVideoUrl
      ? [{ url: selected.guideVideoUrl, label: "응원법 영상 보기" }]
      : []),
    ...(selected?.sourceUrl && selected.sourceUrl !== selected.guideVideoUrl
      ? [{ url: selected.sourceUrl, label: "원본 보기" }]
      : []),
  ];
  return (
    <div className="px-4 pt-2 pb-2.5 md:px-6 md:pt-3.5 md:pb-4.5">
      <div className="flex min-h-11 items-center gap-1">
        <h1 className="min-w-0 flex-1 text-xl leading-tight font-bold tracking-tight text-balance wrap-anywhere md:text-2xl">
          {title}
        </h1>
        <button
          type="button"
          className={iconClass}
          aria-label="곡과 응원법 정보"
          aria-expanded={expanded}
          aria-controls={informationId}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown className={expanded ? "size-5 rotate-180" : "size-5"} />
        </button>
      </div>
      <div className="-mt-1 -mb-1.5 flex min-h-11 items-center gap-3 text-[13px]">
        {guides.length > 1 ? (
          <fieldset className="flex min-w-0 flex-wrap gap-3">
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
                  checked={guide.id === selected?.id}
                  onChange={() => onSelect(guide.id)}
                />
                <span className="text-muted-foreground peer-checked:text-foreground peer-focus-visible:outline-ring inline-flex min-h-11 items-center underline-offset-4 peer-checked:underline peer-focus-visible:outline-2">
                  {modeCopy[guide.mode].label}
                </span>
              </label>
            ))}
          </fieldset>
        ) : selected ? (
          <span title={modeCopy[selected.mode].description}>{modeCopy[selected.mode].label}</span>
        ) : null}
        {selected && (
          <span
            className="text-muted-foreground text-xs"
            title={
              selected.sourceType === "OFFICIAL"
                ? "공식 응원법이에요."
                : "팬들 사이에서 자연스럽게 생겨난 응원법이에요."
            }
          >
            {sourceLabel}
          </span>
        )}
        <button
          type="button"
          className={`${iconClass} -ml-2`}
          onClick={onShare}
          aria-label="공유하기"
          title="공유하기"
          disabled={isSharing}
        >
          <Share2 className="size-3.5" />
        </button>
      </div>
      <div
        id={informationId}
        hidden={!expanded}
        className="max-h-42 overflow-y-auto pt-2 text-[13px] leading-relaxed"
      >
        {album && (
          <Link
            href={`/albums/${album.imageSlug}`}
            className="text-muted-foreground focus-visible:outline-ring flex min-h-9 items-center hover:underline focus-visible:outline-2"
          >
            QWER · {album.name}
          </Link>
        )}
        {links.map(({ url, label }) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-visible:outline-ring flex min-h-9 w-fit items-center gap-1.5 underline underline-offset-4 focus-visible:outline-2"
          >
            {label}
            <ExternalLink className="size-3.5" />
          </a>
        ))}
        {selected?.description && (
          <p className="text-muted-foreground pt-2 break-words whitespace-pre-wrap">
            {selected.description}
          </p>
        )}
      </div>
    </div>
  );
}
