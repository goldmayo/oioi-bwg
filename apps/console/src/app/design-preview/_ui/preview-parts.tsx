import { AudioLines, BadgeCheck, Users } from "lucide-react";
import Image from "next/image";

export function PreviewBrand({ consoleLabel = false }: { consoleLabel?: boolean }) {
  return (
    <span className="oioi-brand">
      <AudioLines aria-hidden="true" />
      <span>
        어이어이바위게<small>{consoleLabel ? "Console" : "응원은 자유롭게"}</small>
      </span>
    </span>
  );
}
export function AlbumArtwork({ album, size = 40 }: { album: string; size?: number }) {
  return (
    <Image
      className="oioi-artwork"
      src={`/design-preview/albums/${album}.webp`}
      alt=""
      width={size}
      height={size}
    />
  );
}
export function SourceBadge({ source }: { source: string }) {
  const Icon = source === "공식" ? BadgeCheck : Users;
  return (
    <span className={`oioi-badge ${source === "공식" ? "oioi-badge-info" : ""}`}>
      <Icon size={13} aria-hidden="true" />
      {source}
    </span>
  );
}
