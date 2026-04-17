import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface TransitionDialogProps {
  open: boolean;
  title: string;
  description: string;
  inputLabel: string;
  inputRequired: boolean;
  confirmLabel: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export function TransitionDialog({
  open,
  title,
  description,
  inputLabel,
  inputRequired,
  confirmLabel,
  onConfirm,
  onCancel,
}: TransitionDialogProps): React.ReactElement {
  const [text, setText] = useState('');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen): void => {
        if (!isOpen) {
          setText('');
          onCancel();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e): void => {
            setText(e.target.value);
          }}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none resize-y min-h-[80px]"
          placeholder={inputLabel}
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={(): void => {
              setText('');
              onCancel();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={(): void => {
              onConfirm(text);
              setText('');
            }}
            disabled={inputRequired && !text.trim()}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
