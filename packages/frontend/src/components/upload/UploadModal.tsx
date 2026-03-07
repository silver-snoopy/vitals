import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AppleHealthUploader } from './AppleHealthUploader';

interface Props {
  trigger: React.ReactElement;
}

export function UploadModal({ trigger }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Base UI uses render prop instead of asChild */}
      <DialogTrigger render={trigger} />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Apple Health Data</DialogTitle>
        </DialogHeader>
        <AppleHealthUploader onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
