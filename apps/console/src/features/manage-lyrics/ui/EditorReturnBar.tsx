import { ArrowLeft } from "lucide-react";

import { Button } from "@/shared/ui/button";

import type { EditorReturnTarget } from "../model/types";

export function EditorReturnBar({ target }: { target: EditorReturnTarget }) {
  return (
    <div className="border-border flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 text-sm">
      <Button asChild variant="outline" size="sm">
        <a href={target.href}>
          <ArrowLeft />
          {target.label}
        </a>
      </Button>
      {target.description && <p className="text-muted-foreground">{target.description}</p>}
    </div>
  );
}
