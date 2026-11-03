import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
}: {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onStay();
      }}
    >
      <DialogContent showCloseButton={false} role="alertdialog">
        <DialogHeader>
          <DialogTitle>변경 사항을 저장하지 않고 나갈까요?</DialogTitle>
          <DialogDescription>입력한 내용은 저장되지 않습니다.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onStay}>
            계속 편집
          </Button>
          <Button type="button" variant="destructive" onClick={onLeave}>
            저장하지 않고 나가기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
