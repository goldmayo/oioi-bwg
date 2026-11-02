import { CircleCheckBig, Lock } from "lucide-react";

export function VisibilityIcon({ visible }: { visible: boolean }) {
  const label = visible ? "공개" : "비공개";
  const Icon = visible ? CircleCheckBig : Lock;
  return (
    <span title={label} className="inline-flex items-center justify-center align-middle">
      <Icon
        role="img"
        aria-label={label}
        className={visible ? "text-success size-4" : "text-warning size-4"}
      />
    </span>
  );
}
